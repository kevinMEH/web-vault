// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";



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

test("Testing basic JWT generation", async () => {
    const token = new JWT("Kevin", 1000000000, 1111111111)
        .addClaim("issuerIsCool", true)
        .finalize("4B6576696E20697320636F6F6C")
        .getToken();
    console.log(token);
    assert(token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ");
    // RHS obtained from https://jwt.io/
})