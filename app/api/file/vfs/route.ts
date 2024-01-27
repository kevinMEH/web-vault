// api/file/vfs

import { NextRequest } from "next/server";
import { SimpleFlatDirectory } from "../../../../src/vfs";
import { getDirectoryAt, validate } from "../../../../src/controller";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithSinglePathAuthentication } from "../../../../src/route_helpers";

export type Expect = {
    vaultToken: string,
    path: string
}

export type Data = {
    directory: SimpleFlatDirectory | undefined
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithSinglePathAuthentication<Data>(request, (body, path) => {
        const validPath = validate(path);
        if(validPath === null) {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not valid.")
            }));
        }
        return Promise.resolve(Answer(200, {
            directory: getDirectoryAt(validPath)?.flat(false, 4)
        }));
    });
}