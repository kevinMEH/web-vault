import { after, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";

import config from "../config";


config.JWT_SECRET = "4B6576696E20697320636F6F6C";
config.DOMAIN = "Kevin";
config.PASSWORD_SALT = "ABC99288B9288B22A66F00E";


if(process.env.REDIS) {
    config.REDIS = true;
    console.log("Using Redis");
} else {
    console.log("Using in memory database");
}
const { cleanup } = await import("../src/cleanup");

const { verifyVaultPassword } = await import("../src/authentication/database");
const { changeVaultPassword, createNewVault, deleteVault } = await import("../src/vault");

describe("Vault tests", () => {
    it("Tests the creation, changing password, and deletion of a vault", async () => {
        await deleteVault("test-vault", true);

        assert(await createNewVault("test-vault", "Password123") === null);
        assert(await verifyVaultPassword("test-vault", "Password123"));
        assert(!await verifyVaultPassword("test-vault", "password321"));

        assert(await changeVaultPassword("test-vault", "NiceAndSecure123") === true);
        assert(await verifyVaultPassword("test-vault", "NiceAndSecure123"));
        assert(!await verifyVaultPassword("test-vault", "Password123"));

        // Make certain vault and logging directory actually created. Error will be
        // thrown by .access if the folders does not exist.
        await fs.access(path.join(process.cwd(), "vaults", "test-vault"));
        await fs.access(path.join(process.cwd(), "logs", "vaults", "test-vault"));
        
        await deleteVault("test-vault", true);

        try {
            await fs.access(path.join(process.cwd(), "vaults", "test-vault"));
            assert(false); // The vault somehow still exists after deletion.
        } catch(error) {
            const code = (error as NodeJS.ErrnoException).code;
            assert(code === "ENOENT");
        }
        
        assert(await changeVaultPassword("test-vault", "NonexistantVault123") === false);
    });
    
    it("Makes certain that bad vault names will return an error", async () => {
        let result = await createNewVault("../hello_world", "password");
        assert(result !== null);
        assert(result.code === "INVALID_NAME");
        
        result = await createNewVault("/hello_world", "password");
        assert(result !== null);
        assert(result.code === "INVALID_NAME");

        result = await createNewVault("/hello_world", "password");
        assert(result !== null);
        assert(result.code === "INVALID_NAME");

        result = await createNewVault("asdf/hello", "password");
        assert(result !== null);
        assert(result.code === "INVALID_NAME");
    });
    
    after(async () => {
        await cleanup();
    })
});