import { adminLogout } from "../../../src/admin_auth";
import { metaLog } from "../../../src/logger";
import type { ForceReturned, ForceSendResponse, SafeBodyRequest } from "../../../src/request_helpers";

type _Expect = {
    token: string
}

type Data = {
    success: boolean,
    error?: string
}

export default async function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<ForceReturned> {
    try {
        if(typeof request.body === "object" && request.body !== null) {
            const { token } = request.body;
            if(typeof token === "string") {
                return response.status(200).json({
                    success: await adminLogout(token)
                });
            }
        }
        return response.status(200).json({
            success: false,
            error: "Bad parameters. Expected body with string attributes token."
        });
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in api/admin/logout.ts with request ${request}.`)
        return response.status(500).json({
            success: false,
            error: "Some kind of server error has occurred. Please notify admins."
        });
    }
}