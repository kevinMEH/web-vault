import { after, describe, it } from "node:test";
import assert from "assert";


process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";


if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");
const { cleanup } = await import("../src/cleanup");

const { default: JWT } = await import("../src/authentication/jwt");
import type { Header, Payload, Token } from "../src/authentication/jwt";
const { getUnwrappedToken, createToken, addNewVaultToToken, removeVaultFromToken, refreshTokenExpiration } = await import("../src/authentication");
const {
    addOutdatedToken,
    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword,
    setAdminPassword,
    verifyAdminPassword,
    deleteAdminPassword
} = await import("../src/authentication/database");

describe("Authentication tests", () => {
    describe("Testing token authentication module", () => {
        it("Creates a new token and checks if successful by using the JWT class", async () => {
            await setVaultPassword("main_vault", "password");
            const token = await createToken(["main_vault"]);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
            const token2 = new JWT(process.env.DOMAIN as string, payload.exp, payload.iat)
                    .addClaim("vaults", ["main_vault"])
                    .addClaim("nonces", [payload?.nonces[0]])
                    .getToken(process.env.JWT_SECRET);
            assert(token === token2);
            assert((await getUnwrappedToken(token))[0] !== null);
            assert((await getUnwrappedToken(token2))[0] !== null);
            await deleteVaultPassword("main_vault");
        });
        
        it("Checks that expired tokens and bad tokens are not valid", async () => {
            await setVaultPassword("vault", "password");
            const token = await createToken(["vault"]);
            assert((await getUnwrappedToken(token))[0] !== null);
            assert((await getUnwrappedToken(token.substring(0, token.length - 1) as Token))[0] === null);
            
            // Taken from main tests. exp was at 1000000000 unix time (Sept 9, 2001) (A long time ago)
            const oldToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ";
            assert((await getUnwrappedToken(oldToken as Token))[0] === null);
            await deleteVaultPassword("vault");
        });
        
        it("Outdates a token", async () => {
            await setVaultPassword("log_me_out", "asdfasd");
            const token = await createToken(["log_me_out"]);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
            addOutdatedToken(token, payload.exp);
            assert((await getUnwrappedToken(token))[0] === null);
            await deleteVaultPassword("log_me_out");
        });
        
        it("Creates a new token based on an old token with new vault", async () => {
            await setVaultPassword("old_vault", "a--12n");
            await setVaultPassword("new_vault", "a--12n");
            const token = await createToken(["old_vault"]);
            const unwrappedToken = await getUnwrappedToken(token) as any;
            const newToken = await addNewVaultToToken(unwrappedToken, "new_vault");
            const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(payload.vaults.includes("old_vault"));
            assert(payload.vaults.includes("new_vault"));
            await deleteVaultPassword("old_vault");
            await deleteVaultPassword("new_vault");
        });
        
        it("Creates a new token based on an old token with a vault removed", async () => {
            await setVaultPassword("remove_me", "asd2");
            const token = await createToken(["remove_me"]);
            const unwrappedToken = await getUnwrappedToken(token) as any;
            const newToken = await removeVaultFromToken(unwrappedToken, "remove_me");
            const [_header, payload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(!payload.vaults.includes("remove_me"));
            assert(!payload.vaults.includes("random"));
            assert(!payload.vaults.includes(""));
            await deleteVaultPassword("remove_me");
        });
        
        it("Refreshes a token's expiration date", async () => {
            await setVaultPassword("log_me_out", "asdfn");
            const token = await createToken(["log_me_out"]);
            const [_header, payload] = JWT.unwrap(token, process.env.JWT_SECRET as string) as [Header, Payload];
            const unwrappedToken = await getUnwrappedToken(token) as any;
            assert(unwrappedToken[0] !== null);
            await new Promise(resolve => setTimeout(resolve, 2000));

            const newToken = await refreshTokenExpiration(unwrappedToken);
            const [_newHeader, newPayload] = JWT.unwrap(newToken, process.env.JWT_SECRET as string) as [Header, Payload];
            assert(newPayload.exp > payload.exp);
            assert(newPayload.iat > payload.iat);
            assert((await getUnwrappedToken(token))[0] === null);
        });
        
        it("Changing a vault's password invalidates token as nonces change", async () => {
            await setVaultPassword("change my password", "first password");
            const token = await createToken(["change my password"]);
            const unwrapped = await getUnwrappedToken(token);
            assert(unwrapped[0] !== null);
            assert(unwrapped[1].vaults.length === 1);
            assert(unwrapped[1].nonces.length === 1);
            
            await setVaultPassword("change my password", "second password");
            const unwrappedAfter = await getUnwrappedToken(token);
            assert(unwrappedAfter[0] !== null);
            assert(unwrappedAfter[1].vaults.length === 0);
            assert(unwrappedAfter[1].nonces.length === 0);
            await deleteVaultPassword("change my password");
        });
    });

    describe("Testing vault authentication functions", () => {
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
    
    describe("Testing admin authentication functions", () => {
        it("Sets the password for an admin and checks if successful", async () => {
            await setAdminPassword("some_admin", "some_password");
            assert(await verifyAdminPassword("some_admin", "some_password"));
            assert(!await verifyAdminPassword("some_admin", "not_password"));
            assert(!await verifyAdminPassword("nonexistant", "some_password"));
            await deleteAdminPassword("some_admin");
            assert(!await verifyAdminPassword("some_admin", "some_password"));
        });
    });

    after(async () => {
        await cleanup();
    });
});