// Before running this test, make sure npm run dev is ran
// The database used for this test depends on the one npm run dev is using.

import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import axios from "axios"; // eslint-disable-line
import fs from "fs/promises";
import { Blob } from "buffer";

import { cleanup } from "../src/cleanup";
import { createToken, WebVaultPayload } from "../src/authentication/vault_token";
import { deleteVaultPassword, setVaultPassword } from "../src/authentication/database";
import JWT, { Header, unixTime } from "jwt-km";
import { DEFAULT_ADMIN_NAME, DOMAIN, JWT_SECRET } from "../src/env";
import { adminAccess } from "../src/admin_auth";
import { Directory, File } from "../src/vfs";

import { post } from "../src/requests";

import type { Expect as AdminLoginExpect, Data as AdminLoginData } from "../app/api/admin/login/route";
import type { Expect as CreateVaultExpect, Data as CreateVaultData } from "../app/api/admin/create_vault/route";
import type { Expect as DeleteVaultExpect, Data as DeleteVaultData } from "../app/api/admin/delete_vault/route";
import type { Expect as VaultLoginExpect, Data as VaultLoginData } from "../app/api/vault/login/route";
import type { Expect as VFSExpect, Data as VFSData } from "../app/api/file/vfs/route";
import type { Data as AddFileData } from "../app/api/file/add_file/route";
import type { Expect as AddFolderExpect, Data as AddFolderData } from "../app/api/file/add_folder/route";
import type { Expect as MoveExpect, Data as MoveData } from "../app/api/file/move/route";
import type { Expect as RemoveExpect, Data as RemoveData } from "../app/api/file/remove/route";

axios.defaults.baseURL = "http://localhost:3000/api";
axios.defaults.baseURL = "http://172.20.80.1:3000/api"; // Windows localhost IP from WSL
axios.defaults.validateStatus = null;

async function checkResponse(url: string, parameters: Array<unknown>, checks: (data: any, parameter: any) => any) {
    for(const parameter of parameters) {
        await axios.post(url, parameter).then(response => checks(response.data, parameter));
    }
}

// Request with body ${parameter} failed the ${checkName} check.
function failString(data: object, parameter: string, checkName: string) {
    return `Request with body ${JSON.stringify(parameter)} failed the ${checkName} check. Data: ${JSON.stringify(data)}`
}

