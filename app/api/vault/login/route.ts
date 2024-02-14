import { NextRequest } from "next/server";
import { vaultLogin } from "../../../../src/vault_auth";
import { Answer, badParameters, ErrorResponse, NonAuthResponse, WithBody } from "../../../../helpers/route_helpers";

export type Expect = {
    vaultName: string,
    password: string,
    existingToken?: string
}

export type Data = {
    token: string | null
} | ErrorResponse;

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { vaultName, password, existingToken } = body;
        if(typeof vaultName === "string" && typeof password === "string"
        && (existingToken === undefined || typeof existingToken === "string")) {
            return Answer(200, {
                token: await vaultLogin(vaultName, password, existingToken)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes vaultName and password, and optionally string attributes existingToken.")
        });
    });
}