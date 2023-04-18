import { after, describe, it } from "node:test";
import assert from "assert";
import fs from "fs/promises";
import path from "path";

import { close } from "../src/authentication/redis.js";

import { ValidatedPath } from "../src/controller.js"; // Type
import { Stats } from "fs"; // Type

async function shutdown() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");
    
    console.log("Done.");
}

const vaultDirectory = process.env.VAULT_DIRECTORY = path.join(process.cwd(), "vaults");
process.env.JWT_SECRET = "4B6576696E20697320636F6F6C";
process.env.DOMAIN = "Kevin";
process.env.PASSWORD_SALT = "ABC99288B9288B22A66F00E";
if(process.env.REDIS) console.log("Using Redis");
else console.log("Using in memory database");

// VFS controller test setup
{
    /*
    vault
        .gitignore
        folder1
            package.json
            folder2
                LICENSE
        folder1.1
            tsconfig.json
    */
    await fs.mkdir(path.join(vaultDirectory, "vault"));
    await fs.cp(
        path.join(process.cwd(), ".gitignore"),
        path.join(vaultDirectory, "vault", ".gitignore")
    );
    await fs.mkdir(path.join(vaultDirectory, "vault", "folder1"));
    await fs.cp(
        path.join(process.cwd(), "package.json"),
        path.join(vaultDirectory, "vault", "folder1", "package.json")
    );
    await fs.mkdir(path.join(vaultDirectory, "vault", "folder1", "folder2"));
    await fs.cp(
        path.join(process.cwd(), "LICENSE"),
        path.join(vaultDirectory, "vault", "folder1", "folder2", "LICENSE")
    );
    await fs.mkdir(path.join(vaultDirectory, "vault", "folder1.1"));
    await fs.cp(
        path.join(process.cwd(), "tsconfig.json"),
        path.join(vaultDirectory, "vault", "folder1.1", "tsconfig.json")
    );
    
    /*
    anothervault
        folder
            another folder
                yet another folder
                    package-lock.json
    */
    await fs.mkdir(path.join(vaultDirectory, "anothervault"));
    await fs.mkdir(path.join(vaultDirectory, "anothervault", "folder"));
    await fs.mkdir(path.join(vaultDirectory, "anothervault", "folder", "another folder"));
    await fs.mkdir(path.join(vaultDirectory, "anothervault", "folder", "another folder", "yet another folder"));
    await fs.cp(
        path.join(process.cwd(), "package-lock.json"),
        path.join(vaultDirectory, "anothervault", "folder", "another folder", "yet another folder", "package-lock.json")
    );
}

// ------------------
// ------------------
// ------------------

const { vaultDirectoryExists, validate, getDirectoryAt, getFileAt } = await import("../src/controller.js");
const { createNewVault, deleteVault } = await import("../src/vault.js");

describe("VFS controller tests", () => {
    it("Tests the validate function", () => {
        assert(validate("vault") !== null);
        assert(validate("anothervault") !== null);
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
        assert(vaultDirectoryExists("vault"));
        assert(vaultDirectoryExists("anothervault"));

        let vPath: ValidatedPath | null;

        vPath = validate("vault");
        assert(getDirectoryAt(vPath) !== null)

        vPath = validate("anothervault");
        assert(getDirectoryAt(vPath) !== null)
    });
    
    it("Tests if VFS is correct", async () => {
        let vPath: ValidatedPath | null;
        let stat: Stats;

        vPath = validate("vault");
        assert(getDirectoryAt(vPath)?.contents.length === 3);
        assert(getDirectoryAt(vPath)?.getFile(".gitignore"));

        vPath = validate("vault/.gitignore");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);
        stat = await fs.stat(path.join(process.cwd(), ".gitignore"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);
        stat = await fs.stat(path.join(vaultDirectory, "vault/.gitignore"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);

        vPath = validate("vault/folder1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1/package.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);
        stat = await fs.stat(path.join(process.cwd(), "package.json"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);
        stat = await fs.stat(path.join(vaultDirectory, "vault/folder1/package.json"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);

        vPath = validate("vault/folder1/folder2");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1/folder2/LICENSE");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);
        stat = await fs.stat(path.join(process.cwd(), "LICENSE"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);
        stat = await fs.stat(path.join(vaultDirectory, "vault/folder1/folder2/LICENSE"));
        assert(getFileAt(vPath)?.getByteSize() === stat.size);

        vPath = validate("vault/folder1.1");
        assert(getDirectoryAt(vPath));
        assert(getFileAt(vPath) === null);

        vPath = validate("vault/folder1.1/tsconfig.json");
        assert(getFileAt(vPath));
        assert(getDirectoryAt(vPath) === null);

        stat = await fs.stat(path.join(vaultDirectory, "vault/folder1.1/tsconfig.json"));
        const timeDiff = Math.abs(getFileAt(vPath)?.lastModified?.valueOf() as number - new Date(stat.mtime).valueOf());
        assert(timeDiff === 0); // Modification time of file in VFS same as in directories
        

        vPath = validate("vault/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);

        vPath = validate("vault/also/nonexistant");
        assert(getFileAt(vPath) === null);
        assert(getDirectoryAt(vPath) === null);
        
        

        vPath = validate("anothervault");
        assert(getDirectoryAt(vPath)?.contents.length === 1);
        assert(getDirectoryAt(vPath)?.getDirectory("folder"));
        assert(getDirectoryAt(vPath)?.getDirectory("nonexistant") === null);
        
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
        

        
        vPath = validate("nonexistant");
        assert(getDirectoryAt(vPath) === null);
        assert(getFileAt(vPath) === null);
        
        vPath = validate("nonexistant/folder1");
        assert(getDirectoryAt(vPath) === null);
        assert(getFileAt(vPath) === null);
    });
    
    it("Creating vault creates VFS", async () => {
        assert(await createNewVault("somevault", "secure_password123") === null);
        assert(vaultDirectoryExists("somevault"));
        assert(vaultDirectoryExists("sooommmeevault") === false);
        assert(getDirectoryAt(validate("somevault")));
        
        await deleteVault("somevault");
        assert(vaultDirectoryExists("somevault") === false);
    });
    
    after(async () => {
        // Cleanup
        await fs.rm(path.join(vaultDirectory, "vault"), { recursive: true, force: true });
        await fs.rm(path.join(vaultDirectory, "anothervault"), { recursive: true, force: true });
        
        await shutdown();
    });
});