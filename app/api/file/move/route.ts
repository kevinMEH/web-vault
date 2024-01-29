// api/file/move

import { NextRequest } from "next/server";
import { validatePath } from "../../../../src/controller";
import { moveItem } from "../../../../src/file";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithDoublePathAuthentication } from "../../../../src/route_helpers";

export type Expect = {
    vaultToken: string,
    sourcePath: string,
    destinationPath: string
}

export type Data = {
    success: boolean
} | ErrorResponse;

export function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithDoublePathAuthentication<Data>(request, async (body, sourcePath, destinationPath) => {
        const validSourcePath = validatePath(sourcePath);
        const validDestinationPath = validatePath(destinationPath);
        if(validSourcePath === null || validDestinationPath === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("The provided sourcePath and/or destinationPath is not valid.")
            });
        }
        return Answer<Data>(200, {
            success: await moveItem(validSourcePath, validDestinationPath)
        });
    });
}