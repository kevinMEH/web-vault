// api/file/delete

import { NextRequest } from "next/server";
import { validate } from "../../../../src/controller";
import { deleteItem } from "../../../../src/file";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithSinglePathAuthentication } from "../../../../src/route_helpers";

export type Expect = {
    vaultToken: string,
    path: string
}

export type Data = {
    success: boolean
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithSinglePathAuthentication<Data>(request, (body, path) => {
        const validPath = validate(path);
        if(validPath === null) {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not valid.")
            }));
        }
        return Promise.resolve(Answer<Data>(200, {
            success: deleteItem(validPath)
        }));
    });
}