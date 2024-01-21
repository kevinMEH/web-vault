import { after, describe, it } from "node:test";
import assert from "assert";

import config from "../config";


config.TESTING = true;
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

import JWT, { unixTime } from "jwt-km";
import type { Header, Payload } from "jwt-km";
import type { VaultAccess } from "../src/authentication/vault_token";
const {
    _addOutdatedToken,
    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword,
    setAdminPassword,
    verifyAdminPassword,
    deleteAdminPassword,
    invalidAdminIssuingDate,
    resetAdminNonce
} = await import("../src/authentication/database");
const {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    _refreshVaultExpiration
} = await import("../src/authentication/vault_token");
const {
    vaultLogin,
    vaultLogout,
    vaultAccessible,
    refreshVaultExpiration
} = await import("../src/vault_auth");
const {
    adminLogin,
    adminLogout,
    adminAccess
} = await import("../src/admin_auth");


describe("Authentication tests", () => {
    describe("Testing database vault authentication functions (src/authentication/database.ts)", () => {
        it("Sets the password for a vault and checks if successful", async () => {
            await setVaultPassword("testing", "password123");
            assert(await verifyVaultPassword("testing", "password123"));
            assert(!await verifyVaultPassword("testing", "⬈⋘▀ⵃ⡚⼅⤩⛾⁻⃧⍪Ⓢ⵴✡⩱ⷱ⯠⢪ℨⵖ⎓⹹⯞⾱₧ₔⲺ⚀⣗⦿⠇⸥☑⑈ⷫ⌀⎥␿ⷞ⼝⍜⢥⃊♻∩ⱁ⯣⁮❐⹦⢋⋞⾰ⴂ∎⋪⤲ⴚ⯄⸥⁙⿔⧢ⷙⰪ⛻Ⳅ⛀≳⌅⎖⣧⨬⅌␈⶿ⷡ█ⱼ⟵⥿⍠₶⌔ⳭⰖ⥳⢹≭♢⮦⸗⾄ⵉ⬻⍫⍂☏⢶⼠"));
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
            assert(await verifyAdminPassword("some_admin", "some_password"));
            assert(!await verifyAdminPassword("some_admin", "not_password"));
            assert(!await verifyAdminPassword("some_admin", "⬈⋘▀ⵃ⡚⼅⤩⛾⁻⃧⍪Ⓢ⵴✡⩱ⷱ⯠⢪ℨⵖ⎓⹹⯞⾱₧ₔⲺ⚀⣗⦿⠇⸥☑⑈ⷫ⌀⎥␿ⷞ⼝⍜⢥⃊♻∩ⱁ⯣⁮❐⹦⢋⋞⾰ⴂ∎⋪⤲ⴚ⯄⸥⁙⿔⧢ⷙⰪ⛻Ⳅ⛀≳⌅⎖⣧⨬⅌␈⶿ⷡ█ⱼ⟵⥿⍠₶⌔ⳭⰖ⥳⢹≭♢⮦⸗⾄ⵉ⬻⍫⍂☏⢶⼠"));
            assert(!await verifyAdminPassword("nonexistant", "some_password"));
            await deleteAdminPassword("some_admin");
            assert(!await verifyAdminPassword("some_admin", "some_password"));
        });
        
        it("Tests invalidAdminIssuingDate()", async () => {
            await setAdminPassword("random", "random");

            assert(await invalidAdminIssuingDate("random", unixTime() - 60));
            assert(await invalidAdminIssuingDate("random", unixTime() - 30));
            assert(await invalidAdminIssuingDate("random", unixTime() + 1) === false);
            assert(await invalidAdminIssuingDate("random", unixTime() + 30) === false);
            
            await deleteAdminPassword("random");
        });
        
        it("Tests resetAdminNonce()", async () => {
            await setAdminPassword("hello", "hello");
            
            const afterOriginalNonce = unixTime();
            assert(await invalidAdminIssuingDate("hello", afterOriginalNonce) === false);
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line
            await resetAdminNonce("hello");
            assert(await invalidAdminIssuingDate("hello", afterOriginalNonce));
            assert(await invalidAdminIssuingDate("hello", unixTime()) === false);

            await deleteAdminPassword("hello");
        });
    });

    describe("Vault token authentication tests (src/authentication/vault_token.ts)", () => {
        it("Creates a new token and checks if successful by using the JWT class", async () => {
            await setVaultPassword("main_vault", "password");

            const token = await createToken("main_vault");
            assert(token !== null);
            const [_header, payload] = JWT.unwrap(token, config.JWT_SECRET as string) as [Header, Payload];
            assert(payload.access?.length === 1);
            assert(payload.access[0].vault === "main_vault");
            const token2 = new JWT(config.DOMAIN as string, payload.exp, payload.iat)
                .addClaim("type", "vault")
                .addClaim("random", payload.random)
                .addClaim("access", [{
                    vault: "main_vault",
                    issuedAt: payload.access[0].issuedAt,
                    expiration: payload.access[0].expiration
                }]).getToken(config.JWT_SECRET as string);
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
            const [_header, payload] = JWT.unwrap(token, config.JWT_SECRET as string) as [Header, Payload];
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
            const [_header, payload] = JWT.unwrap(newToken, config.JWT_SECRET as string) as [Header, Payload];
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
            const [_header, payload] = JWT.unwrap(newToken, config.JWT_SECRET as string) as [Header, Payload];
            assert(payload.access.length === 0);

            await deleteVaultPassword("remove_me");
        });
        
        it("Refreshes a token's expiration date", async () => {
            await setVaultPassword("unique_name", "asdfn");

            const token = await createToken("unique_name");
            assert(token !== null);
            assert(await getUnwrappedToken(token) !== null);
            const [_header, payload] = JWT.unwrap(token, config.JWT_SECRET as string) as [Header, Payload];

            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line
            const newToken = await _refreshVaultExpiration(token, "unique_name");

            assert(newToken !== null);
            assert(await getUnwrappedToken(token) === null);
            const [_newHeader, newPayload] = JWT.unwrap(newToken, config.JWT_SECRET as string) as [Header, Payload];
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
            assert(unwrapped.access.length === 1);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line
            await setVaultPassword("change my password", "second password");

            const unwrappedAfter = await getUnwrappedToken(token);
            assert(unwrappedAfter !== null);
            assert(unwrappedAfter.access.length === 0);

            await deleteVaultPassword("change my password");
        });
    });
    
    describe("Vault authentication tests (src/vault_auth.ts)", () => {
        it("Tests vaultLogin()", async () => {
            await setVaultPassword("new_vault", "!!secure123");
            await setVaultPassword("new_vault_too", "1234");
            
            assert(await vaultLogin("new_vault", "!secure123") === null);
            assert(await vaultLogin("new_vault", "⬈⋘▀ⵃ⡚⼅⤩⛾⁻⃧⍪Ⓢ⵴✡⩱ⷱ⯠⢪ℨⵖ⎓⹹⯞⾱₧ₔⲺ⚀⣗⦿⠇⸥☑⑈ⷫ⌀⎥␿ⷞ⼝⍜⢥⃊♻∩ⱁ⯣⁮❐⹦⢋⋞⾰ⴂ∎⋪⤲ⴚ⯄⸥⁙⿔⧢ⷙⰪ⛻Ⳅ⛀≳⌅⎖⣧⨬⅌␈⶿ⷡ█ⱼ⟵⥿⍠₶⌔ⳭⰖ⥳⢹≭♢⮦⸗⾄ⵉ⬻⍫⍂☏⢶⼠") === null);
            assert(await vaultLogin("new_vault", "#secure123") === null);
            assert(await vaultLogin("new_vault", "wrong") === null);
            assert(await vaultLogin("new_vault", "") === null);
            assert(await vaultLogin("nonexist", "!!secure123") === null);

            const token = await vaultLogin("new_vault", "!!secure123");
            assert(token !== null);
            
            const unwrapped = await getUnwrappedToken(token);
            assert(unwrapped !== null);
            assert(unwrapped.access.length === 1);
            assert(unwrapped.access[0].vault === "new_vault");
            
            assert(await vaultLogin("new_vault_too", "wrong", token) === null);
            assert(await vaultLogin("new_vault_too", "wrong", "") === null);
            assert(await vaultLogin("new_vault_too", "wrong", "bad.token.nonsensical") === null);
            
            const newToken = await vaultLogin("new_vault_too", "1234", token);
            assert(newToken !== null);
            
            assert(await getUnwrappedToken(token) === null);
            const newUnwrapped = await getUnwrappedToken(newToken);
            assert(newUnwrapped !== null);
            assert(newUnwrapped.access.length === 2);
            assert(newUnwrapped.access.some(access => access.vault === "new_vault"));
            assert(newUnwrapped.access.some(access => access.vault === "new_vault_too"));
            
            const validToken = await vaultLogin("new_vault_too", "1234", "bad.token.incorrect");
            assert(validToken !== null);
            
            const validUnwrapped = await getUnwrappedToken(validToken);
            assert(validUnwrapped !== null);
            assert(validUnwrapped.access.length === 1);
            assert(validUnwrapped.access[0].vault === "new_vault_too");
            
            await deleteVaultPassword("new_vault");
            await deleteVaultPassword("new_vault_too");
        });
        
        it("Tests vaultLogout()", async () => {
            await setVaultPassword("another_vault", "password2222");
            
            const token = await vaultLogin("another_vault", "password2222");
            assert(token !== null);
            
            const unwrapped = await getUnwrappedToken(token);
            assert(unwrapped !== null);
            assert(unwrapped.access.length === 1);
            assert(unwrapped.access[0].vault === "another_vault");
            
            const newToken = await vaultLogout("another_vault", token);
            assert(newToken !== null);
            
            assert(await getUnwrappedToken(token) === null);
            const newUnwrapped = await getUnwrappedToken(newToken);
            assert(newUnwrapped !== null);
            assert(newUnwrapped.access.length === 0);
            
            const readdedToken = await vaultLogin("another_vault", "password2222", newToken);
            assert(readdedToken !== null);
            const readdedUnwrapped = await getUnwrappedToken(readdedToken);
            assert(readdedUnwrapped !== null);
            assert(await getUnwrappedToken(newToken) === null);
            assert(readdedUnwrapped.access.length === 1);
            assert(readdedUnwrapped.access[0].vault === "another_vault");
            
            const similarToken = await vaultLogout("nonexistant", readdedToken);
            assert(similarToken !== null);
            const similarUnwarpped = await getUnwrappedToken(similarToken);
            assert(similarUnwarpped !== null);
            assert(await getUnwrappedToken(readdedToken) === null);
            assert(similarToken !== readdedToken);
            assert(similarUnwarpped.access.length === 1);
            assert(similarUnwarpped.access[0].vault === "another_vault");
            
            await deleteVaultPassword("another_vault");
        });
        
        it("Tests vaultAccessible()", async () => {
            await setVaultPassword("another_another_vault", "!@#$");
            await setVaultPassword("existant", "12313123123")
            
            const token = await vaultLogin("another_another_vault", "!@#$");
            assert(token !== null);
            
            assert(await vaultAccessible("nonexistant", token) === false);
            assert(await vaultAccessible("existant", token) === false);
            assert(await vaultAccessible("another_another_vault", token));
            
            const newToken = await vaultLogout("another_another_vault", token);
            assert(newToken !== null);

            assert(await vaultAccessible("nonexistant", token) === false);
            assert(await vaultAccessible("existant", token) === false);
            assert(await vaultAccessible("another_another_vault", token) === false);
            
            await deleteVaultPassword("another_another_vault");
            await deleteVaultPassword("existant");
        });
        
        it("Tests refreshVaultExpiration()", async () => {
            await setVaultPassword("first", "first");
            await setVaultPassword("second", "second");
            
            let token: string | null;
            token = await vaultLogin("first", "first");
            assert(token !== null);
            token = await vaultLogin("second", "second", token);
            assert(token !== null);
            
            const originalPayload = await getUnwrappedToken(token);
            assert(originalPayload !== null);
            const originalFirstAccess = originalPayload.access.find(access => access.vault === "first");
            assert(originalFirstAccess !== undefined);
            const originalSecondAccess = originalPayload.access.find(access => access.vault === "second");
            assert(originalSecondAccess !== undefined);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line
            
            const oldToken = token;
            token = await refreshVaultExpiration("first", token);
            assert(token !== null);
            assert(await getUnwrappedToken(oldToken) === null);
            
            const newPayload = await getUnwrappedToken(token);
            assert(newPayload !== null);
            const newFirstAccess = newPayload.access.find(access => access.vault === "first");
            assert(newFirstAccess !== undefined);
            const newSecondAccess = newPayload.access.find(access => access.vault === "second");
            assert(newSecondAccess !== undefined);
            
            assert(newPayload.iat > originalPayload.iat);
            assert(newPayload.exp > originalPayload.exp);
            assert(newFirstAccess.issuedAt === originalFirstAccess.issuedAt);
            assert(newFirstAccess.expiration > originalFirstAccess.expiration);
            assert(newSecondAccess.issuedAt === originalSecondAccess.issuedAt);
            assert(newSecondAccess.expiration === originalSecondAccess.expiration);
            
            await deleteVaultPassword("first");
            await deleteVaultPassword("second");
        });
        
        it("getUnwrappedToken() doesn't work on admin tokens", async () => {
            await setAdminPassword("abcd", "1234");
            
            const token = await adminLogin("abcd", "1234");
            assert(token !== null);
            assert(await getUnwrappedToken(token) === null);

            await deleteAdminPassword("abcd");
        });
    });
    
    describe("Admin authentication tests (src/admin_auth.ts)", () => {
        it("Tests adminLogin()", async () => {
            await setAdminPassword("kevin", "admin1324");
            
            assert(await adminLogin("kevin", "admin1234") === null);
            assert(await adminLogin("kevin", "") === null);
            assert(await adminLogin("kevin", "!%*@*`") === null);
            assert(await adminLogin("kevin", "⬈⋘▀ⵃ⡚⼅⤩⛾⁻⃧⍪Ⓢ⵴✡⩱ⷱ⯠⢪ℨⵖ⎓⹹⯞⾱₧ₔⲺ⚀⣗⦿⠇⸥☑⑈ⷫ⌀⎥␿ⷞ⼝⍜⢥⃊♻∩ⱁ⯣⁮❐⹦⢋⋞⾰ⴂ∎⋪⤲ⴚ⯄⸥⁙⿔⧢ⷙⰪ⛻Ⳅ⛀≳⌅⎖⣧⨬⅌␈⶿ⷡ█ⱼ⟵⥿⍠₶⌔ⳭⰖ⥳⢹≭♢⮦⸗⾄ⵉ⬻⍫⍂☏⢶⼠") === null);
            
            const token = await adminLogin("kevin", "admin1324");
            assert(token !== null);
            assert(await adminAccess(token));

            await deleteAdminPassword("kevin");
        });
        
        it("Tests adminLogout()", async () => {
            await setAdminPassword("kevin2", "admin1324");
            
            const token = await adminLogin("kevin2", "admin1324");
            assert(token !== null);
            
            assert(await adminAccess(token));
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line
            assert(await adminLogout(token));
            assert(await adminAccess(token) === false);
            
            await deleteAdminPassword("kevin2");
        });
        
        it("Tests adminAccess()", async () => {
            await setAdminPassword("aadminn", "admin1324");
            
            const token = await adminLogin("aadminn", "admin1324");
            assert(token !== null);
            
            assert(await adminAccess(token));
            assert(await adminAccess(token + "1") === false);
            assert(await adminAccess(token + ".") === false);
            assert(await adminAccess("asdf.aaba.") === false);
            assert(await adminAccess(token.substring(1)) === false);
            assert(await adminAccess(token.substring(0, token.length - 2)) === false);
            
            await deleteAdminPassword("aadminn");
        });
        
        it("Admin functions don't work on vault tokens", async () => {
            await setVaultPassword("aadminn", "admin1324");

            const vaultToken = await vaultLogin("aadminn", "admin1324");
            assert(vaultToken !== null);
            assert(await adminAccess(vaultToken) === false);
            assert(await adminLogout(vaultToken) === false);

            await deleteVaultPassword("aadminn");
        });
    });

    after(async () => {
        await cleanup();
    });
});