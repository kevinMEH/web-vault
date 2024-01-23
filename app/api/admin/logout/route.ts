import { NextRequest } from "next/server";
import { adminLogout } from "../../../../src/admin_auth";
import { ErrorResponse, NonAuthResponse, Answer, WithBody, badParameters } from "../../../../src/route_helpers";

export type Expect = {
    token: string
}

export type Data = {
    success: boolean
} | ErrorResponse;

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { token } = body;
        if(typeof token === "string") {
            return Answer(200, {
                success: await adminLogout(token)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes token.")
        });
    });
}