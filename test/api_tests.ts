// Before running this test, make sure npm run dev is ran
// The database used for this test depends on the one npm run dev is using.

import { after, describe, it } from "node:test";
import assert from "node:assert";
import axios from "axios";
import type { AxiosResponse } from "axios";

import { cleanup } from "../src/cleanup";

axios.defaults.baseURL = "http://localhost:3000/api";
axios.defaults.baseURL = "http://172.20.80.1:3000/api"; // Windows localhost IP from WSL
axios.defaults.validateStatus = null;

async function checkResponse(url: string, parameters: Array<unknown>, checks: (response: AxiosResponse<any, any>, parameter: any) => any) {
    for(const parameter of parameters) {
        await axios.post(url, parameter).then(response => checks(response, parameter));
    }
}

function failString(data: object, parameter: string, checkName: string) {
    return `Request with body ${JSON.stringify(parameter)} failed the ${checkName} check. Data: ${JSON.stringify(data)}`
}

describe("API tests", () => {
    describe("Authentication API tests", () => {
        it("Tests api/admin/login", async () => {
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
            ], ({ data }, parameter) => {
                assert(data.token === null, failString(data, parameter, "token null"));
                assert(data.error?.includes("Bad parameters"), failString(data, parameter, "bad parameters error"));
            });
            
            const data = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data;
            assert(data.token !== null);
            assert(typeof data.token === "string");
            assert(data.error === undefined);
            // TODO: Test that token indeed works
        });
        
        it("Tests api/admin/logout", async () => {
            await checkResponse("admin/logout", [
                undefined, null, "asdf", {},
                { token: 123 },
                { token: null },
                { token: undefined },
                { token: { asdf: "asdf" } },
            ], ({ data }, parameter) => {
                assert(data.success === false, failString(data, parameter, "success is false"));
                assert(data.error?.includes("Bad parameters"), failString(data, parameter, "bad parameters error"));
            });
            
            await checkResponse("admin/logout", [
                { token: "" },
                { token: "abasdf" },
                { token: "abasdf.asdfsa.ashhbha" },
            ], ({ data }, parameter) => {
                assert(data.success === false, failString(data, parameter, "success is false"));
            });
            
            const token = (await axios.post("admin/login", { adminName: "admin", password: "password" })).data.token;
            assert(token !== null);
            assert(typeof token === "string");
            
            const data = (await axios.post("admin/logout", { token })).data;
            assert(data.success === true);
            assert(data.error === undefined);
        });
    });
    
    it("Tests api/login", () => {
        // TODO: Implement vault tests. Requires vault creation API to work first
    });
    
    after(async () => {
        await cleanup();
    });
});