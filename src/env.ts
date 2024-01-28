import path from "path";
import config from "../config";

const throwEnvError = (variableName: string, reason?: string) => { throw new Error(`The ${variableName} environmental variable must be specified.` + (reason ? ` ${reason}` : ``)); }


export const TESTING = process.env.TESTING === "true";


export const PRODUCTION = config.PRODUCTION === true && !TESTING;


export const USING_REDIS = config.REDIS === true || process.env.REDIS === "true";


export const DATABASE_SAVE_INTERVAL = config.DATABASE_SAVE_INTERVAL || 24 * 60 * 60;
export const PURGE_INTERVAL = config.PURGE_INTERVAL || 24 * 60 * 60;
export const VFS_STORE_DIRECTORY = config.VFS_STORE_DIRECTORY || path.join(process.cwd(), "database");


export const DOMAIN = config.DOMAIN ? config.DOMAIN
    : PRODUCTION ? throwEnvError("DOMAIN", `It is used as the "issuer" field in the JWT.`) : "kevin";
export const JWT_EXPIRATION = config.JWT_EXPIRATION || 7 * 24 * 60 * 60;
export const ADMIN_JWT_EXPIRATION = config.ADMIN_JWT_EXPIRATION || 3 * 60 * 60;
export const ALLOW_REFRESH = config.ALLOW_REFRESH !== false;
export const JWT_SECRET = (() => {
    const secret = config.JWT_SECRET ? config.JWT_SECRET :
        PRODUCTION ? throwEnvError("JWT_SECRET") : "1234".repeat(16);
    if(!(/^[a-fA-F0-9]+$/.test(secret))) throw new Error("Secret must be a hex string. (No 0x)");
    return secret;
})();
export const PASSWORD_SALT = (() => {
    const salt = config.PASSWORD_SALT ? config.PASSWORD_SALT :
        PRODUCTION ? throwEnvError("PASSWORD_SALT") : "12345678";
    if(false === /^[a-fA-F0-9]+$/.test(salt)) {
        throw new Error("Password must be a hex string. (No 0x)");
    }
    return Buffer.from(salt, "hex");
})();
export const ITERATION_COUNT = config.ITERATION_COUNT || 1000;


export const DEFAULT_ADMIN_NAME = config.DEFAULT_ADMIN_NAME ? config.DEFAULT_ADMIN_NAME
    : PRODUCTION
        ? throwEnvError("DEFAULT_ADMIN_NAME", "It is used as the default admin account for online vault management.")
        : "admin";
export const DEFAULT_ADMIN_PASSWORD_HASH = config.DEFAULT_ADMIN_PASSWORD_HASH ? config.DEFAULT_ADMIN_PASSWORD_HASH
    : PRODUCTION
        ? throwEnvError("DEFAULT_ADMIN_PASSWORD_HASH", "It is used as the password hash for the default admin account. WARNING: THE VALUE PROVIDED MUST BE A HASH, NOT THE PASSWORD ITSELF.")
        : "fd9545d08526d97ece9c88e696a6e3343e99f1ae06244eafd634badbae29bb23"; // Hash for "password", salt=12345678, iterations=1000


export const VFS_BACKUP_INTERVAL = config.VFS_BACKUP_INTERVAL || 30 * 60;
export const BASE_VAULT_DIRECTORY = config.BASE_VAULT_DIRECTORY || path.join(process.cwd(), "vaults");
export const BASE_LOGGING_DIRECTORY = config.LOGGING_DIRECTORY || path.join(process.cwd(), "logs");


export const MAX_VFS_DEPTH = config.MAX_VFS_DEPTH || 5;
export const DEFAULT_VFS_DEPTH = config.DEFAULT_VFS_DEPTH || 3;