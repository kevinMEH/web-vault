import { refreshVaultExpiration } from "../../../src/vault_auth";
import { ALLOW_REFRESH } from "../../../src/env";
import { ForceSendResponse, NonAuthResponse, SafeBodyRequest, badParameters, logServerError, serverError } from "../../../src/request_helpers";

export type Expect = {
    vaultName: string,
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
        if(typeof request.body === "object" && request.body !== null) {
            const { vaultName, token } = request.body;
            if(typeof vaultName === "string" && typeof token === "string") {
                return response.status(200).json({
                    token: ALLOW_REFRESH
                        ? await refreshVaultExpiration(vaultName, token)
                        : token
                });
            }
        }
        return response.status(400).json({
            token: null,
            error: badParameters("Expected body with string attributes vaultName and token.")
        });
    } catch(error) {
        logServerError(error as Error, "api/vault/refresh.ts", request);
        return response.status(500).json({
            token: null,
            error: serverError()
        });
    }
}