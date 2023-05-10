import {
    localAddOutdatedToken,
    localDeleteVaultPassword,
    localIsOutdatedToken,
    localSetVaultPassword,
    localVaultExists,
    localVerifyVaultPassword,
} from "./database/local.js";
import {
    redisAddOutdatedToken,
    redisDeleteVaultPassword,
    redisIsOutdatedToken,
    redisSetVaultPassword,
    redisVaultExists,
    redisVerifyVaultPassword,
} from "./database/redis.js";
import { hashPassword } from "./password.js";

import { metaLog } from "../logger.js";

import { USING_REDIS, PASSWORD_SALT, ITERATION_COUNT } from "../env.js";

const isOutdatedToken = USING_REDIS ? redisIsOutdatedToken : (token: string) => Promise.resolve(localIsOutdatedToken(token));
const vaultExistsDatabase = USING_REDIS ? redisVaultExists : (vault: string) => Promise.resolve(localVaultExists(vault));
const addOutdatedTokenFunction = USING_REDIS ? redisAddOutdatedToken : (token: string, expireAt: number) => Promise.resolve(localAddOutdatedToken(token, expireAt));
const setVaultPasswordFunction = USING_REDIS ? redisSetVaultPassword : localSetVaultPassword;
const verifyVaultPasswordFunction = USING_REDIS ? redisVerifyVaultPassword : (vault: string, password: string) => Promise.resolve(localVerifyVaultPassword(vault, password));
const deleteVaultPasswordFunction = USING_REDIS ? redisDeleteVaultPassword : localDeleteVaultPassword;

async function addOutdatedToken(token: string, expireAt: number) {
    await addOutdatedTokenFunction(token, expireAt);
    metaLog("authentication", "INFO", `Outdating token ${token}, expiring at ${expireAt}`);
}

// TODO: Error handling on hashPassword
async function setVaultPassword(vault: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    await setVaultPasswordFunction(vault, hashedPassword);
    metaLog("authentication", "INFO", `Changed vault ${vault} password. (Hash: ${hashedPassword})`);
}

// TODO: Error handling on hashPassword
async function verifyVaultPassword(vault: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    return verifyVaultPasswordFunction(vault, hashedPassword);
}

async function deleteVaultPassword(vault: string) {
    await deleteVaultPasswordFunction(vault);
    metaLog("authentication", "INFO", `Deleted vault ${vault} password.`);
}

export {
    addOutdatedToken,
    isOutdatedToken,
    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword
};