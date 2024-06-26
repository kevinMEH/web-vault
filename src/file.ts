import fs from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { File as WebFile } from "buffer";

import { metaLog, vaultLog } from "./logger";
import { getVaultFromPath, getDirectoryAt, splitParentChild, getAt } from "./controller";
import type { ValidatedPath, VaultPath } from "./controller";
import { File, Directory } from "./vfs";
import { storeVFS } from "./authentication/database";
import { shutdown } from "./cleanup";

import { BASE_VAULT_DIRECTORY, TESTING, PRODUCTION } from "./env";


const deletionTimeout = 5 * 1000;
const tempFileDirectory = path.join(BASE_VAULT_DIRECTORY, "temp");
const tempVaultName = "temp" as VaultPath;
const hexTo12 = Math.pow(16, 12);



/**
 * Due to NextJS being a piece of garbage and constantly recompiling everything,
 * changes in the VFS will be lost unless immediately stored.
 */
const after = !TESTING && !PRODUCTION ? storeVFS : () => {};


function randomFileName(): string {
    return Math.floor(Math.random() * hexTo12).toString(16).padStart(12, "0");
}

/**
 * Creates a random temporary file at the specified vault, retrying if there is
 * already a file with the same name as the one randomFileName() generated.
 * 
 * If excessive errors occurs, the application will shut down.
 * 
 * @param vault 
 * @returns 
 */
async function __getTempFile(vault: VaultPath): Promise<string> {
    let errorCount = 0;
    while(true) {
        const tempName = randomFileName();
        const tempFilePath = path.join(BASE_VAULT_DIRECTORY, vault, tempName);
        try {
            const tempFile = await fs.open(tempFilePath, "wx");
            await tempFile.close();
            return tempName;
        } catch(error) {
            const code = (error as NodeJS.ErrnoException).code;
            const message = (error as Error).message;
            if(code !== "EEXIST") {
                metaLog("file system", "ERROR", `Trying to create temp file at "${tempFilePath}", but encountered unexpected error ${message} instead.`);
            }
            errorCount++;
            if(errorCount >= 12) {
                metaLog("file system", "ERROR", `CATASTROPHIC ERROR: Repeatedly encountering errors while creating a temp file.`);
                await shutdown();
                await shutdown();
                await shutdown();
                process.exit(0);
            }
        }
    }
}

/**
 * Adding files: What happens:
 * 
 * - User sends in a form request, with the file attached.
 * - File is written to random file in temp directory
 * - __tempToVault is called to move from temp directory to vault
 * - Once moving is finished, the corresponding entry in the VFS is created to
 * include information from the file.
 * 
 * Notes:
 * 
 * How is file size going to be read?
 * Using the file.size property, which is considered safe to use as an
 * estimation of the actual byte size of the file.
 * 
 * What if during the file upload time, a new file / directory has been created
 * with the same name?
 * The file will be deleted and it will not be added.
 * 
 * What if files are super big, and another file is uploaded with same name?
 * Both files are allowed to be uploaded. The first file that finishes uploading
 * will get the desired name. The second file will then see that the file name
 * has been taken, and will abort.
 */

/**
 * Adds a file into the desired vault and creates a VFS entry for the file.
 * The desiredPath must be a full path; ie: vault/folder/desired_file_name
 * 
 * The parent directory should exist and path should not be occupied.
 * 
 * @param file 
 */
