import { after, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";

import { close } from "../src/authentication/redis.js";

async function shutdown() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");
    
    console.log("Done.");
}

process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";
if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");

const { verifyVaultPassword } = await import("../src/authentication.js");
const { changeVaultPassword, createNewVault, deleteVault } = await import("../src/vault.js");

describe("Vault tests", () => {
    it("Tests the creation, changing password, and deletion of a vault", async () => {
        await deleteVault("test-vault");

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
        
        assert((await deleteVault("test-vault")).length === 0);

        try {
            await fs.access(path.join(process.cwd(), "vaults", "test-vault"));
            assert(false); // The vault somehow still exists after deletion.
        } catch(error) {
            const message = (error as Error).message;
            assert(message.includes("no such file"));
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
        
        const results = await deleteVault("bad\\name");
        assert(results.some(error => error.code === "INVALID_NAME"));
    });
    
    it("Unsuccessfully delete nonexistant vault", async () => {
        const results = await deleteVault("nonexistant-vault");
        assert(results.some(error => error.code === "VAULT_NONEXISTANT"));
    });
    
    after(async () => {
        await shutdown();
    })
});