// api/file/vfs

import { NextRequest } from "next/server";
import { SimpleDirectory } from "../../../../src/vfs";
import { getDirectoryAt, validate } from "../../../../src/controller";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithSinglePathAuthentication } from "../../../../src/route_helpers";
import { MAX_VFS_DEPTH, DEFAULT_VFS_DEPTH } from "../../../../src/env";

export type Expect = {
    vaultToken: string,
    path: string,
    depth?: number
}

export type Data = {
    directory: SimpleDirectory | undefined
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithSinglePathAuthentication<Data>(request, (body, path) => {
        const validPath = validate(path);
        if(validPath === null) {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not valid.")
            }));
        }
        const userDepth = body.depth || DEFAULT_VFS_DEPTH;
        if(typeof userDepth !== "number") {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("Expected body with optional number attribute depth.")
            }));
        } else {
            const depth = userDepth < 0 ? DEFAULT_VFS_DEPTH : Math.min(userDepth, MAX_VFS_DEPTH);
            return Promise.resolve(Answer(200, {
                directory: getDirectoryAt(validPath)?.flat(false, depth)
            }));
        }
    });
}