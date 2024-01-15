import { adminLogin } from "../../../src/admin_auth";
import { metaLog } from "../../../src/logger";
import type { ForceSendResponse, ForceReturned, SafeBodyRequest } from "../../../src/request_helpers";

type _Expect = {
    adminName: string,
    password: string
}

type Data = {
    token: string | null,
    error?: string
}

export default async function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<ForceReturned> {
    try {
        if(typeof request.body === "object" && request.body !== null) {
            const { adminName, password } = request.body;
            if(typeof adminName === "string" && typeof password === "string") {
                return response.status(200).json({
                    token: await adminLogin(adminName, password)
                });
            }
        }
        return response.status(400).json({
            token: null,
            error: "Bad parameters. Expected body with string attributes adminName and password."
        });
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in api/admin/login.ts with request ${request}.`)
        return response.status(500).json({
            token: null,
            error: "Some kind of server error has occurred. Please notify admins."
        });
    }
}