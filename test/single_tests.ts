// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test, { after, describe, it } from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";

import { unixTime } from "../src/helper.js";

let status = 0;

// Gracefully shutdown function
async function shutdown() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");

    console.log("Done.");
}

process.on("SIGINT", shutdown);

// ------------------
// ------------------
// ------------------

// Expect error tests
import { expectError, asyncExpectError } from "./expect_error.js";

test("Verifying expectError works when no error (using expectError).", expectError(() => {
    const errorFunction = expectError(() => {
        const _ = "Everything is ok.";
        const _2 = "No errors here.";
    }, "");
    errorFunction();
}, "Expected error \"\" but found success instead."));

test("Verifying expectError works on error.", expectError(() => {
    throw new Error("This is a random error.");
}, "random error"));

test("Verifying expectError works with async functions.", asyncExpectError(async () => {
    await new Promise((_, reject) => setTimeout(() => reject(new Error("Some random error")), 1000));
}, "random error"));

// ------------------
// ------------------
// ------------------

import { vaultLog, logFileNameFromDate } from "../src/logger.js";

test("Logging to a file", async () => {
    const logFileName = logFileNameFromDate();
    const message = "This is a test message.";
    await vaultLog(".", "INFO", "This is a test message.");
    const logFilePath = path.join("./logs/vaults", logFileName);
    const contents: string = await fs.readFile(logFilePath, { encoding: "utf8" } );
    fs.rm(logFilePath);
    
    assert(contents.includes(message));
    assert(contents.includes(new Date().toUTCString().substring(0, 16)));
});

// ------------------
// ------------------
// ------------------

import JWT, { Header, Payload } from "../src/authentication/jwt.js";

describe("JSON Web Token tests", () => {
    it("Generates a JWT", () => {
        const token = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .finalize("4B6576696E20697320636F6F6C")
            .getToken();
        assert(token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ");
        // RHS obtained from https://jwt.io/
    });
    
    it("Verifies and extracts header and payload from JWT", () => {
        const [header, payload] = JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6C") as [Header, Payload];
        assert(header.alg === "HS256");
        assert(header.typ !== "asd")
        assert(payload.issuerIsCool === true);
        assert(payload.iss === "Kevin");
        assert(payload.sub === undefined);
    })

    it("Returns null on incorrect signature", () => {
        assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJi",
            "4B6576696E20697320636F6F6C") === null);
    });

    it("Returns null on incorrect signature", () => {
        assert(JWT.unwrap("bad.token.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6C") === null);
    });

    it("Returns null on correct signature but incorrect secret", () => {
        assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6D") === null);
    });

    it("Returns null on bad token formatting", () => {
        assert(JWT.unwrap("bad.token", "4B6576696E20697320636F6F6C") === null);
    });
    
    it("Throws error on bad secret", expectError(() => {
        JWT.unwrap("asdf.asdf.asdf", "Z");
    }, "must be a hex string"));
    
    it("Encrypts and decrypts token using AES 256", () => {
        const aesKey = "546869732069732061203634206368617261637465722068657820737472696e";
        const secret = "4B6576696E20697320636F6F6C";
        const encryptedToken = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .getEncryptedToken(aesKey, secret);
        assert(encryptedToken.split(".").length === 2);
        
        const [header, payload] = JWT.unwarpEncrypted(encryptedToken, aesKey, secret) as [Header, Payload];
        assert(header.typ === "JWT");
        assert(payload.iss === "Kevin");
        assert(payload.asdf === undefined);
        assert(payload.issuerIsCool === true);
    });
});

// ------------------
// ------------------
// ------------------

import { redisIsOutdatedToken, redisAddOutdatedToken, close } from "../src/authentication/redis.js";

describe("Redis database tests", () => {
    it("Stores and identifies an outdated token", async () => {
        redisAddOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        unixTime() + 60);
        assert(await redisIsOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ"));
    });
    
    it("Verifies that Redis correctly deletes expiring tokens", async () => {
        redisAddOutdatedToken("temp.token.expiring", unixTime() - 10);
        assert(await redisIsOutdatedToken("temp.token.expiring") === false);
        // The expired token is not considered "outdated" anymore but
        // this is fine as we will always verify if it is expired before
        // checking if it is outdated.
    });

    after(() => {
        status++;
    });
});

import { saveOutdatedTokensToFile, loadOutdatedTokensFromFile, localAddOutdatedToken, localIsOutdatedToken, purgeAllOutdated, localSetVaultPassword, localVaultExists, loadVaultPasswordsFromFile, localDeleteVaultPassword, _tokenList, _tokenSet, _vaultPasswordMap, NodeType as Node } from "../src/authentication/database.js";

