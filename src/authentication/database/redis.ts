import Redis from "ioredis";
import { USING_REDIS } from "../../env";

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
const passwordPrefix = "webvault:vaultauth:";
const noncePrefix = "webvault:vaultauth:nonce:";

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
    return await redis.get(passwordPrefix + vault) !== null;
}

async function redisSetVaultPassword(vault: string, hashedPassword: string) {
    await redis.set(passwordPrefix + vault, hashedPassword);
    await redisSetVaultNonce(vault);
}

async function redisVerifyVaultPassword(vault: string, password: string) {
    return await redis.get(passwordPrefix + vault) === password;
}

async function redisDeleteVaultPassword(vault: string) {
    await redis.del(passwordPrefix + vault);
    await redisDeleteVaultNonce(vault);
}

async function redisVerifyVaultNonce(vault: string, nonce: number) {
    return await redis.get(noncePrefix + vault) === nonce + "";
}

async function redisGetVaultNonce(vault: string): Promise<number | undefined> {
    const nonce = await redis.get(noncePrefix + vault);
    if(nonce !== null) {
        return parseInt(nonce) as number;
    }
    return undefined;
}

async function redisSetVaultNonce(vault: string) {
    let nonce = Math.floor(Math.random() * 4294967295);
    while(await redisVerifyVaultNonce(vault, nonce)) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    await redis.set(noncePrefix + vault, nonce + "");
}

async function redisDeleteVaultNonce(vault: string) {
    await redis.del(noncePrefix + vault);
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
    
    redisVerifyVaultNonce,
    redisGetVaultNonce,
    redisDeleteVaultNonce,

    close,
};