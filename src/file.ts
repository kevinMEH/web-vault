import fs from "fs/promises";
import path from "path";
import { metaLog, vaultLog } from "./logger";
import { getVaultFromPath, getDirectoryAt, splitParentChild, getAt, getVaultVFS } from "./controller";
import type { ValidatedPath, VaultPath } from "./controller";
import { File, Directory } from "./vfs";

import { BASE_VAULT_DIRECTORY } from "./env";

import { shutdown } from "./cleanup";

const deletionTimeout = 5 * 1000;
const tempFileDirectory = path.join(BASE_VAULT_DIRECTORY, "temp");
const hexTo12 = Math.pow(16, 12);

function randomFileName(): string {
    return Math.floor(Math.random() * hexTo12).toString(16).padStart(12, "0");
}

/**
 * Creates a random temporary file at the specified vault, retrying if there is
 * already a file with the same name as the one randomFileName() generated.
 * 
 * Returns null if the vault somehow does not exist.
 * 
 * If excessive errors occurs, the application will shut down.
 * 
 * @param vault 
 * @returns 
 */
async function getTempFile(vault: VaultPath): Promise<string> {
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
                const message = `Repeatedly encountering errors while creating a temp file.`;
                metaLog("file system", "ERROR", message);
                shutdown();
            }
        }
    }
}

/**
 * Creates a displaced directory in the specified directory, and returns it.
 * 
 * The directory name will be in the form "displaced", or "displaced (1)" if
 * "displaced" is already taken.
 * 
 * @param parentDirectory 
 * @returns Directory
 */
