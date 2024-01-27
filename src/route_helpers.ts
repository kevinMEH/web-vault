import { metaLog } from "./logger";
import { adminAccess } from "./admin_auth";
import { NextRequest, NextResponse } from "next/server";
import { vaultAccessible } from "./vault_auth";

export type ErrorResponse = { error: string }
export type NonAuthResponse<Data> = NextResponse<Data> & { __type: "NonAuthResponse" };
export type AuthResponse<Data> = NextResponse<Data> & { __type: "AuthResponse" };

export function Answer<Data>(status: number, data: Data) {
    return NextResponse.json<Data>(data, { status }) as NonAuthResponse<Data>;
}

/**
 * Gets the body of a request as a JSON object
 * 
 * @param request 
 * @returns 
 */
async function _getBody(request: NextRequest): Promise<Record<string, unknown> | null> {
    try {
        const body = await request.json() as unknown;
        if(typeof body === "object") {
            return body as Record<string, unknown> | null;
        } else {
            return null;
        }
    } catch(_) {
        return null;
    }
}

export async function WithBody<Data>(
    request: NextRequest,
    logic: (body: Record<string, unknown>) => Promise<NonAuthResponse<Data | ErrorResponse>>
): Promise<NonAuthResponse<Data | ErrorResponse>> {
    const body = await _getBody(request);
    try {
        if(body === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("Expected JSON body.")
            });
        }
        return logic(body);
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify(body)}.`);
        return Answer<ErrorResponse>(500, {
            error: "Some kind of server error has occurred. Please notify admins."
        });
    }
}

/**
 * Data should always be a union with ErrorResponse as one of its members.
 * request must have body with parameters "adminToken"
 * 
 * @param request 
 * @param logic 
 * @returns 
 */
export async function WithAdminAuthentication<Data>(
    request: NextRequest,
    logic: (body: Record<string, unknown>) => Promise<NonAuthResponse<Data>>
): Promise<AuthResponse<Data | ErrorResponse>> {
    const body = await _getBody(request);
    try {
        if(body === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("Expected JSON body.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        const adminToken = body.adminToken;
        if(typeof adminToken === "string") {
            if(await adminAccess(adminToken)) {
                return logic(body) as unknown as Promise<AuthResponse<Data>>;
            }
            return Answer<ErrorResponse>(401, {
                error: badParameters("Unauthorized admin request. Provided adminToken is invalid.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        return Answer<ErrorResponse>(401, {
            error: badParameters("Unauthorized admin request. Expected body with a valid adminToken atring attribute.")
        }) as unknown as AuthResponse<ErrorResponse>;
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify(body)}.`);
        return Answer<ErrorResponse>(500, {
            error: "Some kind of server error has occurred. Please notify admins."
        }) as unknown as AuthResponse<ErrorResponse>;
    }
}

/**
 * Data should alwyas be a union with ErrorResponse as one of its members.
 * Request must have body with parameters "vaultToken" and "path"
 * 
 * @param request
 * @param logic
 * @returns 
 */
