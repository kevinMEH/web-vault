// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test, { after, describe, it } from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";

import { unixTime } from "../src/helper.js";

let status = 0;

// Gracefully shutdown function
async function shutdown() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");

    console.log("Done.");
}

process.on("SIGINT", shutdown);

// ------------------
// ------------------
// ------------------

// Expect error tests
import { expectError, asyncExpectError } from "./expect_error.js";

test("Verifying expectError works when no error (using expectError).", expectError(() => {
    const errorFunction = expectError(() => {
        const _ = "Everything is ok.";
        const _2 = "No errors here.";
    }, "");
    errorFunction();
}, "Expected error \"\" but found success instead."));

test("Verifying expectError works on error.", expectError(() => {
    throw new Error("This is a random error.");
}, "random error"));

test("Verifying expectError works with async functions.", asyncExpectError(async () => {
    await new Promise((_, reject) => setTimeout(() => reject(new Error("Some random error")), 1000));
}, "random error"));

// ------------------
// ------------------
// ------------------

import { vaultLog, logFileNameFromDate } from "../src/logger.js";

test("Logging to a file", async () => {
    const logFileName = logFileNameFromDate();
    const message = "This is a test message.";
    await vaultLog("." as unknown as VaultPath, "INFO", "This is a test message.");
    const logFilePath = path.join("./logs/vaults", logFileName);
    const contents: string = await fs.readFile(logFilePath, { encoding: "utf8" } );
    fs.rm(logFilePath);
    
    assert(contents.includes(message));
    assert(contents.includes(new Date().toUTCString().substring(0, 16)));
});

// ------------------
// ------------------
// ------------------

import JWT, { Header, Payload } from "../src/authentication/jwt.js";

describe("JSON Web Token tests", () => {
    it("Generates a JWT", () => {
        const token = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .finalize("4B6576696E20697320636F6F6C")
            .getToken();
        assert(token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ");
        // RHS obtained from https://jwt.io/
    });
    
    it("Verifies and extracts header and payload from JWT", () => {
        const [header, payload] = JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6C") as [Header, Payload];
        assert(header.alg === "HS256");
        assert(header.typ !== "asd")
        assert(payload.issuerIsCool === true);
        assert(payload.iss === "Kevin");
        assert(payload.sub === undefined);
    })

    it("Returns null on incorrect signature", () => {
        assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJi",
            "4B6576696E20697320636F6F6C") === null);
    });

    it("Returns null on incorrect signature", () => {
        assert(JWT.unwrap("bad.token.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6C") === null);
    });

    it("Returns null on correct signature but incorrect secret", () => {
        assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            "4B6576696E20697320636F6F6D") === null);
    });

    it("Returns null on bad token formatting", () => {
        assert(JWT.unwrap("bad.token", "4B6576696E20697320636F6F6C") === null);
    });
    
    it("Throws error on bad secret", expectError(() => {
        JWT.unwrap("asdf.asdf.asdf", "Z");
    }, "must be a hex string"));
    
    it("Encrypts and decrypts token using AES 256", () => {
        const aesKey = "546869732069732061203634206368617261637465722068657820737472696e";
        const secret = "4B6576696E20697320636F6F6C";
        const encryptedToken = new JWT("Kevin", 1000000000, 1111111111)
            .addClaim("issuerIsCool", true)
            .getEncryptedToken(aesKey, secret);
        assert(encryptedToken.split(".").length === 2);
        
        const [header, payload] = JWT.unwarpEncrypted(encryptedToken, aesKey, secret) as [Header, Payload];
        assert(header.typ === "JWT");
        assert(payload.iss === "Kevin");
        assert(payload.asdf === undefined);
        assert(payload.issuerIsCool === true);
    });
});

// ------------------
// ------------------
// ------------------

import { redisIsOutdatedToken, redisAddOutdatedToken, close } from "../src/authentication/redis.js";

