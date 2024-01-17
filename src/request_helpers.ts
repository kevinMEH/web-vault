import { metaLog } from "./logger";
import { adminAccess } from "./admin_auth";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Helper type to force undefined check on body, null check on body, and affirm
 * necessary property existance in body.
 */
export interface SafeBodyRequest extends NextApiRequest {
    body: Record<string, unknown> | null | undefined
}

/**
 * Helper type to force API handlers to force send a non authenticated response.
 */
export type NonAuthResponse = { __type: "NonAuthReturned" };
/**
 * Helper type to force API handlers to force send a non authenticated response.
 */
export type AuthResponse = { __type: "AuthResponse" }


/**
 * Replaces the NextApiResponse class to force a respond in the form of .send()
 * .json() to be sent.
 */
export interface ForceSendResponse<Data = any> extends NextApiResponse { // eslint-disable-line
    send: (body: Data) => NonAuthResponse;
    json: (body: Data) => NonAuthResponse;
    status: (statusCode: number) => ForceSendResponse<Data>;
    redirect(url: string): ForceSendResponse<Data>;
    redirect(status: number, url: string): ForceSendResponse<Data>;
}

export async function withAdminAuthentication(
    request: SafeBodyRequest,
    logic: (body: Record<string, unknown>) => Promise<NonAuthResponse>,
    unauthorized: () => NonAuthResponse,
    serverError: (error: Error) => NonAuthResponse
): Promise<AuthResponse> {
    try {
        if(typeof request.body === "object" && request.body !== null) {
            const { adminToken } = request.body;
            if(typeof adminToken === "string" && await adminAccess(adminToken)) {
                return logic(request.body) as unknown as Promise<AuthResponse>;
            }
        }
        return Promise.resolve(unauthorized()) as unknown as Promise<AuthResponse>;
    } catch(error) {
        return Promise.resolve(serverError(error as Error)) as unknown as Promise<AuthResponse>;
    }
}

export function badParameters(expect: string) {
    return `Bad parameters. ${expect}`;
}

export function unauthorizedAdmin() {
    return "Unauthorized admin request. Please provide an adminToken string attribute in the request body.";
}

export function serverError() {
    return "Some kind of server error has occured. Please notify admins.";
}

export function logServerError(error: Error, fileName: string, request: SafeBodyRequest) {
    metaLog("requests", "ERROR", `Unexpected error "${error.message}" has occured in ${fileName} with request body ${JSON.stringify(request.body)}.`);
}