import { adminLogout } from "../../../src/admin_auth";
import { badParameters, ForceReturned, ForceSendResponse, logServerError, SafeBodyRequest, serverError } from "../../../src/request_helpers";

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
            error: badParameters("Expected body with string attributes token.")
        });
    } catch(error) {
        logServerError(error as Error, "api/admin/logout.ts", request);
        return response.status(500).json({
            success: false,
            error: serverError()
        });
    }
}