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

import JWT from "../src/authentication/jwt.js";

process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";
if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");

const { isValidToken, createToken, addNewVaultToToken, removeVaultFromToken, outdateToken, refreshTokenExpiration, setVaultPassword, verifyVaultPassword } = await import("../src/authentication.js");

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
        await outdateToken(token, payload.exp);
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

describe("Testing vault authentication module", () => {
    it("Sets the password for a vault and checks if successful", async () => {
        await setVaultPassword("testing", "password123");
        assert(await verifyVaultPassword("testing", "password123"));
        assert(!await verifyVaultPassword("testing", "Password123"));
        assert(!await verifyVaultPassword("nonexistant", "password123"));
    });
    
    after(() => status++);
})

while(status !== 2) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();