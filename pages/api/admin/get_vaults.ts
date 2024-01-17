const { vaultMap } = await import("../../../src/controller");
import { AuthResponse, ForceSendResponse, logServerError, SafeBodyRequest, serverError, unauthorizedAdmin, withAdminAuthentication } from "../../../src/request_helpers";

export type Expect = {
    adminToken: string
}

export type Data = {
    vaults: string[] | null,
    error?: string
}

/**
 * Note: This function lists the vault's existance by consulting the VFS.
 * 
 * @param request 
 * @param response 
 */
export default function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<AuthResponse> {
    return withAdminAuthentication(request, () => {
        const vaults = Array.from(vaultMap.keys());
        return Promise.resolve(response.status(200).json({
            vaults
        }));
    }, () => {
        return response.status(401).json({
            vaults: null,
            error: unauthorizedAdmin()
        });
    }, error => {
        logServerError(error, "api/admin/get_vaults.ts", request);
        return response.status(500).json({
            vaults: null,
            error: serverError()
        });
    });
}