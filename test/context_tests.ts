import { after, describe, it } from "node:test";
import { asyncExpectError } from "./expect_error.js";
import assert from "assert";

import { close } from "../src/authentication/redis.js";

let status = 0;

async function shutdown() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");
    
    console.log("Done.");
}

process.on("SIGINT", shutdown);

import JWT from "../src/authentication/jwt.js";

process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";
if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");

const { isValidToken, createToken, addNewVaultToToken, removeVaultFromToken, outdateToken, refreshTokenExpiration, setVaultPassword, verifyVaultPassword, vaultExists, deleteVaultPassword } = await import("../src/authentication.js");

describe("Testing token authentication module", () => {
    it("Creates a new token and checks if successful by using the JWT class", () => {
        const token = createToken(["main_vault"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string);
        const token2 = new JWT(process.env.DOMAIN as string, payload.exp, payload.iat)
                .addClaim("vaults", ["main_vault"])
                .addClaim("nonce", payload.nonce)
                .getToken(process.env.JWT_SECRET);
        assert(token === token2);
        assert(isValidToken(token));
        assert(isValidToken(token2));
    });
    
    it("Checks that expired tokens and bad tokens are not valid", async () => {
        const token = createToken(["vault"]);
        assert(await isValidToken(token));
        assert(!await isValidToken(token.substring(0, token.length - 1)));
        
        // Taken from main tests. exp was at 1000000000 unix time (Sept 9, 2001) (A long time ago)
        const oldToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ";
        assert(!await isValidToken(oldToken));
    });
    
    it("Outdates a token", async () => {
        const token = createToken(["log_me_out"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string);
        outdateToken(token, payload.exp);
        assert(!await isValidToken(token));
    });
    
    it("Creates a new token based on an old token with new vault", () => {
        const token = createToken(["old_vault"]);
        const newToken = addNewVaultToToken(token, "new_vault");
        const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string);
        assert(payload.vaults.includes("old_vault"));
        assert(payload.vaults.includes("new_vault"));
    });
    
    it("Creates a new token based on an old token with a vault removed", () => {
        const token = createToken(["remove_me"]);
        const newToken = removeVaultFromToken(token, "remove_me");
        const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string);
        assert(!payload.vaults.includes("remove_me"));
        assert(!payload.vaults.includes("random"));
        assert(!payload.vaults.includes(""));
    });
    
    it("Refreshes a token's expiration date", async () => {
        const token = createToken(["log_me_out"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string);
        assert(await isValidToken(token));
        await new Promise(resolve => setTimeout(resolve, 2000));

        const newToken = refreshTokenExpiration(token);
        const [_newHeader, newPayload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string);
        assert(newPayload.exp > payload.exp);
        assert(newPayload.iat > payload.iat);
        assert(!await isValidToken(token));
    });
    
    after(() => status++);
});

// ------------------
// ------------------
// ------------------

describe("Testing vault authentication functions", () => {
    it("Sets the password for a vault and checks if successful", async () => {
        await setVaultPassword("testing", "password123");
        assert(await verifyVaultPassword("testing", "password123"));
        assert(!await verifyVaultPassword("testing", "Password123"));
        assert(!await verifyVaultPassword("nonexistant", "password123"));
        deleteVaultPassword("testing");
        assert(!await vaultExists("testing"));
    });
    
    it("Tests the vaultExists function", async () => {
        await setVaultPassword("existing_peacefully", "password")
        assert(await vaultExists("existing_peacefully"));
        assert(!await vaultExists("nonexistant_vault"));
        deleteVaultPassword("existing_peacefully");
        assert(!await vaultExists("existing_peacefully"));
    });
    
    after(() => status++);
});

// ------------------
// ------------------
// ------------------

import fs from "fs/promises";
import path from "path";
// Dynamic import because of environment variables
const { changeVaultPassword, createNewVault, deleteVault } = await import("../src/vault.js");

describe("Vault tests", () => {
    it("Tests the creation, changing password, and deletion of a vault", async () => {
        assert(await createNewVault("test-vault", "Password123") === true);
        assert(await verifyVaultPassword("test-vault", "Password123"));
        assert(!await verifyVaultPassword("test-vault", "password321"));

        assert(await changeVaultPassword("test-vault", "NiceAndSecure123") === true);
        assert(await verifyVaultPassword("test-vault", "NiceAndSecure123"));
        assert(!await verifyVaultPassword("test-vault", "Password123"));

        // Make certain vault and logging directory actually created. Error will be
        // thrown by .access if the folders does not exist.
        await fs.access(path.join(process.cwd(), "vaults", "test-vault"));
        await fs.access(path.join(process.cwd(), "logs", "vaults", "test-vault"));
        
        assert(await deleteVault("test-vault") === true);
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
        await asyncExpectError(async () => {
            await createNewVault("../hello_world", "password");
        }, "is not a valid vault name")();
        await asyncExpectError(async () => {
            await createNewVault("/hello_world", "password");
        }, "is not a valid vault name")();
        await asyncExpectError(async () => {
            await createNewVault("asdf/hello", "password");
        }, "is not a valid vault name")();
        
        await asyncExpectError(async () => {
            await deleteVault("bad\\name");
        }, "is not a valid vault name")();
    });
    
    it("Unsuccessfully delete nonexistant vault", async () => {
        assert(await deleteVault("nonexistant-vault") === false);
    });
    
    after(() => status++);
});

while(status !== 3) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();