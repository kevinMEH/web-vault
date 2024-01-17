import { adminLogin } from "../../../src/admin_auth";
import { badParameters, serverError, logServerError, ForceSendResponse, NonAuthResponse, SafeBodyRequest } from "../../../src/request_helpers";

export type Expect = {
    adminName: string,
    password: string
}

export type Data = {
    token: string | null,
    error?: string
}

export default async function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<NonAuthResponse> {
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
            error: badParameters("Expected body with string attributes adminName and password.")
        });
    } catch(error) {
        logServerError(error as Error, "api/admin/login.ts", request);
        return response.status(500).json({
            token: null,
            error: serverError()
        });
    }
}