describe("In-memory database tests", () => {
    it("Stores and identifies an outdated token", () => {
        localAddOutdatedToken("test.token.outdated", unixTime() + 300);
        assert(localIsOutdatedToken("test.token.outdated"));
        assert(!localIsOutdatedToken("test.token.valid"));
    });
    
    it("Verifies that local database correctly purges expired tokens", async () => {
        localAddOutdatedToken("test.token.nonexpired", unixTime() + 300);
        localAddOutdatedToken("test.token.expired", unixTime() - 60);
        localAddOutdatedToken("test.token.expired2", unixTime() - 30);
        localAddOutdatedToken("test.token.nonexpired2", unixTime() + 300);
        localAddOutdatedToken("test.token.expired3", unixTime() - 90);

        // Check for existance
        assert(localIsOutdatedToken("test.token.nonexpired"));
        assert(localIsOutdatedToken("test.token.expired"));
        assert(localIsOutdatedToken("test.token.expired2"));
        assert(localIsOutdatedToken("test.token.nonexpired2"));
        assert(localIsOutdatedToken("test.token.expired3"));

        await purgeAllOutdated();
        
        // Check for nonexistance after purge for expired tokens
        assert(localIsOutdatedToken("test.token.nonexpired"));
        assert(!localIsOutdatedToken("test.token.expired"));
        assert(!localIsOutdatedToken("test.token.expired2"));
        assert(localIsOutdatedToken("test.token.nonexpired2"));
        assert(!localIsOutdatedToken("test.token.expired3"));
        // The expired tokens are not considered "outdated" anymore but
        // this is fine as we will always verify if they are expired before
        // checking if they are outdated.
        
        let nonexpiredExists = false;
        let nonexpired2Exists = false;
        // Check that purge correctly modified the linked list too
        let current: Node | null = _tokenList.head;
        while(current) {
            assert(current.getExp() >= unixTime() - 10);
            if(current.value.token === "test.token.nonexpired") nonexpiredExists = true;
            if(current.value.token === "test.token.nonexpired2") nonexpired2Exists = true;
            current = current.next;
        }
        // Check that purge did not purge nonexpired tokens
        assert(nonexpiredExists && nonexpired2Exists);
    });
    
    it("Saves the in memory tokens database to a file and loads from the file", async () => {
        localAddOutdatedToken("save.me.tofile", unixTime() + 100);
        localAddOutdatedToken("save.me.too", unixTime() + 100);
        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));

        await saveOutdatedTokensToFile();
        
        _tokenList.head.next = null;
        _tokenList.tail = _tokenList.head;
        _tokenSet.clear();
        assert(!localIsOutdatedToken("save.me.tofile"));
        assert(!localIsOutdatedToken("save.me.too"));
        
        await loadOutdatedTokensFromFile();

        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));
    });
    
    it("Saves the in memory vault passwords database to a file and loads from the file", async () => {
        // Setting passwords directly, in reality should be hashed first and local*() should never be called.
        // Setting passwords automatically saves
        await localSetVaultPassword("test-vault-test", "password112233");
        await localSetVaultPassword("testing2", "Password22");
        await localSetVaultPassword("helloworld", "GoodAndSecure111");

        assert(localVaultExists("test-vault-test"));
        assert(localVaultExists("helloworld"));

        _vaultPasswordMap.clear();

        assert(!localVaultExists("testing2"));
        assert(!localVaultExists("helloworld"));
        
        await loadVaultPasswordsFromFile();
        assert(localVaultExists("test-vault-test"));
        assert(localVaultExists("testing2"));
        assert(localVaultExists("helloworld"));
        assert(!localVaultExists("nonexistant-vault"));
        
        // Deleting passwords automatically saves to file
        await localDeleteVaultPassword("test-vault-test");
        await localDeleteVaultPassword("testing2");
        await localDeleteVaultPassword("helloworld");

        await loadVaultPasswordsFromFile();
        assert(_vaultPasswordMap.size === 0);
    });
    
    after(() => {
        status++;
    })
});

// ------------------
// ------------------
// ------------------

import { hashPassword } from "../src/authentication/password.js";

describe("Tests hashing for password", () => {
    it("Hashes a password and verifies result is correct", () => {
        const hashed = hashPassword("password", Buffer.from("48656c6c6f20776f726c64", "hex"), 1);
        assert(hashed === Buffer.from("4vYX8jJxVqwiRBDeCHUEVsevS4qBDKmQYwHlRFGED18=", "base64").toString("hex"));
        // Password obtained from https://8gwifi.org/pbkdf.jsp
        // Salt: SGVsbG8gd29ybGQ= / Buffer.from("48656c6c6f20776f726c64", "hex").toString("base64")
    });
});

while(status !== 2) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();