describe("Redis database tests", () => {
    it("Stores and identifies an outdated token", async () => {
        redisAddOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
        unixTime() + 60);
        assert(await redisIsOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ"));
    });
    
    it("Verifies that Redis correctly deletes expiring tokens", async () => {
        redisAddOutdatedToken("temp.token.expiring", unixTime() - 10);
        assert(await redisIsOutdatedToken("temp.token.expiring") === false);
        // The expired token is not considered "outdated" anymore but
        // this is fine as we will always verify if it is expired before
        // checking if it is outdated.
    });

    after(() => {
        status++;
    });
});

import { saveOutdatedTokensToFile, loadOutdatedTokensFromFile, localAddOutdatedToken, localIsOutdatedToken, purgeAllOutdated, localSetVaultPassword, localVaultExists, loadVaultPasswordsFromFile, localDeleteVaultPassword, _tokenList, _tokenSet, _vaultPasswordMap, NodeType as Node } from "../src/authentication/database.js";

describe("In-memory database tests", () => {
    it("Stores and identifies an outdated token", () => {
        localAddOutdatedToken("test.token.outdated", unixTime() + 300);
        assert(localIsOutdatedToken("test.token.outdated"));
        assert(!localIsOutdatedToken("test.token.valid"));
    });
    
    it("Verifies that local database correctly purges expired tokens", async () => {
        localAddOutdatedToken("test.token.nonexpired", unixTime() + 300);
        localAddOutdatedToken("test.token.expired", unixTime() - 60);
        localAddOutdatedToken("test.token.expired2", unixTime() - 30);
        localAddOutdatedToken("test.token.nonexpired2", unixTime() + 300);
        localAddOutdatedToken("test.token.expired3", unixTime() - 90);

        // Check for existance
        assert(localIsOutdatedToken("test.token.nonexpired"));
        assert(localIsOutdatedToken("test.token.expired"));
        assert(localIsOutdatedToken("test.token.expired2"));
        assert(localIsOutdatedToken("test.token.nonexpired2"));
        assert(localIsOutdatedToken("test.token.expired3"));

        await purgeAllOutdated();
        
        // Check for nonexistance after purge for expired tokens
        assert(localIsOutdatedToken("test.token.nonexpired"));
        assert(!localIsOutdatedToken("test.token.expired"));
        assert(!localIsOutdatedToken("test.token.expired2"));
        assert(localIsOutdatedToken("test.token.nonexpired2"));
        assert(!localIsOutdatedToken("test.token.expired3"));
        // The expired tokens are not considered "outdated" anymore but
        // this is fine as we will always verify if they are expired before
        // checking if they are outdated.
        
        let nonexpiredExists = false;
        let nonexpired2Exists = false;
        // Check that purge correctly modified the linked list too
        let current: Node | null = _tokenList.head;
        while(current) {
            assert(current.getExp() >= unixTime() - 10);
            if(current.value.token === "test.token.nonexpired") nonexpiredExists = true;
            if(current.value.token === "test.token.nonexpired2") nonexpired2Exists = true;
            current = current.next;
        }
        // Check that purge did not purge nonexpired tokens
        assert(nonexpiredExists && nonexpired2Exists);
    });
    
    it("Saves the in memory tokens database to a file and loads from the file", async () => {
        localAddOutdatedToken("save.me.tofile", unixTime() + 100);
        localAddOutdatedToken("save.me.too", unixTime() + 100);
        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));

        await saveOutdatedTokensToFile();
        
        _tokenList.head.next = null;
        _tokenList.tail = _tokenList.head;
        _tokenSet.clear();
        assert(!localIsOutdatedToken("save.me.tofile"));
        assert(!localIsOutdatedToken("save.me.too"));
        
        await loadOutdatedTokensFromFile();

        assert(localIsOutdatedToken("save.me.tofile"));
        assert(localIsOutdatedToken("save.me.too"));
    });
    
    it("Saves the in memory vault passwords database to a file and loads from the file", async () => {
        // Setting passwords directly, in reality should be hashed first and local*() should never be called.
        // Setting passwords automatically saves
        await localSetVaultPassword("test-vault-test", "password112233");
        await localSetVaultPassword("testing2", "Password22");
        await localSetVaultPassword("helloworld", "GoodAndSecure111");

        assert(localVaultExists("test-vault-test"));
        assert(localVaultExists("helloworld"));

        _vaultPasswordMap.clear();

        assert(!localVaultExists("testing2"));
        assert(!localVaultExists("helloworld"));
        
        await loadVaultPasswordsFromFile();
        assert(localVaultExists("test-vault-test"));
        assert(localVaultExists("testing2"));
        assert(localVaultExists("helloworld"));
        assert(!localVaultExists("nonexistant-vault"));
        
        // Deleting passwords automatically saves to file
        await localDeleteVaultPassword("test-vault-test");
        await localDeleteVaultPassword("testing2");
        await localDeleteVaultPassword("helloworld");

        await loadVaultPasswordsFromFile();
        assert(_vaultPasswordMap.size === 0);
    });
    
    after(() => {
        status++;
    })
});

