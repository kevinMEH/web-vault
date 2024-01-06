import {
    localAddOutdatedToken,
    localIsOutdatedToken,
    localSetVaultPassword,
    localVerifyVaultPassword,
    localVaultExists,
    localDeleteVault,
    localGetVaultNonce,
    localVerifyVaultNonce,
    localSetAdminPassword,
    localVerifyAdminPassword,
    localDeleteAdmin,
    localGetAdminNonce,
    localVerifyAdminNonce,
} from "./database/local";
import {
    redisAddOutdatedToken,
    redisIsOutdatedToken,
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
} from "./database/redis";
import { hashPassword } from "./password";

import { metaLog } from "../logger";

import { USING_REDIS, PASSWORD_SALT, ITERATION_COUNT } from "../env";

const isOutdatedToken = USING_REDIS ? redisIsOutdatedToken : (token: string) => Promise.resolve(localIsOutdatedToken(token));
const addOutdatedTokenFunction = USING_REDIS ? redisAddOutdatedToken : (token: string, expireAt: number) => Promise.resolve(localAddOutdatedToken(token, expireAt));

async function addOutdatedToken(token: string, expireAt: number) {
    await addOutdatedTokenFunction(token, expireAt);
    metaLog("authentication", "INFO", `Outdating token ${token}, expiring at ${expireAt}`);
}

const vaultExistsDatabase = USING_REDIS ? redisVaultExists : (vault: string) => Promise.resolve(localVaultExists(vault));
const setVaultPasswordFunction = USING_REDIS ? redisSetVaultPassword : localSetVaultPassword;
const verifyVaultPasswordFunction = USING_REDIS ? redisVerifyVaultPassword : (vault: string, password: string) => Promise.resolve(localVerifyVaultPassword(vault, password));
const deleteVaultFunction = USING_REDIS ? redisDeleteVault : localDeleteVault;
const getVaultNonce = USING_REDIS ? redisGetVaultNonce : (vault: string) => Promise.resolve(localGetVaultNonce(vault));
const verifyVaultNonce = USING_REDIS ? redisVerifyVaultNonce : (vault: string, nonce: number) => Promise.resolve(localVerifyVaultNonce(vault, nonce));

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
    await deleteVaultFunction(vault);
    metaLog("authentication", "INFO", `Deleted vault ${vault} credentials.`);
}

const setAdminPasswordFunction = USING_REDIS ? redisSetAdminPassword : localSetAdminPassword;
const verifyAdminPasswordFunction = USING_REDIS ? redisVerifyAdminPassword : (adminName: string, password: string) => Promise.resolve(localVerifyAdminPassword(adminName, password));
const deleteAdminFunction = USING_REDIS ? redisDeleteAdmin : localDeleteAdmin;
const getAdminNonce = USING_REDIS ? redisGetAdminNonce : (adminName: string) => Promise.resolve(localGetAdminNonce(adminName));
const verifyAdminNonce = USING_REDIS ? redisVerifyAdminNonce : (adminName: string, nonce: number) => Promise.resolve(localVerifyAdminNonce(adminName, nonce));

// TODO: Error handling on hashPassword
async function setAdminPassword(adminName: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    await setAdminPasswordFunction(adminName, hashedPassword);
    metaLog("authentication", "INFO", `Changed admin ${adminName} password. (Hash: ${hashedPassword})`);
}

// TODO: Error handling on hashPassword
async function verifyAdminPassword(adminName: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    return verifyAdminPasswordFunction(adminName, hashedPassword)
}

async function deleteAdminPassword(adminName: string) {
    await deleteAdminFunction(adminName);
    metaLog("authentication", "INFO", `Deleted admin ${adminName} credentials.`)
}

export {
    addOutdatedToken,
    isOutdatedToken,

    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword,
    getVaultNonce,
    verifyVaultNonce,
    
    setAdminPassword,
    verifyAdminPassword,
    deleteAdminPassword,
    getAdminNonce,
    verifyAdminNonce
};