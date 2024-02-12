// For local testing purposes only.
// If you are a regular user, do not expect all tests to pass.

import test, { after, describe, it } from "node:test";
import assert from "assert";
import path from "path";
import fs from "fs/promises";

import { vaultLog, logFileNameFromDate } from "../src/logger";
import JWT, { unixTime, Header, Payload } from "jwt-km";
import { redisIsOutdatedToken, redisAddOutdatedToken } from "../src/authentication/database/redis";
import { _saveOutdatedTokensToFile, _loadOutdatedTokensFromFile, localAddOutdatedToken,
    localIsOutdatedToken, _purgeAllOutdated, _loadVaultCredentialsFromFile, localSetVaultPassword,
    localVaultExists, localDeleteVault, _tokenList, _tokenSet,
    _vaultCredentialsMap, NodeType as Node, localSetAdminPassword, _adminCredentialsMap,
    _loadAdminCredentialsFromFile, localDeleteAdmin, localVerifyAdminPassword, localInvalidAdminIssuingDate
} from "../src/authentication/database/local";
import { HashedPassword, hashPassword } from "../src/authentication/password";
import { File, Directory } from "../src/vfs";
import { validName, validPath } from "../src/helper";
import { getParentPath, splitParentChild, ValidatedPath, VaultPath, getVaultFromPath } from "../src/controller";
import { fileNameMap, folderBaseMap, fileExtensionMap } from "../src/icons/iconMap";
import { DEFAULT_ADMIN_NAME } from "../src/env";

import { cleanup } from "../src/cleanup";