// ------------------
// ------------------
// ------------------

import { hashPassword } from "../src/authentication/password.js";

describe("Tests hashing for password", () => {
    it("Hashes a password and verifies result is correct", () => {
        const hashed = hashPassword("password", Buffer.from("48656c6c6f20776f726c64", "hex"), 1);
        assert(hashed === Buffer.from("4vYX8jJxVqwiRBDeCHUEVsevS4qBDKmQYwHlRFGED18=", "base64").toString("hex"));
        // Password obtained from https://8gwifi.org/pbkdf.jsp
        // Salt: SGVsbG8gd29ybGQ= / Buffer.from("48656c6c6f20776f726c64", "hex").toString("base64")
    });
});

import { File, Directory } from "../src/vfs.js";

describe("Tests virtual file system", () => {
    it("Basic File and Directory tests", () => {
        const file = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file, file2]);
        assert(directory.getAny("hello.txt") === file);
        directory.removeEntry(file, false);
        assert(directory.getAny("hello.txt") === null);
    });
    
    it("Tests duplication", () => {
        const file = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file, file2]);
        
        const dupedFile = file.duplicate();
        assert(dupedFile !== file);
        assert(dupedFile.name === file.name);
        assert(dupedFile.byteSize === file.byteSize);
        
        const dupedDirectory = directory.duplicate();
        assert(directory !== dupedDirectory);
        assert(directory.getFile("hello.txt"));
        assert(dupedDirectory.getFile("hello.txt"));
        assert(dupedDirectory.getFile("hello.txt") !== directory.getFile("hello.txt"));
        assert(dupedDirectory.getFile("hello.txt")?.byteSize === directory.getFile("hello.txt")?.byteSize);
    });
    
    it("Tests flattening and reattaching", () => {
        const file1 = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file1, file2]);
        
        const other1 = new File("other", 8);
        const other2 = new File("another", 3);
        const otherDirectory = new Directory("other_stuff", [other1, other2]);
        const otherParent = new Directory("other_parent", [otherDirectory]);
        
        const root = new Directory("root", [directory, otherParent]);
        
        const fullFlatRoot = root.flat(10);
        
        const root2 = new Directory("root", []);
        root2.update(fullFlatRoot);
        
        assert(root2.getDirectory("project") !== null);
        assert(root2.getDirectory("other_parent") !== null);

        assert(root2.getDirectory("project")?.contents.length === 2);
        assert(root2.getDirectory("project")?.getFile("hello.txt"));
        assert(root2.getDirectory("project")?.getFile("world.png"));
        assert(root2.getDirectory("project")?.getFile("hello.txt")?.byteSize === 40);
        assert(root2.getDirectory("project")?.getFile("world.png")?.byteSize === 8044);
        
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize === 8);
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize === 3);
    });
    
    it("Testing stringifying, parsing, and reattaching", () => {
        const file1 = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file1, file2]);
        
        const other1 = new File("other", 8);
        const other2 = new File("another", 3);
        const otherDirectory = new Directory("other_stuff", [other1, other2]);
        const otherParent = new Directory("other_parent", [otherDirectory]);
        
        const root = new Directory("root", [directory, otherParent]);
        
        const stringifiedRoot = root.stringify(10);
        const parsedRoot = JSON.parse(stringifiedRoot);
        
        const root2 = new Directory("root", []);
        root2.update(parsedRoot);
        
        assert(root2.getDirectory("project") !== null);
        assert(root2.getDirectory("other_parent") !== null);

        assert(root2.getDirectory("project")?.contents.length === 2);
        assert(root2.getDirectory("project")?.getFile("hello.txt"));
        assert(root2.getDirectory("project")?.getFile("world.png"));
        assert(root2.getDirectory("project")?.getFile("hello.txt")?.byteSize === 40);
        assert(root2.getDirectory("project")?.getFile("world.png")?.byteSize === 8044);
        
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another"));
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize === 8);
        assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize === 3);
    });
    
    it("Tests partially flattened root", () => {
        const file1 = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file1, file2]);
        
        const other1 = new File("other", 8);
        const other2 = new File("another", 3);
        const otherDirectory = new Directory("other_stuff", [other1, other2]);
        const otherParent = new Directory("other_parent", [otherDirectory]);
        
        const root = new Directory("root", [directory, otherParent]);
        
        const rootDepth0 = new Directory("root", []);
        rootDepth0.update(root.flat(0));
        assert(root.contents.length === 2);
        assert(rootDepth0.contents.length === 0);
        
        const rootDepth1 = new Directory("root", []);
        rootDepth1.update(root.flat(1));
        assert(rootDepth1.contents.length === 2);
        assert(rootDepth1.getDirectory("project"));
        assert(rootDepth1.getDirectory("project")?.contents.length === 0);
        assert(rootDepth1.getDirectory("other_parent"));
        assert(rootDepth1.getDirectory("other_parent")?.contents.length === 0);
        
        const rootDepth2 = new Directory("root", []);
        rootDepth2.update(root.flat(2));
        assert(rootDepth2.contents.length === 2);
        assert(rootDepth2.getDirectory("other_parent"));
        assert(rootDepth2.getDirectory("other_parent")?.contents.length === 1);
        assert(rootDepth2.getDirectory("other_parent")?.getDirectory("other_stuff")?.contents.length === 0);
        
        const rootDepthAll = new Directory("root", []);
        rootDepthAll.update(root.flat(99));
        assert(rootDepthAll.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another"));
        assert(rootDepthAll.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize === other2.byteSize);
    })
    
    it("Tests root self-updating multiple times", () => {
        const file1 = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file1, file2]);
        
        const other1 = new File("other", 8);
        const other2 = new File("another", 3);
        const otherDirectory = new Directory("other_stuff", [other1, other2]);
        const otherParent = new Directory("other_parent", [otherDirectory]);
        
        const root = new Directory("root", [directory, otherParent]);
        
        const newRoot = new Directory("root", []);

        const rootDepthAll = root.flat(10);
        newRoot.update(rootDepthAll);
        assert(newRoot.getDirectory("project"));
        assert(newRoot.getDirectory("project")?.contents.length === 2);
        assert(newRoot.getDirectory("project")?.getFile("hello.txt"));
        
        const rootDepth0 = root.flat(0);
        newRoot.update(rootDepth0);
        assert(newRoot.contents.length === 0);
        assert(newRoot.lastModified.toJSON() === root.lastModified.toJSON());
        
        const rootDepth1 = root.flat(1);
        newRoot.update(rootDepth1);
        assert((newRoot.contents.length as any) === 2);
        assert(newRoot.getDirectory("other_parent"));
        assert(newRoot.getDirectory("other_parent")?.contents.length === 0);
        
        root.removeEntry(directory, false);
        
        const rootDepth2 = root.flat(2);
        newRoot.update(rootDepth2);
        assert((newRoot.contents.length as any) === 1);
        assert(newRoot.getDirectory("other_parent"));
        assert(newRoot.getDirectory("other_parent")?.contents.length === 1);
    });
    
    it("Tests VFS cloning functions", () => {
        const file1 = new File("hello.txt", 40);
        const file2 = new File("world.png", 8044);
        const directory = new Directory("project", [file1, file2]);
        
        const other1 = new File("other", 8);
        const other2 = new File("another", 3);
        const otherDirectory = new Directory("other_stuff", [other1, other2]);
        const otherParent = new Directory("other_parent", [otherDirectory]);
        
        const root = new Directory("root", [directory, otherParent]);
        
        const rootClone = root.clone();
        
        assert(root !== rootClone);
        
        assert(rootClone.lastModified.toJSON() === root.lastModified.toJSON());
        assert(rootClone.name === root.name);
        assert(rootClone.isDirectory === root.isDirectory);
        assert(rootClone.contents.length === root.contents.length);
        
        assert(rootClone.getDirectory("project") !== null);
        assert(rootClone.getDirectory("project")?.name === root.getDirectory("project")?.name);
        assert(rootClone.getDirectory("project")?.lastModified.toJSON() === root.getDirectory("project")?.lastModified.toJSON());
        assert(rootClone.getDirectory("project")?.contents.length === root.getDirectory("project")?.contents.length);

        assert(rootClone.getDirectory("project")?.getFile("hello.txt")
        !== null);
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.name
        === root.getDirectory("project")?.getFile("hello.txt")?.name);
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.lastModified.toJSON()
        === root.getDirectory("project")?.getFile("hello.txt")?.lastModified.toJSON());
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.byteSize
        === root.getDirectory("project")?.getFile("hello.txt")?.byteSize);
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.getByteSize()
        === root.getDirectory("project")?.getFile("hello.txt")?.getByteSize());
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.byteSize
        === 40);
        assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.getByteSize()
        === 40);

        assert(rootClone.getDirectory("project")?.getFile("world.png")
        !== null);
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.name
        === root.getDirectory("project")?.getFile("world.png")?.name);
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.lastModified.toJSON()
        === root.getDirectory("project")?.getFile("world.png")?.lastModified.toJSON());
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.byteSize
        === root.getDirectory("project")?.getFile("world.png")?.byteSize);
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.getByteSize()
        === root.getDirectory("project")?.getFile("world.png")?.getByteSize());
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.byteSize
        === 8044);
        assert(rootClone.getDirectory("project")?.getFile("world.png")?.getByteSize()
        === 8044);

        assert(rootClone.getDirectory("other_parent") !== null);
        assert(rootClone.getDirectory("other_parent")?.name === root.getDirectory("other_parent")?.name);
        assert(rootClone.getDirectory("other_parent")?.lastModified.toJSON() === root.getDirectory("other_parent")?.lastModified.toJSON());
        assert(rootClone.getDirectory("other_parent")?.contents.length === root.getDirectory("other_parent")?.contents.length);

        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")
        !== null);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.name
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.name);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.lastModified.toJSON()
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.lastModified.toJSON());
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.contents.length
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.contents.length);

        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")
        !== null);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.name
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.name);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.lastModified.toJSON()
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.lastModified.toJSON());
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.getByteSize()
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.getByteSize());
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize
        === 8);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.getByteSize()
        === 8);

        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")
        !== null);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.name
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.name);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.lastModified.toJSON()
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.lastModified.toJSON());
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.getByteSize()
        === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.getByteSize());
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize
        === 3);
        assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.getByteSize()
        === 3);
    })
});

