import { metaLog } from "./logger";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Helper type to force undefined check on body, null check on body, and affirm
 * necessary property existance in body.
 */
export interface SafeBodyRequest extends NextApiRequest {
    body: Record<string, unknown> | null | undefined
}

/**
 * Helper type to force API handlers to force send a response.
 * All handler functions should have this as a return type.
 */
export type ForceReturned = { __type: "Returned" };

/**
 * Replaces the NextApiResponse class to force a respond in the form of .send()
 * .json() to be sent.
 */
export interface ForceSendResponse<Data = any> extends NextApiResponse { // eslint-disable-line
    send: (body: Data) => ForceReturned;
    json: (body: Data) => ForceReturned;
    status: (statusCode: number) => ForceSendResponse<Data>;
    redirect(url: string): ForceSendResponse<Data>;
    redirect(status: number, url: string): ForceSendResponse<Data>;
}

export function badParameters(expect: string) {
    return `Bad parameters. ${expect}`;
}

export function serverError() {
    return "Some kind of server error has occured. Please notify admins.";
}

export function logServerError(error: Error, fileName: string, request: SafeBodyRequest) {
    metaLog("requests", "ERROR", `Unexpected error "${error.message}" has occured in ${fileName} with request body ${JSON.stringify(request.body)}.`);
}