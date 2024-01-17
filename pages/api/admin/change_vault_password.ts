import { changeVaultPassword } from "../../../src/vault";
import { badParameters, ForceSendResponse, logServerError, SafeBodyRequest, serverError, AuthResponse, withAdminAuthentication, unauthorizedAdmin } from "../../../src/request_helpers";

export type Expect = {
    adminToken: string,
    vaultName: string,
    password: string,
}

export type Data = {
    success: boolean,
    error?: string
}

export default function handler(
    request: SafeBodyRequest,
    response: ForceSendResponse<Data>
): Promise<AuthResponse> {
    return withAdminAuthentication(request, async body => {
         const { vaultName, password } = body;
         if(typeof vaultName === "string" && typeof password === "string") {
            return response.status(200).json({
                success: await changeVaultPassword(vaultName, password)
            });
         }
         return response.status(200).json({
            success: false,
            error: badParameters("Expected body with string attributes vaultName and password.")
         });
    }, () => {
        return response.status(401).json({
            success: false,
            error: unauthorizedAdmin()
        });
    }, error => {
        logServerError(error, "api/admin/create_vault.ts", request);
        return response.status(500).json({
            success: false,
            error: serverError()
        });
    });
}