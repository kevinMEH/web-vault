import { NextRequest } from "next/server";
import { Answer, badParameters, ErrorResponse, NonAuthResponse, WithBody } from "../../../../helpers/route_helpers";
import { trimToken } from "../../../../src/vault_auth";

export type Expect = {
    token: string
}

export type Data = {
    token: string | null
} | ErrorResponse;

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { token } = body;
        if(typeof token === "string") {
            return Answer(200, {
                token: await trimToken(token)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes token.")
        });
    });
}