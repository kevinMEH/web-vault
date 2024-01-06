import Redis from "ioredis";
import { USING_REDIS } from "../../env";
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
    await redis.set(vaultPasswordPrefix + vault, hashedPassword);
    const currentNonce = await redis.get(vaultNoncePrefix + vault);
    let nonce = Math.floor(Math.random() * 4294967295);
    while(currentNonce && nonce === parseInt(currentNonce)) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    await redis.set(vaultNoncePrefix + vault, nonce + "");
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

async function redisGetVaultNonce(vault: string): Promise<number | undefined> {
    const nonce = await redis.get(vaultNoncePrefix + vault);
    if(nonce !== null) {
        return parseInt(nonce) as number;
    }
    return undefined;
}

async function redisVerifyVaultNonce(vault: string, nonce: number) {
    return parseInt(await redis.get(vaultNoncePrefix + vault) || "Not a number") === nonce;
}




async function redisSetAdminPassword(adminName: string, hashedPassword: HashedPassword) {
    await redis.set(adminPasswordPrefix + adminName, hashedPassword);
    const currentNonce = await redis.get(adminNoncePrefix + adminName);
    let nonce = Math.floor(Math.random() * 4294967295);
    while(currentNonce && nonce === parseInt(currentNonce)) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    await redis.set(adminNoncePrefix + adminName, nonce + "");
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

async function redisGetAdminNonce(adminName: string): Promise<number | undefined> {
    const nonceString = await redis.get(adminNoncePrefix + adminName);
    if(nonceString != null) {
        return parseInt(nonceString) as number;
    }
    return undefined;
}

async function redisVerifyAdminNonce(adminName: string, nonce: number) {
    return parseInt(await redis.get(adminNoncePrefix + adminName) || "Not a number") === nonce;
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
    
    redisSetAdminPassword,
    redisVerifyAdminPassword,
    redisDeleteAdmin,
    redisGetAdminNonce,
    redisVerifyAdminNonce,

    close
};