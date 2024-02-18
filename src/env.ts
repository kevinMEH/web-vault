import path from "path";
import { mkdir } from "fs/promises";
import config from "../config";
import { metaLog } from "./logger";

// The ${name} configuration must be specified. ${reason}
function configUndefinedError(configurationName: string, reason: string): never {
    throw new Error(`The ${configurationName} configuration must be specified. ${reason}`);
}
function configIncorrectType(configurationName: string, correctType: string): never {
    throw new Error(`The ${configurationName} configuration is of the incorrect type. It is currently a ${typeof(configurationName)}, but it must be a ${correctType}.`);
}


export const TESTING = process.env.TESTING === "true" && config.PRODUCTION !== true;


export const PRODUCTION: boolean = (() => {
    const entry = config.PRODUCTION;
    if(entry === undefined) {
        configUndefinedError("PRODUCTION", "Unless you know what you are doing, set PRODUCTION to true.");
    } else if(typeof entry === "boolean") {
        return entry;
    } else {
        configIncorrectType("PRODUCTION", "boolean");
    }
})();


export const USING_REDIS: boolean = (() => {
    const defaultValue = process.env.REDIS === "true";
    const entry = config.REDIS;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "boolean") {
        return entry;
    } else {
        configIncorrectType("REDIS", "boolean");
    }
})();


export const DATABASE_SAVE_INTERVAL: number = (() => {
    const defaultValue = 24 * 60 * 60;
    const entry = config.DATABASE_SAVE_INTERVAL;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("DATABASE_SAVE_INTERVAL", "number");
    }
})();

export const PURGE_INTERVAL: number = (() => {
    const defaultValue = 24 * 60 * 60;
    const entry = config.PURGE_INTERVAL;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("PURGE_INTERVAL", "number");
    }
})();

export const VFS_STORE_DIRECTORY: string = await (async () => {
    const defaultValue = path.join(process.cwd(), "database");
    const entry = config.VFS_STORE_DIRECTORY;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "string") {
        await mkdir(path.join(entry)).then(() => {
            metaLog("admin", "INFO", `Created new VFS store directory at "${path.join(entry)}".`);
        }).catch(() => {});
        return entry;
    } else {
        configIncorrectType("VFS_STORE_DIRECTORY", "string");
    }
})();


export const DOMAIN: string = (() => {
    const entry = config.DOMAIN;
    if(entry === undefined) {
        if(PRODUCTION) {
            configUndefinedError("DOMAIN", `It is used as the "issuer" field in the JWT, and can be set to any value that can identify you as the issuer.`);
        } else {
            return "kevin";
        }
    } else if(typeof entry === "string") {
        return entry;
    } else {
        configIncorrectType("DOMAIN", "string");
    }
})();

export const JWT_EXPIRATION: number = (() => {
    const defaultValue = 7 * 24 * 60 * 60;
    const entry = config.JWT_EXPIRATION;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("JWT_EXPIRATION", "number");
    }
})();

export const ADMIN_JWT_EXPIRATION: number = (() => {
    const defaultValue = 3 * 60 * 60;
    const entry = config.ADMIN_JWT_EXPIRATION;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("ADMIN_JWT_EXPIRATION", "number");
    }
})();

export const ALLOW_REFRESH: boolean = (() => {
    const defaultValue = true;
    const entry = config.ALLOW_REFRESH;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "boolean") {
        return entry;
    } else {
        configIncorrectType("ALLOW_REFRESH", "boolean");
    }
})();

export const JWT_SECRET: string = (() => {
    const entry = config.JWT_SECRET;
    if(entry === undefined) {
        if(PRODUCTION) {
            configUndefinedError("JWT_SECRET", "It is used as the secret for signing issued JWTs and should be a hex string (string consisting of only numbers and letters A to F) at least 64 hexes long.");
        } else {
            return "1234".repeat(16);
        }
    } else if(typeof entry === "string") {
        if(/^[a-fA-F0-9]+$/.test(entry) === false) {
            throw new Error("JWT_SECRET must be a hex string (string consisting of only numbers and letters A to F) preferably 64+ hexes long.");
        } else {
            return entry;
        }
    } else {
        configIncorrectType("JWT_SECRET", "string");
    }
})();

