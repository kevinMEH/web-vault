import { NextRequest } from "next/server";
import { Answer, badParameters, ErrorResponse, NonAuthResponse, WithBody } from "../../../../src/request_helpers";
import { refreshVaultExpiration } from "../../../../src/vault_auth";

export type Expect = {
    vaultName: string,
    token: string
}

export type Data = {
    token: string | null
} | ErrorResponse;

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { vaultName, token } = body;
        if(typeof vaultName === "string" && typeof token === "string") {
            return Answer(200, {
                token: await refreshVaultExpiration(vaultName, token)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes vaultName and token.")
        });
    });
}