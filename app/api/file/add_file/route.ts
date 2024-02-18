// api/file/add_file

import { NextRequest } from "next/server";
import { addFile } from "../../../../src/file";
import { validatePath } from "../../../../src/controller";
import { Answer, AuthResponse, badParameters, ErrorResponse, WithFormAuthentication } from "../../../../helpers/route_helpers";
import type { File } from "buffer";

export type Expect = {
    vaultToken: string,
    path: string,
    file: File
}

export type Data = {
    success: boolean
} | ErrorResponse;

export async function POST(request: NextRequest): Promise<AuthResponse<Data>> {
    return WithFormAuthentication(request, async (formData, path) => {
        const file = formData.get("file");
        const validatedPath = validatePath(path);
        if(validatedPath === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("The provided path is not valid.")
            });
        }
        if(file !== null && typeof file !== "string") {
            const result = await addFile(file as unknown as File, validatedPath);
            return Answer<Data>(200, { success: result });
        }
        return Answer<ErrorResponse>(400, {
            error: badParameters("Expected body with File attribute file.")
        });
    });
}