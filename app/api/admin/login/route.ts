import type { NextRequest } from "next/server";
import { adminLogin } from "../../../../src/admin_auth";
import { badParameters, ErrorResponse, NonAuthResponse, Answer, WithBody } from "../../../../helpers/route_helpers";

export type Expect = {
    adminName: string,
    password: string,
}

export type Data = {
    token: string | null
} | ErrorResponse;

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { adminName, password } = body;
        if(typeof adminName === "string" && typeof password === "string") {
            return Answer(200, { token: await adminLogin(adminName, password) });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attribute adminName and password.")
        });
    });
}