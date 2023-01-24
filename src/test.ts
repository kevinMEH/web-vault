// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test, { after, describe, it } from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";

import { unixTime } from "./helper.js";

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

// Expects an error, throwing an error if there is no error.
// The error message can be a substring of the full error message.
// Returns a function that can be tested.
function expectError(testFunction: Function, errorMessage: string) {
    return () => {
        try {
            testFunction()
        } catch(error) {
            assert((error as Error).message.includes(errorMessage),
                "Error message \"" + (error as Error).message
                + "\" does not include the expected error message \""
                + errorMessage + "\".");
            return;
        }
        throw new Error("Expected error \"" + errorMessage + "\" but found success instead.");
    }
}

test("Verifying expectError works when no error (using expectError).", expectError(() => {
    const errorFunction = expectError(() => {
        const _ = "Everything is ok.";
        const _2 = "No errors here.";
    }, "");
    errorFunction();
}, "Expected error \"\" but found success instead."));

test("Verifying expectError works on error.", expectError(() => {
    throw new Error("This is a random error.");
}, "random error"))

// ------------------
// ------------------
// ------------------

import { vaultLog, logFileNameFromDate } from "./logger.js";

test("Logging to a file", async () => {
    const logFileName = logFileNameFromDate();
    const message = "This is a test message.";
    await vaultLog(".", "This is a test message.");
    const logFilePath = path.join("./logs/vaults", logFileName);
    const contents: string = await fs.readFile(logFilePath, { encoding: "utf8" } );
    fs.rm(logFilePath);
    
    assert(contents.includes(message));
    assert(contents.includes(new Date().toUTCString().substring(0, 16)));
});

// ------------------
// ------------------
// ------------------

import JWT from "./authentication/jwt.js";

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
            "4B6576696E20697320636F6F6C");
        assert(header.alg === "HS256");
        assert(header.typ !== "asd")
        assert(payload.issuerIsCool === true);
        assert(payload.iss === "Kevin");
        assert(payload.sub === undefined);
    })

    it("Identifies incorrect signature and returns an error", expectError(() => {
        JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJi",
            "4B6576696E20697320636F6F6C");
    }, "Token signature does not match header and body"));

    it("Identifies incorrect signature and returns an error", expectError(() => {
        JWT.unwrap("bad.token.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6C");
    }, "Token signature does not match header and body"));

    it("Correct signature but incorrect secret returns an error", expectError(() => {
        JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6D");
    }, "Token signature does not match header and body"));

    it("Detects bad token formatting", expectError(() => {
        JWT.unwrap("bad.token", "4B6576696E20697320636F6F6C");
    }, "Invalid JSON Web Token format."));
    
    it("Encrypts and decrypts token using AES 256", () => {
        const aesKey = "546869732069732061203634206368617261637465722068657820737472696e";
        const secret = "4B6576696E20697320636F6F6C";
        const encryptedToken = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .getEncryptedToken(aesKey, secret);
        assert(encryptedToken.split(".").length === 2);
        
        const [header, payload] = JWT.unwarpEncrypted(encryptedToken, aesKey, secret);
        assert(header.typ === "JWT");
        assert(payload.iss === "Kevin");
        assert(payload.asdf === undefined);
        assert(payload.issuerIsCool === true);
    });
});

// ------------------
// ------------------
// ------------------

import { redisIsOutdatedToken, redisAddOutdatedToken, close } from "./authentication/redis.js";

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

import { saveOutdatedTokensToFile, loadOutdatedTokensFromFile, localAddOutdatedToken, localIsOutdatedToken, purgeAllOutdated, _list, _set, NodeType as Node } from "./authentication/database.js";

describe("In-memory database tests", () => {
    it("Stores and identifies an outdated token", async () => {
        await localAddOutdatedToken("test.token.outdated", unixTime() + 300);
        assert(localIsOutdatedToken("test.token.outdated"));
        assert(!localIsOutdatedToken("test.token.valid"));
    });
    
    it("Verifies that local database correctly purges expired tokens", async () => {
        await localAddOutdatedToken("test.token.nonexpired", unixTime() + 300);
        await localAddOutdatedToken("test.token.expired", unixTime() - 60);
        await localAddOutdatedToken("test.token.expired2", unixTime() - 30);
        await localAddOutdatedToken("test.token.nonexpired2", unixTime() + 300);
        await localAddOutdatedToken("test.token.expired3", unixTime() - 90);

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
        let current: Node | null = _list.head;
        while(current) {
            assert(current.getExp() >= unixTime() - 10);
            if(current.value.token === "test.token.nonexpired") nonexpiredExists = true;
            if(current.value.token === "test.token.nonexpired2") nonexpired2Exists = true;
            current = current.next;
        }
        // Check that purge did not purge nonexpired tokens
        assert(nonexpiredExists && nonexpired2Exists);
    });
    
    it("Saves the in memory database to a file and loads from the file", async () => {
        await localAddOutdatedToken("save.me.tofile", unixTime() + 100);
        await localAddOutdatedToken("save.me.too", unixTime() + 100);
        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));

        await saveOutdatedTokensToFile();
        
        _list.head.next = null;
        _list.tail = _list.head;
        _set.clear();
        assert(!localIsOutdatedToken("save.me.tofile"));
        assert(!localIsOutdatedToken("save.me.too"));
        
        await loadOutdatedTokensFromFile();

        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));
    });
    
    after(() => {
        status++;
    })
})

while(status !== 2) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();