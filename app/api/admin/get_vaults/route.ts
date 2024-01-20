import { NextRequest } from "next/server";
import { vaultMap } from "../../../../src/controller";
import { Answer, AuthResponse, ErrorResponse, WithAdminAuthentication } from "../../../../src/request_helpers";

export type Expect = {
    adminToken: string
}

export type Data = {
    vaults: string[],
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithAdminAuthentication<Data>(request, () => {
        const vaults = Array.from(vaultMap.keys());
        return Promise.resolve(Answer(200, {
            vaults
        }));
    });
}