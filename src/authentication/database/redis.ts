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
const passwordPrefix = "webvault:vaultauth:password:";
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
    const currentNonce = await redis.get(noncePrefix + vault);
    let nonce = Math.floor(Math.random() * 4294967295);
    while(currentNonce && nonce === parseInt(currentNonce)) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    await redis.set(noncePrefix + vault, nonce + "");
}

async function redisVerifyVaultPassword(vault: string, password: string) {
    return await redis.get(passwordPrefix + vault) === password;
}

async function redisDeleteVault(vault: string) {
    await Promise.all([
        redis.del(passwordPrefix + vault),
        redis.del(noncePrefix + vault)
    ]);
}

async function redisGetVaultNonce(vault: string): Promise<number | undefined> {
    const nonce = await redis.get(noncePrefix + vault);
    if(nonce !== null) {
        return parseInt(nonce) as number;
    }
    return undefined;
}

async function redisVerifyVaultNonce(vault: string, nonce: number) {
    return parseInt(await redis.get(noncePrefix + vault) || "Not a number") === nonce;
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
    
    redisGetVaultNonce,
    redisVerifyVaultNonce,

    close
};