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
 * will proceed and nothing will be returned.
 * 
 * If an unknown error is encountered, that error will be returned.
 * 
 * Returns any errors if any were encountered, or null if everything goes successfully.
 * 
 * @param vaultName 
 * @param password 
 * @returns Promise of instance of CustomError with `code` and `type` attribute
 */
async function createNewVault(vaultName: string, password: string): Promise<CustomError | null> {
    if(!/^([a-z]|[A-Z]|[0-9]|_|-)+$/.test(vaultName)) {
        metaLog("admin", "ERROR",
        `Tried to create a new vault ${vaultName}, but the name is not a valid name.`);
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
                code
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
        } else {
            metaLog("admin", "ERROR",
            `Tried to create logging directory for newly created vault ${vaultName} inside ${baseVaultLoggingDirectory}, but encountered unrecognized error "${message}" instead. Please check if the logging directory has been created, and if not, create it manually.`);
            returnValue = new CustomError(message, "ERROR", code);
        }
    }
    await setVaultPassword(vaultName, password);

    if(returnValue == null) {
        metaLog("admin", "INFO",
        `Created new vault ${vaultName} in ${baseVaultDirectory} and logging directory in ${baseVaultLoggingDirectory}.`);
    } else {
        metaLog("admin", "INFO",
        `Created new vault ${vaultName} in ${baseVaultDirectory} and logging directory in ${baseVaultLoggingDirectory} with warnings / errors.`);
    }
    return returnValue;
}


/**
 * Changes the vault's password.
 * Returns true on successful change, false if vault does not exist.
 * 
 * @param vaultName 
 * @param password 
 * @returns 
 */
async function changeVaultPassword(vaultName: string, password: string): Promise<boolean> {
    if(!await vaultExists(vaultName)) {
        metaLog("admin", "INFO", `Tried to change vault ${vaultName} password, but the vault does not exist in the database.`);
        return false;
    }
    await setVaultPassword(vaultName, password);
    metaLog("admin", "INFO", `Changed vault ${vaultName} password.`);
    return true;
}


/**
 * Deletes a vault.
 * 
 * Returns an error on invalid vault name. (Not base64url string) (`INVALID_NAME`)
 * 
 * Returns an error if the vault does not exist in the database. (`VAULT_NONEXISTANT`)
 * Deletion will nonetheless proceed.
 * 
 * Returns an error if the vault directory does not exist. (`VAULT_DIRECTORY_NONEXISTANT`)
 * 
 * @param vaultName 
 * @returns Promise<Array<CustomError>>
 */
async function deleteVault(vaultName: string): Promise<Array<CustomError>> {
    if(!/^([a-z]|[A-Z]|[0-9]|_|-)+$/.test(vaultName)) {
        return [ new CustomError(`${vaultName} is not a valid vault name. The name may only consist of uppercase letters, lowercase letters, numbers, underscores (_), and dashes (-).`,
            "ERROR", "INVALID_NAME") ];
    }
    
    const returnValue: Array<CustomError> = [];
    if(!await vaultExists(vaultName)) {
        metaLog("admin", "ERROR", `${vaultName} does not exist in the database. Deletion still proceeding.`);
        returnValue.push(new CustomError(`${vaultName} does not exist in the database.`, "ERROR", "VAULT_NONEXISTANT"));
    } else {
        await deleteVaultPassword(vaultName);
    }

    try {
        await fs.rm(path.join(baseVaultDirectory, vaultName), { recursive: true });
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("admin", "WARNING",
            `Trying to delete ${vaultName} at ${path.join(baseVaultDirectory, vaultName)} but the vault does not exist.`);
            returnValue.push(new CustomError(`${vaultName} does not have a corresponding directory in ${baseVaultDirectory}`, "ERROR", "VAULT_DIRECTORY_NONEXISTANT"));
        } else {
            metaLog("admin", "ERROR",
            `Trying to delete ${vaultName} at ${path.join(baseVaultDirectory, vaultName)} but encountered unrecognized error "${message}".`);
            returnValue.push(new CustomError(message, "ERROR", code));
        }
    }
    
    if(returnValue == null) {
        metaLog("admin", "INFO",
        `Successfully deleted vault ${vaultName} at ${path.join(baseVaultDirectory, vaultName)}.`);
    } else {
        metaLog("admin", "INFO",
        `Deleted vault ${vaultName} at ${path.join(baseVaultDirectory, vaultName)} with warnings / errors.`);
    }
    return returnValue;
}

export { createNewVault, changeVaultPassword, deleteVault };