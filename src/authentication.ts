import JWT from "./authentication/jwt.js";
import {
    localAddOutdatedToken,
    localIsOutdatedToken,
    localSetVaultPassword,
    localVerifyVaultPassword,
} from "./authentication/database.js";
import {
    redisAddOutdatedToken,
    redisIsOutdatedToken,
    redisSetVaultPassword,
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

const addOutdatedTokenFunction = process.env.REDIS ? redisAddOutdatedToken : localAddOutdatedToken;
const isOutdatedTokenFunction = process.env.REDIS ? redisIsOutdatedToken : localIsOutdatedToken;
const setVaultPasswordFunction: ((vault: string, password: string) => void | Promise<void>) = process.env.REDIS ? redisSetVaultPassword : localSetVaultPassword;
const verifyVaultPasswordFunction = process.env.REDIS ? redisVerifyVaultPassword : localVerifyVaultPassword;

async function isValidToken(token: string) {
    if(await isOutdatedTokenFunction(token)) return false;
    try {
        const [_header, payload] = JWT.unwrap(token, secret);
        return payload.exp > unixTime();
    } catch(error) {
        const errorMessage = (error as Error).message;
        if(errorMessage === "Token signature does not match header and body.")
            return false;
        if(errorMessage === "Invalid JSON Web Token format.")
            return false;
        
        metaLog("authentication", "ERROR",
        `Encountered unknown error "${errorMessage}" while validating token "${token}". Returned false.`);
        return false;
    }
}

async function outdateToken(token: string, expireAt: number) {
    metaLog("authentication", "INFO",
    `Outdating token ${token}, expiring at ${expireAt}`);
    await addOutdatedTokenFunction(token, expireAt);
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

// Returns a new token (with updated expirations) with the vault added.
// MUST VERIFY TOKEN IS VALID before calling this function.
function addNewVaultToToken(token: string, vault: string) {
    metaLog("authentication", "INFO",
    `Adding new vault ${vault} to token ${token}`);
    const [_header, payload] = JWT.unwrap(token, secret);
    const currentVaults = payload.vaults;
    if(!currentVaults.includes(vault))
        currentVaults.push(vault);
    outdateToken(token, payload.exp);
    return createToken(currentVaults);
}

// Returns a new token (with updated expirations) with the vault removed.
// MUST VERIFY TOKEN IS VALID before calling this function.
// A token with an empty array as its "vaults" field is safe.
function removeVaultFromToken(token: string, vault: string) {
    metaLog("authentication", "INFO",
    `Removing vault ${vault} from token ${token}`);
    const [_header, payload] = JWT.unwrap(token, secret);
    const currentVaults: string[] = payload.vaults;
    const index = currentVaults.indexOf(vault);
    if(index !== -1) currentVaults.splice(index, 1);
    outdateToken(token, payload.exp);
    return createToken(currentVaults);
}

// Issues a new token with updated expiration.
// MUST VERIFY TOKEN IS VALID before calling this function.
// Useful for short lived expirations for extra security, but refreshes
// every time the user logs back in / accesses vault.
function refreshTokenExpiration(token: string) {
    metaLog("authentication", "INFO",
    `Refreshing token ${token}`);
    const [_header, payload] = JWT.unwrap(token, secret);
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
}

async function verifyVaultPassword(vault: string, password: string) {
    const hashedPassword = hashPassword(password, passwordSalt, iterationCount);
    return await verifyVaultPasswordFunction(vault, hashedPassword);
}


export {
    isValidToken,
    createToken,
    addNewVaultToToken,
    removeVaultFromToken,
    outdateToken,
    refreshTokenExpiration,
    setVaultPassword,
    verifyVaultPassword
};