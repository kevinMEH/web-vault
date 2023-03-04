// Admin functions for creating and managing vaults
// Will be used through an admin login page
// vault.ts is the main interface for controlling vaults

// Should not be run manually separate from the main program as if you
// are using an in memory database, passwords and stuff will not update
// properly.

import fs from "fs/promises";
import path from "path";
import { metaLog } from "./logger.js";
import { deleteVaultPassword, setVaultPassword, vaultExists } from "./authentication.js";

import CustomError from "./custom_error.js";

const baseVaultDirectory = process.env.VAULT_DIRECTORY || path.join(process.cwd(), "vaults");
const baseVaultLoggingDirectory = process.env.LOGGING_DIRECTORY || path.join(process.cwd(), "logs", "vaults");
// Must create corresponding log folder with creation of vault.
// (The vaultLog function expects the folder to be present or error)


/**
 * Password should be passed in as plain text. It will be hashed.
 * 
 * Vault name should be valid (consisting only of base64url characters), or an error
 * is returned.
 * (`INVALID_NAME`)
 * 
 * Vault should not already exist, or an error is returned.
 * (`VAULT_DIRECTORY_EXISTS`)
 * 
 * Vault logging directory may exist, as previously deleted vaults will retain their
 * logging directory for debugging and security purposes. If that happens, the creation
 * will proceed, but an INFO message will be returned.
 * (`LOGGING_DIRECTORY_EXISTS`)
 * 
 * If an unknown error is encountered, that error will be returned.
 * 
 * Returns any errors / infos if any were encountered, or null if everything goes successfully.
 * 
 * @param vaultName 
 * @param password 
 * @returns Promise of instance of CustomError with `code` and `type` attribute
 */
async function createNewVault(vaultName: string, password: string): Promise<CustomError | null> {
    if(!/^([a-z]|[A-Z]|[0-9]|_|-)+$/.test(vaultName)) {
        return new CustomError(
            `${vaultName} is not a valid vault name. The name may only consist of uppercase letters, lowercase letters, numbers, underscores (_), and dashes (-).`,
            "ERROR",
            "INVALID_NAME"
        );
    }
    try {
        await fs.mkdir(path.join(baseVaultDirectory, vaultName));
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "EEXIST") {
            metaLog("admin", "ERROR",
            `Tried to create new vault directory ${vaultName} inside ${baseVaultDirectory}, but directory already exists. Aborting...`);
            return new CustomError(
                message,
                "ERROR",
                "VAULT_DIRECTORY_EXISTS"
            );
        } else {
            metaLog("admin", "ERROR",
            `Tried to create new vault directory ${vaultName} inside ${baseVaultDirectory}, but encountered unrecognized error "${message}" instead. Aborting...`);
            return new CustomError(
                message,
                "ERROR",
                code || "NO_ERROR_CODE"
            );
        }
    }

    let returnValue: CustomError | null = null;
    try {
        await fs.mkdir(path.join(baseVaultLoggingDirectory, vaultName));
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "EEXIST") {
            metaLog("admin", "INFO",
            `Tried to create logging directory for newly created vault ${vaultName} inside ${baseVaultLoggingDirectory}, but directory already exists. This may be because the logging directory was already created from a previous creation of this same vault.`);
            returnValue = new CustomError(message, "INFO", "LOGGING_DIRECTORY_EXISTS");
        } else {
            metaLog("admin", "ERROR",
            `Tried to create logging directory for newly created vault ${vaultName} inside ${baseVaultLoggingDirectory}, but encountered unrecognized error "${message}" instead. Please check if the logging directory has been created, and if not, create it manually.`);
            returnValue = new CustomError(message, "ERROR", code || "NO_ERROR_CODE");
        }
    }
    await setVaultPassword(vaultName, password);
    metaLog("admin", "INFO",
    `Created new vault ${vaultName} in ${baseVaultDirectory} and logging directory in ${baseVaultLoggingDirectory}.`);
    return returnValue;
}


// Changes the vault's password.
// Returns true on successful change, false otherwise. Returns false if vault does not exist.
async function changeVaultPassword(vaultName: string, password: string) {
    if(!await vaultExists(vaultName)) return false;
    await setVaultPassword(vaultName, password);
    metaLog("admin", "INFO",
    `Changed vault ${vaultName} password.`);
    return true;
}


// Will throw error on invalid vault name.
// Returns true on success, false otherwise.
async function deleteVault(vaultName: string) {
    if(!/^([a-z]|[A-Z]|[0-9]|_|-)+$/.test(vaultName)) {
        throw new Error(`${vaultName} is not a valid vault name. The name may only consist of uppercase letters, lowercase letters, numbers, underscores (_), and dashes (-).`);
    }
    await deleteVaultPassword(vaultName);
    let success = false;
    await fs.rm(path.join(baseVaultDirectory, vaultName), { recursive: true })
    .then(() => success = true)
    .catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("admin", "WARNING",
            `Trying to delete ${vaultName} at ${path.join(baseVaultDirectory, vaultName)} but the vault does not exist.`);
        } else {
            metaLog("admin", "ERROR",
            `Trying to delete ${vaultName} at ${path.join(baseVaultDirectory, vaultName)} but encountered unrecognized error "${message}".`);
        }
    })
    if(!success) return false;
    metaLog("admin", "INFO",
    `Successfully deleted vault ${vaultName} at ${path.join(baseVaultDirectory, vaultName)}.`);
    return true;
}

export { createNewVault, changeVaultPassword, deleteVault };