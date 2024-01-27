// api/file/copy

import { NextRequest } from "next/server";
import { validate } from "../../../../src/controller";
import { copyItem } from "../../../../src/file";
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
        const validSourcePath = validate(sourcePath);
        const validDestinationPath = validate(destinationPath);
        if(validSourcePath === null || validDestinationPath === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("The provided sourcePath and/or destinationPath is not valid.")
            });
        }
        return Answer<Data>(200, {
            success: await copyItem(validSourcePath, validDestinationPath)
        });
    });
}