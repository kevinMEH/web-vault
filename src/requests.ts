// Frontend only
import axios from "axios"; // eslint-disable-line

export async function post<Payload, Data>(url: string, payload: Payload) {
    return (await axios.post(url, payload)).data as Data;
}