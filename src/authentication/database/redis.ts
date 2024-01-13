import Redis from "ioredis";
import { USING_REDIS } from "../../env";
import { unixTime } from "../../helper";
import { HashedPassword } from "../password";

const throwRedisError = () => { throw new Error("Attempting to use Redis with the REDIS environment variable turned off."); }

const redis = USING_REDIS
    ? new Redis()
    : {
    get: throwRedisError,
    set: throwRedisError,
    quit: () => { console.log("Not using Redis."); },
    del: throwRedisError
};

const outdatedPrefix = "webvault:outdated:";
const vaultPasswordPrefix = "webvault:vaultauth:password:";
const vaultNoncePrefix = "webvault:vaultauth:nonce:";
const adminPasswordPrefix = "webvault:adminauth:password:";
const adminNoncePrefix = "webvault:adminauth:nonce:";

/**
 * Checks if the token is outdated (meaning that the user has requested
 * a logout, information has been added to / removed from teh token, etc.)
 * 
 * @param token 
 * @returns Promise<boolean>
 */
async function redisIsOutdatedToken(token: string): Promise<boolean> {
    return await redis.get(outdatedPrefix + token) === "1";
}

/**
 * Adds an outdated token to the database. The token will be set with a TTL
 * in the form of a unix timestamp.
 * 
 * @param token 
 * @param expireAt Unix timestamp of the expiration date of the token.
 */
async function redisAddOutdatedToken(token: string, expireAt: number) {
    await redis.set(outdatedPrefix + token, "1", "EXAT", expireAt);
}

async function redisVaultExists(vault: string) {
    return await redis.get(vaultPasswordPrefix + vault) !== null;
}

async function redisSetVaultPassword(vault: string, hashedPassword: HashedPassword) {
    await Promise.all([
        redis.set(vaultPasswordPrefix + vault, hashedPassword),
        redis.set(vaultNoncePrefix + vault, unixTime() + "")
    ]);
}

async function redisVerifyVaultPassword(vault: string, password: HashedPassword) {
    return await redis.get(vaultPasswordPrefix + vault) === password;
}

async function redisDeleteVault(vault: string) {
    await Promise.all([
        redis.del(vaultPasswordPrefix + vault),
        redis.del(vaultNoncePrefix + vault)
    ]);
}

async function redisInvalidVaultIssuingDate(vault: string, issuingDate: number) {
    const vaultNonce = parseInt(await redis.get(vaultNoncePrefix + vault) || "Not a number")
    return isNaN(vaultNonce) || issuingDate < vaultNonce;
}




async function redisSetAdminPassword(adminName: string, hashedPassword: HashedPassword) {
    await Promise.all([
        redis.set(adminPasswordPrefix + adminName, hashedPassword),
        redis.set(adminNoncePrefix + adminName, unixTime() + "")
    ]);
}

async function redisVerifyAdminPassword(adminName: string, password: HashedPassword) {
    return await redis.get(adminPasswordPrefix + adminName) === password;
}

async function redisDeleteAdmin(adminName: string) {
    await Promise.all([
        redis.del(adminPasswordPrefix + adminName),
        redis.del(adminNoncePrefix + adminName),
    ]);
}

async function redisInvalidAdminIssuingDate(adminName: string, issuingDate: number) {
    const adminNonce = parseInt(await redis.get(adminNoncePrefix + adminName) || "Not a number");
    return isNaN(adminNonce) || issuingDate < adminNonce;
}

async function redisResetAdminNonce(adminName: string) {
    await redis.set(adminNoncePrefix + adminName, unixTime() + "");
}




async function close() {
    await redis.quit();
}



export {
    redisIsOutdatedToken,
    redisAddOutdatedToken,

    redisSetVaultPassword,
    redisVerifyVaultPassword,
    redisVaultExists,
    redisDeleteVault,
    redisInvalidVaultIssuingDate,
    
    redisSetAdminPassword,
    redisVerifyAdminPassword,
    redisDeleteAdmin,
    redisInvalidAdminIssuingDate,
    redisResetAdminNonce,

    close
};