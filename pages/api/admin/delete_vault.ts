import { deleteVault } from "../../../src/vault";
import { AuthResponse, badParameters, ForceSendResponse, logServerError, SafeBodyRequest, serverError, unauthorizedAdmin, withAdminAuthentication } from "../../../src/request_helpers";

export type Expect = {
    adminToken: string,
    vaultName: string
}

export type Data = {
    error?: string
}

export default function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<AuthResponse> {
    return withAdminAuthentication(request, async body => {
        const { vaultName } = body;
        if(typeof vaultName === "string") {
            await deleteVault(vaultName, false);
            return response.status(200).json({});
        }
        return response.status(400).json({
            error: badParameters("Expected body with string attributes vaultName.")
        });
    }, () => {
        return response.status(401).json({
            error: unauthorizedAdmin()
        });
    }, error => {
        logServerError(error, "api/admin/delete_vault.ts", request);
        return response.status(500).json({
            error: serverError()
        });
    });
}