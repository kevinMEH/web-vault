// api/file/vfs

import { NextRequest } from "next/server";
import { SimpleDirectory } from "../../../../src/vfs";
import { getDirectoryAt, validateDestination } from "../../../../src/controller";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithSinglePathAuthentication } from "../../../../src/route_helpers";
import { MAX_VFS_DEPTH, DEFAULT_VFS_DEPTH } from "../../../../src/env";

export type Expect = {
    vaultToken: string,
    path: string,
    depth?: number
}

export type Data = {
    vfs: SimpleDirectory,
    depth: number
} | {
    vfs: undefined,
    depth: number
} | ErrorResponse;


export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithSinglePathAuthentication<Data>(request, (body, path) => {
        const validDestination = validateDestination(path);
        if(validDestination === null) {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not a valid destination.")
            }));
        }
        const userDepth = body.depth || DEFAULT_VFS_DEPTH;
        if(typeof userDepth !== "number") {
            return Promise.resolve(Answer<ErrorResponse>(400, {
                error: badParameters("Expected body with optional number attribute depth.")
            }));
        }
        const depth = userDepth < 0 ? DEFAULT_VFS_DEPTH : Math.min(userDepth, MAX_VFS_DEPTH);
        return Promise.resolve(Answer(200, {
            vfs: getDirectoryAt(validDestination)?.flat(false, depth),
            depth
        }));
    });
}