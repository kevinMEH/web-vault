import path from "path";

const throwEnvError = (variableName: string, reason?: string) => { throw new Error(`The ${variableName} environmental variable must be specified.` + (reason ? ` ${reason}` : ``)); }


export const PRODUCTION = process.env.PRODUCTION === "true" ? true : false;
export const DOMAIN = process.env.DOMAIN ? process.env.DOMAIN
    : PRODUCTION ? throwEnvError("DOMAIN", `It is used as the "issuer" field in the JWT.`) : "kevin";


export const USING_REDIS = process.env.REDIS === "true" ? true : false;
export const DATABASE_SAVE_INTERVAL = parseInt(process.env.DATABASE_SAVE_INTERVAL as string) || 24 * 60 * 60;
export const PURGE_INTERVAL = parseInt(process.env.PURGE_INTERVAL as string) || 24 * 60 * 60;


export const JWT_EXPIRATION = parseInt(process.env.JWT_EXPIRATION as string) || 7 * 24 * 60 * 60;
export const JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET ? process.env.JWT_SECRET :
        PRODUCTION ? throwEnvError("JWT_SECRET") : "1234".repeat(16);
    if(!(/^[a-fA-F0-9]+$/.test(secret))) throw new Error("Secret must be a hex string. (No 0x)");
    return secret;
})();
export const PASSWORD_SALT = (() => {
    const salt = process.env.PASSWORD_SALT ? process.env.PASSWORD_SALT :
        PRODUCTION ? throwEnvError("PASSWORD_SALT") : "12345678";
    if(false === /^[a-fA-F0-9]+$/.test(salt)) {
        throw new Error("Password must be a hex string. (No 0x)");
    }
    return Buffer.from(salt, "hex");
})();
export const ITERATION_COUNT = parseInt(process.env.ITERATION_COUNT as string) || 123456;


export const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME ? process.env.DEFAULT_ADMIN_NAME
    : PRODUCTION ? throwEnvError("DEFAULT_ADMIN_NAME", "It is used as the default admin account for online vault management.") : "admin";
export const DEFAULT_ADMIN_PASSWORD_HASH = process.env.DEFAULT_ADMIN_PASSWORD_HASH ? process.env.DEFAULT_ADMIN_PASSWORD_HASH
    : PRODUCTION ? throwEnvError("DEFAULT_ADMIN_PASSWORD_HASH", "It is used as the password hash for the default admin account. WARNING: THE VALUE PROVIDED MUST BE A HASH, NOT THE PASSWORD ITSELF.") : "admin123";


export const BASE_VAULT_DIRECTORY = process.env.VAULT_DIRECTORY || path.join(process.cwd(), "vaults");
export const VFS_STORE_DIRECTORY = process.env.VFS_STORE_DIRECTORY || BASE_VAULT_DIRECTORY;
export const BASE_LOGGING_DIRECTORY = process.env.LOGGING_DIRECTORY || path.join(process.cwd(), "logs");
export const VFS_BACKUP_INTERVAL = parseInt(process.env.VFS_BACKUP_INTERVAL as string) || 24 * 60 * 60;