import { generateVFS } from "../src/vfs_helpers.js";

describe("Tests Virtual File System helpers", () => {
    it("Tests generation of VFS", async () => {
        // This project's root
        const projectRoot = await generateVFS(".");

        assert(projectRoot.getDirectory("test"));
        assert(projectRoot.getDirectory("test")?.getFile("single_tests.ts"));
        assert(projectRoot.getDirectory("test")?.getFile("single_tests.ts")?.lastModified.toJSON()
            === new Date((await fs.stat("./test/single_tests.ts")).mtime).toJSON());
        assert(projectRoot.getDirectory("test")?.getFile("expect_error.ts"));
        assert(projectRoot.getDirectory("test")?.getFile("expect_error.ts")?.lastModified.toJSON()
            === new Date((await fs.stat("./test/expect_error.ts")).mtime).toJSON());

        assert(projectRoot.getDirectory("src"));
        assert(projectRoot.getDirectory("vaults"));
        assert(projectRoot.getDirectory("logs"));
        const logStats = await fs.readdir("./logs");
        assert(projectRoot.getDirectory("logs")?.contents.length === logStats.length);
    });
    
    it("Generation of nonexistant directory throws ENOENT", async () => {
        try {
            const _nonexistant = await generateVFS("./nonexistant");
            assert(false, "Generating VFS of nonexistant directory did not return error.");
        } catch(error) {
            if((error as NodeJS.ErrnoException).code !== "ENOENT") {
                assert(false, `Generating VFS of nonexistant directory returned unexpected error ${(error as Error).message}.`);
            }
        }
        assert(true);
    });
});

