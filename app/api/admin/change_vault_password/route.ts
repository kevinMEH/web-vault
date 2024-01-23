import { NextRequest } from "next/server";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithAdminAuthentication } from "../../../../src/route_helpers";
import { changeVaultPassword } from "../../../../src/vault";

export type Expect = {
    adminToken: string,
    vaultName: string,
    password: string
}

export type Data = {
    success: boolean
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithAdminAuthentication<Data>(request, async body => {
        const { vaultName, password } = body;
        if(typeof vaultName === "string" && typeof password === "string") {
            return Answer(200, {
                success: await changeVaultPassword(vaultName, password)
            });
        }
        return Answer(400, {
            error: badParameters("Expected body with string attributes vaultName and password.")
        });
    })
}