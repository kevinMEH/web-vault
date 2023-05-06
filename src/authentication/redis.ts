import Redis from "ioredis";
import { USING_REDIS } from "../env.js";

const throwRedisError = () => { throw new Error("Attempting to use Redis with the REDIS environment variable turned off."); }

const redis = USING_REDIS
    ? new Redis()
    : {
    get: throwRedisError,
    set: throwRedisError,
    quit: () => { console.log("Not using Redis."); },
    del: throwRedisError
};

/**
 * Checks if the token is outdated (meaning that the user has requested
 * a logout, information has been added to / removed from teh token, etc.)
 * 
 * @param token 
 * @returns Promise<boolean>
 */
async function redisIsOutdatedToken(token: string): Promise<boolean> {
    return await redis.get("webvault:outdated:" + token) === "1";
}

/**
 * Adds an outdated token to the database. The token will be set with a TTL
 * in the form of a unix timestamp.
 * 
 * @param token 
 * @param expireAt Unix timestamp of the expiration date of the token.
 */
async function redisAddOutdatedToken(token: string, expireAt: number) {
    await redis.set("webvault:outdated:" + token, "1", "EXAT", expireAt);
}

async function redisSetVaultPassword(vault: string, hashedPassword: string) {
    await redis.set("webvault:vaultauth:" + vault, hashedPassword);
}

async function redisVerifyVaultPassword(vault: string, password: string) {
    return await redis.get("webvault:vaultauth:" + vault) === password;
}

async function redisVaultExists(vault: string) {
    return await redis.get("webvault:vaultauth:" + vault) !== null;
}

async function redisDeleteVaultPassword(vault: string) {
    await redis.del("webvault:vaultauth:" + vault);
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
    redisDeleteVaultPassword,
    close,
};