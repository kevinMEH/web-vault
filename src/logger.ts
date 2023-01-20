import fs from "fs/promises";
import path from "path";

const baseLoggingDirectory = process.env.LOGGING_DIRECTORY || path.join(process.cwd(), "logs");

// Logs a message.
// Vault log directory should already exist.
// TODO: Add configuration for logging, ex: date format, log file names
async function log(vaultName: string, message: string) {
    const filePath = path.join(baseLoggingDirectory, vaultName, logFileNameFromDate());
    // TODO: Switch to file descriptors and have array of file
    // descriptors to read and write to. (Performance reasons)
    message = (new Date()).toUTCString() + "\n" + message + "\n\n";
    await fs.appendFile(filePath, message, { mode: 0o750, flag: "a+" });
}

// Returns the name of the log file associated with the current date.
function logFileNameFromDate() {
    let date = new Date();
    return date.getUTCFullYear() + "_" + date.getUTCMonth() + "_" + date.getUTCDate() + ".log";
}

export { log, logFileNameFromDate };