import Redis from "ioredis";
const redis = new Redis();

// Checks if the token is outdated (meaning that the user has requested
// a logout, information has been added to / removed from the token, etc
async function isOutdatedToken(token: string) {
    return await redis.get("webvault:outdated:" + token) === "1";
}

// Adds an outdated token to the database. The token will be set
// with a TTL in the form of a unix timestamp.
function addOutdatedToken(token: string, expireAt: number) {
    redis.set("webvault:outdated:" + token, "1", "EXAT", expireAt);
}

async function close() {
    await redis.quit();
}

export { isOutdatedToken, addOutdatedToken, close };