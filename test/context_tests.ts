import { after, describe, it } from "node:test";
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

import JWT, { Header, Payload, UnwrappedToken } from "../src/authentication/jwt.js";

process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";
if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");

const { getUnwrappedToken, createToken, addNewVaultToToken, removeVaultFromToken, outdateToken, refreshTokenExpiration, setVaultPassword, verifyVaultPassword, vaultExistsDatabase, deleteVaultPassword } = await import("../src/authentication.js");

describe("Testing token authentication module", () => {
    it("Creates a new token and checks if successful by using the JWT class", async () => {
        const token = createToken(["main_vault"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
        const token2 = new JWT(process.env.DOMAIN as string, payload.exp, payload.iat)
                .addClaim("vaults", ["main_vault"])
                .addClaim("nonce", payload.nonce)
                .getToken(process.env.JWT_SECRET);
        assert(token === token2);
        assert(await getUnwrappedToken(token) !== null);
        assert(await getUnwrappedToken(token2) !== null);
    });
    
    it("Checks that expired tokens and bad tokens are not valid", async () => {
        const token = createToken(["vault"]);
        assert(await getUnwrappedToken(token) !== null);
        assert(await getUnwrappedToken(token.substring(0, token.length - 1)) === null);
        
        // Taken from main tests. exp was at 1000000000 unix time (Sept 9, 2001) (A long time ago)
        const oldToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ";
        assert(await getUnwrappedToken(oldToken) === null);
    });
    
    it("Outdates a token", async () => {
        const token = createToken(["log_me_out"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
        outdateToken(token, payload.exp);
        assert(await getUnwrappedToken(token) === null);
    });
    
    it("Creates a new token based on an old token with new vault", async () => {
        const token = createToken(["old_vault"]);
        const unwrappedToken = await getUnwrappedToken(token) as UnwrappedToken;
        const newToken = addNewVaultToToken(unwrappedToken, "new_vault");
        const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
        assert(payload.vaults.includes("old_vault"));
        assert(payload.vaults.includes("new_vault"));
    });
    
    it("Creates a new token based on an old token with a vault removed", async () => {
        const token = createToken(["remove_me"]);
        const unwrappedToken = await getUnwrappedToken(token) as UnwrappedToken;
        const newToken = removeVaultFromToken(unwrappedToken, "remove_me");
        const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
        assert(!payload.vaults.includes("remove_me"));
        assert(!payload.vaults.includes("random"));
        assert(!payload.vaults.includes(""));
    });
    
    it("Refreshes a token's expiration date", async () => {
        const token = createToken(["log_me_out"]);
        const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
        const unwrappedToken = await getUnwrappedToken(token);
        assert(unwrappedToken !== null);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const newToken = refreshTokenExpiration(unwrappedToken);
        const [_newHeader, newPayload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
        assert(newPayload.exp > payload.exp);
        assert(newPayload.iat > payload.iat);
        assert(await getUnwrappedToken(token) === null);
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
        assert(!await vaultExistsDatabase("testing"));
    });
    
    it("Tests the vaultExists function", async () => {
        await setVaultPassword("existing_peacefully", "password")
        assert(await vaultExistsDatabase("existing_peacefully"));
        assert(!await vaultExistsDatabase("nonexistant_vault"));
        deleteVaultPassword("existing_peacefully");
        assert(!await vaultExistsDatabase("existing_peacefully"));
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
    
    after(() => status++);
});

while(status !== 3) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();