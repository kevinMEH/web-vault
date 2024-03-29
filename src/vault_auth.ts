import { verifyVaultPassword } from "./authentication/database";
import { getUnwrappedToken, createToken, addNewVaultToToken, removeVaultFromToken, _refreshVaultExpiration, _trimToken } from "./authentication/vault_token";

async function vaultLogin(vaultName: string, password: string, existingToken?: string): Promise<string | null> {
    if(await verifyVaultPassword(vaultName, password)) {
        if(existingToken) {
            const newToken = await addNewVaultToToken(existingToken, vaultName);
            if(newToken !== null) {
                return newToken;
            }
        }
        return createToken(vaultName);
    }
    return null;
}

function vaultLogout(vaultName: string, existingToken: string): Promise<string | null> {
    return removeVaultFromToken(existingToken, vaultName);
}

async function vaultAccessible(vaultName: string, token: string): Promise<boolean> {
    const payload = await getUnwrappedToken(token);
    if(payload === null) {
        return false;
    }
    for(const { vault } of payload.access) {
        if(vault === vaultName) {
            return true;
        }
    }
    return false;
}

function trimToken(token: string): Promise<string | null> {
    return _trimToken(token);
}

function refreshVaultExpiration(vaultName: string, token: string): Promise<string | null> {
    return _refreshVaultExpiration(token, vaultName);
}

export {
    vaultLogin,
    vaultLogout,
    vaultAccessible,
    trimToken,
    refreshVaultExpiration
};