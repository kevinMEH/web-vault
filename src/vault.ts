// Admin functions for creating and managing vaults
// Will be used through an admin login page
// vault.ts is the main interface for controlling vaults

// Should not be run manually separate from the main program as if you
// are using an in memory database, passwords and stuff will not update
// properly.

import fs from "fs/promises";
import path from "path";
import { metaLog } from "./logger.js";
import { deleteVaultPassword, setVaultPassword, vaultExistsDatabase } from "./authentication.js";
import { validNameRegex, deleteVaultVFS, newVaultVFS } from "./controller.js";

import CustomError from "./custom_error.js";

import { BASE_VAULT_DIRECTORY, BASE_LOGGING_DIRECTORY } from "./env.js";

const deletionTimeout = 15 * 1000;
const baseVaultLoggingDirectory = path.join(BASE_LOGGING_DIRECTORY, "vaults");
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
    if(false === validNameRegex.test(vaultName)) {
        metaLog("admin", "ERROR", `Tried to create a new vault ${vaultName}, but the name is not a valid name.`);
        return new CustomError(`${vaultName} is not a valid vault name.`, "ERROR", "INVALID_NAME");
    }

    try {
        await fs.mkdir(path.join(BASE_VAULT_DIRECTORY, vaultName));
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "EEXIST") {
            metaLog("admin", "ERROR",
            `Tried to create new vault directory ${vaultName} inside ${BASE_VAULT_DIRECTORY}, but directory already exists. Aborting...`);
            return new CustomError(
                message,
                "ERROR",
                "VAULT_DIRECTORY_EXISTS"
            );
        } else {
            metaLog("admin", "ERROR",
            `Tried to create new vault directory ${vaultName} inside ${BASE_VAULT_DIRECTORY}, but encountered unrecognized error "${message}" instead. Aborting...`);
            return new CustomError(
                message,
                "ERROR",
                code
            );
        }
    }
    
    newVaultVFS(vaultName);

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
        `Created new vault ${vaultName} in ${BASE_VAULT_DIRECTORY} and logging directory in ${baseVaultLoggingDirectory}.`);
    } else {
        metaLog("admin", "INFO",
        `Created new vault ${vaultName} in ${BASE_VAULT_DIRECTORY} and logging directory in ${baseVaultLoggingDirectory} with warnings / errors.`);
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
    if(!await vaultExistsDatabase(vaultName)) {
        metaLog("admin", "INFO", `Tried to change vault ${vaultName} password, but the vault does not exist in the database.`);
        return false;
    }
    await setVaultPassword(vaultName, password);
    metaLog("admin", "INFO", `Changed vault ${vaultName} password.`);
    return true;
}


/**
 * Deletes a vault. Vault does not have to exist, although errors will be
 * logged.
 * 
 * Unless deleteImmediately is set to true, there will be a timeout before the
 * deletion of the vault directory so that other possible operations on the
 * files inside may finish.
 * 
 * The async function will wait for vault deletion if deleteImmediately is set
 * to true.
 * 
 * @param vaultName 
 * @param deleteImmediately
 * @returns
 */
async function deleteVault(vaultName: string, deleteImmediately: boolean) {
    vaultExistsDatabase(vaultName).then(exists => {
        if(!exists) {
            metaLog("admin", "ERROR", `${vaultName} does not exist in the database. Deletion still proceeding.`);
        }
        deleteVaultPassword(vaultName);
    })
    
    if(!deleteVaultVFS(vaultName)) {
        metaLog("admin", "ERROR", `${vaultName} VFS somehow does not exist. Deletion still proceeding.`);
    }
    
    if(deleteImmediately) {
        await fs.rm(path.join(BASE_VAULT_DIRECTORY, vaultName), { recursive: true }).then(() => {
            metaLog("admin", "INFO", `Successfully deleted vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)}.`);
        }).catch(error => {
            const message = (error as Error).message;
            const code = (error as NodeJS.ErrnoException).code;
            if(code === "ENOENT") {
                metaLog("admin", "WARNING",
                `Deleting vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)} but the vault does not exist.`);
            } else {
                metaLog("admin", "ERROR",
                `Deleting vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)} but encountered unrecognized error "${message}".`);
            }
        });
    } else {
        setTimeout(() => {
            fs.rm(path.join(BASE_VAULT_DIRECTORY, vaultName), { recursive: true }).then(() => {
                metaLog("admin", "INFO", `Successfully deleted vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)}.`);
            }).catch(error => {
                const message = (error as Error).message;
                const code = (error as NodeJS.ErrnoException).code;
                if(code === "ENOENT") {
                    metaLog("admin", "WARNING",
                    `Deleting vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)} but the vault does not exist.`);
                } else {
                    metaLog("admin", "ERROR",
                    `Deleting vault ${vaultName} at ${path.join(BASE_VAULT_DIRECTORY, vaultName)} but encountered unrecognized error "${message}".`);
                }
            });
        }, deletionTimeout);
    }
}

export { createNewVault, changeVaultPassword, deleteVault };