// Frontend only
import axios, { AxiosError } from "axios"; // eslint-disable-line
import type { ErrorResponse } from "./route_helpers";
import type { Data as AddFileData } from "../app/api/file/add_file/route";

axios.defaults.validateStatus = null;

export async function post<Payload, Data extends Record<string, unknown>>(
    url: string,
    payload: Payload,
    signal?: AbortSignal
): Promise<Record<string, undefined> | Exclude<Data, ErrorResponse>> {
    try {
        const request = await axios.post(url, payload, { signal: signal });
        const data = request.data as Data | ErrorResponse;
        const status = request.status;
        if(status >= 500) {
            console.error(`Server error: ${data.error}`);
        }
        if(data.error !== undefined) {
            return {} as Record<string, undefined>
        }
        return data as Exclude<Data, ErrorResponse>;
    } catch(error) {
        if((error as Error).name !== "CanceledError") {
            console.log(`Request to "${(error as AxiosError).config?.url}" rejected with error "${(error as Error).name}".`);
        }
        return {} as Record<string, undefined>;
    }
}

export async function postAddFile(
    vaultToken: string,
    path: string,
    file: Blob,
    signal?: AbortSignal
): Promise<Record<string, undefined> | Exclude<AddFileData, ErrorResponse>> {
    try {
        const form = new FormData();
        form.append("vaultToken", vaultToken);
        form.append("path", path);
        form.append("file", file);
        const response = (await axios.post("/api/file/add_file", form, { signal: signal })).data as AddFileData & ErrorResponse;
        if(response.error !== undefined) {
            return {} as Record<string, undefined>;
        }
        return response as Exclude<AddFileData, ErrorResponse>;
    } catch(error) {
        if((error as Error).name !== "CanceledError") {
            console.log(`Request to "${(error as AxiosError).config?.url}" rejected with error "${(error as Error).name}"`)
        }
        return {} as Record<string, undefined>;
    }
}