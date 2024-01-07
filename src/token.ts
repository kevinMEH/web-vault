import JWT, { Header, Token } from "./authentication/jwt";
import { metaLog } from "./logger";
import { unixTime } from "./helper";
import { isOutdatedToken, addOutdatedToken, getVaultNonce, verifyVaultNonce } from "./authentication/database";

import { JWT_EXPIRATION, DOMAIN, JWT_SECRET } from "./env";

export type WebVaultPayload = {
    iss: string,
    exp: number,
    iat: number,
    vaults: string[],
    nonces: number[]
}

/**
 * Goes through all checks, and returns [Header, Payload, Token] if the token is
 * valid. If the token is invalid, [null, null, null] is returned.
 * 
 * If any vaults have bad nonces, the vaults will be removed from the payload.
 * The payload will still be returned.
 * 
 * Checks if outdated, body hash consistency, not malformed, nonces consistent.
 * 
 * @param token 
 * @returns Promise<[Header, WebVaultPayload, Token] | [null, null, null]>
 */
async function getUnwrappedToken(token: Token): Promise<[Header, WebVaultPayload, Token] | [null, null, null]> {
    if(await isOutdatedToken(token)) return [null, null, null];
    const unwrapped = JWT.unwrap(token, JWT_SECRET);
    // Malformed or inconsistent
    if(unwrapped == null) {
        return [null, null, null];
    }
    const [header, payload] = unwrapped as [Header, WebVaultPayload];
    // If expired
    if(payload.exp < unixTime()) {
        return [null, null, null];
    }
    // Checks that nonces are consistent, if not remove vault from payload
    for(let i = 0; i < payload.vaults.length; i++) {
        const vault = payload.vaults[i];
        const nonce = payload.nonces[i];
        if(await verifyVaultNonce(vault, nonce) === false) {
            payload.vaults.splice(i, 1);
            payload.nonces.splice(i, 1);
            i--;
        }
    }
    return [header, payload as WebVaultPayload, token];
}

/**
 * The vaults parameter may be modified by the function. It is strongly
 * recommended to pass in a referenceless copy of vaults, or one which is going
 * to be outdated.
 * 
 * @param vaults 
 * @returns 
 */
async function createToken(vaults: string[]): Promise<Token> {
    const current = unixTime();
    const nonces: number[] = [];
    for(let i = 0; i < vaults.length; i++) {
        const vaultNonce = await getVaultNonce(vaults[i]);
        if(vaultNonce === undefined) {
            // Nonce does not exist, so vault does not exist.
            vaults.splice(i, 1);
            i--;
        } else {
            nonces.push(vaultNonce);
        }
    }
    const jwt = new JWT(DOMAIN, current + JWT_EXPIRATION, current);
    jwt.addClaim("vaults", vaults);
    jwt.addClaim("nonces", nonces);
    const token = jwt.getToken(JWT_SECRET);
    metaLog("authentication", "INFO", `Created new token ${token}. (Vaults: ${vaults}, Expiration: ${current + JWT_EXPIRATION})`);
    return token;
}

/**
 * Returns a new token (with updated expirations) with the vault added.
 * 
 * INPUT TOKEN IS INVALIDATED.
 * 
 * MUST VERIFY TOKEN IS VALID BEFORE CALLING!!!
 * 
 * @param unwrappedToken 
 * @param vault 
 * @returns New token as a base64url string
 */
function addNewVaultToToken(unwrappedToken: [Header, WebVaultPayload, Token], vault: string): Promise<Token> {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO", `Adding new vault ${vault} to token ${token}`);
    if(!payload.vaults.includes(vault)) {
        payload.vaults.push(vault);
    }
    addOutdatedToken(token, payload.exp);
    return createToken(payload.vaults);
}

/**
 * Returns a new token (with updated expirations) with the vault removed.
 * 
 * INPUT TOKEN IS INVALIDATED.
 * 
 * A token with an empty array as its "vaults" field is safe. An invalid vault
 * is safe.
 * 
 * MUST VERIFY TOKEN IS VALID BEFORE CALLING!!!
 * 
 * @param unwrappedToken 
 * @param vault 
 * @returns 
 */
function removeVaultFromToken(unwrappedToken: [Header, WebVaultPayload, Token], vault: string): Promise<Token> {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO", `Removing vault ${vault} from token ${token}`);
    const index = payload.vaults.indexOf(vault);
    if(index !== -1) {
        payload.vaults.splice(index, 1);
    }
    addOutdatedToken(token, payload.exp);
    return createToken(payload.vaults);
}

/**
 * Issues a new token with updated expiration.
 * 
 * Useful for short lived expirations for extra security, but refreshes every time
 * the user logs back in / accesses vault.
 * 
 * MUST VERIFY TOKEN IS VALID BEFORE CALLING!!!
 * 
 * @param unwrappedToken
 * @returns The updated token as a string
 */
function refreshTokenExpiration(unwrappedToken: [Header, WebVaultPayload, Token]): Promise<Token> {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO",`Refreshing token ${token}`);
    addOutdatedToken(token, payload.exp);
    return createToken(payload.vaults);
}

export {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    refreshTokenExpiration
};