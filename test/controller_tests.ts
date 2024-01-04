import { after, before, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";


const vaultDirectory = process.env.VAULT_DIRECTORY = path.join(process.cwd(), "vaults");
process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";


import type { ValidatedPath, VaultPath } from "../src/controller";

if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");
const { cleanup } = await import("../src/cleanup");

const { File, Directory } = await import("../src/vfs");
const { newVaultVFS, vaultVFSExists, validate, getAt, getDirectoryAt, getFileAt } = await import("../src/controller");
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
        assert(validate("vault/.gitignore") !== null);
        assert(validate("vault/folder1") !== null);
        assert(validate("anothervault/folder/another folder/yet another folder/package-lock.json") !== null);


        // Most of the test below is to make sure the function doesn't break
        assert(null === validate("."));
        assert(null === validate(".."));
        assert(null === validate("......."));
        assert(null === validate(". "));
        assert(null === validate(" ."));
        assert(null === validate(" . "));
        assert(null === validate("  ."));

        assert(null === validate("./asdf"));
        assert(null === validate("vault/."));
        assert(null === validate("vault/./folder1"));
        assert(null === validate("asdf/../asdf"));

        assert(null === validate(""));
        assert(null === validate("   "));
        assert(null === validate(" asdf"));
        assert(null === validate("asdf "));
        assert(null === validate(" asdf "));
        assert(null === validate(". asdf. "));
        assert(null === validate(".asdf. "));
        
        assert(null === validate(" /asdf"));
        assert(null === validate("asdf/ asdf"));
        assert(null === validate("asdf/asdf "));
        assert(null === validate("asdf /asdf"));
        assert(null === validate("asdf / asdf"));


        assert(null === validate("\tasdf"));
        assert(null === validate("asdf\n"));

        assert(null === validate("asdf/\tasdf"));
        assert(null === validate("asdf\n/asdf"));
        assert(null === validate("asdf/asdf\n"));


        assert(null === validate("asdf/"));
        assert(null === validate("/asdf"));
        assert(null === validate("/"));
        assert(null === validate("asdf/asdf/"));
        assert(null === validate("/asdf/"));
        assert(null === validate("_._/.asdf/"));
        assert(null === validate("asdf//asdf"));
        assert(null === validate("asdf//"));


        assert(null === validate("-rf"));
        assert(null === validate("- -rf"));
        assert(null === validate("--rf"));

        assert(null === validate("asdf/-rf"));
        assert(null === validate("-rf/asdf"));
        assert(null === validate("asdf/- -rf"));
        assert(null === validate("- -rf/asdf"));
        assert(null === validate("asdf/--rf"));
        assert(null === validate("--rf/asdf"));
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

        vPath = validate("vault/.gitignore");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/folder1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1/package.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/folder1/folder2");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1/folder2/LICENSE");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/folder1.1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1.1/tsconfig.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/also/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);
        
        

        vPath = "anothervault" as VaultPath;
        assert(getDirectoryAt(vPath)?.contents.length === 1);
        assert(getDirectoryAt(vPath)?.getAny("folder"));
        assert(getDirectoryAt(vPath)?.getAny("nonexistant") === null);
        assert(getAt(vPath) !== null);
        
        vPath = validate("anothervault/folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("anothervault/folder/another folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("anothervault/folder/another folder/yet another folder");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("anothervault/folder/another folder/yet another folder/package-lock.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);
        

        
        vPath = "nonexistant" as VaultPath;
        assert(getAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);
        
        vPath = validate("nonexistant/folder1");
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