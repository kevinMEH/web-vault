import { after, describe, it } from "node:test";
import assert from "assert";


process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";


if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");
const { cleanup } = await import("../src/cleanup");

import JWT from "jwt-km";
import type { Header, Payload } from "jwt-km";
import type { VaultAccess } from "../src/authentication/vault_token";
const {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    _refreshVaultExpiration
} = await import("../src/authentication/vault_token");
const {
    _addOutdatedToken,
    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword,
    setAdminPassword,
    _verifyAdminPassword,
    deleteAdminPassword
} = await import("../src/authentication/database");

describe("Authentication tests", () => {
    describe("Testing database vault authentication functions (src/authentication/database.ts)", () => {
        it("Sets the password for a vault and checks if successful", async () => {
            await setVaultPassword("testing", "password123");
            assert(await verifyVaultPassword("testing", "password123"));
            assert(!await verifyVaultPassword("testing", "Password123"));
            assert(!await verifyVaultPassword("nonexistant", "password123"));
            await deleteVaultPassword("testing");
            assert(!await vaultExistsDatabase("testing"));
        });
        
        it("Tests the vaultExists function", async () => {
            await setVaultPassword("existing_peacefully", "password")
            assert(await vaultExistsDatabase("existing_peacefully"));
            assert(!await vaultExistsDatabase("nonexistant_vault"));
            await deleteVaultPassword("existing_peacefully");
            assert(!await vaultExistsDatabase("existing_peacefully"));
        });
    });
    
    describe("Testing database admin authentication functions (src/authentication/database.ts)", () => {
        it("Sets the password for an admin and checks if successful", async () => {
            await setAdminPassword("some_admin", "some_password");
            assert(await _verifyAdminPassword("some_admin", "some_password"));
            assert(!await _verifyAdminPassword("some_admin", "not_password"));
            assert(!await _verifyAdminPassword("nonexistant", "some_password"));
            await deleteAdminPassword("some_admin");
            assert(!await _verifyAdminPassword("some_admin", "some_password"));
        });
    });

    describe("Vault token authentication tests (src/authentication/vault_token.ts)", () => {
        it("Creates a new token and checks if successful by using the JWT class", async () => {
            await setVaultPassword("main_vault", "password");

            const token = await createToken("main_vault");
            assert(token !== null);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(payload.access?.length === 1);
            assert(payload.access[0].vault === "main_vault");
            const token2 = new JWT(process.env.DOMAIN as string, payload.exp, payload.iat)
                    .addClaim("access", [{
                        vault: "main_vault",
                        issuedAt: payload.access[0].issuedAt,
                        expiration: payload.access[0].expiration
                    }]).getToken(process.env.JWT_SECRET as string);
            assert(token === token2);
            assert(await getUnwrappedToken(token2) !== null);

            await deleteVaultPassword("main_vault");
        });
        
        it("Checks that expired tokens and bad tokens are not valid", async () => {
            await setVaultPassword("vault", "password");

            const token = await createToken("vault");
            assert(token !== null);
            assert(await getUnwrappedToken(token) !== null);
            assert(await getUnwrappedToken(token.substring(0, token.length - 1)) === null);
            
            // Taken from main tests. exp was at 1000000000 unix time (Sept 9, 2001) (A long time ago)
            const oldToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ";
            assert(await getUnwrappedToken(oldToken) === null);

            await deleteVaultPassword("vault");
        });
        
        it("Outdates a token", async () => {
            await setVaultPassword("log_me_out", "asdfasd");

            const token = await createToken("log_me_out");
            assert(token !== null);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
            await _addOutdatedToken(token, payload.exp as number);
            assert(await getUnwrappedToken(token) === null);

            await deleteVaultPassword("log_me_out");
        });
        
        it("Creates a new token based on an old token with new vault", async () => {
            await setVaultPassword("old_vault", "a--12n");
            await setVaultPassword("new_vault", "a--12n");

            const token = await createToken("old_vault");
            assert(token !== null);
            assert(await getUnwrappedToken(token) !== null);
            const newToken = await addNewVaultToToken(token, "new_vault");
            assert(newToken !== null);
            assert(await getUnwrappedToken(token) === null);
            const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(payload.access.some((access: VaultAccess) => access.vault === "old_vault"));
            assert(payload.access.some((access: VaultAccess) => access.vault === "new_vault"));
            
            await deleteVaultPassword("old_vault");
            await deleteVaultPassword("new_vault");
        });
        
        it("Creates a new token based on an old token with a vault removed", async () => {
            await setVaultPassword("remove_me", "asd2");

            const token = await createToken("remove_me");
            assert(token !== null);
            assert(await getUnwrappedToken(token) !== null);
            const newToken = await removeVaultFromToken(token, "remove_me");
            assert(newToken !== null);
            assert(await getUnwrappedToken(token) === null);
            const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(payload.access.length === 0);

            await deleteVaultPassword("remove_me");
        });
        
        it("Refreshes a token's expiration date", async () => {
            await setVaultPassword("unique_name", "asdfn");

            const token = await createToken("unique_name");
            assert(token !== null);
            assert(await getUnwrappedToken(token) !== null);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];

            await new Promise(resolve => setTimeout(resolve, 2000));
            const newToken = await _refreshVaultExpiration(token, "unique_name");

            assert(newToken !== null);
            assert(await getUnwrappedToken(token) === null);
            const [_newHeader, newPayload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(newPayload.exp > payload.exp);
            assert(newPayload.iat > payload.iat);
            
            await deleteVaultPassword("unique_name");
        });
        
        it("Changing a vault's password invalidates token as nonces change", async () => {
            await setVaultPassword("change my password", "first password");

            const token = await createToken("change my password");
            assert(token !== null);
            const unwrapped = await getUnwrappedToken(token);
            assert(unwrapped !== null);
            assert(unwrapped[1].access.length === 1);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            await setVaultPassword("change my password", "second password");

            const unwrappedAfter = await getUnwrappedToken(token);
            assert(unwrappedAfter !== null);
            assert(unwrappedAfter[1].access.length === 0);

            await deleteVaultPassword("change my password");
        });
    });

    after(async () => {
        await cleanup();
    });
});