describe("Single Tests", () => {
    it("Logging to a file", async () => {
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
    
    test("JSON Web Token tests", async context => {
        await context.test("Generates a JWT", () => {
            const token = new JWT("Kevin", 1000000000, 1111111111)
                .addClaim("issuerIsCool", true)
                .getToken("4B6576696E20697320636F6F6C");
            assert(token === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ");
            // RHS obtained from https://jwt.io/
        });
        
        await context.test("Verifies and extracts header and payload from JWT", () => {
            const [header, payload] = JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
                "4B6576696E20697320636F6F6C") as [Header, Payload];
            assert(header.alg === "HS256");
            assert(header.typ !== "asd")
            assert(payload.issuerIsCool === true);
            assert(payload.iss === "Kevin");
            assert(payload.sub === undefined);
        })
    
        await context.test("Returns null on incorrect signature", () => {
            assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJi",
                "4B6576696E20697320636F6F6C") === null);
        });
    
        await context.test("Returns null on incorrect signature", () => {
            assert(JWT.unwrap("bad.token.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
                "4B6576696E20697320636F6F6C") === null);
        });
    
        await context.test("Returns null on correct signature but incorrect secret", () => {
            assert(JWT.unwrap("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
                "4B6576696E20697320636F6F6D") === null);
        });
    
        await context.test("Returns null on bad token formatting", () => {
            assert(JWT.unwrap("bad.token", "4B6576696E20697320636F6F6C") === null);
        });
        
        await context.test("Throws error on bad secret", () => {
            try {
                JWT.unwrap("asdf.asdf.asdf", "Z");
                assert(false, "The unwarp() call should've thrown an error.");
            } catch(error) {
                assert((error as Error).message.includes("must be a hex string"));
            }
        });
    });
    
    // ------------------
    // ------------------
    // ------------------
    
    test("Redis database tests", async context => {
        await context.test("Stores and identifies an outdated token", async () => {
            redisAddOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ",
            unixTime() + 60);
            assert(await redisIsOutdatedToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJLZXZpbiIsImV4cCI6MTAwMDAwMDAwMCwiaWF0IjoxMTExMTExMTExLCJpc3N1ZXJJc0Nvb2wiOnRydWV9.wm1_FGup-Jkj8b9_EtV0sLWc8Z-xkW2sIq0y48TaJiQ"));
        });
        
        await context.test("Verifies that Redis correctly deletes expiring tokens", async () => {
            redisAddOutdatedToken("temp.token.expiring", unixTime() - 10);
            assert(await redisIsOutdatedToken("temp.token.expiring") === false);
            // The expired token is not considered "outdated" anymore but
            // this is fine as we will always verify if it is expired before
            // checking if it is outdated.
        });
    });
    
    test("In-memory database tests", async context => {
        await context.test("Stores and identifies an outdated token", () => {
            localAddOutdatedToken("test.token.outdated", unixTime() + 300);
            assert(localIsOutdatedToken("test.token.outdated"));
            assert(!localIsOutdatedToken("test.token.valid"));
        });
        
        await context.test("Verifies that local database correctly purges expired tokens", () => {
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
    
            _purgeAllOutdated();
            
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
        
        await context.test("Saves the in memory tokens database to a file and loads from the file", async () => {
            localAddOutdatedToken("save.me.tofile", unixTime() + 100);
            localAddOutdatedToken("save.me.too", unixTime() + 100);
            assert(localIsOutdatedToken("save.me.tofile"));
            assert(localIsOutdatedToken("save.me.too"));
    
            await _saveOutdatedTokensToFile();
            
            _tokenList.head.next = null;
            _tokenList.tail = _tokenList.head;
            _tokenSet.clear();
            assert(!localIsOutdatedToken("save.me.tofile"));
            assert(!localIsOutdatedToken("save.me.too"));
            
            await _loadOutdatedTokensFromFile();
    
            assert(localIsOutdatedToken("save.me.tofile"));
            assert(localIsOutdatedToken("save.me.too"));
        });
        
        await context.test("Saves the in memory vault credentials database to a file and loads from the file", async () => {
            // Setting passwords directly, in reality should be hashed first and local*() should never be called.
            // Setting passwords automatically saves
            await localSetVaultPassword("test-vault-test", "password112233" as HashedPassword);
            await localSetVaultPassword("testing2", "Password22" as HashedPassword);
            await localSetVaultPassword("helloworld", "GoodAndSecure111" as HashedPassword);
    
            assert(localVaultExists("test-vault-test"));
            assert(localVaultExists("helloworld"));
            
            _vaultCredentialsMap.clear();
    
            assert(!localVaultExists("testing2"));
            assert(!localVaultExists("helloworld"));
            assert(_vaultCredentialsMap.get("testing2") === undefined);
            assert(_vaultCredentialsMap.get("helloworld") === undefined);
            
            await _loadVaultCredentialsFromFile();
            assert(localVaultExists("test-vault-test"));
            assert(localVaultExists("testing2"));
            assert(localVaultExists("helloworld"));
            assert(!localVaultExists("nonexistant-vault"));
            assert(_vaultCredentialsMap.get("testing2") !== undefined);
            assert(_vaultCredentialsMap.get("helloworld") !== undefined);
            
            // Deleting passwords automatically saves to file
            await localDeleteVault("test-vault-test");
            await localDeleteVault("testing2");
            await localDeleteVault("helloworld");
    
            await _loadVaultCredentialsFromFile();
            assert(_vaultCredentialsMap.size === 0);
        });
        
        await context.test("Setting password sets nonces", async () => {
            // Setting passwords, which will also set the nonces
            await localSetVaultPassword("some-test-vault", "password" as HashedPassword);
            await localSetVaultPassword("another-test-vault", "password2" as HashedPassword);
            
            assert(localVaultExists("some-test-vault"));
            assert(localVaultExists("another-test-vault"));

            const previousNonceOne = _vaultCredentialsMap.get("some-test-vault")?.[1];
            assert(previousNonceOne !== undefined);
            const previousNonceTwo = _vaultCredentialsMap.get("another-test-vault")?.[1];
            assert(previousNonceTwo !== undefined);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line

            await localSetVaultPassword("some-test-vault", "password" as HashedPassword);
            await localSetVaultPassword("another-test-vault", "password2" as HashedPassword);
            
            assert(_vaultCredentialsMap.get("some-test-vault")?.[1] !== undefined);
            assert(_vaultCredentialsMap.get("some-test-vault")?.[1] !== previousNonceOne);
            assert(_vaultCredentialsMap.get("another-test-vault")?.[1] !== undefined);
            assert(_vaultCredentialsMap.get("another-test-vault")?.[1] !== previousNonceTwo);
            
            await localDeleteVault("some-test-vault");
            await localDeleteVault("another-test-vault");
        });
        
        await context.test("Saves the in memory admin credentials database to a file and loads from the file", async () => {
            await localSetAdminPassword("kevin", "keviniscool" as HashedPassword);
            await localSetAdminPassword("hello", "world" as HashedPassword);
            
            assert(localVerifyAdminPassword("kevin", "keviniscool" as HashedPassword));
            assert(localVerifyAdminPassword("hello", "world" as HashedPassword));
            assert(!localVerifyAdminPassword("hello", "wworld" as HashedPassword));
            assert(!localVerifyAdminPassword("hhello", "world" as HashedPassword));
            
            const kevinNonce = _adminCredentialsMap.get("kevin")?.[1];
            const helloNonce = _adminCredentialsMap.get("hello")?.[1];
            
            assert(kevinNonce !== undefined);
            assert(helloNonce !== undefined);
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce - 60));
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce) === false);
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce + 60) === false);
            assert(localInvalidAdminIssuingDate("hello", helloNonce) === false);
            
            _adminCredentialsMap.clear();
            assert(!localVerifyAdminPassword("kevin", "keviniscool" as HashedPassword));
            assert(!localVerifyAdminPassword("hello", "world" as HashedPassword));
            assert(!localVerifyAdminPassword("hello", "wworld" as HashedPassword));
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce));
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce + 1));
            assert(localInvalidAdminIssuingDate("hello", helloNonce));
            
            await _loadAdminCredentialsFromFile();

            assert(localVerifyAdminPassword("kevin", "keviniscool" as HashedPassword));
            assert(localVerifyAdminPassword("hello", "world" as HashedPassword));
            assert(!localVerifyAdminPassword("hello", "wworld" as HashedPassword));
            assert(!localVerifyAdminPassword("hhello", "world" as HashedPassword));

            assert(_adminCredentialsMap.get("kevin")?.[1] !== undefined);
            assert(_adminCredentialsMap.get("hello")?.[1] !== undefined);
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce - 60));
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce) === false);
            assert(localInvalidAdminIssuingDate("kevin", kevinNonce + 60) === false);
            assert(localInvalidAdminIssuingDate("hello", helloNonce) === false);
            
            await localDeleteAdmin("kevin");
            await localDeleteAdmin("hello");
            await localDeleteAdmin(DEFAULT_ADMIN_NAME)
            assert(_adminCredentialsMap.size === 0);
            
            await _loadAdminCredentialsFromFile();
            assert(_adminCredentialsMap.size === 0 as number);
        });
        
        await context.test("Setting admin passwords sets nonces", async () => {
            await localSetAdminPassword("kevin2", "kevin2" as HashedPassword);
            assert(localVerifyAdminPassword("kevin2", "kevin2" as HashedPassword));

            const previousNonce = _adminCredentialsMap.get("kevin2")?.[1];
            assert(previousNonce !== undefined);
            assert(localInvalidAdminIssuingDate("kevin2", previousNonce) === false);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // eslint-disable-line

            await localSetAdminPassword("kevin2", "kevin222" as HashedPassword);
            assert(localVerifyAdminPassword("kevin2", "kevin222" as HashedPassword));
            assert(!localVerifyAdminPassword("kevin2", "kevin2" as HashedPassword));
            
            const currentNonce = _adminCredentialsMap.get("kevin2")?.[1];
            assert(currentNonce !== undefined);
            assert(currentNonce !== previousNonce);
            assert(localInvalidAdminIssuingDate("kevin2", currentNonce) === false);
            assert(localInvalidAdminIssuingDate("kevin2", previousNonce));

            await localDeleteAdmin("kevin2");
        });
    });
    
    // ------------------
    // ------------------
    // ------------------
    
    it("Hashes a password and verifies result is correct", async () => {
        const hashed = await hashPassword("password", Buffer.from("48656c6c6f20776f726c64", "hex"), 1);
        assert(hashed === Buffer.from("4vYX8jJxVqwiRBDeCHUEVsevS4qBDKmQYwHlRFGED18=", "base64").toString("hex"));
        // Password obtained from https://8gwifi.org/pbkdf.jsp
        // Salt: SGVsbG8gd29ybGQ= / Buffer.from("48656c6c6f20776f726c64", "hex").toString("base64")
    });
    
    test("Tests virtual file system", async context => {
        await context.test("Basic File and Directory tests", () => {
            const file = new File("hello.txt", 40, "");
            const file2 = new File("world.png", 8044, "");
            const directory = new Directory("project", [file, file2]);
            assert(directory.getAny("hello.txt") === file);
            directory.removeEntry(file, false);
            assert(directory.getAny("hello.txt") === null);
        });
        
        await context.test("Tests flattening and reattaching", () => {
            const file1 = new File("hello.txt", 40, "");
            const file2 = new File("world.png", 8044, "");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "");
            const other2 = new File("another", 3, "");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const fullFlatRoot = root.flat(true, 10);
            
            const root2 = new Directory("root", []);
            root2.update(fullFlatRoot, 10);
            
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
        
        await context.test("Testing stringifying, parsing, and reattaching", () => {
            const file1 = new File("hello.txt", 40, "hello");
            const file2 = new File("world.png", 8044, "world");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "other");
            const other2 = new File("another", 3, "another");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const stringifiedRoot = root.stringify(true, 10);
            const parsedRoot = JSON.parse(stringifiedRoot);
            
            const root2 = new Directory("root", []);
            root2.update(parsedRoot, 10);
            
            assert(root2.getDirectory("project") !== null);
            assert(root2.getDirectory("other_parent") !== null);
    
            assert(root2.getDirectory("project")?.contents.length === 2);
            assert(root2.getDirectory("project")?.getFile("hello.txt"));
            assert(root2.getDirectory("project")?.getFile("world.png"));
            assert(root2.getDirectory("project")?.getFile("hello.txt")?.byteSize === 40);
            assert(root2.getDirectory("project")?.getFile("world.png")?.byteSize === 8044);
            assert(root2.getDirectory("project")?.getFile("hello.txt")?.realFile === "hello");
            assert(root2.getDirectory("project")?.getFile("world.png")?.realFile === "world");
            
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff"));
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other"));
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another"));
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.byteSize === 8);
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize === 3);
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.realFile === "other");
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.realFile === "another");
        });
        
        await context.test("Stringifying without includeRealFile will not include realFile", () => {
            const file1 = new File("hello.txt", 40, "hello");
            const file2 = new File("world.png", 8044, "world");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "other");
            const other2 = new File("another", 3, "another");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const stringifiedRoot = root.stringify(false, 10);
            const parsedRoot = JSON.parse(stringifiedRoot);
            
            const root2 = new Directory("root", []);
            root2.update(parsedRoot, 10);
    
            assert(root2.getDirectory("project")?.getFile("hello.txt")?.realFile === "");
            assert(root2.getDirectory("project")?.getFile("world.png")?.realFile === "");
            
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.realFile === "");
            assert(root2.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.realFile === "");
        })
        
        await context.test("Tests partially flattened root", () => {
            const file1 = new File("hello.txt", 40, "");
            const file2 = new File("world.png", 8044, "");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "");
            const other2 = new File("another", 3, "");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const rootDepth0 = new Directory("root", []);
            rootDepth0.update(root.flat(true, 0), 0);
            assert(root.contents.length === 2);
            assert(rootDepth0.contents.length === 0);
            
            const rootDepth1 = new Directory("root", []);
            rootDepth1.update(root.flat(true, 1), 1);
            assert(rootDepth1.contents.length === 2);
            assert(rootDepth1.getDirectory("project"));
            assert(rootDepth1.getDirectory("project")?.contents.length === 0);
            assert(rootDepth1.getDirectory("other_parent"));
            assert(rootDepth1.getDirectory("other_parent")?.contents.length === 0);
            
            const rootDepth2 = new Directory("root", []);
            rootDepth2.update(root.flat(true, 2), 2);
            assert(rootDepth2.contents.length === 2);
            assert(rootDepth2.getDirectory("other_parent"));
            assert(rootDepth2.getDirectory("other_parent")?.contents.length === 1);
            assert(rootDepth2.getDirectory("other_parent")?.getDirectory("other_stuff")?.contents.length === 0);
            
            const rootDepthAll = new Directory("root", []);
            rootDepthAll.update(root.flat(true, 99), 99);
            assert(rootDepthAll.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another"));
            assert(rootDepthAll.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.byteSize === other2.byteSize);
            assert(rootDepthAll.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("another")?.realFile === other2.realFile);
        })
        
        await context.test("Tests root self-updating multiple times", () => {
            const file1 = new File("hello.txt", 40, "");
            const file2 = new File("world.png", 8044, "");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "");
            const other2 = new File("another", 3, "");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const newRoot = new Directory("root", []);
    
            const rootDepthAll = root.flat(true, 10);
            newRoot.update(rootDepthAll, 10);
            assert(newRoot.contents.length === 2);
            assert(newRoot.getDirectory("project"));
            assert(newRoot.getDirectory("project")?.contents.length === 2);
            assert(newRoot.getDirectory("project")?.getFile("hello.txt"));
            assert(newRoot.getDirectory("project")?.getFile("hello.txt")?.realFile
            === root.getDirectory("project")?.getFile("hello.txt")?.realFile);
            
            // Updating using lower depth value will not change lower depth contents
            const rootDepth0 = root.flat(true, 0);
            newRoot.update(rootDepth0, 0);
            assert(newRoot.contents.length === 2);
            assert(newRoot.lastModified.toJSON() === root.lastModified.toJSON());
            
            const rootDepth1 = root.flat(true, 1);
            newRoot.update(rootDepth1, 1);
            assert(newRoot.contents.length === 2);
            assert(newRoot.getDirectory("other_parent"));
            assert(newRoot.getDirectory("other_parent")?.contents.length === 1);
            
            root.removeEntry(directory, false);
            
            const rootDepth2 = root.flat(true, 2);
            newRoot.update(rootDepth2, 2);
            assert((newRoot.contents.length as any) === 1);
            assert(newRoot.getDirectory("other_parent"));
            assert(newRoot.getDirectory("other_parent")?.contents.length === 1);
        });
        
        await context.test("Tests VFS cloning functions", () => {
            const file1 = new File("hello.txt", 40, "");
            const file2 = new File("world.png", 8044, "");
            const directory = new Directory("project", [file1, file2]);
            
            const other1 = new File("other", 8, "");
            const other2 = new File("another", 3, "");
            const otherDirectory = new Directory("other_stuff", [other1, other2]);
            const otherParent = new Directory("other_parent", [otherDirectory]);
            
            const root = new Directory("root", [directory, otherParent]);
            
            const rootClone = root.clone(false);
            
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
            assert(rootClone.getDirectory("project")?.getFile("hello.txt")?.realFile
            === root.getDirectory("project")?.getFile("hello.txt")?.realFile);
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
            assert(rootClone.getDirectory("project")?.getFile("world.png")?.realFile
            === root.getDirectory("project")?.getFile("world.png")?.realFile);
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
            assert(rootClone.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.realFile
            === root.getDirectory("other_parent")?.getDirectory("other_stuff")?.getFile("other")?.realFile);
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
    
    test("Controller function tests", async context => {
        await context.test("Tests valid name regex", () => {
            assert(validName("a"));
            assert(validName("hello"));
            assert(validName("hello.txt"));
            assert(validName("hello world.txt"));
            assert(validName("hello world.asdf.  ..txt"));
            assert(validName("hello_world"));
            assert(validName("hello-"));
            assert(validName("_ - ."));
            assert(validName(".hidden"));
            assert(validName(".hidden."));
            assert(validName(".hidden .local .env"));
            assert(validName("image (1).png"));
            assert(validName("()()))()((()("));
    
            assert(false === validName("."));
            assert(false === validName(".."));
            assert(false === validName("......."));
            assert(false === validName(". "));
            assert(false === validName(" ."));
            assert(false === validName(" . "));
            assert(false === validName("  ."));
    
            assert(false === validName(""));
            assert(false === validName("   "));
            assert(false === validName(" asdf"));
            assert(false === validName("asdf "));
            assert(false === validName(" asdf "));
            assert(false === validName(". asdf. "));
            assert(false === validName(".asdf. "));
    
            assert(false === validName("\tasdf"));
            assert(false === validName("\nasdf"));
            assert(false === validName("\rasdf"));
            assert(false === validName("asdf\t"));
            assert(false === validName("asdf\n"));
            assert(false === validName("asdf\r"));
    
            assert(false === validName("asdf/"));
            assert(false === validName("/asdf"));
            assert(false === validName("asdf/other"));
    
            assert(false === validName("-rf"));
            assert(false === validName("- -rf"));
            assert(false === validName("--rf"));

            assert(false === validPath("asdfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdf"));
        });
        
        await context.test("Tests valid path regex", () => {
            assert(validPath("a/a"));
            assert(validPath("hello/a"));
            assert(validPath("hello/(a)"));
            assert(validPath("hello/a)"));
            assert(validPath("hello/(a"));
            assert(validPath("(hel)()lo)/(a"));
            assert(validPath("hello.txt/a"));
            assert(validPath("hello world.txt/a"));
            assert(validPath("hello world.asdf.  ..txt/a"));
            assert(validPath("hello_world/a"));
            assert(validPath("hello-/a"));
            assert(validPath("hello-)/a"));
            assert(validPath("_ - ./a"));
            assert(validPath(".hidden/a"));
            assert(validPath(".hidden./a"));
            assert(validPath(".hidden .local .env/a"));
            
            assert(validPath("a/asdf"));
            assert(validPath("a/asdf/asdf"));
            assert(validPath("a/hello world/asdf"));
            assert(validPath("a/.asdf/asdf"));
            assert(validPath("a/.asdf/_hello-world.txt"));
            assert(validPath("vault/folder/hello_world.png"));
            assert(validPath("vault/folder/.asdf"));
            assert(validPath("_/_/_"));
    
    
    
            assert(false === validPath("a"));
            assert(false === validPath("hello"));
            assert(false === validPath("hello.txt"));
            assert(false === validPath("hello world.txt"));
            assert(false === validPath("hello world.asdf.  ..txt"));
            assert(false === validPath("hello_world"));
            assert(false === validPath("hello-"));
            assert(false === validPath("_ - ."));
            assert(false === validPath(".hidden"));
            assert(false === validPath(".hidden."));
            assert(false === validPath(".hidden .local .env"));
    
            assert(false === validPath("."));
            assert(false === validPath(".."));
            assert(false === validPath("......."));
            assert(false === validPath(". "));
            assert(false === validPath(" ."));
            assert(false === validPath(" . "));
            assert(false === validPath("  ."));
    
            assert(false === validPath("./a"));
            assert(false === validPath("../a"));
            assert(false === validPath("......./a"));
            assert(false === validPath(". /a"));
            assert(false === validPath(" ./a"));
            assert(false === validPath(" . /a"));
            assert(false === validPath("  ./a"));
    
            assert(false === validPath("./asdf"));
            assert(false === validPath("asdf/./asdf"));
            assert(false === validPath("asdf/."));
            assert(false === validPath("asdf/.."));
            assert(false === validPath("asdf/../asdf"));
    
    
            assert(false === validPath(""));
            assert(false === validPath("   "));
            assert(false === validPath(" asdf"));
            assert(false === validPath("asdf "));
            assert(false === validPath(" asdf "));
            assert(false === validPath(". asdf. "));
            assert(false === validPath(".asdf. "));
    
            assert(false === validPath("/a"));
            assert(false === validPath("   /a"));
            assert(false === validPath(" asdf/a"));
            assert(false === validPath("asdf /a"));
            assert(false === validPath(" asdf /a"));
            assert(false === validPath(". asdf. /a"));
            assert(false === validPath(".asdf. /a"));
            
            assert(false === validPath(" /asdf"));
            assert(false === validPath("asdf/ asdf"));
            assert(false === validPath("asdf/asdf "));
            assert(false === validPath("asdf /asdf"));
            assert(false === validPath("asdf / asdf"));
    
    
            assert(false === validPath("\tasdf"));
            assert(false === validPath("asdf\n"));
            assert(false === validPath("\tasdf/a"));
            assert(false === validPath("asdf\n/a"));
            assert(false === validPath("a/\tasdf"));
            assert(false === validPath("a/asdf\n"));
    
            assert(false === validPath("asdf/\tasdf"));
            assert(false === validPath("asdf\n/asdf"));
            assert(false === validPath("asdf/asdf\n"));
    
    
            assert(false === validPath("asdf/"));
            assert(false === validPath("/asdf"));
            assert(false === validPath("/"));
            assert(false === validPath("asdf/asdf/"));
            assert(false === validPath("/asdf/"));
            assert(false === validPath("_._/.asdf/"));
            assert(false === validPath("asdf//asdf"));
            assert(false === validPath("asdf//"));
    
    
            assert(false === validPath("-rf"));
            assert(false === validPath("- -rf"));
            assert(false === validPath("--rf"));
            assert(false === validPath("a/-rf"));
            assert(false === validPath("a/- -rf"));
            assert(false === validPath("a/--rf"));
            assert(false === validPath("-rf/a"));
            assert(false === validPath("- -rf/a"));
            assert(false === validPath("--rf/a"));
    
            assert(false === validPath("asdf/-rf"));
            assert(false === validPath("-rf/asdf"));
            assert(false === validPath("asdf/- -rf"));
            assert(false === validPath("- -rf/asdf"));
            assert(false === validPath("asdf/--rf"));
            assert(false === validPath("--rf/asdf"));

            assert(false === validPath("asdfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdf"));
            assert(false === validPath("asdfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdf/item"));
            assert(false === validPath("folder/asdfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdf"));
            assert(false === validPath("folder/subfolder/asdfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdf"));
        });
        
        await context.test("Tests getVaultFromPath function", () => {
            assert(getVaultFromPath("asdf" as any) === "asdf");
            assert(getVaultFromPath("hello world" as any) === "hello world");
            assert(getVaultFromPath("Hello_-wor.dll" as any) === "Hello_-wor.dll");
            assert(getVaultFromPath("19298aubu asdf823n" as any) === "19298aubu asdf823n");
    
            assert(getVaultFromPath("asdf/asdfasdfa" as any) === "asdf");
            assert(getVaultFromPath("asdf/asdfas. asdf_-as-d-_- 29192" as any) === "asdf");
            assert(getVaultFromPath("hello world/a s d a hello world" as any) === "hello world");
            assert(getVaultFromPath("Hello_-wor.dll/Hello-world.exe" as any) === "Hello_-wor.dll");
            assert(getVaultFromPath("19298aubu asdf823n/8382nb" as any) === "19298aubu asdf823n");
    
            assert(getVaultFromPath("asdf/asdfasdfa/asdfasdf" as any) === "asdf");
            assert(getVaultFromPath("asdf/asdfas. asdf_-as-d-_- 29192/hello world" as any) === "asdf");
            assert(getVaultFromPath("hello world/a s d a hello world/aaaa" as any) === "hello world");
            assert(getVaultFromPath("Hello_-wor.dll/Hello-world.exe/19391 19" as any) === "Hello_-wor.dll");
            assert(getVaultFromPath("19298aubu asdf823n/8382nb/. . . ." as any) === "19298aubu asdf823n");
        });
        
        await context.test("Tests getParentDirectory function", () => {
            assert(getParentPath("vault/hello/some folder/file.txt/what" as any) === "vault/hello/some folder/file.txt");
            assert(getParentPath("vault/hello/some folder/file.txt" as any) === "vault/hello/some folder");
            assert(getParentPath("vault/hello/some folder" as any) === "vault/hello");
            assert(getParentPath("vault/hello" as any) === "vault");
            assert(getParentPath("vault" as any) === null);
        });
        
        await context.test("Tests splitParentChild function", () => {
            let path: ValidatedPath;
            let split: [VaultPath | ValidatedPath, string] | [null, null];
    
            path = "vault/hello/some folder/file.txt/what" as any;
            split = splitParentChild(path);
            assert(split[0] === "vault/hello/some folder/file.txt");
            assert(split[1] === "what");
    
            path = "vault/hello/some folder/file.txt" as any;
            split = splitParentChild(path);
            assert(split[0] === "vault/hello/some folder");
            assert(split[1] === "file.txt");
    
            path = "vault/hello/some folder" as any;
            split = splitParentChild(path);
            assert(split[0] === "vault/hello");
            assert(split[1] === "some folder");
    
            path = "vault/hello" as any;
            split = splitParentChild(path);
            assert(split[0] === "vault");
            assert(split[1] === "hello");
    
            path = "vault" as any;
            split = splitParentChild(path);
            assert(split[0] === null);
        });
    });
    
    it("Tests file and folder icons maps", async () => {
        // Files icons from extension
        assert(fileExtensionMap.get("js") === "javascript.svg");
        assert(fileExtensionMap.get("ts") === "typescript.svg");
        assert(fileExtensionMap.get("cpp") === "cpp.svg");
        assert(fileExtensionMap.get("h") === "h.svg");
        assert(fileExtensionMap.get("json") === "json.svg");
        assert(fileExtensionMap.get("json5") === "json.svg");
        assert(fileExtensionMap.get("doesntexist") === undefined);
        
        // File icons from name
        assert(fileNameMap.get(".gitignore") === "git.svg");
        assert(fileNameMap.get(".gitconfig") === "git.svg");
        assert(fileNameMap.get("authors") === "authors.svg");
        assert(fileNameMap.get("authors.md") === "authors.svg");
        assert(fileNameMap.get("readme.md") === "readme.svg");
        assert(fileNameMap.get("hello") === undefined);
        
        // Folder base icons
        assert(folderBaseMap.get("components") === "folder-components");
        assert(folderBaseMap.get("public") === "folder-public");
        assert(folderBaseMap.get("src") === "folder-src");
        assert(folderBaseMap.get("tests") === "folder-test");
        assert(folderBaseMap.get("build") === "folder-dist");
        assert(folderBaseMap.get("bin") === "folder-dist");
        assert(folderBaseMap.get("myfolder") === undefined);
        
        // Tests all svgs actually exist
        for(const file of fileExtensionMap.values()) {
            try {
                await fs.access(path.join(process.cwd(), "public/item-icons", file));
            } catch(error) {
                assert(false, `Icon file ${file} does not exist.`)
            }
        }
        for(const file of fileNameMap.values()) {
            try {
                await fs.access(path.join(process.cwd(), "public/item-icons", file));
            } catch(error) {
                assert(false, `Icon file ${file} does not exist.`)
            }
        }
        for(const file of folderBaseMap.values()) {
            try {
                await fs.access(path.join(process.cwd(), "public/item-icons", file + ".svg"));
            } catch(error) {
                assert(false, `Icon file ${file} does not exist.`)
            }
            try {
                await fs.access(path.join(process.cwd(), "public/item-icons", file + "-open.svg"));
            } catch(error) {
                assert(false, `Icon file ${file} does not exist.`)
            }
        }
    });
    
    after(async () => {
        await cleanup();
    });
});