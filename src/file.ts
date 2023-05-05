// Module responsible for actually modifying the file system, and updating
// the VFS.

/* {
    For most functions the flow goes like this:
    
    // File system modification
    try {
        await file system modification
        vfs modifications
    } catch(error) {
        if(osError) {
            vaultLog("ERROR", error);
            return "ERROR";
        }
        vaultLog("NON URGENT", error);
        return "FAILURE";
    }
    
    // Logging
    vaultLog();
    
    // VFS modification
    if(inconsistent) {
        await resynchronize();
        return "RESYNC";
    }
    getAt();
    return "SUCCESS";
    
    
    This makes sure that the VFS modification is performed at the same tick the
    file system modification is performed.
    
    If any errors pop up, the VFS modification will not be performed as the file
    system modification would most likely not have been performed. If any errors
    pop up that results from user error, (renaming nonexistant file, copying
    file as preexisting directory entry, etc.), it will be logged as NON URGENT.
    If it is some serious OS error, it will be logged as ERROR.
    
    Once we get to the VFS modification stage, the only value allowed to be
    returned is true, as the real file system modification was successful.
    
    If there were to be any inconsistencies between the file system and VFS
    after the file system modifications would performed, the VFS modification
    will log an error and try to resynchronize the VFS. The function would only
    return AFTER resynchronization is finished, (so that the user will only get
    a successful response, and then attempt client side VFS synchronization
    after proper serverside VFS resynchronization.)
} */

import fs from "fs/promises";
import path from "path";
import { vaultLog } from "./logger.js";
import { ValidatedPath, getVaultFromPath, getDirectoryAt, splitParentChild, resynchronize, getAt } from "./controller.js";
import { Directory } from "./vfs.js";

// File system modification result.
// SUCCESS: Successful file system modification + VFS updating
// RESYNC: Successful file system modification but unsuccessful VFS updating
// FAILURE: Unsuccessful file system modification, but no major error
// ERROR: Unsuccessful file system modification due to error
export type ModResult = "SUCCESS" | "RESYNC" | "FAILURE" | "ERROR";

const baseVaultDirectory = process.env.VAULT_DIRECTORY || path.join(process.cwd(), "vaults");

/**
 * Standard allowed errors list:
 * Certain errors are allowed and logged as NON URGENT, as they may result
 * from users having an outdated VFS, or just incorrect/unchecked API calls.
 * 
 * ENOENT : Somewhere in the path, an entry does not exist.
 *          For ex: folder/nonexistant.txt
 *                  folder/nonexistant/hello.txt
 * ENOTDIR : Some entry in the path is not actually a directory.
 *          For ex: folder/file.txt/hello.png
 */


/**
 * Move file or folder from one directory to another using the rename command.
 * 
 * The destination path's directory should already exist.
 * 
 * Paths should be complete file paths. It is the client's responsibility to
 * check if there already exists a file / folder with the same name at the
 * destination.
 *
 * If you are moving a file:
 * If there exists a file at the destination with the same name, it will be
 * overwritten.
 * If there exists a folder at the destination with the same name, an error will
 * be thrown.
 *
 * If you are moving a folder:
 * The destination must not exist at all. (Or it can be an empty folder at the
 * destination, but for simplicity make sure there is no folder there.)
 *
 * Returns true if successful, false if failure or error.
 * 
 * @param originalPath 
 * @param destinationPath 
 * @returns
 */
