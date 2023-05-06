import fs from "fs/promises";
import path from "path";
import { VaultPath } from "./controller.js";
import { BASE_LOGGING_DIRECTORY } from "./env.js";

async function metaLog(name: "database" | "authentication" | "admin" | "vfs", type: "ERROR" | "WARNING" | "INFO", message: string) {
    const filePath = path.join(BASE_LOGGING_DIRECTORY, name, logFileNameFromDate());
    message = (new Date()).toUTCString() + "\n" + type + ": " + message + "\n\n";
    await fs.appendFile(filePath, message, { mode: 0o640, flag: "a" });
}

/**
 * Logs a message related to a specific vault.
 * 
 * Vault log directory should already exist.
 * 
 * TODO: Add configuration for logging, ex: date format, log file names
 * 
 * @param vaultName 
 * @param type 
 * @param message 
 */
async function vaultLog(vaultName: VaultPath, type: "ERROR" | "NON URGENT" | "WARNING" | "INFO", message: string) {
    const filePath = path.join(BASE_LOGGING_DIRECTORY, "vaults", vaultName as unknown as string, logFileNameFromDate());
    // TODO: Switch to file descriptors and have array of file
    // descriptors to read and write to. (Performance reasons)
    message = (new Date()).toUTCString() + "\n" + type + ": " + message + "\n\n";
    await fs.appendFile(filePath, message, { mode: 0o640, flag: "a" });
}

/**
 * Returns the name of the log file associated with the current date.
 * 
 * @returns file name string
 */
function logFileNameFromDate(): string {
    const date = new Date();
    return date.getUTCFullYear() + "_" + (1 + date.getUTCMonth()) + "_" + date.getUTCDate() + ".log";
}

export { metaLog, vaultLog, logFileNameFromDate };