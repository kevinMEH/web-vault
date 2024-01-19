import { NextRequest } from "next/server";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithAdminAuthentication } from "../../../../src/request_helpers";
import { createNewVault } from "../../../../src/vault";

export type Expect = {
    adminToken: string,
    vaultName: string,
    password: string
}

export type Data = {
    success: boolean,
    failureReason?: string
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithAdminAuthentication<Data>(request, async body => {
        const { vaultName, password } = body;
        if(typeof vaultName === "string" && typeof password === "string") {
            const result = await createNewVault(vaultName, password);
            return Answer(200, {
                success: result === null,
                failureReason: result?.message
            })
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes vaultName and password.")
        });
    });
}