export const PASSWORD_SALT: Buffer = (() => {
    const entry = config.PASSWORD_SALT;
    if(entry === undefined) {
        if(PRODUCTION) {
            configUndefinedError("PASSWORD_SALT", "It is used as the salt for hashing and storing the password and should be a hex string (string consisting of only numbers and letters A to F) at least 64 hexes long.")
        } else {
            return Buffer.from("12345678", "hex");
        }
    } else if(typeof entry === "string") {
        if(/^[a-fA-F0-9]+$/.test(entry) === false) {
            throw new Error("PASSWORD_SALT must be a hex string (string consisting of only numbers and letters A to F) preferably 64+ hexes long.");
        } else {
            return Buffer.from(entry, "hex");
        }
    } else {
        configIncorrectType("PASSWORD_SALT", "string");
    }
})();

export const ITERATION_COUNT: number = (() => {
    const defaultValue = 1000;
    const entry = config.ITERATION_COUNT;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("ITERATION_COUNT", "number");
    }
})();


export const DEFAULT_ADMIN_NAME: string = (() => {
    const entry = config.DEFAULT_ADMIN_NAME;
    if(entry === undefined) {
        if(PRODUCTION) {
            configUndefinedError("DEFAULT_ADMIN_NAME", "It is used as the default admin account for online vault management.");
        } else {
            return "admin";
        }
    } else if(typeof entry === "string") {
        return entry;
    } else {
        configIncorrectType("DEFAULT_ADMIN_NAME", "string");
    }
})();

export const DEFAULT_ADMIN_PASSWORD_HASH: string = (() => {
    const entry = config.DEFAULT_ADMIN_PASSWORD_HASH;
    if(entry === undefined) {
        if(PRODUCTION) {
            configUndefinedError("DEFAULT_ADMIN_PASSWORD_HASH", "It is used as the password hash for the default admin account. NOTE: THE VALUE PROVIDED MUST BE A HASH, NOT THE PASSWORD ITSELF.");
        } else {
            return "fd9545d08526d97ece9c88e696a6e3343e99f1ae06244eafd634badbae29bb23"; // Hash for "password", salt=12345678, iterations=1000
        }
    } else if(typeof entry === "string") {
        return entry;
    } else {
        configIncorrectType("DEFAULT_ADMIN_PASSWORD_HASH", "string");
    }
})();


export const VFS_BACKUP_INTERVAL: number = (() => {
    const defaultValue = 30 * 60;
    const entry = config.VFS_BACKUP_INTERVAL;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("VFS_BACKUP_INTERVAL", "number");
    }
})();

export const BASE_VAULT_DIRECTORY: string = await (async () => {
    const defaultValue = path.join(process.cwd(), "vaults");
    const entry = config.BASE_VAULT_DIRECTORY;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "string") {
        await mkdir(path.join(entry)).then(() => {
            metaLog("admin", "INFO", `Created new base vault directory at "${path.join(entry)}".`)
        }).catch(() => {});
        await mkdir(path.join(entry, "temp")).then(() => {
            metaLog("admin", "INFO", `Created temp vault directory at "${path.join(entry, "temp")}".`)
        }).catch(() => {});
        return entry;
    } else {
        configIncorrectType("BASE_VAULT_DIRECTORY", "string");
    }
})();

export const BASE_LOGGING_DIRECTORY: string = await (async () => {
    const defaultValue = path.join(process.cwd(), "logs");
    const entry = config.LOGGING_DIRECTORY;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "string") {
        await mkdir(path.join(entry, "admin")).then(() => {
            metaLog("admin", "INFO", `Created new logging directory at ${path.join(entry)}`);
        }).catch(() => {});
        await Promise.all([
            mkdir(path.join(entry, "admin"), { recursive: true }),
            mkdir(path.join(entry, "authentication"), { recursive: true }),
            mkdir(path.join(entry, "database"), { recursive: true }),
            mkdir(path.join(entry, "file system"), { recursive: true }),
            mkdir(path.join(entry, "requests"), { recursive: true }),
            mkdir(path.join(entry, "runtime"), { recursive: true }),
            mkdir(path.join(entry, "vaults"), { recursive: true }),
            mkdir(path.join(entry, "vfs"), { recursive: true })
        ]).then(() => {
            metaLog("admin", "INFO", `Created new logging category directories inside "${path.join(entry)}".`);
        }).catch(error => {
            metaLog("admin", "WARNING", `Encountered error "${(error as Error).name}: ${(error as Error).message}" while creating new logging category directories inside "${path.join(entry)}".`);
        });
        return entry;
    } else {
        configIncorrectType("BASE_LOGGING_DIRECTORY", "string");
    }
})();


export const MAX_VFS_DEPTH: number = (() => {
    const defaultValue = 4;
    const entry = config.MAX_VFS_DEPTH;
    if(entry === undefined) {
        return defaultValue;
    } else if(typeof entry === "number") {
        return entry;
    } else {
        configIncorrectType("MAX_VFS_DEPTH", "number");
    }
})();