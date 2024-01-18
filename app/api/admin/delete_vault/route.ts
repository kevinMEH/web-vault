import { NextRequest } from "next/server";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithAdminAuthentication } from "../../../../src/request_helpers";
import { deleteVault } from "../../../../src/vault";

export type Expect = {
    adminToken: string,
    vaultName: string
}

export type Data = Partial<ErrorResponse>;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithAdminAuthentication(request, async body => {
        const { vaultName } = body;
        if(typeof vaultName === "string") {
            await deleteVault(vaultName, false);
            return Answer(200, {});
        }
        return Answer(400, {
            error: badParameters("Expected body with string attribute vaultName.")
        });
    });
}