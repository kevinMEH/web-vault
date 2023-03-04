import fs from "fs/promises";
import path from "path";

const baseLoggingDirectory = process.env.LOGGING_DIRECTORY || path.join(process.cwd(), "logs");

async function metaLog(name: "database" | "authentication" | "admin", type: "ERROR" | "WARNING" | "INFO", message: string) {
    const filePath = path.join(baseLoggingDirectory, name, logFileNameFromDate());
    message = (new Date()).toUTCString() + "\n" + type + ": " + message + "\n\n";
    await fs.appendFile(filePath, message, { mode: 0o640, flag: "a" });
}

// Logs a message related to a specific vault.
// Vault log directory should already exist.
// TODO: Add configuration for logging, ex: date format, log file names
async function vaultLog(vaultName: string, type: "ERROR" | "WARNING" | "INFO", message: string) {
    const filePath = path.join(baseLoggingDirectory, "vaults", vaultName, logFileNameFromDate());
    // TODO: Switch to file descriptors and have array of file
    // descriptors to read and write to. (Performance reasons)
    message = (new Date()).toUTCString() + "\n" + type + ": " + message + "\n\n";
    await fs.appendFile(filePath, message, { mode: 0o640, flag: "a" });
}

// Returns the name of the log file associated with the current date.
function logFileNameFromDate() {
    const date = new Date();
    return date.getUTCFullYear() + "_" + (1 + date.getUTCMonth()) + "_" + date.getUTCDate() + ".log";
}

export { metaLog, vaultLog, logFileNameFromDate };