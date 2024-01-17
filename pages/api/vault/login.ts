import { vaultLogin } from "../../../src/vault_auth";
import { ForceSendResponse, NonAuthResponse, SafeBodyRequest, badParameters, logServerError, serverError } from "../../../src/request_helpers";

export type Expect = {
    vaultName: string,
    password: string,
    existingToken?: string
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
            const { vaultName, password, existingToken } = request.body;
            if(typeof vaultName === "string" && typeof password === "string"
            && (existingToken === undefined || typeof existingToken === "string")) {
                return response.status(200).json({
                    token: await vaultLogin(vaultName, password, existingToken)
                });
            }
        }
        return response.status(400).json({
            token: null,
            error: badParameters("Expected body with string attributes vaultName and password, and optionally string attributes existingToken.")
        });
    } catch(error) {
        logServerError(error as Error, "api/vault/login.ts", request);
        return response.status(500).json({
            token: null,
            error: serverError()
        });
    }
}