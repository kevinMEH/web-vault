// The vault controller file
// Maintains the VFS of the vaults.
// Contains functions for validating paths and associating paths with the
// respective Files or Directories.

import { File, Directory } from "./vfs";

import { vaultMap } from "./authentication/database";

export type ValidatedPath = string & { __type: "ValidatedPath" };
export type VaultPath = string & { __type: "VaultPath" };

/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 */
const validNameRegex = /(?!^(\.)+$)^(?! |-)[a-zA-Z0-9_\-. ]+(?<! )$/
/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 */
const validPathRegex = /(?!^(\.)+($|\/))^(?! |-)[a-zA-Z0-9_\-. ]+(?<! )(\/(?!(\.)+($|\/))(?! |-)[a-zA-Z0-9_\-. )]+(?<! ))+$/;





function newVaultVFS(vault: string) {
    const vaultVFS = new Directory(vault, []);
    vaultMap.set(vault, vaultVFS);
}

/**
 * Returns true if the vault exists and has been deleted, false if the vault
 * does not exist.
 * 
 * @param vault 
 * @returns 
 */
function deleteVaultVFS(vault: string): boolean {
    return vaultMap.delete(vault);
}

/**
 * Another test for a vault's existance, but this time depending on if the vault
 * directory exists in the VFS.
 * 
 * @param vault - Vault name string
 * @returns
 */
function vaultVFSExists(vault: string | VaultPath): boolean {
    return vaultMap.has(vault as string);
}





/**
 * Returns the first directory of the path. Paths should be of the form:
 * vault/folder/folder/file
 * 
 * Will not resolve dots, check for valid paths, check for valid vault, etc.
 * But validate will take care of all of that. Specifically, it will check that
 * it is inside the baseVaultDirectory already.
 * 
 * @param filePath 
 * @returns 
 */
function getVaultFromPath(filePath: ValidatedPath | VaultPath): VaultPath {
    return (filePath.substring(0, filePath.indexOf("/")) || filePath) as VaultPath;
}

/**
 * Gets the parent directory path of the file path. If the path is just a vault
 * directory, returns null.
 * 
 * vault/folder/file -> vault/folder
 * vault/folder -> vault
 * vault -> null
 * 
 * @param filePath 
 * @returns 
 */
function getParentPath(filePath: ValidatedPath): ValidatedPath | null {
    const lastSlash = filePath.lastIndexOf("/");
    if(lastSlash === -1) return null;
    return filePath.substring(0, lastSlash) as ValidatedPath;
}

/**
 * Takes a ValidatedPath, returns the parent directory as a ValidatedPath and
 * the child item as a string. Returns null if the path is just the vault
 * directory.
 * 
 * @param filePath 
 * @returns 
 */
function splitParentChild(filePath: ValidatedPath | VaultPath): [ValidatedPath | VaultPath, string] | [ null, null ] {
    const lastSlash = filePath.lastIndexOf("/");
    if(lastSlash === -1) return [ null, null ];
    return [ filePath.substring(0, lastSlash) as ValidatedPath, filePath.substring(lastSlash + 1)]
}

/**
 * The file path should be of this form:
 * vault/folder/folder/file
 * 
 * The validate function checks that the path is valid and if the vault exists.
 * 
 * Returns the resolved path or null if the path is bad.
 * 
 * @param filePath 
 * @returns ValidatedPath | null
 */
function validate(filePath: string): ValidatedPath | null {
    if(filePath.charAt(filePath.length - 1) === "/") {
        // If for whatever reason ends in a /, remove it
        filePath = filePath.substring(0, filePath.length - 1);
    }
    if(false === validPathRegex.test(filePath)) {
        return null;
    }
    const vault = getVaultFromPath(filePath as ValidatedPath);
    if(!vaultVFSExists(vault)) {
        return null;
    }
    return filePath as ValidatedPath;
}

function getVaultVFS(vault: string): Directory | null {
    const maybeDirectory = vaultMap.get(vault);
    if(maybeDirectory !== undefined) return maybeDirectory;
    else return null;
}

function getAt(path: ValidatedPath | VaultPath | null): File | Directory | null {
    if(path === null) return null;
    const directories = path.split("/");
    let last: Directory | null | undefined = getVaultVFS(directories[0]);
    if(directories.length === 1) {
        return last;
    }
    for(let i = 1; i < directories.length - 1; i++) {
        last = last?.getDirectory(directories[i]);
    }
    const item: File | Directory | null | undefined = last?.getAny(directories[directories.length - 1]);
    if(item === null || item === undefined) return null;
    return item;
}

function getDirectoryAt(path: ValidatedPath | VaultPath | null): Directory | null {
    if(path === null) return null;
    const directories = path.split("/");
    let last: Directory | null | undefined = getVaultVFS(directories[0]);
    for(let i = 1; i < directories.length; i++) {
        last = last?.getDirectory(directories[i]);
    }
    if(last === null || last === undefined) return null;
    return last;
}

function getFileAt(path: ValidatedPath | null): File | null {
    if(path === null) return null;
    const directories = path.split("/");
    let last: Directory | null | undefined = getVaultVFS(directories[0]);
    for(let i = 1; i < directories.length - 1; i++) {
        last = last?.getDirectory(directories[i]);
    }
    const file: File | null | undefined = last?.getFile(directories[directories.length - 1]);
    if(file === null || file === undefined) return null;
    return file;
}

export {
    validNameRegex,
    validPathRegex,
    newVaultVFS,
    deleteVaultVFS,
    vaultVFSExists,
    getVaultFromPath,
    getParentPath,
    splitParentChild,
    validate,
    getVaultVFS,
    getAt,
    getDirectoryAt,
    getFileAt
};