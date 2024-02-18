import JWT, { unixTime, Header } from "jwt-km";
import { metaLog } from "../logger";
import { isOutdatedToken, _addOutdatedToken, invalidVaultIssuingDate, vaultExistsDatabase } from "./database";
import { JWT_EXPIRATION, DOMAIN, JWT_SECRET, ALLOW_REFRESH } from "../env";
import type { AdminPayload } from "../admin_auth";

export type VaultAccess = {
    vault: string,
    issuedAt: number,
    expiration: number
};

export type VaultPayload = {
    iss: string,
    exp: number,
    iat: number,
    type: "vault", // We will be using JWTs for other types of verification
    access: VaultAccess[],
    // Random number to ensure that 2 tokens created at the same time with the
    // same contents is still somehow unique. It should never be used.
    random: number
}

function __createToken(access: VaultAccess[]): string {
    const current = unixTime();
    const jwt = new JWT(DOMAIN, current + JWT_EXPIRATION, current);
    jwt.addClaim("type", "vault");
    jwt.addClaim("random", Math.floor(Math.random() * 4294967296));
    jwt.addClaim("access", access);
    return jwt.getToken(JWT_SECRET);
}

/**
 * Goes through all checks, and returns [Header, Payload] if the token is
 * valid. If the token is invalid, null is returned.
 * 
 * Checks if outdated, body hash consistency, not malformed, nonces consistent.
 * 
 * NOTE: This function automatically removes invalid vaults from the payload.
 * (Issued before nonce, expired vaults, etc.)
 * 
 * @param token 
 * @returns
 */
async function getUnwrappedToken(token: string): Promise<VaultPayload | null> {
    if(await isOutdatedToken(token)) {
        return null;
    }
    const unwrapped = JWT.unwrap(token, JWT_SECRET);
    // Malformed or inconsistent
    if(unwrapped === null) {
        return null;
    }
    const [_header, payload] = unwrapped as [Header, VaultPayload | AdminPayload];
    if(payload.type !== "vault") {
        return null;
    }
    // If expired
    if(payload.exp < unixTime()) {
        return null;
    }
    for(let i = 0; i < payload.access.length; i++) {
        const { vault, issuedAt, expiration } = payload.access[i];
        if(expiration < unixTime()) {
            payload.access.splice(i, 1);
            i--;
        } else if(await invalidVaultIssuingDate(vault, issuedAt)) {
            payload.access.splice(i, 1);
            i--;
        }
    }
    return payload;
}

/**
 * The vaults parameter may be modified by the function. It is strongly
 * recommended to pass in a referenceless copy of vaults, or one which is going
 * to be outdated.
 * 
 * @param vault
 * @returns 
 */
async function createToken(vault: string): Promise<string | null> {
    if(await vaultExistsDatabase(vault) === false) {
        return null;
    }
    const current = unixTime();
    const singleAccess: VaultAccess = {
        vault: vault,
        issuedAt: current,
        expiration: current + JWT_EXPIRATION
    };
    const token = __createToken([ singleAccess ]);
    metaLog("authentication", "INFO", `Created new token ${token}. (Vault: ${vault}, Issued at: ${current}, Expiration: ${current + JWT_EXPIRATION})`);
    return token;
}

/**
 * Returns a new token (with updated expiration) with the new vault added if it
 * isn't already present. The new vault's issuing and expiration will be reset.
 * 
 * @param token
 * @param vault 
 * @returns New token as a base64url string or null if token is invalid.
 */
async function addNewVaultToToken(token: string, vault: string): Promise<string | null> {
    const payload = await getUnwrappedToken(token);
    if(payload === null) {
        return null;
    }
    if(await vaultExistsDatabase(vault) === false) {
        return null;
    }
    const vaultAccesses = payload.access;
    for(let i = 0; i < vaultAccesses.length; i++) {
        if(vaultAccesses[i].vault === vault) {
            vaultAccesses.splice(i, 1);
            i--;
        }
    }
    await addOutdatedToken(token, payload.exp);

    const current = unixTime();
    vaultAccesses.push({
        vault: vault,
        issuedAt: current,
        expiration: current + JWT_EXPIRATION
    });
    const newToken = __createToken(vaultAccesses);
    metaLog("authentication", "INFO", `Adding new vault ${vault} to token ${token}, receiving new token ${newToken}`);
    return newToken;
}

/**
 * Returns a new token (with updated expiration) with the vault removed if it
 * is present.
 * 
 * A token with an empty array as its "vaults" field is safe. An invalid vault
 * is safe.
 * 
 * @param token
 * @param vault 
 * @returns New token as a base64url string or null if token is invalid.
 */
async function removeVaultFromToken(token: string, vault: string): Promise<string | null> {
    const payload = await getUnwrappedToken(token);
    if(payload === null) {
        return null;
    }
    const vaultAccesses = payload.access;
    for(let i = 0; i < vaultAccesses.length; i++) {
        if(vaultAccesses[i].vault === vault) {
            vaultAccesses.splice(i, 1);
            i--;
        }
    }
    await addOutdatedToken(token, payload.exp);
    
    const newToken = __createToken(vaultAccesses);
    metaLog("authentication", "INFO", `Removed vault ${vault} from token ${token}, receiving new token ${newToken}`);
    return newToken;
}

/**
 * Returns a new token with invalid vaults trimmed out. Input token is invalidated.
 * 
 * @param token 
 * @returns New token as a base64url string or null if token is invalid.
 */
async function _trimToken(token: string): Promise<string | null> {
    const payload = await getUnwrappedToken(token);
    if(payload === null) {
        return null;
    }
    await addOutdatedToken(token, payload.exp);
    const newToken = __createToken(payload.access);
    metaLog("authentication", "INFO", `Trimming token ${token} into new token ${newToken}`);
    return newToken;
}

/**
 * Returns a new token with updated expiration for the given vault. Input token
 * is invalidated.
 * 
 * @param token
 * @param vault
 * @returns New token as a base64url string or null if token is invalid.
 */
async function _refreshVaultExpiration(token: string, vault: string): Promise<string | null> {
    if(!ALLOW_REFRESH) {
        return _trimToken(token);
    }
    const payload = await getUnwrappedToken(token);
    if(payload === null) {
        return null;
    }
    const vaultAccesses = payload.access;
    const current = unixTime();
    for(const access of vaultAccesses) {
        if(access.vault === vault) {
            access.expiration = current + JWT_EXPIRATION;
        }
    }
    await addOutdatedToken(token, payload.exp);

    const newToken = __createToken(vaultAccesses);
    metaLog("authentication", "INFO",`Refreshing token ${token} to new token ${newToken}`);
    return newToken;
}

async function addOutdatedToken(token: string, expireAt: number) {
    metaLog("authentication", "INFO", `Outdating token ${token}, expiring at ${expireAt}`);
    await _addOutdatedToken(token, expireAt);
}

export {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    _trimToken,
    _refreshVaultExpiration
};