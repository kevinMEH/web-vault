import { after, before, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";

import config from "../config";


config.TESTING = true;
if(process.env.REDIS) {
    config.REDIS = true;
    console.log("Using Redis");
} else {
    console.log("Using in memory database");
}
const { cleanup } = await import("../src/cleanup");


import type { VaultPath, ValidatedPath } from "../src/controller";
import type { File, Directory } from "../src/vfs";
import type { Stats } from "fs";

const { createNewVault, deleteVault } = await import("../src/vault");
const { getAt, getDirectoryAt, validate } = await import("../src/controller");
const { getTempFile, addFile, addFolder, copyItem, moveItem, deleteItem } = await import("../src/file");
const { BASE_VAULT_DIRECTORY } = await import("../src/env");

describe("File function tests", () => {
    const tempVault = "temp" as VaultPath;
    const testVaultOne = "test-vault-one" as VaultPath;
    const testVaultTwo = "test-vault-two" as VaultPath;

    let gitignoreTemp: string;
    let licenseTemp: string;
    let tsconfigTemp: string;
    let packageTemp: string;
    let packageLockTemp: string;
    
    let gitignoreStat: Stats;
    let licenseStat: Stats;
    let tsconfigStat: Stats;
    let packageStat: Stats;
    let packageLockStat: Stats;

    let gitignorePath: ValidatedPath;
    let licensePath: ValidatedPath;
    let tsconfigPath: ValidatedPath;
    let packagePath: ValidatedPath;
    let packageLockPath: ValidatedPath;
    
    // Assert that files in the following array are really deleted from the file
    // system.
    // [reason, path][]
    const assertDeletedFiles: [string, string][] = [];
    
    /*
    test-vault-one
        folder1
            .gitignore -> .gitignore
        folder2
            another folder
                file.json -> tsconfig.json
        somefile.txt -> LICENSE
    
    test-vault-two
        some folder
            package-lock -> package-lock.json
        package -> package.json
    */

    before(async () => {
        gitignoreTemp = await getTempFile(tempVault);
        licenseTemp = await getTempFile(tempVault);
        tsconfigTemp = await getTempFile(tempVault);
        packageTemp = await getTempFile(tempVault);
        packageLockTemp = await getTempFile(tempVault);
    
        assert(await createNewVault(testVaultOne, "randompassword") === null);
        assert(await createNewVault(testVaultTwo, "randompassword") === null);
        
        gitignoreStat = await fs.stat("./.gitignore");
        licenseStat = await fs.stat("./LICENSE");
        tsconfigStat = await fs.stat("./tsconfig.json");
        packageStat = await fs.stat("./package.json");
        packageLockStat = await fs.stat("./package-lock.json");
        
        await fs.cp("./.gitignore", path.join(BASE_VAULT_DIRECTORY, tempVault, gitignoreTemp));
        await fs.cp("./LICENSE", path.join(BASE_VAULT_DIRECTORY, tempVault, licenseTemp));
        await fs.cp("./tsconfig.json", path.join(BASE_VAULT_DIRECTORY, tempVault, tsconfigTemp));
        await fs.cp("./package.json", path.join(BASE_VAULT_DIRECTORY, tempVault, packageTemp));
        await fs.cp("./package-lock.json", path.join(BASE_VAULT_DIRECTORY, tempVault, packageLockTemp));
        
        let verifyPath: ValidatedPath | null;

        verifyPath = validate(testVaultOne + "/folder1/.gitignore");
        assert(verifyPath !== null);
        gitignorePath = verifyPath;

        verifyPath = validate(testVaultOne + "/somefile.txt");
        assert(verifyPath !== null);
        licensePath = verifyPath;

        verifyPath = validate(testVaultOne + "/folder2/another folder/file.json");
        assert(verifyPath !== null);
        tsconfigPath = verifyPath;

        verifyPath = validate(testVaultTwo + "/package");
        assert(verifyPath !== null);
        packagePath = verifyPath;

        verifyPath = validate(testVaultTwo + "/some folder/package-lock");
        assert(verifyPath !== null);
        packageLockPath = verifyPath;
    });

    it("Tests adding files", async () => {
        assert(await addFile(gitignorePath, gitignoreTemp) === true);
        assert(await addFile(licensePath, licenseTemp) === true);
        assert(await addFile(tsconfigPath, tsconfigTemp) === true);
        assert(await addFile(packagePath, packageTemp) === true);
        assert(await addFile(packageLockPath, packageLockTemp) === true);
    });
    
    it("Checks that the file structure is correct", async () => {
        let entry: Directory | File | null;
        let realFileStat: Stats;
        
        entry = getAt(gitignorePath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        realFileStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, (entry as File).realFile));
        assert(realFileStat.size === gitignoreStat.size);
        assert(realFileStat.size === (entry as File).byteSize);
        assert(realFileStat.mtime.toJSON() === (entry as File).lastModified.toJSON());

        entry = getAt(licensePath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        realFileStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, (entry as File).realFile));
        assert(realFileStat.size === licenseStat.size);
        assert(realFileStat.size === (entry as File).byteSize);
        assert(realFileStat.mtime.toJSON() === (entry as File).lastModified.toJSON());

        entry = getAt(tsconfigPath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        realFileStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, (entry as File).realFile));
        assert(realFileStat.size === tsconfigStat.size);
        assert(realFileStat.size === (entry as File).byteSize);
        assert(realFileStat.mtime.toJSON() === (entry as File).lastModified.toJSON());

        entry = getAt(testVaultOne);
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 3);

        entry = getAt(validate(testVaultOne + "/folder1"));
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 1);

        entry = getAt(validate(testVaultOne + "/folder2"));
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 1);

        entry = getAt(validate(testVaultOne + "/folder2/another folder"));
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 1);
        


        entry = getAt(packagePath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        realFileStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (entry as File).realFile));
        assert(realFileStat.size === packageStat.size);
        assert(realFileStat.size === (entry as File).byteSize);
        assert(realFileStat.mtime.toJSON() === (entry as File).lastModified.toJSON());

        entry = getAt(packageLockPath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        realFileStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (entry as File).realFile));
        assert(realFileStat.size === packageLockStat.size);
        assert(realFileStat.size === (entry as File).byteSize);
        assert(realFileStat.mtime.toJSON() === (entry as File).lastModified.toJSON());
        
        entry = getAt(testVaultTwo);
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 2);

        entry = getAt(validate(testVaultTwo + "/some folder"));
        assert(entry !== null);
        assert(entry.isDirectory);
        assert((entry as Directory).contents.length === 1);
        
        
        
        entry = getAt(validate(testVaultOne + "/nonexistant"));
        assert(entry === null);

        entry = getAt(validate(testVaultOne + "/nonexistant/nonexistant also"));
        assert(entry === null);

        entry = getAt(validate(testVaultOne + "/asdf.asdf"));
        assert(entry === null);

        entry = getAt(validate(testVaultTwo + "/.an2n1 12312__--as."));
        assert(entry === null);

        entry = getAt(validate(testVaultTwo + "/??!@?!#<>"));
        assert(entry === null);
        
        assert((await fs.readdir(path.join(BASE_VAULT_DIRECTORY, testVaultOne))).length === 3);
        assert((await fs.readdir(path.join(BASE_VAULT_DIRECTORY, testVaultTwo))).length === 2);
        // There will still be the .trackme file
        assert((await fs.readdir(path.join(BASE_VAULT_DIRECTORY, tempVault))).length === 1);
    });
    
    it("Checks folder creation and deletion", () => {
        const verifiedPath = validate(testVaultOne + "/new folder");
        assert(verifiedPath !== null);
        addFolder(verifiedPath);
        
        assert(getAt(verifiedPath) !== null);
        assert(getAt(verifiedPath)?.isDirectory === true);
        assert(getDirectoryAt(verifiedPath)?.contents.length === 0);
        
        assert(deleteItem(verifiedPath) === true);
        assert(getAt(verifiedPath) === null);
    });
    
    it("Cannot create folder that conflicts with preexisting entries", () => {
        assert(addFolder(tsconfigPath) === false);
        assert(getAt(tsconfigPath)?.isDirectory === false);
        assert(addFolder(packagePath) === false);
        assert(getAt(packagePath)?.isDirectory === false);
        assert(addFolder(testVaultOne + "/folder1" as ValidatedPath) === false);
        assert(getAt(testVaultOne + "/folder1" as ValidatedPath)?.isDirectory === true);
        assert(addFolder(testVaultOne + "/folder2" as ValidatedPath) === false);
        assert(getAt(testVaultOne + "/folder2" as ValidatedPath)?.isDirectory === true);
        assert(addFolder(testVaultTwo + "/some folder" as ValidatedPath) === false);
        assert(getAt(testVaultTwo + "/some folder" as ValidatedPath)?.isDirectory === true);
    })
    
    it("Checks copying items in same vault and across vaults", async () => {
        let oldEntry: File | Directory | null;
        let copiedEntry: File | Directory | null;
        let oldStat: Stats;
        let copiedStat: Stats;
        let previousRealFile: string;
        let copiedRealFile: string;
        
        previousRealFile = (getAt(packagePath) as File).realFile;
        assert(await copyItem(packagePath, testVaultTwo + "/some folder/new package" as ValidatedPath) === true);
        oldEntry = getAt(packagePath);
        copiedEntry = getAt(testVaultTwo + "/some folder/new package" as ValidatedPath);
        assert(oldEntry !== null);
        assert(copiedEntry !== null);
        assert(copiedEntry.name === "new package");
        assert(oldEntry.isDirectory === copiedEntry.isDirectory);
        assert(oldEntry.getByteSize() === copiedEntry.getByteSize());
        assert((oldEntry as File).realFile === previousRealFile);
        assert((oldEntry as File).realFile !== (copiedEntry as File).realFile); // Copied file has a new realFile
        copiedRealFile = (copiedEntry as File).realFile;
        oldStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (oldEntry as File).realFile));
        copiedStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (copiedEntry as File).realFile));
        assert(oldStat.size === copiedStat.size);
        // Will not match exactly but should be close enough
        assert(Math.abs(copiedStat.mtime.valueOf() - copiedEntry.lastModified.valueOf()) < 1000);
        assert(deleteItem(testVaultTwo + "/some folder/new package" as ValidatedPath) === true);
        assertDeletedFiles.push(["1st copy: Copying items in same vault", testVaultTwo + "/" + copiedRealFile]);
        
        previousRealFile = (getAt(packagePath) as File).realFile;
        assert(await copyItem(packagePath, testVaultOne + "/folder2/copied.json" as ValidatedPath) === true);
        oldEntry = getAt(packagePath);
        copiedEntry = getAt(testVaultOne + "/folder2/copied.json" as ValidatedPath);
        assert(oldEntry !== null);
        assert(copiedEntry !== null);
        assert(copiedEntry.name === "copied.json");
        assert(oldEntry.isDirectory === copiedEntry.isDirectory);
        assert(oldEntry.getByteSize() === copiedEntry.getByteSize());
        assert((oldEntry as File).realFile === previousRealFile);
        assert((oldEntry as File).realFile !== (copiedEntry as File).realFile);
        copiedRealFile = (copiedEntry as File).realFile;
        oldStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (oldEntry as File).realFile));
        copiedStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, (copiedEntry as File).realFile));
        assert(oldStat.size === copiedStat.size);
        // Will not match exactly but should be close enough
        assert(Math.abs(copiedStat.mtime.valueOf() - copiedEntry.lastModified.valueOf()) < 1000);
        assert(deleteItem(testVaultOne + "/folder2/copied.json" as ValidatedPath) === true);
        assertDeletedFiles.push(["2nd copy: Copying items in across vaults", testVaultOne + "/" + copiedRealFile]);
    });
    
    it("Checks copying folders in same vault and across vaults", async () => {
        let oldEntry: File | Directory | null;
        let copiedEntry: File | Directory | null;
        let oldStat: Stats;
        let copiedStat: Stats;
        let copiedRealFile: string;
        
        assert(await copyItem(testVaultTwo + "/some folder" as ValidatedPath, testVaultTwo + "/copied folder" as ValidatedPath) === true);
        oldEntry = getAt(testVaultTwo + "/some folder" as ValidatedPath);
        copiedEntry = getAt(testVaultTwo + "/copied folder" as ValidatedPath);
        assert(oldEntry !== null);
        assert(copiedEntry !== null);
        assert(copiedEntry.name === "copied folder");
        assert(oldEntry.isDirectory === copiedEntry.isDirectory);
        assert(oldEntry.getByteSize() === copiedEntry.getByteSize());
        assert((oldEntry as Directory).contents.length === (copiedEntry as Directory).contents.length);
        assert((oldEntry as Directory).getAny("package-lock") !== null);
        assert((copiedEntry as Directory).getAny("package-lock") !== null);
        assert((oldEntry as Directory).getAny("package-lock")?.name === (copiedEntry as Directory).getAny("package-lock")?.name);
        assert((oldEntry as Directory).getAny("package-lock")?.isDirectory === (copiedEntry as Directory).getAny("package-lock")?.isDirectory);
        assert((oldEntry as Directory).getAny("package-lock")?.getByteSize() === (copiedEntry as Directory).getAny("package-lock")?.getByteSize());
        assert(((oldEntry as Directory).getAny("package-lock") as File).realFile !== ((copiedEntry as Directory).getAny("package-lock") as File).realFile);
        copiedRealFile = ((copiedEntry as Directory).getAny("package-lock") as File).realFile;
        oldStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, ((oldEntry as Directory).getAny("package-lock") as File).realFile));
        copiedStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, copiedRealFile));
        assert(oldStat.size === copiedStat.size);
        assert(oldStat.mtime.toJSON() === ((oldEntry as Directory).getAny("package-lock") as File).lastModified.toJSON());
        // New file mtime not guaranteed to be consistent with stat mtime, although they will be pretty close.
        assert(Math.abs(copiedStat.mtime.valueOf() - ((oldEntry as Directory).getAny("package-lock") as File).lastModified.valueOf()) < 2000);
        assert(deleteItem(testVaultTwo + "/copied folder" as ValidatedPath) === true);
        assertDeletedFiles.push(["1st copy: Copying folders in same vault", testVaultTwo + "/" + copiedRealFile]);
        
        assert(await copyItem(testVaultTwo + "/some folder" as ValidatedPath, testVaultOne + "/folder2/copied folder" as ValidatedPath) === true);
        oldEntry = getAt(testVaultTwo + "/some folder" as ValidatedPath);
        copiedEntry = getAt(testVaultOne + "/folder2/copied folder" as ValidatedPath);
        assert(oldEntry !== null);
        assert(copiedEntry !== null);
        assert(copiedEntry.name === "copied folder");
        assert(oldEntry.isDirectory === copiedEntry.isDirectory);
        assert(oldEntry.getByteSize() === copiedEntry.getByteSize());
        assert((oldEntry as Directory).contents.length === (copiedEntry as Directory).contents.length);
        assert((oldEntry as Directory).getAny("package-lock") !== null);
        assert((copiedEntry as Directory).getAny("package-lock") !== null);
        assert((oldEntry as Directory).getAny("package-lock")?.name === (copiedEntry as Directory).getAny("package-lock")?.name);
        assert((oldEntry as Directory).getAny("package-lock")?.isDirectory === (copiedEntry as Directory).getAny("package-lock")?.isDirectory);
        assert((oldEntry as Directory).getAny("package-lock")?.getByteSize() === (copiedEntry as Directory).getAny("package-lock")?.getByteSize());
        assert(((oldEntry as Directory).getAny("package-lock") as File).realFile !== ((copiedEntry as Directory).getAny("package-lock") as File).realFile);
        copiedRealFile = ((copiedEntry as Directory).getAny("package-lock") as File).realFile;
        oldStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, ((oldEntry as Directory).getAny("package-lock") as File).realFile));
        copiedStat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, copiedRealFile));
        assert(oldStat.size === copiedStat.size);
        assert(oldStat.mtime.toJSON() === ((oldEntry as Directory).getAny("package-lock") as File).lastModified.toJSON());
        // New file mtime not guaranteed to be consistent with stat mtime, although they will be pretty close.
        assert(Math.abs(copiedStat.mtime.valueOf() - ((oldEntry as Directory).getAny("package-lock") as File).lastModified.valueOf()) < 2000);
        assert(deleteItem(testVaultOne + "/folder2/copied folder" as ValidatedPath) === true);
        assertDeletedFiles.push(["2nd copy: Copying folders across vaults", testVaultOne + "/" + copiedRealFile]);
    });
    
    it("Checks copying file to file replaces file", async () => {
        assert(await copyItem(packagePath, testVaultTwo + "/some folder/copied package" as ValidatedPath) === true);
        const replacedRealFile = (getAt(testVaultTwo + "/some folder/copied package" as ValidatedPath) as File).realFile;
        assert(await copyItem(licensePath, testVaultTwo + "/some folder/copied package" as ValidatedPath) === true);
        const oldEntry = getAt(licensePath);
        const copiedEntry = getAt(testVaultTwo + "/some folder/copied package" as ValidatedPath);
        assert(oldEntry !== null);
        assert(copiedEntry !== null);
        assert(oldEntry.isDirectory === copiedEntry.isDirectory);
        assert(oldEntry.getByteSize() === copiedEntry.getByteSize());
        assert(replacedRealFile !== (copiedEntry as File).realFile);
        // Make sure that the replaced file's real file will be deleted
        assertDeletedFiles.push(["Copying file to file replaces file", testVaultTwo + "/" + replacedRealFile]);
        assert(deleteItem(testVaultTwo + "/some folder/copied package" as ValidatedPath) === true);
    });
    
    it("Checks copying restrictions", async () => {
        // Can't copy directory into preexisting entries
        assert(await copyItem(testVaultOne + "/folder1" as ValidatedPath, testVaultOne + "/folder2" as ValidatedPath) === false);
        assert(await copyItem(testVaultOne + "/folder1" as ValidatedPath, packagePath) === false);
        
        // Can't copy file as directory
        assert(await copyItem(packagePath, testVaultTwo + "/some folder" as ValidatedPath) === false);
    });

    it("Checks moving files in same vault and across vaults", async () => {
        let entry: File | Directory | null;
        let stat: Stats;
        let previousRealFile: string;

        // Moving within same vault
        previousRealFile = (getAt(gitignorePath) as File).realFile;
        assert(await moveItem(gitignorePath, testVaultOne + "/folder2/.gitignore" as ValidatedPath) === true);
        assert(getAt(gitignorePath) === null);
        entry = getAt(testVaultOne + "/folder2/.gitignore" as ValidatedPath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        assert(previousRealFile === (entry as File).realFile);
        stat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, (entry as File).realFile));
        assert(stat.size === entry.getByteSize());
        assert(stat.mtime.toJSON() === entry.lastModified.toJSON());
        // Moving back
        assert(await moveItem(testVaultOne + "/folder2/.gitignore" as ValidatedPath, gitignorePath) === true);
        assert(getAt(gitignorePath) !== null);
        
        // Moving across vaults
        previousRealFile = (getAt(gitignorePath) as File).realFile;
        assert(await moveItem(gitignorePath, testVaultTwo + "/new file" as ValidatedPath));
        assert(getAt(gitignorePath) === null);
        entry = getAt(testVaultTwo + "/new file" as ValidatedPath);
        assert(entry !== null);
        assert(entry.isDirectory === false);
        // Real file location is different when moving across different vaults.
        assert(previousRealFile !== (entry as File).realFile);
        try {
            // No longer at old location
            await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultOne, previousRealFile));
            assert(false, `There should no longer be a real file inside the ` + 
            `original vault after moving the corresponding VFS File entry to a new vault.`);
        } catch(error) {
            assert((error as NodeJS.ErrnoException).code === "ENOENT");
        }
        stat = await fs.stat(path.join(BASE_VAULT_DIRECTORY, testVaultTwo, (entry as File).realFile));
        assert(stat.size === entry.getByteSize());
        assert(stat.mtime.toJSON() === entry.lastModified.toJSON());
        // Moving back
        assert(await moveItem(testVaultTwo + "/new file" as ValidatedPath, gitignorePath) === true);
        assert(getAt(gitignorePath) !== null);
    });
    
    it("Checks moving folders in same vault and across vaults", async () => {
        let previousItem: File | Directory | null;
        let previousItemLength: number;
        let previousItemFile: File | Directory | null;
        let previousItemFileRealFile: string;
        let newItem: File | Directory | null;

        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) !== null);
        assert(getAt(testVaultOne + "/new_folder_location" as ValidatedPath) === null);
        previousItem = getAt(testVaultOne + "/folder2" as ValidatedPath);
        previousItemLength = (previousItem as Directory).contents.length;
        previousItemFile = (previousItem as Directory).contents[0];
        previousItemFileRealFile = (previousItemFile as File).realFile;
        assert(await moveItem(testVaultOne + "/folder2" as ValidatedPath, testVaultOne + "/new_folder_location" as ValidatedPath) === true);
        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) === null);
        assert(getAt(testVaultOne + "/new_folder_location" as ValidatedPath) !== null);
        newItem = getAt(testVaultOne + "/new_folder_location" as ValidatedPath);
        assert(previousItem === newItem); // Folder references should be the same before and after move
        assert((newItem as Directory).contents.length === previousItemLength);
        assert((newItem as Directory).contents[0] === previousItemFile); // Item inside should be the same before and after move
        // Real file should not change as we are moving within the same vault
        assert(((newItem as Directory).contents[0] as File).realFile === previousItemFileRealFile);
        // Moving back
        assert(await moveItem(testVaultOne + "/new_folder_location" as ValidatedPath, testVaultOne + "/folder2" as ValidatedPath) === true);
        
        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) !== null);
        assert(getAt(testVaultTwo + "/some folder/new_folder_location" as ValidatedPath) === null);
        previousItem = getAt(testVaultOne + "/folder2" as ValidatedPath);
        previousItemLength = (previousItem as Directory).contents.length;
        previousItemFile = ((previousItem as Directory).contents[0] as Directory).contents[0];
        previousItemFileRealFile = (previousItemFile as File).realFile;
        assert(await moveItem(testVaultOne + "/folder2" as ValidatedPath, testVaultTwo + "/some folder/new_folder_location" as ValidatedPath) === true);
        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) === null);
        assert(getAt(testVaultTwo + "/some folder/new_folder_location" as ValidatedPath) !== null);
        newItem = getAt(testVaultTwo + "/some folder/new_folder_location" as ValidatedPath);
        assert(previousItem === newItem); // Folder references should be the same before and after move
        assert((newItem as Directory).contents.length === previousItemLength);
        assert(((newItem as Directory).contents[0] as Directory).contents[0] === previousItemFile); // Item inside should be the same before and after move
        // Real file should be different as we are moving across vaults
        assert((((newItem as Directory).contents[0] as Directory).contents[0] as File).realFile !== previousItemFileRealFile);
        assertDeletedFiles.push(["Moving folder across vaults deletes previous subfiles real files", previousItemFileRealFile]);
        // Moving back
        assert(await moveItem(testVaultTwo + "/some folder/new_folder_location" as ValidatedPath, testVaultOne + "/folder2" as ValidatedPath) === true);
    });
    
    it("Checks moving restrictions", async () => {
        // Can't move directory into preexisting entries
        assert(await moveItem(testVaultOne + "/folder2" as ValidatedPath, testVaultTwo + "/some folder" as ValidatedPath) === false);
        assert(await moveItem(testVaultOne + "/folder2" as ValidatedPath, gitignorePath) === false);
        
        // Can't move file as directory
        assert(await moveItem(tsconfigPath, testVaultOne + "/folder1" as ValidatedPath) === false);
        
        // Can't move directory into some place inside itself
        assert(await moveItem(testVaultOne + "/folder2" as ValidatedPath, testVaultOne + "/folder2/new folder" as ValidatedPath) === false);
    });
    
    it("Deletes items, and checks that all items have been deleted", async () => {
        assert(getAt(gitignorePath) !== null);
        assertDeletedFiles.push(["Deleting file deletes real file", (getAt(gitignorePath) as File).realFile]);
        deleteItem(gitignorePath);
        assert(getAt(gitignorePath) === null);

        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) !== null);
        assertDeletedFiles.push(["Deleting folder deletes sub files' real files", (getAt(tsconfigPath) as File).realFile]);
        deleteItem(testVaultOne + "/folder2" as ValidatedPath);
        assert(getAt(testVaultOne + "/folder2" as ValidatedPath) === null);
        assert(getAt(tsconfigPath) === null);
        
        // Delete delay is 5 seconds, 6 should be more than enough
        await new Promise(resolve => setTimeout(resolve, 6 * 1000)); // eslint-disable-line
        for(const [deletionReason, realPath] of assertDeletedFiles) {
            try {
                await fs.stat(path.join(BASE_VAULT_DIRECTORY, realPath));
                assert(false, "Deletion failed at: " + deletionReason);
            } catch(error) {
                if((error as NodeJS.ErrnoException).code !== "ENOENT") {
                    assert(false, `Deletion encountered a different error than ENOENT ${(error as Error).message}. Deletion failed at: ` + deletionReason);
                }
            }
        }
    });
    
    after(async () => {
        await deleteVault(testVaultOne, true);
        await deleteVault(testVaultTwo, true);
        await cleanup();
    });
});