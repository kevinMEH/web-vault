import {
    localAddOutdatedToken,
    localIsOutdatedToken,
    localSetVaultPassword,
    localVerifyVaultPassword,
    localVaultExists,
    localDeleteVault,
    localInvalidVaultIssuingDate,
    localSetAdminPassword,
    localVerifyAdminPassword,
    localDeleteAdmin,
    localInvalidAdminIssuingDate,
    localResetAdminNonce,
} from "./database/local";
import {
    redisAddOutdatedToken,
    redisIsOutdatedToken,
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
} from "./database/redis";
import { HashedPassword, hashPassword } from "./password";

import { metaLog } from "../logger";

import { USING_REDIS, PASSWORD_SALT, ITERATION_COUNT } from "../env";

const isOutdatedToken = USING_REDIS ? redisIsOutdatedToken : (token: string) => Promise.resolve(localIsOutdatedToken(token));
const _addOutdatedToken = USING_REDIS ? redisAddOutdatedToken : (token: string, expireAt: number) => Promise.resolve(localAddOutdatedToken(token, expireAt));

const vaultExistsDatabase = USING_REDIS ? redisVaultExists : (vault: string) => Promise.resolve(localVaultExists(vault));
const setVaultPasswordFunction = USING_REDIS ? redisSetVaultPassword : localSetVaultPassword;
const verifyVaultPasswordFunction = USING_REDIS ? redisVerifyVaultPassword : (vault: string, password: HashedPassword) => Promise.resolve(localVerifyVaultPassword(vault, password));
const deleteVaultFunction = USING_REDIS ? redisDeleteVault : localDeleteVault;
const invalidVaultIssuingDate = USING_REDIS ? redisInvalidVaultIssuingDate : (vault: string, issuingDate: number) => Promise.resolve(localInvalidVaultIssuingDate(vault, issuingDate));

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
const verifyAdminPasswordFunction = USING_REDIS ? redisVerifyAdminPassword : (adminName: string, password: HashedPassword) => Promise.resolve(localVerifyAdminPassword(adminName, password));
const deleteAdminFunction = USING_REDIS ? redisDeleteAdmin : localDeleteAdmin;
const invalidAdminIssuingDate = USING_REDIS ? redisInvalidAdminIssuingDate : (adminName: string, issuingDate: number) => Promise.resolve(localInvalidAdminIssuingDate(adminName, issuingDate));
const resetAdminNonce = USING_REDIS ? redisResetAdminNonce : (adminName: string) => Promise.resolve(localResetAdminNonce(adminName));

// TODO: Error handling on hashPassword
async function setAdminPassword(adminName: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    await setAdminPasswordFunction(adminName, hashedPassword);
    metaLog("authentication", "INFO", `Changed admin ${adminName} password. (Hash: ${hashedPassword})`);
}

// TODO: Error handling on hashPassword
async function verifyAdminPassword(adminName: string, password: string) {
    const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
    return verifyAdminPasswordFunction(adminName, hashedPassword);
}

async function deleteAdminPassword(adminName: string) {
    await deleteAdminFunction(adminName);
    metaLog("authentication", "INFO", `Deleted admin ${adminName} credentials.`)
}

export {
    _addOutdatedToken,
    isOutdatedToken,

    setVaultPassword,
    verifyVaultPassword,
    vaultExistsDatabase,
    deleteVaultPassword,
    invalidVaultIssuingDate,
    
    setAdminPassword,
    verifyAdminPassword,
    deleteAdminPassword,
    invalidAdminIssuingDate,
    resetAdminNonce
};