async function moveItem(originalPath: ValidatedPath, destinationPath: ValidatedPath): Promise<ModResult> {
    const originalVault = getVaultFromPath(originalPath);
    const destinationVault = getVaultFromPath(destinationPath);
    
    const realOriginalPath = path.join(baseVaultDirectory, originalPath);
    const realDestinationPath = path.join(baseVaultDirectory, destinationPath);

    // File system modification
    try {
        await fs.rename(realOriginalPath, realDestinationPath);
    } catch(error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = (error as Error).message;
        // Allowed errors:
        // ENOENT
        // ENOTDIR : Trying to rename directory into an existing file
        // EISDIR : Trying to rename file into an existing directory
        // ENOTEMPTY : Trying to copy directory into existing but nonempty directory
        // EEXIST : Same as ENOTEMPTY, will most likely not pop up.
        const serious =
        code !== "ENOENT"
        && code !== "ENOTDIR"
        && code !== "EISDIR"
        && code !== "ENOTEMPTY"
        && code !== "EEXIST";
        const category = serious ? "ERROR" : "NON URGENT";
        if(originalVault === destinationVault) {
            vaultLog(originalVault, category, `Trying to move "${originalPath}" to "${destinationPath}", but encountered error ${message} instead.`);
        } else {
            vaultLog(originalVault, category, `Trying to move "${originalPath}" from vault ${originalVault} to "${destinationPath}" in vault ${destinationVault}, but encountered error ${message} instead.`);
            vaultLog(destinationVault, category, `Trying to move "${originalPath}" from vault ${originalVault} to "${destinationPath}" in vault ${destinationVault}, but encountered error ${message} instead.`);
        }
        return serious ? "ERROR" : "FAILURE";
    }
    
    // Logging
    if(originalVault === destinationVault) {
        vaultLog(originalVault, "INFO", `Moved "${originalPath}" to "${destinationPath}".`);
    } else {
        vaultLog(originalVault, "INFO", `Moved "${originalPath}" from vault ${originalVault} to "${destinationPath}" in vault ${destinationVault}.`);
        vaultLog(destinationVault, "INFO", `Moved "${originalPath}" from vault ${originalVault} to "${destinationPath}" in vault ${destinationVault}.`);
    }

    // VFS modification
    const [ originalParentPath, originalName ] = splitParentChild(originalPath);
    const [ destinationParentPath, destinationName ] = splitParentChild(destinationPath);
    const destinationParentDirectory = getDirectoryAt(destinationParentPath);
    const originalParentDirectory = getDirectoryAt(originalParentPath);

    const originalNull = originalParentDirectory === null || originalParentPath === null || originalName === null;
    const destinationNull = destinationParentDirectory === null || destinationParentPath === null || destinationName === null;
    if(originalNull || destinationNull) {
        if(originalNull) {
            vaultLog(originalVault, "VFS ERROR", `Moving entry at "${originalPath}" to "${destinationPath}", but somehow the original path's parent directory does not exist. Resynchronizing entire vault...`);
            resynchronize(originalVault);
        }
        if(destinationNull) {
            if(!originalNull || originalVault !== destinationVault) {
                vaultLog(originalVault, "VFS ERROR", `Moving entry at "${originalPath}" to "${destinationPath}", but somehow the destination path's parent directory does not exist. Resynchronizing entire vault...`);
                resynchronize(destinationVault);
            } else {
                vaultLog(originalVault, "VFS ERROR", `Moving entry at "${originalPath}" to "${destinationPath}", but somehow the destination path's parent directory does not exist.`);
            }
        }
        return "RESYNC";
    }
    // If original somehow does not exist, resynchronize destination
    const originalItem = originalParentDirectory.getAny(originalName);
    if(originalItem === null) {
        vaultLog(originalVault, "VFS ERROR", `Moving entry at "${originalPath}" to "${destinationPath}", but somehow there is no item at "${originalPath}". Resynchronizing entire vault...`);
        resynchronize(destinationParentPath);
        return "RESYNC";
    }

    // If destination path already exists, remove it.
    const maybeDestinationItem = destinationParentDirectory.getAny(destinationName);
    if(maybeDestinationItem !== null) {
        destinationParentDirectory.removeEntry(maybeDestinationItem, true);
    }
    // Add original to destination, and remove original from parent.
    destinationParentDirectory.addEntry(originalItem, true);
    originalParentDirectory.removeEntry(originalItem, true);

    return "SUCCESS";
}

/**
 * Copies a file or folder from the originalPath to the destinationPath using
 * the cp command.
 * 
 * Paths should be complete file paths. 
 * 
 * Preferably, you are copying to nonexistant destination.
 * If the source and destination are folders, and destination exists, destin-
 * ation contents will remain as long as it doesn't conflict with the entires
 * in source.
 * 
 * Will overwrite all files at destinationPath if they conflict with a file to
 * be copied.
 * Will fail if there exists an entry at destinationPath with the same name at
 * original but one is file and one is directory.
 * 
 * @param originalPath 
 * @param destinationPath 
 * @returns 
 */