async function addFile(file: WebFile, desiredPath: ValidatedPath): Promise<boolean> {
    const targetVault = getVaultFromPath(desiredPath);
    // Checks if the parent directory exists and path is not occupied.
    // This condition will be rechecked later during __tempToVault
    const [ parentPath, name ] = splitParentChild(desiredPath);
    const parentDirectory = getDirectoryAt(parentPath);
    if(parentDirectory === null || parentPath === null) {
        vaultLog(targetVault, "NON URGENT", `Attempting to add a file at "${desiredPath}", but the parent directory does not exist.`);
        return false;
    }
    const maybeExists = parentDirectory.getAny(name);
    if(maybeExists !== null) {
        vaultLog(targetVault, "NON URGENT", `Attempting to add a file at "${desiredPath}", but there is already an item there.`);
        return false;
    }

    // Adding File to temp
    // Reserve temp file
    const tempFileName = await __getTempFile(tempVaultName);
    const tempFilePath = path.join(tempFileDirectory, tempFileName);
    try {
        // TODO: TODO: TODO: IMPORTANT: Performance comparison
        // TODO: Disk space check ( See TODO.md )
        const handle = await fs.open(tempFilePath, "w");
        await pipeline(file.stream(), handle.createWriteStream());
    } catch(error) {
        metaLog("file system", "ERROR", `Trying to add file at "${tempFilePath}", but encountered unexpected error ${(error as Error).message} instead.`);
        await fs.unlink(tempFilePath).catch(error => {
            if((error as NodeJS.ErrnoException).code !== "ENOENT") {
                metaLog("file system", "ERROR", `Trying to cleanup file at "${tempFilePath}" after encountering error, but encountered unexpected error ${(error as Error).message} instead.`);
            } else {
                metaLog("file system", "WARNING", `Trying to cleanup file at "${tempFilePath}" after encountering error, but the temp file does not exist.`);
            }
        });
        return false;
    }

    // Moving to vault
    return __tempToVault(desiredPath, tempFileName);
}

/**
 * Adds a file from the temp vault into the desired vault and then creates the
 * VFS entry.
 * 
 * If the file's parent directory does not exist, the process will be aborted.
 * If the file's path is already occupied, the process will be aborted.
 * 
 * @param targetPath 
 * @param tempFileName 
 */
async function __tempToVault(targetPath: ValidatedPath, tempFileName: string): Promise<boolean> {
    const tempFilePath = path.join(tempFileDirectory, tempFileName);
    const targetVault = getVaultFromPath(targetPath);
    
    const stats = await fs.stat(tempFilePath).catch(error => {
        const message = (error as Error).message;
        vaultLog(targetVault, "ERROR", `Trying to obtain stats for file "${targetPath}" with real file in temp directory "${tempFilePath}", but encountered unexpected error ${message}.`)
        return null;
    });

    const newFileName = await __getTempFile(targetVault);
    const newFilePath = path.join(BASE_VAULT_DIRECTORY, targetVault, newFileName);
    try {
        await fs.rename(tempFilePath, newFilePath);
    } catch(error) {
        const message = (error as Error).message;
        vaultLog(targetVault, "ERROR", `Attempting to add a file at path "${targetPath}" by renaming temp file "${tempFilePath}" to "${newFilePath}", but encountered unexpected error ${message}. Deleting file...`);
        await fs.unlink(tempFilePath).catch(async error => {
            const message = (error as Error).message;
            vaultLog(targetVault, "ERROR", `Attempting to remove temp file "${tempFilePath}", but encountered unexpected error ${message}.`);
            await fs.unlink(newFilePath).catch(error => {
                const message = (error as Error).message;
                vaultLog(targetVault, "ERROR", `Attempting to remove possibly renamed temp file "${newFilePath}", but encountered unexpected error ${message}.`);
            });
        });
        return false;
    }
    
    const [ parentPath, name ] = splitParentChild(targetPath);
    const parentDirectory = getDirectoryAt(parentPath);
    if(parentDirectory === null || parentPath === null) {
        vaultLog(targetVault, "NON URGENT", `Uploading file at "${targetPath}", but the parent directory does not exist.`);
        await fs.unlink(newFilePath).catch(error => {
            const message = (error as Error).message;
            vaultLog(targetVault, "ERROR", `Attempting to remove temp file "${tempFilePath}", but encountered unexpected error ${message}.`);
        });
        return false;
    }
    const maybeExists = parentDirectory.getAny(name);
    if(maybeExists !== null) {
        vaultLog(targetVault, "NON URGENT", `Uploading file at "${targetPath}", but there is already an entry there with the same name.`);
        await fs.unlink(newFilePath).catch(error => {
            const message = (error as Error).message;
            vaultLog(targetVault, "ERROR", `Attempting to remove temp file "${tempFilePath}", but encountered unexpected error ${message}.`);
        });
        return false;
    }

    const newFileEntry = stats !== null ? new File(name, stats.size, newFileName, stats.mtime) : new File(name, 0, newFileName);
    parentDirectory.addEntry(newFileEntry, true);

    after();
    return true;
}

/**
 * Makes a new folder in the VFS. Non-recursive: Only one folder can be created
 * 
 * The parent directory should exist and path should not be occupied.
 * 
 * @param targetPath 
 */
