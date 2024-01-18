import { metaLog } from "./logger";
import { adminAccess } from "./admin_auth";
import { NextRequest, NextResponse } from "next/server";

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
 * 
 * @param request 
 * @param logic 
 * @returns 
 */
export async function WithAdminAuthentication<Data>(
    request: NextRequest,
    logic: (body: Record<string, unknown>) => Promise<NonAuthResponse<Data | ErrorResponse>>
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
                return logic(body) as unknown as Promise<AuthResponse<Data | ErrorResponse>>;
            }
            return Answer<ErrorResponse>(401, {
                error: badParameters("Unauthorized admin request. Provided adminToken is invalid.")
            }) as unknown as AuthResponse<ErrorResponse>;
        }
        return Answer<ErrorResponse>(401, {
            error: badParameters("Unauthorized admin request. Please provide a valid adminToken string attribute in the request body.")
        }) as unknown as AuthResponse<ErrorResponse>;
    } catch(error) {
        metaLog("requests", "ERROR", `Unexpected error "${(error as Error).message}" has occurred in ${request.url} with request body ${JSON.stringify(body)}.`);
        return Answer<ErrorResponse>(500, {
            error: "Some kind of server error has occurred. Please notify admins."
        }) as unknown as AuthResponse<ErrorResponse>;
    }
}

export function badParameters(expect: string) {
    return `Bad parameters. ${expect}`;
}