function getDisplacedDirectory(parentDirectory: Directory): Directory {
    let displacedDirectory = parentDirectory.getAny("displaced");
    if(displacedDirectory === null) {
        displacedDirectory = new Directory("displaced", []);
        parentDirectory.addEntry(displacedDirectory, true);
        return displacedDirectory;
    }
    if(displacedDirectory.isDirectory) {
        return displacedDirectory as Directory;
    }
    let displacedCounter = 0;
    // Possible opportunity for DOS but if an attacker has access to your vaults
    // you have bigger problems.
    // Keeps iterating until you find either a preexisting directory, or nothing
    while(displacedDirectory !== null && !displacedDirectory.isDirectory) {
        displacedCounter++;
        displacedDirectory = parentDirectory.getAny(`displaced (${displacedCounter})`);
    }
    // Found nothing
    if(displacedDirectory === null) {
        displacedDirectory = new Directory(`displaced (${displacedCounter})`, []);
        parentDirectory.addEntry(displacedDirectory, true);
    }
    return displacedDirectory as Directory;
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
 * the file from the temporary directory into the target vault.
 * - Once moving is finished, the corresponding entry in the VFS is created to
 * include information from the file.
 * 
 * Notes:
 * 
 * How is file size going to be read?
 * Using the Content-Length header, which is generally considered safe to use as
 * an estimation of the actual file size.
 * 
 * What if during the file upload time, a new file / directory has been created
 * with the same name?
 * The file name will be appended with random numbers, and the new path will be
 * returned from the function.
 * 
 * What if files are super big, and another file is uploaded with same name?
 * Both files are allowed to be uploaded. The first file that finishes uploading
 * will get the desired name. The second file will then see that the file name
 * has been taken, and will follow the steps from the question above.
 */

/**
 * Adds a file by moving the uploaded file from the temp path into the vault
 * path, and then adding the VFS entry.
 * 
 * Upper level directories will be recursively created if they do not exist. If
 * there exists an upper level directory that is actually a file, the file will
 * be placed into a "displaced" directory.
 * 
 * If there are possible file naming conflicts, it will be given a new name and
 * the new path will be returned.
 * 
 * @param desiredPath 
 * @param tempFileName 
 */
async function addFile(desiredPath: ValidatedPath, tempFileName: string): Promise<ValidatedPath | boolean> {
    const targetVault = getVaultFromPath(desiredPath);
    const directories = desiredPath.split("/");

    let displaced = false;
    let finalPath = directories[0];
    let last: Directory | null = getVaultVFS(directories[0] as VaultPath);
    // It may be that the file upload was performed right before vault deletion,
    // if this happens to be the case delete the temp file.
    if(last === null) {
        vaultLog(targetVault, "ERROR", `Attempting to add a file at path "${desiredPath}" with temp file ${tempFileName}, but the vault no longer exists.`);
        await fs.unlink(path.join(tempFileDirectory, tempFileName));
        return false;
    }
    // Go up the paths, creating directories if they don't exist.
    for(let i = 1; i < directories.length - 1; i++) {
        const directoryName = directories[i];
        let nextDirectory: Directory | File | null = last.getAny(directoryName);
        if(nextDirectory === null) {
            nextDirectory = new Directory(directoryName, [])
            last.addEntry(nextDirectory, true);
        } else {
            // If the item was a file, we can't continue. Find a displaced
            // directory and use it instead.
            if(!nextDirectory.isDirectory) {
                last = getDisplacedDirectory(last);
                finalPath += "/" + last.name;
                displaced = true;
                break;
            }
        }
        last = nextDirectory as Directory;
        finalPath += "/" + directoryName;
    }
    
    // Moving from temp to new
    const tempFilePath = path.join(tempFileDirectory, tempFileName);
    const newFileName = await getTempFile(targetVault);
    const newFilePath = path.join(BASE_VAULT_DIRECTORY, targetVault, newFileName);
    try {
        await fs.rename(tempFilePath, newFilePath);
    } catch(error) {
        const message = (error as Error).message;
        vaultLog(targetVault, "ERROR", `Attempting to add a file at path "${desiredPath}" by renaming temp file "${tempFilePath}" to "${newFilePath}", but encountered unexpected error ${message}. Deleting file...`);
        await fs.rm(tempFilePath).catch(error => {
            const message = (error as Error).message;
            vaultLog(targetVault, "ERROR", `Attempting to remove temp file "${tempFilePath}", but encountered unexpected error ${message}.`);
        });
        return false;
    }
    const stats = await fs.stat(newFilePath).catch(error => {
        const message = (error as Error).message;
        vaultLog(targetVault, "ERROR", `Trying to obtain stats for file "${desiredPath}" with real file "${newFilePath}", but encountered unexpected error ${message}.`)
        return null;
    });

    // Creating file entry in VFS
    const originalFileName = directories[directories.length - 1];
    const firstDotIndex = originalFileName.indexOf(".");
    const fileNameBase = firstDotIndex >= 0
    ? originalFileName.substring(0, firstDotIndex) : originalFileName;
    const fileNameExtension = firstDotIndex >= 0
    ? originalFileName.substring(firstDotIndex) : "";

    let fileName = fileNameBase + fileNameExtension;
    let existingFile = last.getAny(fileName);
    let duplicateCounter = 0;
    if(existingFile !== null) displaced = true;
    while(existingFile !== null) {
        duplicateCounter++;
        fileName = `${fileNameBase} (${duplicateCounter})${fileNameExtension}`;
        existingFile = last.getAny(fileName);
    }
    const newFileEntry = stats !== null
    ? new File(fileName, stats.size, newFileName, stats.mtime)
    : new File(fileName, 0, newFileName);
    last.addEntry(newFileEntry, true);
    if(displaced) {
        return finalPath + "/" + fileName as ValidatedPath;
    }
    return true;
}

/**
 * Makes a new folder in the VFS. Non-recursive: Only one folder can be created
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
    return true;
}

/**
 * Deletes an item from the VFS, and asynchronously from the file system after a
 * delay. The delay is to allow for other possible operations on the file or
 * files inside the folder to complete.
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
    return true;
}

/**
 * Paths should be complete file paths.
 *
 * If you are moving a file:
 * If there exists a file at the destination with the same name, it will be
 * overwritten.
 * 
 * If you are moving a folder:
 * Destination must not exist.
 * 
 * You are not allowed to move a file to a folder, or vice versa.
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
    if(destinationParentDirectory === null || destinationParentPath === null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but the destination path's parent directory does not exist.`);
        return false;
    }

    const originalItem = originalParentDirectory.getAny(originalName);
    if(originalItem === null) {
        vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but there is no item at "${originalPath}".`);
        return false;
    }
    
    const destinationItem = destinationParentDirectory.getAny(destinationName);

    if(destinationItem !== null) {
        if(destinationItem.isDirectory) {
            vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but there is an existing directory at destination.`);
            return false;
        }
        if(originalItem.isDirectory !== destinationItem.isDirectory) {
            vaultLog(originalVault, "NON URGENT", `Moving "${originalPath}" to "${destinationPath}", but one is a file and one is a directory.`);
            return false;
        }
        // At this point, both are files. Removing destination...
        deleteItem(destinationPath);
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

        for(const file of files) {
            const realFilePath = path.join(BASE_VAULT_DIRECTORY, originalVault, file.realFile);
            const newFileName = await getTempFile(destinationVault)
            const newFilePath = path.join(BASE_VAULT_DIRECTORY, destinationVault, newFileName);
            try {
                await fs.rename(realFilePath, newFilePath);
                file.realFile = newFileName;
            } catch(error) {
                const message = `Moving real file "${realFilePath}" from "${originalPath}" to "${newFilePath}" in "${destinationPath}", but encountered unexpected error ${(error as Error).message}.`;
                vaultLog(originalVault, "ERROR", message);
                vaultLog(destinationVault, "ERROR", message);
            }
        }
    }
    
    vaultLog(originalVault, "INFO", `Moved "${originalPath}" to "${destinationPath}".`);
    if(originalVault !== destinationVault) {
        vaultLog(destinationVault, "INFO", `Moved "${originalPath}" to "${destinationPath}".`);
    }
    return true;
}

/**
 * Paths should be complete file paths. 
 * 
 * If you are moving a file:
 * If there exists a file at the destination with the same name, it will be
 * overwritten.
 * 
 * If you are moving a folder:
 * Destination must not exist.
 * 
 * You are not allowed to copy a file to a folder, or vice versa.
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
        if(destinationItem.isDirectory) {
            vaultLog(originalVault, "NON URGENT", `Copying entry at "${originalPath}" to "${destinationPath}", but there is an existing directory at destination.`);
            return false;
        }
        if(originalItem.isDirectory !== destinationItem.isDirectory) {
            vaultLog(originalVault, "NON URGENT", `Copying entry at "${originalPath}" to "${destinationPath}", but one is a file and one is a directory.`);
            return false;
        }
        // At this point, both are files. Removing destination...
        deleteItem(destinationPath);
    }

    const copiedItem = originalItem.clone(true);
    copiedItem.name = destinationName;
    destinationParentDirectory.addEntry(copiedItem, true);
    
    // File system modification
    const copiedFiles = copiedItem.isDirectory
    ? (copiedItem as Directory).getAllSubfiles()
    : [ copiedItem as File ];
    
    for(const copiedFile of copiedFiles) {
        const realFilePath = path.join(BASE_VAULT_DIRECTORY, originalVault, copiedFile.realFile);
        const copiedFileName = await getTempFile(destinationVault);
        const copiedFilePath = path.join(BASE_VAULT_DIRECTORY, destinationVault, copiedFileName);
        try {
            await fs.cp(realFilePath, copiedFilePath);
            copiedFile.realFile = copiedFileName;
        } catch(error) {
            const message = `Copying real file "${realFilePath}" from "${originalPath}" to "${copiedFilePath}" in "${destinationPath}", but encountered unexpected error ${(error as Error).message}.`;
            vaultLog(originalVault, "ERROR", message);
            if(originalVault !== destinationVault) {
                vaultLog(destinationVault, "ERROR", message);
            }
        }
    }

    vaultLog(originalVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    if(originalVault !== destinationVault) {
        vaultLog(destinationVault, "INFO", `Copied "${originalPath}" to "${destinationPath}".`);
    }
    return true;
}
export {
    getTempFile,
    addFile,
    addFolder,
    deleteItem,
    moveItem,
    copyItem,
};