function addFolder(targetPath: ValidatedPath): boolean {
    const targetVault = getVaultFromPath(targetPath);
    
    const [ parentPath, name ] = splitParentChild(targetPath);
    const parentDirectory = getDirectoryAt(parentPath);
    if(parentDirectory === null || parentPath === null) {
        vaultLog(targetVault, "NON URGENT", `Making a new directory at "${targetPath}", but the parent directory does not exist.`);
        return false;
    }
    const maybeExists = parentDirectory.getAny(name);
    if(maybeExists !== null) {
        vaultLog(targetVault, "NON URGENT", `Making a new directory "${targetPath}", but there is already an item there.`);
        return false;
    }
    parentDirectory.addEntry(new Directory(name, []), true);
    
    vaultLog(targetVault, "INFO", `Created new directory "${targetPath}".`);
    after();
    return true;
}

/**
 * Deletes an item from the VFS, and asynchronously from the file system after a
 * delay. The delay is to allow for other possible operations on the file or
 * files inside the folder to complete, ex: download operation
 * 
 * @param targetPath 
 * @returns 
 */
function deleteItem(targetPath: ValidatedPath): boolean {
    const vault = getVaultFromPath(targetPath);
    
    const [ parentPath, name ] = splitParentChild(targetPath);
    const parentDirectory = getDirectoryAt(parentPath);
    
    if(parentDirectory === null || parentPath === null) {
        vaultLog(vault, "NON URGENT", `Removing "${targetPath}", but the parent directory does not exist.`);
        return false;
    }
    const item = parentDirectory.getAny(name);
    if(item === null) {
        vaultLog(vault, "NON URGENT", `Removing "${targetPath}", but it does not exist in the parent directory.`);
        return false;
    }
    parentDirectory.removeEntry(item, true);
    
    const subfiles = item.isDirectory ? (item as Directory).getAllSubfiles() : [ item as File ];
    
    for(const file of subfiles) {
        // File system modification
        const realPath = path.join(BASE_VAULT_DIRECTORY, vault, file.realFile);
        // Timeout before deletion so that other possible operations on the same
        // file may finish.
        setTimeout(() => { // eslint-disable-line
            fs.rm(realPath, { recursive: true }).then(() => {
                vaultLog(vault, "INFO", `Removed real file "${realPath}" of target path "${targetPath}".`);
            }).catch(error => {
                const message = (error as Error).message;
                vaultLog(vault, "ERROR", `Removing real file "${realPath}" of target path "${targetPath}", but encountered error ${message} instead.`);
            });
        }, deletionTimeout);
    }
    
    vaultLog(vault, "INFO", `Removed ${targetPath} from VFS.`);
    after();
    return true;
}

/**
 * Paths should be complete file paths. (Including destination name)
 * 
 * The destination's parent directory should exist and the destination path
 * should not be occupied.
 *
 * @param originalPath 
 * @param destinationPath 
 * @returns
 */
