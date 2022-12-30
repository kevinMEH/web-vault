// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";



import { log, logFileNameFromDate } from "./logger.js";

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