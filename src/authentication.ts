import JWT, { UnwrappedToken } from "./authentication/jwt.js";
import {
    localAddOutdatedToken,
    localDeleteVaultPassword,
    localIsOutdatedToken,
    localSetVaultPassword,
    localVaultExists,
    localVerifyVaultPassword,
} from "./authentication/database.js";
import {
    redisAddOutdatedToken,
    redisDeleteVaultPassword,
    redisIsOutdatedToken,
    redisSetVaultPassword,
    redisVaultExists,
    redisVerifyVaultPassword,
} from "./authentication/redis.js";
import { metaLog } from "./logger.js";
import { unixTime } from "./helper.js";

const tokenExpirationTime = parseInt(process.env.JWT_EXPIRATION as string) || 7 * 24 * 60 * 60; // Default is 1 week
const issuer = process.env.DOMAIN !== undefined ? process.env.DOMAIN
    : (() => { throw new Error(`The DOMAIN environment variable must be specified. (It is used as the "issuer" field in the JSON Web Token.)`); })();
const secret = process.env.JWT_SECRET !== undefined ? process.env.JWT_SECRET
    : (() => { throw new Error("The JWT_SECRET environment variable must be specified."); })();
if(!(/^[a-fA-F0-9]+$/.test(secret))) throw new Error("Secret must be a hex string. (No 0x)");

const addOutdatedTokenFunction = process.env.REDIS ? redisAddOutdatedToken : (token: string, expireAt: number) => Promise.resolve(localAddOutdatedToken(token, expireAt));
const isOutdatedTokenFunction = process.env.REDIS ? redisIsOutdatedToken : (token: string) => Promise.resolve(localIsOutdatedToken(token));
const setVaultPasswordFunction = process.env.REDIS ? redisSetVaultPassword : localSetVaultPassword;
const verifyVaultPasswordFunction = process.env.REDIS ? redisVerifyVaultPassword : (vault: string, password: string) => Promise.resolve(localVerifyVaultPassword(vault, password));
const vaultExistsFunction = process.env.REDIS ? redisVaultExists : (vault: string) => Promise.resolve(localVaultExists(vault));
const deleteVaultPasswordFunction = process.env.REDIS ? redisDeleteVaultPassword : localDeleteVaultPassword;

async function getUnwrappedToken(token: string): Promise<UnwrappedToken | null> {
    if(await isOutdatedTokenFunction(token)) return null;
    const unwrapped = JWT.unwrap(token, secret);
    if(unwrapped == null) return null;
    const [header, payload] = unwrapped;
    if(payload.exp < unixTime()) return null;
    return [header, payload, token];
}

function outdateToken(token: string, expireAt: number) {
    metaLog("authentication", "INFO",
    `Outdating token ${token}, expiring at ${expireAt}`);
    addOutdatedTokenFunction(token, expireAt);
}

function createToken(vaults: string[]) {
    const current = unixTime();
    const jwt = new JWT(issuer, current + tokenExpirationTime, current);
    jwt.addClaim("vaults", vaults);
    jwt.addClaim("nonce", Math.floor(Math.random() * 4294967295));
    const token = jwt.getToken(secret);
    metaLog("authentication", "INFO",
    `Created new token ${token}. (Vaults: ${vaults}, Expiration: ${current + tokenExpirationTime})`);
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
    outdateToken(token, payload.exp);
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
    metaLog("authentication", "INFO",
    `Removing vault ${vault} from token ${token}`);
    const currentVaults: string[] = payload.vaults;
    const index = currentVaults.indexOf(vault);
    if(index !== -1) currentVaults.splice(index, 1);
    outdateToken(token, payload.exp);
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
    outdateToken(token, payload.exp);
    return createToken(vaults);
}





import { hashPassword } from "./authentication/password.js";
const passwordSalt = (() => {
    if(process.env.PASSWORD_SALT === undefined) {
        throw new Error("The PASSWORD_SALT environment variable must be specified.");
    }
    if(!(/^[a-fA-F0-9]+$/.test(process.env.PASSWORD_SALT))) {
        throw new Error("Password must be a hex string. (No 0x)");
    }
    return Buffer.from(process.env.PASSWORD_SALT, "hex");
})();

const iterationCount = parseInt(process.env.ITERATION_COUNT as string) || 123456;


async function setVaultPassword(vault: string, password: string) {
    const hashedPassword = hashPassword(password, passwordSalt, iterationCount);
    await setVaultPasswordFunction(vault, hashedPassword);
    metaLog("authentication", "INFO",
    `Changed vault ${vault} password. (Hash: ${hashedPassword})`);
}

function verifyVaultPassword(vault: string, password: string) {
    const hashedPassword = hashPassword(password, passwordSalt, iterationCount);
    return verifyVaultPasswordFunction(vault, hashedPassword);
}

/**
 * Checks if vault exists in the database
 * 
 * @param vault 
 * @returns 
 */
function vaultExistsDatabase(vault: string) {
    return vaultExistsFunction(vault);
}

async function deleteVaultPassword(vault: string) {
    await deleteVaultPasswordFunction(vault);
    metaLog("authentication", "INFO",
    `Deleted vault ${vault} password.`);
}

export {
    getUnwrappedToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    outdateToken,
    refreshTokenExpiration,
    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword
};