async function moveItem(originalPath: ValidatedPath, destinationPath: ValidatedPath): Promise<boolean> {
    const originalVault = getVaultFromPath(originalPath);
    const destinationVault = getVaultFromPath(destinationPath);

    // Destination path cannot contain original path. Prevents moving into
    // inside itself: Example: move hello/folder1 hello/folder1/folder2 -> bad
    if(destinationPath.indexOf(originalPath) === 0) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but the destination path is inside original path.`);
        return false;
    }
    
    const [ originalParentPath, originalName ] = splitParentChild(originalPath);
    const [ destinationParentPath, destinationName ] = splitParentChild(destinationPath);
    const destinationParentDirectory = getDirectoryAt(destinationParentPath);
    const originalParentDirectory = getDirectoryAt(originalParentPath);
    
    if(originalParentDirectory === null || originalParentPath === null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but the original path's parent directory does not exist.`);
        return false;
    }
    const originalItem = originalParentDirectory.getAny(originalName);
    if(originalItem === null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but there is no item at "${originalPath}".`);
        return false;
    }
    
    if(destinationParentDirectory === null || destinationParentPath === null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but the destination path's parent directory does not exist.`);
        return false;
    }

    const destinationItem = destinationParentDirectory.getAny(destinationName);

    if(destinationItem !== null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but there is already an existing entry at destination.`)
        return false;
    }

    // Add original to destination, and remove original from parent.
    originalParentDirectory.removeEntry(originalItem, true);
    originalItem.name = destinationName;
    destinationParentDirectory.addEntry(originalItem, true);
    
    // File system modification
    // If moving to a different vault, we must move the real files.
    if(originalVault !== destinationVault) {
        const files = originalItem.isDirectory
            ? (originalItem as Directory).getAllSubfiles()
            : [ originalItem as File ];
        
        const operations = [];

        for(const file of files) {
            const realFilePath = path.join(BASE_VAULT_DIRECTORY, originalVault, file.realFile);
            const newFileName = await __getTempFile(destinationVault)
            const newFilePath = path.join(BASE_VAULT_DIRECTORY, destinationVault, newFileName);
            const promise = fs.rename(realFilePath, newFilePath).then(() => {
                file.realFile = newFileName;
            }).catch(error => {
                const message = `Moving real file "${realFilePath}" representing "${originalPath}" to new real file "${newFilePath}" representing "${destinationPath}", but encountered unexpected error ${(error as Error).message}.`;
                vaultLog(originalVault, "ERROR", message);
                vaultLog(destinationVault, "ERROR", message);
            });
            operations.push(promise);
        }

        await Promise.all(operations);
    }
       
    vaultLog(originalVault, "INFO", `Moved "${originalPath}" to "${destinationPath}".`);
    if(originalVault !== destinationVault) {
        vaultLog(destinationVault, "INFO", `Moved "${originalPath}" to "${destinationPath}".`);
    }
    after();
    return true;
}

/**
 * Paths should be complete file paths.
 * 
 * The destination's parent directory should exist and the destination path
 * should not be occupied.
 * 
 * @param originalPath 
 * @param destinationPath 
 * @returns 
 */
async function copyItem(originalPath: ValidatedPath, destinationPath: ValidatedPath): Promise<boolean> {
    const originalVault = getVaultFromPath(originalPath);
    const destinationVault = getVaultFromPath(destinationPath);
    
    const originalItem = getAt(originalPath);
    const [ destinationParentPath, destinationName ] = splitParentChild(destinationPath);
    const destinationParentDirectory = getDirectoryAt(destinationParentPath);
    
    if(originalItem === null) {
        vaultLog(originalVault, "NON URGENT", `Copying entry at "${originalPath}" to "${destinationPath}", but somehow there is no item at "${originalPath}".`);
        return false;
    }
    if(destinationParentDirectory === null || destinationParentPath === null) {
        vaultLog(originalVault, "NON URGENT", `Copying entry at "${originalPath}" to "${destinationPath}", but somehow the destination parent path does not exist.`);
        return false;
    }
    
    const destinationItem = destinationParentDirectory.getAny(destinationName);

    if(destinationItem !== null) {
        vaultLog(originalVault, "NON URGENT", `Copying entry at "${originalPath}" to "${destinationPath}", but there is an existing entry at destination.`);
        return false;
    }

    const copiedItem = originalItem.clone(true);
    copiedItem.name = destinationName;
    destinationParentDirectory.addEntry(copiedItem, true);
    
    // File system modification
    const copiedFiles = copiedItem.isDirectory
        ? (copiedItem as Directory).getAllSubfiles()
        : [ copiedItem as File ];
    
    const operations = [];
    
    for(const copiedFile of copiedFiles) {
        const realFilePath = path.join(BASE_VAULT_DIRECTORY, originalVault, copiedFile.realFile);
        const copiedFileName = await __getTempFile(destinationVault);
        const copiedFilePath = path.join(BASE_VAULT_DIRECTORY, destinationVault, copiedFileName);
        const promise = fs.cp(realFilePath, copiedFilePath).then(() => {
            copiedFile.realFile = copiedFileName;
        }).catch(error => {
            const message = `Copying real file "${realFilePath}" from "${originalPath}" to "${copiedFilePath}" in "${destinationPath}", but encountered unexpected error ${(error as Error).message}.`;
            vaultLog(originalVault, "ERROR", message);
            if(originalVault !== destinationVault) {
                vaultLog(destinationVault, "ERROR", message);
            }
        });
        operations.push(promise);
    }
    
    await Promise.all(operations);

    vaultLog(originalVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    if(originalVault !== destinationVault) {
        vaultLog(destinationVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    }
    after();
    return true;
}

export {
    __getTempFile,
    __tempToVault,
    addFile,
    addFolder,
    deleteItem,
    moveItem,
    copyItem,
};