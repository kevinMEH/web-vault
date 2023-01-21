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

import JWT from "./jwt.js";

describe("JSON Web Token tests", () => {
    it("Generates a JWT", () => {
        const token = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .finalize("4B6576696E20697320636F6F6C")
            .getToken();
        console.log(token);
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
});

// ------------------
// ------------------
// ------------------

import { isOutdatedToken, addOutdatedToken, close } from "./redis.js";

describe("Redis database tests", () => {
    it("Stores and identifies an outdated token", async () => {
        addOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        unixTime() + 60);
        assert(await isOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ"));
    });
    
    it("Verifies that Redis correctly deletes expiring tokens", async () => {
        addOutdatedToken("temp.token.expiring", unixTime() - 10);
        assert(await isOutdatedToken("temp.token.expiring") === false);
        // The expired token is not considered "outdated" anymore but
        // this is fine as we will always verify if it is expired before
        // checking if it is outdated.
    });

    after(() => {
        status++;
    });
});

import { localAddOutdatedToken, localIsOutdated, purgeAllOutdated, _list, NodeType as Node } from "./database.js";

describe("In-memory database tests", () => {
    it("Stores and identifies an outdated token", async () => {
        await localAddOutdatedToken("test.token.outdated", unixTime() + 300);
        assert(localIsOutdated("test.token.outdated"));
        assert(!localIsOutdated("test.token.valid"));
    });
    
    it("Verifies that local database correctly purges expired tokens", async () => {
        await localAddOutdatedToken("test.token.nonexpired", unixTime() + 300);
        await localAddOutdatedToken("test.token.expired", unixTime() - 60);
        await localAddOutdatedToken("test.token.expired2", unixTime() - 30);
        await localAddOutdatedToken("test.token.nonexpired2", unixTime() + 300);
        await localAddOutdatedToken("test.token.expired3", unixTime() - 90);

        // Check for existance
        assert(localIsOutdated("test.token.nonexpired"));
        assert(localIsOutdated("test.token.expired"));
        assert(localIsOutdated("test.token.expired2"));
        assert(localIsOutdated("test.token.nonexpired2"));
        assert(localIsOutdated("test.token.expired3"));

        await purgeAllOutdated();
        
        // Check for nonexistance after purge for expired tokens
        assert(localIsOutdated("test.token.nonexpired"));
        assert(!localIsOutdated("test.token.expired"));
        assert(!localIsOutdated("test.token.expired2"));
        assert(localIsOutdated("test.token.nonexpired2"));
        assert(!localIsOutdated("test.token.expired3"));
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
    })
})

while(status !== 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();