// Frontend only
import axios from "axios"; // eslint-disable-line
import type { ErrorResponse } from "./route_helpers";

axios.defaults.validateStatus = null;

export async function post<Payload, Data extends Record<string, unknown>>(url: string, payload: Payload) {
    const response = (await axios.post(url, payload)).data as Data | ErrorResponse;
    if(response.error !== undefined) {
        return {} as Record<string, undefined>
    }
    return response as Exclude<Data, ErrorResponse>;
}