async function copyItem(originalPath: ValidatedPath, destinationPath: ValidatedPath): Promise<ModResult> {
    const originalVault = getVaultFromPath(originalPath);
    const destinationVault = getVaultFromPath(destinationPath);
    
    const realOriginalPath = path.join(baseVaultDirectory, originalPath);
    const realDestinationPath = path.join(baseVaultDirectory, destinationPath);
    
    // File system modification
    try {
        await fs.cp(realOriginalPath, realDestinationPath, { recursive: true });
    } catch(error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = (error as Error).message;
        // Allowed errors:
        // ENOENT
        // ENOTDIR
        // ERR_FS_CP_NON_DIR_TO_DIR : Trying to copy nondirectory to directory for any subentry
        // ERR_FS_CP_DIR_TO_NON_DIR : Trying to copy directory to nondirectory for any subentry
        // ERR_FS_CP_EINVAL : Source and destination are the same
        const serious =
        code !== "ENOENT"
        && code !== "ENOTDIR"
        && code !== "ERR_FS_CP_NON_DIR_TO_DIR"
        && code !== "ERR_FS_CP_DIR_TO_NON_DIR"
        && code !== "ERR_FS_CP_EINVAL"
        const category = serious ? "ERROR" : "NON URGENT";
        if(originalVault === destinationVault) {
            vaultLog(originalVault, category, `Trying to copy "${originalPath}" to "${destinationPath}", but encountered error ${message} instead.`);
        } else {
            vaultLog(originalVault, category, `Trying to copy "${originalPath}" to "${destinationPath}", but encountered error ${message} instead.`);
            vaultLog(destinationVault, category, `Trying to copy "${originalPath}" to "${destinationPath}", but encountered error ${message} instead.`);
        }
        return serious ? "ERROR" : "FAILURE";
    }

    // Logging
    if(originalVault === destinationVault) {
        vaultLog(originalVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    } else {
        vaultLog(originalVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
        vaultLog(destinationVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    }
    
    // VFS modification
    const originalItem = getAt(originalPath);
    const [ destinationParentPath, destinationName ] = splitParentChild(destinationPath);
    const destinationParentDirectory = getDirectoryAt(destinationParentPath);
    
    const originalNull = originalItem === null;
    const destinationNull = destinationParentDirectory === null || destinationParentPath === null || destinationName === null;
    if(originalNull || destinationNull) {
        if(originalNull) {
            vaultLog(originalVault, "VFS ERROR", `Copying entry at "${originalPath}" to "${destinationPath}", but somehow there is no item at "${originalPath}". Resynchronizing entire vault...`);
            resynchronize(originalVault);
        }
        if(destinationNull) {
            if(!originalNull || originalVault !== destinationVault) {
                vaultLog(originalVault, "VFS ERROR", `Copying entry at "${originalPath}" to "${destinationPath}", but somehow there is no destination "${destinationPath}". Resynchronizing entire vault...`);
                resynchronize(destinationVault);
            } else {
                vaultLog(originalVault, "VFS ERROR", `Copying entry at "${originalPath}" to "${destinationPath}", but somehow there is no destination "${destinationPath}".`);
            }
        }
        return "RESYNC";
    }
    const maybeDestinationItem = destinationParentDirectory.getAny(destinationName);
    if(maybeDestinationItem !== null) {
        destinationParentDirectory.removeEntry(maybeDestinationItem, false);
    }
    const copiedItem = originalItem.clone();
    copiedItem.name = destinationName;
    destinationParentDirectory.addEntry(copiedItem, true);
    return "SUCCESS";
}

async function removeItem(targetPath: ValidatedPath): Promise<ModResult> {
    const vault = getVaultFromPath(targetPath);
    
    const realPath = path.join(baseVaultDirectory, targetPath);
    
    // File system modification
    try {
        await fs.rm(realPath, { recursive: true });
    } catch(error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = (error as Error).message;
        // Allowed errors:
        // ENOENT
        // ENOTDIR
        const serious =
        code !== "ENOENT"
        && code !== "ENOTDIR";
        const category = serious ? "ERROR" : "NON URGENT";
        vaultLog(vault, category, `Trying to remove "${targetPath}", but encountered error ${message} instead.`);
        return serious ? "ERROR" : "FAILURE";
    }
    
    // Logging
    vaultLog(vault, "INFO", `Removed ${targetPath}.`);
    
    // VFS modification
    const [ parentPath, name ] = splitParentChild(targetPath);
    const parentDirectory = getDirectoryAt(parentPath);
    
    const anyNull = parentDirectory === null || parentPath === null || name === null;
    if(anyNull) {
        vaultLog(vault, "VFS ERROR", `Removing "${targetPath}", but somehow the parent directory does not exist. Resynchronizing entire vault...`);
        resynchronize(vault);
        return "RESYNC";
    }
    const item = parentDirectory.getAny(name);
    if(item === null) {
        vaultLog(vault, "VFS ERROR", `Removing "${targetPath}", but somehow it does not exist in the parent directory. Resynchronizing parent directory...`);
        resynchronize(parentPath);
        return "RESYNC";
    }
    parentDirectory.removeEntry(item, true);
    
    return "SUCCESS";
}

/**
 * Makes a new folder. Non-recursive: Only one folder can be created
 * 
 * @param targetPath 
 */
async function addFolder(targetPath: ValidatedPath): Promise<ModResult> {
    const targetVault = getVaultFromPath(targetPath);
    
    const realPath = path.join(baseVaultDirectory, targetPath);
    
    // File system modification
    try {
        await fs.mkdir(realPath);
    } catch(error) {
        const code = (error as NodeJS.ErrnoException).code;
        const message = (error as Error).message;
        // Allowed errors:
        // ENOENT : Somewhere up the directory tree, a directory does not exist.
        // ENOTDIR : Somewhere up the directory tree, an entry is not a directory.
        // EEXIST : File or directory with the same name already exists
        const serious =
        code !== "ENOENT"
        && code !== "ENOTDIR"
        && code !== "EEXIST"
        vaultLog(targetVault, serious ? "ERROR" : "NON URGENT", `Trying to create new directory "${targetPath}", but encountered error ${message} instead.`);
        return serious ? "ERROR" : "FAILURE";
    }
    
    // Logging
    vaultLog(targetVault, "INFO", `Created new directory "${targetPath}".`);
    
    // VFS modification
    const [ parentPath, name ] = splitParentChild(targetPath);
    const parentDirectory = getDirectoryAt(parentPath);
    if(parentDirectory === null || parentPath === null || name === null) {
        vaultLog(targetVault, "VFS ERROR", `Trying to make a new directory at parent directory "${parentPath}", but it somehow does not exist. Resynchronizing entire vault...`);
        resynchronize(targetVault);
        return "RESYNC";
    }

    parentDirectory.addEntry(new Directory(name, []), true);
    return "SUCCESS";
}

/**
 * Adding files: What happens:
 * 
 * - User sends in a form request, with the file attached.
 * - The corresponding spot in the VFS is checked to see if the file upload is
 * allowed. (For ex: If there is a folder with the same name there, then it is
 * not allowed to be uploaded.)
 * - The request is parsed using Formidable, which saves the file into a
 * temporary directory.
 * - Once formidable finishes parsing, the following function is called to move
 * the file from the temporary directory into the actual file system.
 * - Once moving is finished, the corresponding entry in the VFS is created to
 * include information from the file. In the hashmap, the reservation will be
 * deleted.
 * 
 * Notes:
 * 
 * How is file size going to be read?
 * Using the Content-Length header, which is generally considered safe to use as
 * an estimation of the actual file size.
 * 
 * What the directory that the file is supposed to be in is deleted?
 * The file will be put into a "displaced" directory in the root vault
 * directory. A RESYNC response will be sent with the location the file has been
 * moved to.
 * 
 * What if during the file upload time, a new file / directory has been created
 * there?
 * The file name will be appended with random numbers BEFORE ITS EXTENSION, and
 * a RESYNC response will be sent with the new file name.
 * 
 * What if files are super big, and another file is uploaded with same name?
 * Both files are allowed to be uploaded. The first file that finishes uploading
 * will get the desired name. The second file will then see that the file name
 * has been taken, and will follow the steps from the question above. (Renamed
 * and a RESYNC response with new file path.)
 * 
 * What if there are other conflicts in the file system?
 * The file will either be renamed as specified above if the parent directory
 * exists, or it will be put into the "displaced" directory if the parent
 * directory no longer exists.
 * 
 */

export { moveItem, copyItem, removeItem };