export async function WithSinglePathAuthentication<Data>(
    request: NextRequest,
    logic: (body: Record<string, unknown>, path: string) => Promise<NonAuthResponse<Data>>
): Promise<AuthResponse<Data | ErrorResponse>> {
    const body = await _getBody(request);
    try {
        if(body === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("Expected JSON body.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        const vaultToken = body.vaultToken;
        const path = body.path;
        if(typeof vaultToken === "string" && typeof path === "string") {
            const vaultName = path.substring(0, path.indexOf("/")) || path;
            if(await vaultAccessible(vaultName, vaultToken)) {
                return logic(body, path) as unknown as Promise<AuthResponse<Data>>;
            }
            return Answer<ErrorResponse>(401, {
                error: badParameters("Unauthorized request. Provided vaultToken does not have access to path.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        return Answer<ErrorResponse>(401, {
            error: badParameters("Unauthorized request. Expected body with valid vaultToken and path string attributes.")
        }) as unknown as AuthResponse<ErrorResponse>;
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify(body)}.`);
        return Answer<ErrorResponse>(500, {
            error: "Some kind of server error has occurred. Please notify admins."
        }) as unknown as AuthResponse<ErrorResponse>;
    }
}

/**
 * Request must have body with parameters "vaultToken", "sourcePath", and "destinationPath"
 * 
 * @param request 
 * @param logic 
 */
export async function WithDoublePathAuthentication<Data>(
    request: NextRequest,
    logic: (body: Record<string, unknown>, sourcePath: string, destinationPath: string) => Promise<NonAuthResponse<Data>>
): Promise<AuthResponse<Data | ErrorResponse>> {
    const body = await _getBody(request);
    try {
        if(body === null) {
            return Answer<ErrorResponse>(400, {
                error: badParameters("Expected JSON body.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        const { vaultToken, sourcePath, destinationPath } = body;
        if(typeof vaultToken === "string" && typeof sourcePath === "string" && typeof destinationPath === "string") {
            const sourceVault = sourcePath.substring(0, sourcePath.indexOf("/")) || sourcePath;
            const destinationVault = destinationPath.substring(0, destinationPath.indexOf("/")) || destinationPath;
            if(sourceVault === destinationVault) {
                if(await vaultAccessible(sourceVault, vaultToken)) {
                    return logic(body, sourcePath, destinationPath) as unknown as Promise<AuthResponse<Data>>;
                }
            } else {
                if((await Promise.all([
                        vaultAccessible(sourceVault, vaultToken),
                        vaultAccessible(destinationVault, vaultToken)
                    ])).every(value => value)
                ) {
                    return logic(body, sourcePath, destinationPath) as unknown as Promise<AuthResponse<Data>>;
                }
            }
            return Answer<ErrorResponse>(401, {
                error: badParameters("Unauthorized request. Provided vaultToken does not have access to sourcePath and destinationPath")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        return Answer<ErrorResponse>(401, {
            error: badParameters("Unauthorized request. Expected body with valid vaultToken, sourcePath, and destinationPath string attributes.")
        }) as unknown as AuthResponse<ErrorResponse>;
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify(body)} has occurred in ${request.url} with request body ${JSON.stringify(body)}.`);
        return Answer<ErrorResponse>(500, {
            error: "Some kind of server error has occurred. Please notify admins."
        }) as unknown as AuthResponse<ErrorResponse>;
    }
}

async function _getFormData(request: NextRequest): Promise<FormData | null> {
    try {
        return request.formData();
    } catch(error) {
        return null;
    }
}

export async function WithFormAuthentication<Data>(
    request: NextRequest,
    logic: (formData: FormData, path: string) => Promise<NonAuthResponse<Data>>
): Promise<AuthResponse<Data | ErrorResponse>> {
    const formData = await _getFormData(request);
    if(formData === null) {
        return Answer<ErrorResponse>(400, {
            error: badParameters("Expected FormData body.")
        }) as unknown as AuthResponse<ErrorResponse>;
    }
    try {
        const vaultToken = formData.get("vaultToken");
        const path = formData.get("path");
        if(typeof vaultToken === "string" && typeof path === "string") {
            const vaultName = path.substring(0, path.indexOf("/")) || path;
            if(await vaultAccessible(vaultName, vaultToken)) {
                return logic(formData, path) as unknown as Promise<AuthResponse<Data>>;
            }
            return Answer<ErrorResponse>(401, {
                error: badParameters("Unauthorized request. Provided vaultToken does not have access to path.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        return Answer<ErrorResponse>(401, {
            error: badParameters("Unauthorized request. Expected body with valid vaultToken and path string attributes.")
        }) as unknown as AuthResponse<ErrorResponse>;
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify([...formData.entries()])}.`)
        return Answer<ErrorResponse>(500, {
            error: badParameters("Some kind of server error has occurred. Please notify admins.")
        }) as unknown as AuthResponse<ErrorResponse>;
    }
}

export function badParameters(expect: string) {
    return `Bad parameters. ${expect}`;
}