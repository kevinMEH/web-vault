// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";

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


import { log, logFileNameFromDate } from "./logger.js";
import JWT from "./jwt.js";

test("Logging to a file", async () => {
    const logFileName = logFileNameFromDate();
    const message = "This is a test message.";
    await log(".", "This is a test message.");
    const logFileDirectory = path.join("./logs", logFileName);
    const contents: string = await fs.readFile(logFileDirectory, { encoding: "utf8" } );
    fs.rm(logFileDirectory);

    assert(contents.includes(message));
    assert(contents.includes(new Date().toUTCString().substring(0, 16)));
});

test("Testing basic JWT generation", () => {
    const token = new JWT("Kevin", 1000000000, 1111111111)
        .addClaim("issuerIsCool", true)
        .finalize("4B6576696E20697320636F6F6C")
        .getToken();
    console.log(token);
    assert(token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ");
    // RHS obtained from https://jwt.io/
});

test("Verifying and extracting header and payload from JWT", () => {
    const [header, payload] = JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        "4B6576696E20697320636F6F6C");
    assert(header.alg === "HS256");
    assert(header.typ !== "asd")
    assert(payload.issuerIsCool === true);
    assert(payload.iss === "Kevin");
    assert(payload.sub === undefined);
});

test("Verifying incorrect signature returns an error", expectError(() => {
    JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJi",
        "4B6576696E20697320636F6F6C");
}, "Token signature does not match header and body"));

test("Verifying incorrect signature returns an error", expectError(() => {
    JWT.unwrap("bad.token.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        "4B6576696E20697320636F6F6C");
}, "Token signature does not match header and body"));

test("Verifying correct signature but incorrect secret returns an error", expectError(() => {
    JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        "4B6576696E20697320636F6F6D");
}, "Token signature does not match header and body"));

test("Verifying successful detection of bad token", expectError(() => {
    JWT.unwrap("bad.token", "4B6576696E20697320636F6F6C");
}, "Invalid JSON Web Token format."));
