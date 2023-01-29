import Redis from "ioredis";

const throwRedisError = () => { throw new Error("Attempting to use Redis with the REDIS environment variable turned off."); }

const redis = process.env.REDIS || process.env.PRODUCTION == undefined
    ? new Redis()
    : {
    get: throwRedisError,
    set: throwRedisError,
    quit: throwRedisError,
    del: throwRedisError
};

// Checks if the token is outdated (meaning that the user has requested
// a logout, information has been added to / removed from the token, etc
async function redisIsOutdatedToken(token: string) {
    return await redis.get("webvault:outdated:" + token) === "1";
}

// Adds an outdated token to the database. The token will be set
// with a TTL in the form of a unix timestamp.
async function redisAddOutdatedToken(token: string, expireAt: number) {
    await redis.set("webvault:outdated:" + token, "1", "EXAT", expireAt);
}

async function redisSetVaultPassword(vault: string, hashedPassword: string) {
    await redis.set("webvault:vaultauth:" + vault, hashedPassword);
}

async function redisVerifyVaultPassword(vault: string, password: string) {
    return await redis.get("webvault:vaultauth:" + vault) === password;
}
}

async function close() {
    await redis.quit();
}

export {
    redisIsOutdatedToken,
    redisAddOutdatedToken,
    redisSetVaultPassword,
    redisVerifyVaultPassword,
    close,
};