import JWT, { UnwrappedToken } from "./authentication/jwt.js";
import { metaLog } from "./logger.js";
import { unixTime } from "./helper.js";
import { isOutdatedToken, addOutdatedToken } from "./authentication/database.js";

import { JWT_EXPIRATION, DOMAIN, JWT_SECRET } from "./env.js";

async function getUnwrappedToken(token: string): Promise<UnwrappedToken | null> {
    if(await isOutdatedToken(token)) return null;
    const unwrapped = JWT.unwrap(token, JWT_SECRET);
    if(unwrapped == null) return null;
    const [header, payload] = unwrapped;
    if(payload.exp < unixTime()) return null;
    return [header, payload, token];
}

function createToken(vaults: string[]) {
    const current = unixTime();
    const jwt = new JWT(DOMAIN, current + JWT_EXPIRATION, current);
    jwt.addClaim("vaults", vaults);
    jwt.addClaim("nonce", Math.floor(Math.random() * 4294967295));
    const token = jwt.getToken(JWT_SECRET);
    metaLog("authentication", "INFO",
    `Created new token ${token}. (Vaults: ${vaults}, Expiration: ${current + JWT_EXPIRATION})`);
    return token;
}

/**
 * Returns a new token (with updated expirations) with the vault added.
 * 
 * MUST VERIFY TOKEN IS VALID BEFORE CALLING!!!
 * 
 * @param unwrappedToken 
 * @param vault 
 * @returns New token as a base64url string
 */
function addNewVaultToToken(unwrappedToken: UnwrappedToken, vault: string): string {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO", `Adding new vault ${vault} to token ${token}`);
    const currentVaults = payload.vaults;
    if(!currentVaults.includes(vault))
        currentVaults.push(vault);
    addOutdatedToken(token, payload.exp);
    return createToken(currentVaults);
}

/**
 * Returns a new token (with updated expirations) with the vault removed.
 * 
 * A token with an empty array as its "vaults" field is safe. An invalid vault is safe.
 * 
 * MUST VERIFY TOKEN IS VALID BEFORE CALLING!!!
 * 
 * @param unwrappedToken 
 * @param vault 
 * @returns 
 */
function removeVaultFromToken(unwrappedToken: UnwrappedToken, vault: string) {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO", `Removing vault ${vault} from token ${token}`);
    const currentVaults: string[] = payload.vaults;
    const index = currentVaults.indexOf(vault);
    if(index !== -1) currentVaults.splice(index, 1);
    addOutdatedToken(token, payload.exp);
    return createToken(currentVaults);
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
function refreshTokenExpiration(unwrappedToken: UnwrappedToken): string {
    const [_header, payload, token] = unwrappedToken;
    metaLog("authentication", "INFO",`Refreshing token ${token}`);
    const vaults = payload.vaults;
    addOutdatedToken(token, payload.exp);
    return createToken(vaults);
}

export {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    refreshTokenExpiration
};