describe("API tests", () => {
    // Forces NextJS to compile all API routes
    // If we do not force all compiles beforehand, some modules will be JIT
    // compiled in the middle of testing, including modules in src which will be
    // recompiled, making them lose their memory.
    before(async () => {
        await Promise.all([
            axios.post("admin/login"),
            axios.post("admin/logout"),
            axios.post("admin/create_vault"),
            axios.post("admin/delete_vault"),
            axios.post("admin/get_vaults"),
            axios.post("admin/change_vault_password"),

            axios.post("vault/login"),
            axios.post("vault/logout"),
            axios.post("vault/refresh"),
            axios.post("vault/trim"),

            axios.post("file/add_file"),
            axios.post("file/add_folder"),
            axios.post("file/copy"),
            axios.post("file/move"),
            axios.post("file/remove"),
            axios.post("file/vfs"),
        ]);
    });

    describe("Admin API tests", () => {
        it("Tests admin/login", async () => {
            await checkResponse("admin/login", [
                undefined,
                null,
                "asdf",
                {},
                { adminName: "hello" },
                { adminName: "hello", password: 123 },
                { adminName: 123, password: 123 },
                { adminName: 123, password: "asdf" },
                { adminName: { adminName: "hello", password: "world" }, password: "asdf" },
                { adminName: null, password: null },
                { adminName: undefined, password: undefined },
                { adminName: undefined, password: null },
                { adminName: null, password: undefined },
                { adminName: null, password: undefined },
                { randomParameter: null },
                { randomParameter: "adminName" }
            ], (data, parameter) => {
                assert(data.error?.includes("Bad parameters"), failString(data, parameter, "bad parameters error"));
            });
            
            const data = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data;
            const token = data.token;
            assert(token !== null);
            assert(typeof data.token === "string");
            assert(data.error === undefined);
            assert(await adminAccess(token));
        });
        
        it("Tests admin/logout", async () => {
            await checkResponse("admin/logout", [
                undefined, null, "asdf", {},
                { token: 123 },
                { token: null },
                { token: undefined },
                { token: { asdf: "asdf" } },
            ], (data, parameter) => {
                assert(data.error?.includes("Bad parameters"), failString(data, parameter, "bad parameters error"));
            });
            
            await checkResponse("admin/logout", [
                { token: "" },
                { token: "abasdf" },
                { token: "abasdf.asdfsa.ashhbha" },
            ], (data, parameter) => {
                assert(data.success === false, failString(data, parameter, "success is false"));
            });
            
            const token = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data.token;
            assert(token !== null);
            assert(typeof token === "string");
            
            const data = (await axios.post("admin/logout", { token })).data;
            assert(data.success === true);
            assert(data.error === undefined);
        });
        
        it("Tests admin/create_vault.ts, admin/delete_vault, and admin/get_vaults", async () => {
            await checkResponse("admin/create_vault", [
                undefined, null, "asdf",
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("admin/create_vault", [
                {},
                { vaultName: "new_vault", password: "password" },
                { vaultName: 123, password: 1231 },
                { adminToken: 123, vaultName: "new_vault", password: "password" },
                { adminToken: null, vaultName: "new_vault", password: "password" },
                { adminToken: "invalid.token.invalid", vaultName: "new_vault", password: "password" },
            ], (data, parameter) => {
                assert(data.error?.includes("Unauthorized admin request"), failString(data, parameter, "unauthorized admin request error"));
            });
            {
                const token = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data.token;
                assert(token !== null);
                assert(JWT.unwrap(token, JWT_SECRET) !== null, "The secret key used by the server and the test is not the same. Please fix or the next few tests may be ineffective.");
            }
            {
                await setVaultPassword("vault123", "password");
                const token = await createToken("vault123");
                assert(token !== null);
                const data = (await axios.post("admin/create_vault", { adminToken: token, vaultName: "new_vault", password: "password" })).data;
                assert(data.error?.includes("Unauthorized admin request"));
                await deleteVaultPassword("vault123");
            }
            {
                const jwt = new JWT(DOMAIN, unixTime() - 1000, unixTime() - 100);
                jwt.addClaim("type", "admin");
                jwt.addClaim("adminName", DEFAULT_ADMIN_NAME);
                const token = jwt.getToken(JWT_SECRET);
                const data = (await axios.post("admin/create_vault", { adminToken: token, vaultName: "new_vault", password: "password" })).data;
                assert(data.error?.includes("Unauthorized admin request"));
            }

            const token = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data.token;
            assert(token !== null);
            {
                const data = (await axios.post("admin/create_vault", { adminToken: token, vaultName: "new_vault", password: "password" })).data;
                assert(data.success);
                assert(data.error === undefined);
            }
            {
                // Cannot create vault when it already exists
                const data = (await axios.post("admin/create_vault", { adminToken: token, vaultName: "new_vault", password: "password" })).data;
                assert(data.failureReason?.toLowerCase().includes("exists"));
            }

            
            


            await checkResponse("admin/get_vaults", [
                undefined, null, "asdf",
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("admin/get_vaults", [
                {},
                { adminToken: "asdfasdf" },
                { adminToken: "asdfasdf.asdfa.ab" },
                { adminToken: null },
            ], (data, parameter) => {
                assert(data.error?.includes("Unauthorized admin request"), failString(data, parameter, "unauthorized admin request error"));
            });
            {
                const data = (await axios.post("admin/get_vaults", { adminToken: token })).data;
                assert(data.vaults !== null);
                assert(data.vaults.some((name: string) => name === "new_vault"));
                assert(data.error === undefined);
            }
            
            

            

            await checkResponse("admin/delete_vault", [
                undefined, null, "asdf",
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("admin/delete_vault", [
                {},
                { vaultName: "nonexist" },
                { vaultName: "new_vault" },
                { adminToken: "asdjfajsdfja", vaultName: "new_vault" },
                { adminToken: null, vaultName: "new_vault" },
                { adminToken: "anbnansdfnan.asdfdansnbnasdf.asdhnasdfasd", vaultName: "new_vault" },
                { adminToken: 123, vaultName: "new_vault" },
            ], (data, parameter) => {
                assert(data.error?.includes("Unauthorized admin request"), failString(data, parameter, "unauthorized admin request error"));
            });
            // Note: No need to test the scenario where a nonexistant vault is
            // inputted because deletion will proceed regardless of vault existance.
            {
                const data = (await axios.post("admin/delete_vault", { adminToken: token, vaultName: "new_vault" })).data;
                assert(data.error === undefined);
            }
            {
                const data = (await axios.post("admin/get_vaults", { adminToken: token })).data;
                assert(data.vaults !== null);
                assert(data.vaults.every((name: string) => name !== "new_vault"));
                assert(data.error === undefined);
            }
        });
        
        after(async () => {
            const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
            assert(adminToken !== null);
            await post<DeleteVaultExpect, DeleteVaultData>("admin/delete_vault", { adminToken, vaultName: "new_vault" });
        });
    });
    
    describe("Vault API tests", async () => {
        const vaultOne = "vault_api_test_one";
        const vaultTwo = "vault_api_test_two";

        before(async () => {
            const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
            assert(adminToken !== null);
            const createVaultOneSuccess = (await post<CreateVaultExpect, CreateVaultData>("admin/create_vault", { adminToken, vaultName: vaultOne, password: "password" })).success;
            assert(createVaultOneSuccess);
            const createVaultTwoSuccess = (await post<CreateVaultExpect, CreateVaultData>("admin/create_vault", { adminToken, vaultName: vaultTwo, password: vaultTwo })).success;
            assert(createVaultTwoSuccess);
        });

        it("Tests vault/login", async () => {
            await checkResponse("vault/login", [
                undefined, null, "asdf",
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("vault/login", [
                undefined,
                null,
                `vaultName: ${vaultOne}, password: "password"`,
                {},
                { vaultName: vaultOne },
                { vaultName: 12312 },
                { vaultName: null },
                { vaultName: vaultOne, password: 1212 },
                { vaultName: vaultOne, password: null },
                { vaultName: vaultOne, password: { password: "password" } },
                { password: null },
                { password: 1234 },
                { password: "password" },
                { randomParameter: null },
                { randomParameter: "password" },
                { randomParameter: "password", vaultName: vaultOne },
                { randomParameter: "password", password: "password" },
            ], (data, parameter) => {
                assert(data.error?.includes("Bad parameters"), failString(data, parameter, "bad parameters error"))
            });
            {
                const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOne, password: "wrong password" })).token ?? null;
                assert(vaultToken === null);
            }
            {
                const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOne, password: "wrong password", existingToken: "invalid.token.forsure" })).token ?? null;
                assert(vaultToken === null);
            }
            
            {
                const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOne, password: "password", existingToken: "invalid.token.forsure" })).token ?? null;
                assert(vaultToken !== null);
                assert(JWT.unwrap(vaultToken, JWT_SECRET) !== null, "The secret key used by the server and the test is not the same. Please fix or the next few tests may be ineffective.");
                const unwrapped = JWT.unwrap(vaultToken, JWT_SECRET);
                assert(unwrapped !== null);
                const [ _header, payload ] = unwrapped as [ Header, WebVaultPayload ];
                assert(payload.access.length === 1);
                assert(payload.access[0].vault === vaultOne);
            }

            const oneVaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOne, password: "password" })).token ?? null;
            assert(oneVaultToken !== null);
            const oneUnwrapped = JWT.unwrap(oneVaultToken, JWT_SECRET);
            assert(oneUnwrapped !== null);
            const [ _header, oneVaultPayload ] = oneUnwrapped as [ Header, WebVaultPayload ];
            assert(oneVaultPayload.access.length === 1);
            assert(oneVaultPayload.access[0].vault === vaultOne);
            
            const bothVaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultTwo, password: vaultTwo, existingToken: oneVaultToken })).token ?? null;
            assert(bothVaultToken !== null);
            const bothUnwrapped = JWT.unwrap(bothVaultToken, JWT_SECRET);
            assert(bothUnwrapped !== null);
            const [ __header, bothVaultPayload ] = bothUnwrapped as [ Header, WebVaultPayload ];
            assert(bothVaultPayload.access.length === 2);
            assert(bothVaultPayload.access.some(access => access.vault === vaultOne));
            assert(bothVaultPayload.access.some(access => access.vault === vaultTwo));
            
            const stillBothVaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOne, password: "password", existingToken: bothVaultToken })).token ?? null;
            assert(stillBothVaultToken !== null)
            const stillBothUnwrapped = JWT.unwrap(stillBothVaultToken, JWT_SECRET);
            assert(stillBothUnwrapped !== null);
            const [ ___header, stillBothVaultPayload ] = stillBothUnwrapped as [ Header, WebVaultPayload ];
            assert(stillBothVaultPayload.access.length === 2);
            assert(stillBothVaultPayload.access.some(access => access.vault === vaultOne));
            assert(stillBothVaultPayload.access.some(access => access.vault === vaultTwo));
        });
        
        after(async () => {
            const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
            assert(adminToken !== null);
            await post<DeleteVaultExpect, DeleteVaultData>("admin/delete_vault", { adminToken, vaultName: vaultOne });
            await post<DeleteVaultExpect, DeleteVaultData>("admin/delete_vault", { adminToken, vaultName: vaultTwo });
        });
    });
    
    async function fileBlob(path: string) {
        return new Blob([ await fs.readFile(path) ]);
    }
    
    describe("File API tests", () => {
        const vaultOneName = "file_api_test_one";
        const vaultTwoName = "file_api_test_two";

        before(async () => {
            const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
            assert(adminToken !== null);
            const createVaultOneSuccess = (await post<CreateVaultExpect, CreateVaultData>("admin/create_vault", { adminToken, vaultName: vaultOneName, password: "password" })).success;
            assert(createVaultOneSuccess);
            const createVaultTwoSuccess = (await post<CreateVaultExpect, CreateVaultData>("admin/create_vault", { adminToken, vaultName: vaultTwoName, password: vaultTwoName })).success;
            assert(createVaultTwoSuccess);
        });
        
        it("Tests api/file/add_file (assumes api/file/vfs working) (for cleanup, assumes api/file/remove", async () => {
            const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
            assert(vaultToken !== null);

            const vaultOne = new Directory(vaultOneName, []);
            {
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 999 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
            }
            assert(vaultOne.contents.length as number === 0);
            
            await checkResponse("file/add_file", [
                {},
                { adminToken: "asdf.asdf.asdf" },
                { adminToken: "asdf.asdf.asdf", path: vaultOneName + "/LICENSE" },
                { adminToken: "asdf.asdf.asdf", path: vaultOneName + "/LICENSE", file: {} }, // Can't stringify Blobs
                { adminToken: "asdf.asdf.asdf", path: vaultOneName + "/LICENSE", file: "asfdasf" }, // Can't stringify Blobs
                { path: vaultOneName + "/LICENSE", file: "asfdasf" }, // Can't stringify Blobs
                { file: "asfdasf" }, // Can't stringify Blobs
            ], (data, parameter) => {
                assert(data.error?.includes("Expected FormData body."), failString(data, parameter, "expected FormData body error"));
            });
            await checkResponse("file/add_file", [
                // For some reason, axios by default encodes data as FormData,
                // even with undefined and null.
                undefined,
                "asdf", 
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
                await (async () => {
                    const formData = new FormData();
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    formData.append("file", await fileBlob("./LICENSE"));
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    formData.append("vaultToken", "asdfsasdf.adsfasdfa.sdfsasdf");
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    formData.append("vaultToken", "asdfsasdf.adsfasdfa.sdfsasdf");
                    formData.append("path", vaultOneName + "/LICENSE");
                    formData.append("file", await fileBlob("./LICENSE"));
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
                    assert(adminToken !== null);
                    formData.append("adminToken", adminToken);
                    formData.append("path", vaultOneName + "/LICENSE");
                    formData.append("file", await fileBlob("./LICENSE"));
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
                    assert(adminToken !== null);
                    formData.append("vaultToken", adminToken);
                    formData.append("path", vaultOneName + "/LICENSE");
                    formData.append("file", await fileBlob("./LICENSE"));
                    return formData;
                })(),
                await (async () => {
                    const formData = new FormData();
                    const vaultOneToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(vaultOneToken !== null);
                    formData.append("vaultToken", vaultOneToken);
                    formData.append("path", vaultTwoName + "/LICENSE");
                    formData.append("file", await fileBlob("./LICENSE"));
                    return formData;
                })(),
            ], (data, parameter) => {
                assert(data.error?.includes("Unauthorized request."), failString(data, parameter, "expected Unauthorized request error"));
            });
            {
                // Cannot add file to invalid path
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "//invalidpath");
                formData.append("file", await fileBlob("./LICENSE"));
                const data = (await axios.post("file/add_file", formData)).data;
                assert(data.error.includes("The provided path is not valid."));
            }
            {
                // Must be at least one entry after vault name
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName);
                formData.append("file", await fileBlob("./LICENSE"));
                const data = (await axios.post("file/add_file", formData)).data;
                assert(data.error.includes("The provided path is not valid."));
            }

            {
                // Add file
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/LICENSE");
                formData.append("file", await fileBlob("./LICENSE"));
                const data = (await axios.post("file/add_file", formData)).data;
                assert(data.error === undefined);
                assert(data.success === true);
                assert(data.displacedPath === undefined);
            }
            {
                // Update VFS and check
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 999 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 1);
                assert(vaultOne.contents[0].name === "LICENSE");
                assert(vaultOne.contents[0].isDirectory === false);
                const stats = await fs.stat("./LICENSE");
                assert(vaultOne.contents[0].getByteSize() === stats.size);
            }
            {
                // Can't add file to already existing location
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/LICENSE");
                formData.append("file", await fileBlob("./.gitignore"));
                const data = (await axios.post("file/add_file", formData)).data;
                assert(data.error === undefined);
                assert(data.success === false);
                assert(data.displacedPath === undefined);
            }
            {
                // Can't add file to destination without an existing parent directory
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/nonexistant/LICENSE");
                formData.append("file", await fileBlob("./.gitignore"));
                const data = (await axios.post("file/add_file", formData)).data;
                assert(data.error === undefined);
                assert(data.success === false);
                assert(data.displacedPath === undefined);
            }

            {
                // Cleanup
                const removeData = (await axios.post("file/remove", { vaultToken, path: vaultOneName + "/LICENSE" })).data;
                assert(removeData.error === undefined);
                assert(removeData.success === true);
            }
        });
        
        it("Tests api/file/add_folder (assumes api/file/vfs working)", async () => {
            await checkResponse("file/add_folder", [
                undefined, null, "asdf",
                `{ #"hello": 123 }`,
                `{ "hello": !123 }`,
                `{ "hello": 123> }`,
                `{ "hello": <123> }`,
                `<div>{}</div>`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("file/add_folder", [
                { },
                { path: vaultOneName + "/folder1" },
                { path: 12341 },
                { path: 12341, vaultToken: "asfda.asdfasdf.asdfa" },
                { path: { path: vaultOneName + "/folder1", vaultToken: "asdfa.sdfasdfa.asdf" }, vaultToken: "asfda.asdfasdf.asdfa" },
                { path: vaultOneName + "/folder1", vaultToken: 123412 },
            ], (data, parameter) => {
                assert(data.error?.includes("Expected body with valid vaultToken and path string attributes."), failString(data, parameter, "expected body with valid vaultToken and path attributes error"));
            });
            await checkResponse("file/add_folder", [
                { path: vaultOneName + "/folder1", vaultToken: "asdfa.asdfa.asdf" },
                { path: vaultOneName + "/folder1", vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultTwoName, password: vaultTwoName })).token ?? null;
                    assert(token !== null);
                    return token;
                })() },
                { path: "nonexistant" + "/folder1", vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(token !== null);
                    return token;
                })() },
            ], (data, parameter) => {
                assert(data.error?.includes("Provided vaultToken does not have access to path"), failString(data, parameter, "vaultToken does not have access to path"));
            });
            const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
            assert(vaultToken !== null);
            {
                const error = (await axios.post("file/add_folder", { vaultToken, path: vaultOneName + "/folder1//bad path" })).data.error;
                assert(error?.includes("The provided path is not valid."));
            }
            {
                // Expects at least one entry after vault name
                const error = (await axios.post("file/add_folder", { vaultToken, path: vaultOneName })).data.error;
                assert(error?.includes("The provided path is not valid."));
            }
            {
                // Nested directory creation disallowed
                const success = (await axios.post("file/add_folder", { vaultToken, path: vaultOneName + "/folder1/folder2" })).data.success;
                assert(success === false);
            }
            
            const vaultOne = new Directory(vaultOneName, []);
            {
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 999 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length === 0);
            }
            
            {
                // Tests add_folder
                const success = (await axios.post("file/add_folder", { vaultToken, path: vaultOneName + "/folder1" })).data.success;
                assert(success === true);
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 999 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 1);
                assert(vaultOne.contents[0].isDirectory === true);
                assert(vaultOne.contents[0].name === "folder1");
            }
            
            {
                // Adds another folder to folder
                const success = (await axios.post("file/add_folder", { vaultToken, path: vaultOneName + "/folder1/folder2" })).data.success;
                assert(success === true);
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName + "/folder1", depth: 999 })).directory;
                assert(vfs !== undefined);
                const folder1 = vaultOne.getDirectory("folder1");
                assert(folder1 !== null);
                folder1.update(vfs);
                assert(folder1.contents.length === 1);
                assert(folder1.contents[0].isDirectory === true);
                assert(folder1.contents[0].name === "folder2");
            }
            
            {
                // Cleanup
                const removed = (await axios.post("file/remove", { vaultToken, path: vaultOneName + "/folder1" })).data;
                assert(removed.error === undefined);
                assert(removed.success === true);
            }
        });

        it("Tests api/file/vfs (assumes api/file/add_* and api/file/remove working)", async () => {
            await checkResponse("file/vfs", [
                undefined, null, "asdf",
                `{ "hello": <123> }`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("file/vfs", [
                { },
                { path: vaultOneName },
                { path: 12341 },
                { path: 12341, vaultToken: "asfda.asdfasdf.asdfa" },
                { path: { path: vaultOneName, vaultToken: "asdfa.sdfasdfa.asdf" }, vaultToken: "asfda.asdfasdf.asdfa" },
                { path: vaultOneName, vaultToken: 123412 },
            ], (data, parameter) => {
                assert(data.error?.includes("Expected body with valid vaultToken and path string attributes."), failString(data, parameter, "expected body with valid vaultToken and path attributes error"));
            });
            await checkResponse("file/vfs", [
                { path: vaultOneName, vaultToken: "asdfa.asdfa.asdf" },
                { path: vaultOneName, vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultTwoName, password: vaultTwoName })).token ?? null;
                    assert(token !== null);
                    return token;
                })() },
                { path: "nonexistant", vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(token !== null);
                    return token;
                })() },
            ], (data, parameter) => {
                assert(data.error?.includes("Provided vaultToken does not have access to path"), failString(data, parameter, "vaultToken does not have access to path"));
            });

            const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
            assert(vaultToken !== null);
            {
                const error = (await axios.post("file/vfs", { vaultToken, path: vaultOneName + "//bad path" })).data.error;
                assert(error?.includes("The provided path is not a valid destination."));
            }
            {
                // Nonexistant folder gives undefined VFS
                const result = (await axios.post("file/vfs", { vaultToken, path: vaultOneName + "/nonexistant"})).data;
                assert(result.error === undefined);
                assert(result.directory === undefined);
            }

            const vaultOne = new Directory(vaultOneName, []);
            {
                const vfs = (await axios.post("file/vfs", { vaultToken, path: vaultOneName })).data.directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length === 0);
            }
            
            /*
            Adds test files and folders
            vaultOne/
                LICENSE
                folder/
                    .gitignore
                    subfolder/
            */
            {
                // Adds vaultOne/LICENSE file
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/LICENSE");
                formData.append("file", await fileBlob("./LICENSE"));
                const success = (await post<FormData, AddFileData>("file/add_file", formData)).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder
                const success = (await post<AddFolderExpect, AddFolderData>("file/add_folder", { vaultToken, path: vaultOneName + "/folder" })).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder/.gitignore
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/folder/.gitignore");
                formData.append("file", await fileBlob("./.gitignore"));
                const success = (await post<FormData, AddFileData>("file/add_file", formData)).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder/subfolder
                const success = (await post<AddFolderExpect, AddFolderData>("file/add_folder", { vaultToken, path: vaultOneName + "/folder/subfolder" })).success;
                assert(success === true);
            }
            
            {
                /*
                vaultOne/
                    LICENSE
                    folder/
                        .gitignore
                        subfolder/
                */
                // Updates vfs from root and checks structure.
                // Note: If error encountered, ensure MAX_VFS_DEPTH is deep enough to update all at once
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 99 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 2);
                {
                    const entry = vaultOne.getPath("LICENSE");
                    assert(entry !== null)
                    assert(entry.isDirectory === false);
                    assert(entry.name === "LICENSE");
                }
                {
                    const entry = vaultOne.getPath("folder");
                    assert(entry !== null)
                    assert(entry.isDirectory === true);
                    assert(entry.name === "folder");
                    assert((entry as Directory).contents.length === 2);
                }
                {
                    const entry = vaultOne.getPath("folder/.gitignore");
                    assert(entry !== null)
                    assert(entry.isDirectory === false);
                    assert(entry.name === ".gitignore");
                }
                {
                    const entry = vaultOne.getPath("folder/subfolder");
                    assert(entry !== null)
                    assert(entry.isDirectory === true);
                    assert(entry.name === "subfolder");
                    assert((entry as Directory).contents.length === 0);
                }
            }
            
            {
                const removed = (await axios.post("file/remove", { vaultToken, path: vaultOneName + "/folder/subfolder" })).data;
                assert(removed.error === undefined);
                assert(removed.success === true);
            }

            {
                /*
                vaultOne/
                    LICENSE
                    folder/
                        .gitignore
                */
                // Retrieves VFS from subdirectory folder this time
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName + "/folder", depth: 99 })).directory;
                assert(vfs !== undefined);
                const folder = vaultOne.getDirectory("folder");
                assert(folder !== null);
                folder.update(vfs);
                assert(vaultOne.contents.length as number === 2);
                {
                    const entry = vaultOne.getPath("LICENSE");
                    assert(entry !== null)
                    assert(entry.isDirectory === false);
                    assert(entry.name === "LICENSE");
                }
                {
                    const entry = vaultOne.getPath("folder");
                    assert(entry !== null)
                    assert(entry.isDirectory === true);
                    assert(entry.name === "folder");
                    assert((entry as Directory).contents.length === 1);
                }
                {
                    const entry = vaultOne.getPath("folder/.gitignore");
                    assert(entry !== null)
                    assert(entry.isDirectory === false);
                    assert(entry.name === ".gitignore");
                }
                {
                    const entry = vaultOne.getPath("folder/subfolder");
                    assert(entry === null)
                }
            }
            
            {
                const removed = (await axios.post("file/remove", { vaultToken, path: vaultOneName + "/folder" })).data;
                assert(removed.error === undefined);
                assert(removed.success === true);
            }
            
            {
                /*
                vaultOne/
                    LICENSE
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 1);
                {
                    const entry = vaultOne.getPath("LICENSE");
                    assert(entry !== null)
                    assert(entry.isDirectory === false);
                    assert(entry.name === "LICENSE");
                }
                {
                    const entry = vaultOne.getPath("folder");
                    assert(entry === null)
                }
            }
            
            {
                const removed = (await axios.post("file/remove", { vaultToken, path: vaultOneName + "/LICENSE" })).data;
                assert(removed.error === undefined);
                assert(removed.success === true);
            }
            
            {
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 0);
            }
        });
        
        it("Tests api/file/move", async () => {
            await checkResponse("file/move", [
                undefined, null, "asdf",
                `{ "hello":: 123 }`,
            ], (data, parameter) => {
                assert(data.error === "Bad parameters. Expected JSON body.", failString(data, parameter, "expected JSON body error"));
            });
            await checkResponse("file/move", [
                { },
                { path: vaultOneName },
                { sourcePath: vaultOneName, destinationPath: vaultOneName + "/destination" },
                { sourcePath: vaultOneName + "/source", destinationPath: vaultOneName + "/destination" },
                { path: 12341 },
                { path: 12341, destinationPath: vaultOneName + "/destination" },
                { sourcePath: 12312, destinationPath: vaultOneName + "/destination" },
                { sourcePath: 12312, destinationPath: { sourcePath: vaultOneName, destinationPath: vaultOneName + "/destination" } },
                { path: 12341, vaultToken: "asfda.asdfasdf.asdfa" },
                { sourcePath: 12341, destinationPath: vaultOneName + "/destination", vaultToken: "asfda.asdfasdf.asdfa" },
                { sourcePath: vaultOneName + "/source", destinationPath: vaultOneName + "/destination", vaultToken: 123412 },
                { vaultToken: await (async () => {
                    const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(vaultToken !== null);
                })(), sourcePath: 12321, destinationPath: vaultOneName + "/destination" },
                { vaultToken: await (async () => {
                    const vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(vaultToken !== null);
                })(), sourcePath: vaultOneName + "/source", destinationPath: {} },
            ], (data, parameter) => {
                assert(data.error?.includes("Expected body with valid vaultToken, sourcePath, and destinationPath string attributes."), failString(data, parameter, "expected body with valid vaultToken, sourcePath, and destinationPath string attributes"));
            });
            await checkResponse("file/move", [
                { vaultToken: "asdfa.asdfasdfas.asdfaf", sourcePath: vaultOneName + "/source", destinationPath: vaultOneName + "/destination" },
                { vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(token !== null);
                    return token;
                })(), sourcePath: vaultTwoName + "/source", destinationPath: vaultOneName + "/destination" },
                { vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(token !== null);
                    return token;
                })(), sourcePath: vaultOneName + "/source", destinationPath: vaultTwoName + "/destination" },
                { vaultToken: await (async () => {
                    const token = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
                    assert(token !== null);
                    return token;
                })(), sourcePath: vaultTwoName + "/source", destinationPath: vaultTwoName + "/destination" },
            ], (data, parameter) => {
                assert(data.error?.includes("Provided vaultToken does not have access to"), failString(data, parameter, "vaultToken does not have access to paths"));
            });
            
            let vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultOneName, password: "password" })).token ?? null;
            assert(vaultToken !== null);
            {
                const error = (await axios.post("file/move", { vaultToken, sourcePath: vaultOneName + "//bad path", destinationPath: vaultOneName + "/destination" })).data.error;
                assert(error?.includes("The provided sourcePath and/or destinationPath is not valid."));
            }
            {
                const error = (await axios.post("file/move", { vaultToken, sourcePath: vaultOneName + "/good path", destinationPath: vaultOneName + "//destination" })).data.error;
                assert(error?.includes("The provided sourcePath and/or destinationPath is not valid."));
            }
            
            /*
            Adds test files and folders
            vaultOne/
                LICENSE
                another folder/
                folder/
                    .gitignore
                    subfolder/
            */
            {
                // Adds vaultOne/LICENSE file
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/LICENSE");
                formData.append("file", await fileBlob("./LICENSE"));
                const success = (await post<FormData, AddFileData>("file/add_file", formData)).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/another folder
                const success = (await post<AddFolderExpect, AddFolderData>("file/add_folder", { vaultToken, path: vaultOneName + "/another folder" })).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder
                const success = (await post<AddFolderExpect, AddFolderData>("file/add_folder", { vaultToken, path: vaultOneName + "/folder" })).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder/.gitignore
                const formData = new FormData();
                formData.append("vaultToken", vaultToken);
                formData.append("path", vaultOneName + "/folder/.gitignore");
                formData.append("file", await fileBlob("./.gitignore"));
                const success = (await post<FormData, AddFileData>("file/add_file", formData)).success;
                assert(success === true);
            }
            {
                // Adds vaultOne/folder/subfolder
                const success = (await post<AddFolderExpect, AddFolderData>("file/add_folder", { vaultToken, path: vaultOneName + "/folder/subfolder" })).success;
                assert(success === true);
            }
            
            // Below: Tests single vault operations (sourcePath and destinationPath same vault)

            const vaultOne = new Directory(vaultOneName, []);
            {
                /*
                vaultOne/
                    LICENSE
                    another folder/
                    folder/
                        .gitignore
                        subfolder/
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length === 3);
                assert(vaultOne.getPath("folder/subfolder"))
            }

            {
                // Move LICENSE to license (renames it)
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/LICENSE", destinationPath: vaultOneName + "/license" })).success;
                assert(success === true);
            }

            {
                /*
                vaultOne/
                    license
                    another folder/
                    folder/
                        .gitignore
                        subfolder/
                */
                const oldFile = vaultOne.getFile("LICENSE");
                assert(oldFile !== null);

                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length === 3);
                const file = vaultOne.getFile("license");
                assert(file !== null);
                assert(file.isDirectory === false);
                assert(file.name === "license");
                assert(file.byteSize === oldFile.byteSize);
            }
            
            {
                // Moves license to another folder and renames to LICENSE
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/license", destinationPath: vaultOneName + "/another folder/LICENSE" })).success;
                assert(success === true);
            }
            
            {
                /*
                vaultOne/
                    another folder/
                        LICENSE
                    folder/
                        .gitignore
                        subfolder/
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 2);
                {
                    const file = vaultOne.getFile("license");
                    assert(file === null);
                }
                {
                    const file = vaultOne.getFile("LICENSE");
                    assert(file === null);
                }
                {
                    const file = vaultOne.getPath("another folder/LICENSE");
                    assert(file !== null);
                    assert(file.name === "LICENSE");
                    assert(file.isDirectory === false);
                }
            }
            
            {
                // Can't move folder to a path inside of itself
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/folder", destinationPath: vaultOneName + "/folder/subfolder" })).success;
                assert(success === false);
            }

            {
                /*
                vaultOne/
                    another folder/
                        LICENSE
                    folder/
                        .gitignore
                        subfolder/
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 2);
                {
                    const file = vaultOne.getPath("another folder/LICENSE");
                    assert(file !== null);
                    assert(file.name === "LICENSE");
                    assert(file.isDirectory === false);
                }
                {
                    const directory = vaultOne.getDirectory("folder");
                    assert(directory !== null);
                    assert(directory.isDirectory === true);
                    assert((directory as Directory).contents.length === 2);
                    assert(directory.getFile(".gitignore") !== null);
                    assert(directory.getDirectory("subfolder") !== null);
                }
            }
            
            {
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/another folder", destinationPath: vaultOneName + "/folder/subfolder/another folder" })).success;
                assert(success === true);
            }
            
            {
                /*
                vaultOne/
                    folder/
                        .gitignore
                        subfolder/
                            another folder/
                                LICENSE
                */
                {
                    const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName })).directory;
                    assert(vfs !== undefined);
                    vaultOne.update(vfs);
                }
                {
                    const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName + "/folder/subfolder" })).directory;
                    assert(vfs !== undefined);
                    const subfolder = vaultOne.getPath("folder/subfolder");
                    assert(subfolder !== null);
                    assert(subfolder.isDirectory === true);
                    (subfolder as Directory).update(vfs);
                }
                assert(vaultOne.contents.length as number === 1);
                const file = vaultOne.getPath("folder/subfolder/another folder/LICENSE");
                assert(file !== null);
                assert(file.isDirectory === false);
                assert(file.name === "LICENSE");
            }
            
            {
                // Can't move to another vault if vaultToken has no access to other vault
                const data = (await axios.post("file/move", { vaultToken, sourcePath: vaultOneName + "/folder/.gitignore", destinationPath: vaultTwoName + "/.gitignore" })).data;
                assert(data.error?.includes("Unauthorized request."));
                assert(data.success === undefined);
            }
            
            vaultToken = (await post<VaultLoginExpect, VaultLoginData>("vault/login", { vaultName: vaultTwoName, password: vaultTwoName, existingToken: vaultToken })).token ?? null;
            assert(vaultToken !== null);

            {
                // Moving file to another vault
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/folder/.gitignore", destinationPath: vaultTwoName + "/.gitignore" })).success;
                assert(success === true);
            }
            
            const vaultTwo = new Directory(vaultTwoName, []);
            {
                /*
                vaultTwo/
                    .gitignore
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultTwoName, depth: 99 })).directory;
                assert(vfs !== undefined);
                vaultTwo.update(vfs);
                assert(vaultTwo.contents.length as number === 1);
                const file = vaultTwo.getFile(".gitignore");
                assert(file !== null);
                assert(file.name === ".gitignore");
                assert(file.isDirectory === false);
                
                const oldFile = vaultOne.getPath("folder/.gitignore");
                assert(oldFile !== null);
                assert(oldFile.isDirectory === false);
                assert(file.byteSize === (oldFile as File).byteSize);
            }
            {
                /*
                vaultOne/
                    folder/
                        subfolder/
                            another folder/
                                LICENSE
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultOneName, depth: 99 })).directory;
                assert(vfs !== undefined);
                vaultOne.update(vfs);
                assert(vaultOne.contents.length as number === 1);
                const folder = vaultOne.getDirectory("folder");
                assert(folder !== null);
                assert(folder.contents.length === 1);
                assert(folder.contents[0].name === "subfolder");
                assert(folder.contents[0].isDirectory === true);
            }
            
            {
                // Moving folder to another vault
                const success = (await post<MoveExpect, MoveData>("file/move", { vaultToken, sourcePath: vaultOneName + "/folder", destinationPath: vaultTwoName + "/moved_folder" })).success;
                assert(success === true);
            }

            {
                /*
                vaultTwo/
                    .gitignore
                    moved_folder/
                        subfolder/
                            another folder/
                                LICENSE
                */
                const vfs = (await post<VFSExpect, VFSData>("file/vfs", { vaultToken, path: vaultTwoName, depth: 99 })).directory ?? null;
                assert(vfs !== null);
                vaultTwo.update(vfs);
                assert(vaultTwo.contents.length as number === 2);
                const folder = vaultTwo.getDirectory("moved_folder");
                assert(folder !== null);
                assert(folder.name === "moved_folder");
                assert(folder.isDirectory === true);
                assert((folder as Directory).contents.length === 1);
                const file = (folder as Directory).getPath("subfolder/another folder/LICENSE");
                assert(file !== null);
                assert(file.name === "LICENSE");
                assert(file.isDirectory === false);
            }
            
            {
                // Cleanup
                assert((await post<RemoveExpect, RemoveData>("file/remove", { vaultToken, path: vaultTwoName + "/.gitignore" })).success === true);
                assert((await post<RemoveExpect, RemoveData>("file/remove", { vaultToken, path: vaultTwoName + "/moved_folder" })).success === true);
            }
        });
        
        after(async () => {
            const adminToken = (await post<AdminLoginExpect, AdminLoginData>("admin/login", { adminName: "admin", password: "password" })).token ?? null;
            assert(adminToken !== null);
            await post<DeleteVaultExpect, DeleteVaultData>("admin/delete_vault", { adminToken, vaultName: vaultOneName });
            await post<DeleteVaultExpect, DeleteVaultData>("admin/delete_vault", { adminToken, vaultName: vaultTwoName });
        });
    });
    
    after(async () => {
        await cleanup();
    });
});