import { validNameRegex, validPathRegex, getParentPath, splitParentChild, ValidatedPath, VaultPath } from "../src/controller.js";

describe("Controller function tests", () => {
    it("Tests valid name regex", () => {
        assert(validNameRegex.test("a"));
        assert(validNameRegex.test("hello"));
        assert(validNameRegex.test("hello.txt"));
        assert(validNameRegex.test("hello world.txt"));
        assert(validNameRegex.test("hello world.asdf.  ..txt"));
        assert(validNameRegex.test("hello_world"));
        assert(validNameRegex.test("hello-"));
        assert(validNameRegex.test("_ - ."));
        assert(validNameRegex.test(".hidden"));
        assert(validNameRegex.test(".hidden."));
        assert(validNameRegex.test(".hidden .local .env"));

        assert(false === validNameRegex.test("."));
        assert(false === validNameRegex.test(".."));
        assert(false === validNameRegex.test("......."));
        assert(false === validNameRegex.test(". "));
        assert(false === validNameRegex.test(" ."));
        assert(false === validNameRegex.test(" . "));
        assert(false === validNameRegex.test("  ."));

        assert(false === validNameRegex.test(""));
        assert(false === validNameRegex.test("   "));
        assert(false === validNameRegex.test(" asdf"));
        assert(false === validNameRegex.test("asdf "));
        assert(false === validNameRegex.test(" asdf "));
        assert(false === validNameRegex.test(". asdf. "));
        assert(false === validNameRegex.test(".asdf. "));

        assert(false === validNameRegex.test("\tasdf"));
        assert(false === validNameRegex.test("asdf\n"));

        assert(false === validNameRegex.test("asdf/"));
        assert(false === validNameRegex.test("/asdf"));
        assert(false === validNameRegex.test("asdf/other"));

        assert(false === validNameRegex.test("-rf"));
        assert(false === validNameRegex.test("- -rf"));
        assert(false === validNameRegex.test("--rf"));
    });
    
    it("Tests valid path regex", () => {
        assert(validPathRegex.test("a"));
        assert(validPathRegex.test("hello"));
        assert(validPathRegex.test("hello.txt"));
        assert(validPathRegex.test("hello world.txt"));
        assert(validPathRegex.test("hello world.asdf.  ..txt"));
        assert(validPathRegex.test("hello_world"));
        assert(validPathRegex.test("hello-"));
        assert(validPathRegex.test("_ - ."));
        assert(validPathRegex.test(".hidden"));
        assert(validPathRegex.test(".hidden."));
        assert(validPathRegex.test(".hidden .local .env"));
        
        assert(validPathRegex.test("a/asdf"));
        assert(validPathRegex.test("a/asdf/asdf"));
        assert(validPathRegex.test("a/hello world/asdf"));
        assert(validPathRegex.test("a/.asdf/asdf"));
        assert(validPathRegex.test("a/.asdf/_hello-world.txt"));
        assert(validPathRegex.test("vault/folder/hello_world.png"));
        assert(validPathRegex.test("vault/folder/.asdf"));
        assert(validPathRegex.test("_/_/_"));



        assert(false === validPathRegex.test("."));
        assert(false === validPathRegex.test(".."));
        assert(false === validPathRegex.test("......."));
        assert(false === validPathRegex.test(". "));
        assert(false === validPathRegex.test(" ."));
        assert(false === validPathRegex.test(" . "));
        assert(false === validPathRegex.test("  ."));

        assert(false === validPathRegex.test("./asdf"));
        assert(false === validPathRegex.test("asdf/./asdf"));
        assert(false === validPathRegex.test("asdf/."));
        assert(false === validPathRegex.test("asdf/.."));
        assert(false === validPathRegex.test("asdf/../asdf"));


        assert(false === validPathRegex.test(""));
        assert(false === validPathRegex.test("   "));
        assert(false === validPathRegex.test(" asdf"));
        assert(false === validPathRegex.test("asdf "));
        assert(false === validPathRegex.test(" asdf "));
        assert(false === validPathRegex.test(". asdf. "));
        assert(false === validPathRegex.test(".asdf. "));
        
        assert(false === validPathRegex.test(" /asdf"));
        assert(false === validPathRegex.test("asdf/ asdf"));
        assert(false === validPathRegex.test("asdf/asdf "));
        assert(false === validPathRegex.test("asdf /asdf"));
        assert(false === validPathRegex.test("asdf / asdf"));


        assert(false === validPathRegex.test("\tasdf"));
        assert(false === validPathRegex.test("asdf\n"));

        assert(false === validPathRegex.test("asdf/\tasdf"));
        assert(false === validPathRegex.test("asdf\n/asdf"));
        assert(false === validPathRegex.test("asdf/asdf\n"));


        assert(false === validPathRegex.test("asdf/"));
        assert(false === validPathRegex.test("/asdf"));
        assert(false === validPathRegex.test("/"));
        assert(false === validPathRegex.test("asdf/asdf/"));
        assert(false === validPathRegex.test("/asdf/"));
        assert(false === validPathRegex.test("_._/.asdf/"));
        assert(false === validPathRegex.test("asdf//asdf"));
        assert(false === validPathRegex.test("asdf//"));


        assert(false === validPathRegex.test("-rf"));
        assert(false === validPathRegex.test("- -rf"));
        assert(false === validPathRegex.test("--rf"));

        assert(false === validPathRegex.test("asdf/-rf"));
        assert(false === validPathRegex.test("-rf/asdf"));
        assert(false === validPathRegex.test("asdf/- -rf"));
        assert(false === validPathRegex.test("- -rf/asdf"));
        assert(false === validPathRegex.test("asdf/--rf"));
        assert(false === validPathRegex.test("--rf/asdf"));
    });
    
    it("Tests getParentDirectory function", () => {
        assert(getParentPath("vault/hello/some folder/file.txt/what") === "vault/hello/some folder/file.txt");
        assert(getParentPath("vault/hello/some folder/file.txt") === "vault/hello/some folder");
        assert(getParentPath("vault/hello/some folder") === "vault/hello");
        assert(getParentPath("vault/hello") === "vault");
        assert(getParentPath("vault") === null);
    });
    
    it("Tests splitParentChild function", () => {
        let path: ValidatedPath;
        let split: [ValidatedPath, string] | [null, null];

        path = "vault/hello/some folder/file.txt/what";
        split = splitParentChild(path);
        assert(split.length === 2);
        assert(split[0] === "vault/hello/some folder/file.txt");
        assert(split[1] === "what");

        path = "vault/hello/some folder/file.txt";
        split = splitParentChild(path);
        assert(split.length === 2);
        assert(split[0] === "vault/hello/some folder");
        assert(split[1] === "file.txt");

        path = "vault/hello/some folder";
        split = splitParentChild(path);
        assert(split.length === 2);
        assert(split[0] === "vault/hello");
        assert(split[1] === "some folder");

        path = "vault/hello";
        split = splitParentChild(path);
        assert(split.length === 2);
        assert(split[0] === "vault");
        assert(split[1] === "hello");

        path = "vault";
        split = splitParentChild(path);
        assert(split.length === 2);
        assert(split[0] === null);
        assert(split[1] === null);
    })
});

while(status !== 2) {
    await new Promise(resolve => setTimeout(resolve, 1000));
}
shutdown();