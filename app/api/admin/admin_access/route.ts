import { NextRequest } from "next/server";
import { adminAccess } from "../../../../src/admin_auth";
import { Answer, badParameters, ErrorResponse, NonAuthResponse, WithBody } from "../../../../src/request_helpers";

export type Expect = {
    adminToken: string
}

export type Data = {
    access: boolean
} | ErrorResponse

export function POST(request: NextRequest): Promise<NonAuthResponse<Data>> {
    return WithBody<Data>(request, async body => {
        const { adminToken } = body;
        if(typeof adminToken === "string") {
            return Answer(200, {
                access: await adminAccess(adminToken)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes adminToken.")
        });
    });
}