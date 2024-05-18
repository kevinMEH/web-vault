import { after, before, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";

import config from "../config";


const vaultDirectory = config.BASE_VAULT_DIRECTORY = path.join(process.cwd(), "vaults");
config.JWT_SECRET = "4B6576696E20697320636F6F6C";
config.DOMAIN = "Kevin";
config.PASSWORD_SALT = "ABC99288B9288B22A66F00E";


import type { ValidatedPath, VaultPath } from "../src/controller";

if(process.env.REDIS) {
    config.REDIS = true;
    console.log("Using Redis");
} else {
    console.log("Using in memory database");
}
const { cleanup } = await import("../src/cleanup");

const { File, Directory } = await import("../src/vfs");
const { newVaultVFS, vaultVFSExists, validatePath, getAt, getDirectoryAt, getFileAt } = await import("../src/controller");
const { createNewVault, deleteVault } = await import("../src/vault");

describe("VFS controller tests", () => {
    before(() => {
        newVaultVFS("vault");
        getDirectoryAt("vault" as VaultPath)
        ?.addEntry(new File(".gitignore", 1, "ASDF"), false);

        getDirectoryAt("vault" as VaultPath)
        ?.addEntry(new Directory("folder1", []), false);
        getDirectoryAt("vault/folder1" as VaultPath)
        ?.addEntry(new File("package.json", 1, "PAC"), false);
        getDirectoryAt("vault/folder1" as VaultPath)
        ?.addEntry(new Directory("folder2", []), false);
        getDirectoryAt("vault/folder1/folder2" as VaultPath)
        ?.addEntry(new File("LICENSE", 1, "LIC"), false);
        
        getDirectoryAt("vault" as VaultPath)
        ?.addEntry(new Directory("folder1.1", []), false);
        getDirectoryAt("vault/folder1.1" as VaultPath)
        ?.addEntry(new File("tsconfig.json", 1, "TSC"), false);

        newVaultVFS("anothervault");
        getDirectoryAt("anothervault" as VaultPath)
        ?.addEntry(new Directory("folder", []), false);
        getDirectoryAt("anothervault/folder" as VaultPath)
        ?.addEntry(new Directory("another folder", []), false);
        getDirectoryAt("anothervault/folder/another folder" as VaultPath)
        ?.addEntry(new Directory("yet another folder", []), false);
        getDirectoryAt("anothervault/folder/another folder/yet another folder" as VaultPath)
        ?.addEntry(new File("package-lock.json", 1, "PAC"), false);
    });

    it("Tests the validate function", () => {
        assert(validatePath("vault/.gitignore") !== null);
        assert(validatePath("vault/folder1") !== null);
        assert(validatePath("anothervault/folder/another folder/yet another folder/package-lock.json") !== null);


        // Most of the test below is to make sure the function doesn't break
        assert(null === validatePath("."));
        assert(null === validatePath(".."));
        assert(null === validatePath("......."));
        assert(null === validatePath(". "));
        assert(null === validatePath(" ."));
        assert(null === validatePath(" . "));
        assert(null === validatePath("  ."));

        assert(null === validatePath("./asdf"));
        assert(null === validatePath("vault/."));
        assert(null === validatePath("vault/./folder1"));
        assert(null === validatePath("asdf/../asdf"));

        assert(null === validatePath(""));
        assert(null === validatePath("   "));
        assert(null === validatePath(" asdf"));
        assert(null === validatePath("asdf "));
        assert(null === validatePath(" asdf "));
        assert(null === validatePath(". asdf. "));
        assert(null === validatePath(".asdf. "));
        
        assert(null === validatePath(" /asdf"));
        assert(null === validatePath("asdf/ asdf"));
        assert(null === validatePath("asdf/asdf "));
        assert(null === validatePath("asdf /asdf"));
        assert(null === validatePath("asdf / asdf"));


        assert(null === validatePath("\tasdf"));
        assert(null === validatePath("asdf\n"));

        assert(null === validatePath("asdf/\tasdf"));
        assert(null === validatePath("asdf\n/asdf"));
        assert(null === validatePath("asdf/asdf\n"));


        assert(null === validatePath("asdf/"));
        assert(null === validatePath("/asdf"));
        assert(null === validatePath("/"));
        assert(null === validatePath("asdf/asdf/"));
        assert(null === validatePath("/asdf/"));
        assert(null === validatePath("_._/.asdf/"));
        assert(null === validatePath("asdf//asdf"));
        assert(null === validatePath("asdf//"));


        assert(null === validatePath("-rf"));
        assert(null === validatePath("- -rf"));
        assert(null === validatePath("--rf"));

        assert(null === validatePath("asdf/-rf"));
        assert(null === validatePath("-rf/asdf"));
        assert(null === validatePath("asdf/- -rf"));
        assert(null === validatePath("- -rf/asdf"));
        assert(null === validatePath("asdf/--rf"));
        assert(null === validatePath("--rf/asdf"));
    });

    it("Tests if VFS successfully initialized for test vaults", () => {
        assert(vaultVFSExists("vault"));
        assert(vaultVFSExists("anothervault"));

        let vPath: ValidatedPath | null;

        vPath = "vault" as ValidatedPath;
        assert(getDirectoryAt(vPath) !== null)

        vPath = "anothervault" as ValidatedPath;
        assert(getDirectoryAt(vPath) !== null)
    });
    
    it("Tests if VFS is correct", () => {
        let vPath: ValidatedPath | VaultPath | null;

        vPath = "vault" as VaultPath;
        assert(getDirectoryAt(vPath)?.contents.length === 3);
        assert(getDirectoryAt(vPath)?.getFile(".gitignore"));
        assert(getAt(vPath) !== null);

        vPath = validatePath("vault/.gitignore");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validatePath("vault/folder1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("vault/folder1/package.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validatePath("vault/folder1/folder2");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("vault/folder1/folder2/LICENSE");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validatePath("vault/folder1.1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("vault/folder1.1/tsconfig.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validatePath("vault/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);

        vPath = validatePath("vault/also/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);
        
        

        vPath = "anothervault" as VaultPath;
        assert(getDirectoryAt(vPath)?.contents.length === 1);
        assert(getDirectoryAt(vPath)?.getAny("folder"));
        assert(getDirectoryAt(vPath)?.getAny("nonexistant") === null);
        assert(getAt(vPath) !== null);
        
        vPath = validatePath("anothervault/folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("anothervault/folder/another folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("anothervault/folder/another folder/yet another folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validatePath("anothervault/folder/another folder/yet another folder/package-lock.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);
        

        
        vPath = "nonexistant" as VaultPath;
        assert(getAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);
        
        vPath = validatePath("nonexistant/folder1");
        assert(getDirectoryAt(vPath) === null);
        assert(getFileAt(vPath) === null);
    });
    
    it("Creating vault creates VFS", async () => {
        assert(await createNewVault("somevault", "secure_password123") === null);
        assert(vaultVFSExists("somevault"));
        assert(vaultVFSExists("sooommmeevault") === false);
        assert(getDirectoryAt("somevault" as VaultPath));
        
        await deleteVault("somevault", true);
        assert(vaultVFSExists("somevault") === false);
    });
    
    after(async () => {
        // Cleanup
        await fs.rm(path.join(vaultDirectory, "vault"), { recursive: true, force: true });
        await fs.rm(path.join(vaultDirectory, "anothervault"), { recursive: true, force: true });
        await fs.rm(path.join(vaultDirectory, "somevault"), { recursive: true, force: true });
        
        await cleanup();
    });
});