import { trimToken } from "../../../src/vault_auth";
import { badParameters, ForceSendResponse, logServerError, NonAuthResponse, SafeBodyRequest, serverError } from "../../../src/request_helpers";

export type Expect = {
    token: string
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
        if(typeof request.body === "object" && request.body !==  null) {
            const { token } = request.body;
            if(typeof token === "string") {
                return response.status(200).json({
                    token: await trimToken(token)
                });
            }
        }
        return response.status(400).json({
            token: null,
            error: badParameters("Expected body with string attributes token.")
        });
    } catch(error) {
        logServerError(error as Error, "api/vault/trim.ts", request);
        return response.status(500).json({
            token: null,
            error: serverError()
        });
    }
}