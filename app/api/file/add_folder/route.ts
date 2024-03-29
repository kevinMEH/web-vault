// api/file/add_folder

import { NextRequest } from "next/server";
import { validatePath } from "../../../../src/controller";
import { addFolder } from "../../../../src/file";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithSinglePathAuthentication } from "../../../../helpers/route_helpers";

export type Expect = {
    vaultToken: string,
    path: string
}

export type Data = {
    success: boolean
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithSinglePathAuthentication<Data>(request, (body, path) => {
        const validatedPath = validatePath(path);
        if(validatedPath === null) {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not valid.")
            }));
        }
        return Promise.resolve(Answer<Data>(200, {
            success: addFolder(validatedPath)
        }));
    });
}