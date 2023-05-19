import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline/promises";
import path from "path";
import { unixTime } from "../../helper"
import { metaLog } from "../../logger";
import CustomError from "../../custom_error";

import { PRODUCTION, USING_REDIS, PURGE_INTERVAL, DATABASE_SAVE_INTERVAL } from "../../env";

type TokenPair = {
    token: string,
    expireAt: number
}

class LinkedList {
    head: Node;
    tail: Node;

    // busy status indicator to shallowly prevent conflicts. TODO: More robust solution.
    busy = false;

    constructor(value: TokenPair) {
        this.head = this.tail = new Node(value);
    }
    
    add(value: TokenPair) {
        this.tail = this.tail.add(value);
    }
}

class Node {
    value: TokenPair;
    next: Node | null;

    constructor(value: TokenPair, next?: Node) {
        this.value = value;
        if(next === undefined) this.next = null;
        else this.next = next;
    }
    
    add(value: TokenPair): Node {
        if(this.next === null) {
            this.next = new Node(value);
            return this.next;
        } else {
            return this.next.add(value);
        }
    }
    
    getExp() {
        return this.value.expireAt;
    }
}





// -----------------------
//      INITIAL SETUP
// -----------------------

// First time flags for tokens database and vault passwords database
let firstTokenSave = true;
let firstVaultSave = true;

const tokenSet: Set<string> = new Set();
const tokenList = new LinkedList({ token: "sentinel", expireAt: 2147483646 });

const vaultPasswordMap: Map<string, string> = new Map();
const vaultNonceMap: Map<string, number> = new Map();

const outdatedTokensFile = path.join(process.cwd(), "database", "outdatedTokens.csv");
const vaultPasswordFile = path.join(process.cwd(), "database", "vaultPasswords.csv");
const vaultNonceFile = path.join(process.cwd(), "database", "vaultNonces.csv");

if(PRODUCTION && !USING_REDIS) {
    try {
        await fs.access(outdatedTokensFile);
        await loadOutdatedTokensFromFile();
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("database", "WARNING", "No outdated tokens database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if outdated tokens database file exists.`);
        }
    }

    try {
        await fs.access(vaultPasswordFile);
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("database", "WARNING", "No vault passwords database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if outdated tokens database file exists.`);
        }
    }
    await loadVaultPasswordsFromFile();

    try {
        await fs.access(vaultNonceFile);
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("database", "WARNING", "No vault passwords database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if outdated tokens database file exists.`);
        }
    }
    await loadVaultNoncesFromFile();
    
    await saveVaultPasswordsToFile();
    await saveVaultNoncesToFile();
    firstVaultSave = false;
    
    // Interval for saving database to file. Default is once per hour.
    setInterval(() => {
        saveOutdatedTokensToFile();
    }, DATABASE_SAVE_INTERVAL * 1000);

    setInterval(() => {
        purgeAllOutdated();
    }, PURGE_INTERVAL * 1000);
}

// --------------------



/**
 * File database/outdatedTokens.csv must exist for this operation to succeed.
 * 
 * An uncatchable error will be thrown if the file does not exist. Do not try
 * catching it. TODO: In the future, try and handle this error.
 */
async function loadOutdatedTokensFromFile() {
    metaLog("database", "INFO", `Loading outdated tokens into memory from file... (${outdatedTokensFile})`);

    const stream = createReadStream(outdatedTokensFile);
    const readlineInterface = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    for await(const line of readlineInterface) {
        if(line === "") continue;
        const parts = line.split(",");
        const token = parts[0].substring(1, parts[0].length - 1);
        const expireAt = parseInt(parts[1]);
        localAddOutdatedToken(token, expireAt);
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", "Finished loading outdated tokens from file.");
}

/**
 * Saves outdated tokens from the local database to a file.
 * 
 * Returns an array of CustomErrors. If successful, the array will be empty.
 * 
 * Errors: `OUTDATEDTOKENS_NONEXISTANT`, `OUTDATEDTOKENS_OLD_NONEXISTANT`
 * 
 * @returns Promise<Array<CustomError>>
 */
async function saveOutdatedTokensToFile(): Promise<Array<CustomError>> {
    metaLog("database", "INFO", "Saving in-memory outdated tokens database to file...")
    // We will write to a temp file and replace the main file with temp file
    // after we finish writing.
    const tempFilePath = path.join(process.cwd(), "database", "tempOutdatedTokens.csv");

    // Attempting temp file creation. Expecting file to be not there.
    let file: fs.FileHandle;
    try {
        file = await fs.open(tempFilePath, "wx")
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "EEXIST") {
            const reason = `Trying to save tokens database to file, but temp file already exists. This means that there is currently an ongoing tokens database save operation, or that the last operation has completed unsuccessfully. Aborting...`;
            metaLog("database", "ERROR", reason);
            return [ new CustomError(reason, "ERROR", "TEMP_FILE_EXISTS") ];
        } else {
            const reason = `Encountered unrecognized error "${message}" while opening temp file for saving tokens database. Aborting...`;
            metaLog("database", "ERROR", reason);
            return [ new CustomError(reason, "ERROR", code) ];
        }
    }

    // Writing to temp file
    try {
        let current = tokenList.head.next; // Sentinel is automatically added so is not written.
        while(current) {
            const value = current.value;
            await file.appendFile(`"${value.token}",${value.expireAt}\n`);
            current = current.next;
        }
        await file.close();
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to append oudated tokens to temp file, but encountered error "${message}" while writing. Aborting...`;
        metaLog("database", "ERROR", reason);
        await file.close();
        await fs.unlink(tempFilePath);
        return [ new CustomError(message, "ERROR", (error as NodeJS.ErrnoException).code) ];
    }
    

    const errors: CustomError[] = [];

    // Replacing main file with temp file
    // Main file -> Old file
    // Temp file -> Main file
    // Unlink Old file
    const realFilePath = outdatedTokensFile;
    const oldFilePath = path.join(process.cwd(), "database", "outdatedTokens.csv.old");
    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstTokenSave) {
                const reason = `outdatedTokens.csv is somehow nonexistant. Ignoring and continuing.`;
                metaLog("database", "WARNING", reason);
                errors.push(new CustomError(reason, "WARNING", "OUTDATEDTOKENS_NONEXISTANT"));
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while renaming outdatedTokens.csv.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        const reason = `There as an error "${message}" renaming tempOutdatedTokens.csv to outdatedTokens.csv.`;
        metaLog("database", "ERROR", reason);
        errors.push(new CustomError(reason, "ERROR", code));
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstTokenSave) {
                const reason = `There was an error unlinking outdatedTokens.csv.old because it does not exist.`;
                metaLog("database", "ERROR", reason);
                errors.push(new CustomError(reason, "ERROR", "OUTDATEDTOKENS_OLD_NONEXISTANT"));
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while unlinking outdatedTokens.csv.old.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });

    if(firstTokenSave) {
        firstTokenSave = false;
    }

    if(errors.length == 0) {
        metaLog("database", "INFO", `Successfully saved in-memory outdated tokens database to file.`);
    } else {
        metaLog("database", "INFO", `Saved in-memory outdated tokens database to file with warnings / errors.`);
    }
    return errors;
}

/**
 * Adds an outdated token to the local database.
 * 
 * @param token 
 * @param expireAt 
 */
function localAddOutdatedToken(token: string, expireAt: number) {
    tokenSet.add(token);
    tokenList.add({ token, expireAt });
}

function localIsOutdatedToken(token: string) {
    return tokenSet.has(token);
}

function purgeAllOutdated() {
    const time = unixTime() - 5;
    let lastValid: Node = tokenList.head;
    let current: Node | null = tokenList.head;
    while(current) {
        if(current.getExp() < time) { // Has expired already, remove from list and set
            tokenSet.delete(current.value.token);
            lastValid.next = current.next;
        } else { // Not expired, update lastValid
            lastValid = current;
        }
        current = lastValid.next;
    }
    tokenList.tail = lastValid;
    
    // Release lock
    tokenList.busy = false;
}



/**
 * File database/vaultPasswords.csv must exist for this operation to succeed.
 * 
 * An uncatchable error will be thrown if the file does not exist. Do not try
 * catching it. TODO: In the future, try and handle this error.
 */
async function loadVaultPasswordsFromFile() {
    metaLog("database", "INFO", `Loading vault passwords into memory from file... (${vaultPasswordFile})`);
    
    const stream = createReadStream(vaultPasswordFile);
    const readlineInterface = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    for await(const line of readlineInterface) {
        if(line === "") continue;
        const [vaultName, password] = line.split(",");
        vaultPasswordMap.set(vaultName, password);
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", "Finished loading vault passwords from file.");
}

/**
 * Will be called every time vault is created, password is changed, or vault is removed.
 * 
 * Should be relatively fast, and each of the operations above will be performed sequentially
 * so there should be no conflicts.
 * 
 * Returns an array of CustomErrors. If successful, the array will be empty..
 * 
 * Errors: `VAULTPASSWORD_NONEXISTANT`, `VAULTPASSWORDS_OLD_NONEXISTANT`
 * 
 * @returns Promise<Array<CustomError>>
 */
async function saveVaultPasswordsToFile(): Promise<Array<CustomError>> {
    metaLog("database", "INFO", "Saving vault passwords to file...");
    // Write to temp file, replace main with temp
    const tempFilePath = path.join(process.cwd(), "database", "tempVaultPasswords.csv");
    
    let file: fs.FileHandle;
    try {
        file = await fs.open(tempFilePath, "w");
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to save vault passwords to temp file, but encountered unrecognized error "${message}" while opening temp file. Aborting...`;
        metaLog("database", "ERROR", reason);
        return [ new CustomError(reason, "ERROR", (error as NodeJS.ErrnoException).code) ];
    }
    
    // Writing to temp file
    try {
        for(const [vault, password] of vaultPasswordMap) {
            await file.appendFile(`${vault},${password}\n`);
        }
        await file.close();
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to write vault password pairs to temp file, but encountered error "${message}" while writing. Aborting...`;
        metaLog("database", "ERROR", reason);
        await file.close();
        await fs.unlink(tempFilePath);
        return [ new CustomError(message, "ERROR", (error as NodeJS.ErrnoException).code) ];
    }

    const errors: CustomError[] = [];

    const realFilePath = vaultPasswordFile;
    const oldFilePath = path.join(process.cwd(), "database", "vaultPasswords.csv.old");
    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstVaultSave) {
                const reason = `vaultPasswords.csv is somehow nonexistant. Ignoring and continuing.`
                metaLog("database", "WARNING", reason);
                errors.push(new CustomError(reason, "WARNING", "VAULTPASSWORDS_NONEXISTANT"));
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while renaming vaultPasswords.csv.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        const reason = `There was an error "${message}" renaming tempVaultPasswords.csv to vaultPasswords.csv.`;
        metaLog("database", "ERROR", reason);
        errors.push(new CustomError(reason, "ERROR", code));
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstVaultSave) {
                const reason = `There was an error unlinking vaultPasswords.csv.old because it does not exist.`;
                metaLog("database", "ERROR", reason);
                errors.push(new CustomError(reason, "ERROR", "VAULTPASSWORDS_OLD_NONEXISTANT"))
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while unlinking vaultPasswords.csv.old.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });
        
    if(errors.length == 0) {
        metaLog("database", "INFO", "Successfully saved vault passwords from in-memory database to file.");
    } else {
        metaLog("database", "INFO", "Saved vault passwords from in-memory database to file with warnings / errors.");
    }
    return errors;
}

async function localSetVaultPassword(vault: string, password: string) {
    vaultPasswordMap.set(vault, password);
    await saveVaultPasswordsToFile();
    await localSetVaultNonce(vault);
}

function localVerifyVaultPassword(vault: string, password: string) {
    return password === vaultPasswordMap.get(vault);
}

function localVaultExists(vault: string) {
    return vaultPasswordMap.has(vault);
}

async function localDeleteVaultPassword(vault: string) {
    vaultPasswordMap.delete(vault);
    await saveVaultPasswordsToFile();
    await localDeleteVaultNonce(vault);
}

async function loadVaultNoncesFromFile() {
    metaLog("database", "INFO", `Loading vault nonces into memory from file... (${vaultNonceFile})`);
    
    const stream = createReadStream(vaultNonceFile);
    const readlineInterface = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    for await(const line of readlineInterface) {
        if(line === "") continue;
        const [vaultName, nonce] = line.split(",");
        vaultNonceMap.set(vaultName, parseInt(nonce));
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", "Finished loading vault nonces from file.");
}

/**
 * Each vault as an associated nonce. The nonce changes when the vault password
 * changes. This prevents JWTs from remaining valid across password changes, as
 * each time it's verified, it's nonces will be compared to the current nonce.
 * 
 */
async function saveVaultNoncesToFile(): Promise<Array<CustomError>> {
    metaLog("database", "INFO", "Saving vault nonces to file...");
    // Write to temp file, replace main with temp
    const tempFilePath = path.join(process.cwd(), "database", "tempVaultNonces.csv");
    
    let file: fs.FileHandle;
    try {
        file = await fs.open(tempFilePath, "w");
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to save vault nonces to file, but encountered unrecognized error "${message}" while opening temp file. Aborting...`;
        metaLog("database", "ERROR", reason);
        return [ new CustomError(reason, "ERROR", (error as NodeJS.ErrnoException).code) ];
    }
    
    // Writing to temp file
    try {
        for(const [vault, nonce] of vaultNonceMap) {
            await file.appendFile(`${vault},${nonce}\n`);
        }
        await file.close();
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to write vault nonce pairs to temp file, but encountered error "${message}" while writing. Aborting...`;
        metaLog("database", "ERROR", reason);
        await file.close();
        await fs.unlink(tempFilePath);
        return [ new CustomError(message, "ERROR", (error as NodeJS.ErrnoException).code) ];
    }
    
    const errors: CustomError[] = [];
    
    const realFilePath = vaultNonceFile;
    const oldFilePath = path.join(process.cwd(), "database", "vaultNonces.csv.old");
    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstVaultSave) {
                const reason = `vaultNonces.csv is somehow nonexistant. Ignoring and continuing.`
                metaLog("database", "WARNING", reason);
                errors.push(new CustomError(reason, "WARNING", "VAULTNONCES_NONEXISTANT"));
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while renaming vaultNonces.csv.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        const reason = `There was an error "${message}" renaming tempVaultNonces.csv to vaultNonces.csv.`;
        metaLog("database", "ERROR", reason);
        errors.push(new CustomError(reason, "ERROR", code));
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstVaultSave) {
                const reason = `There was an error unlinking vaultNonces.csv.old because it does not exist.`;
                metaLog("database", "ERROR", reason);
                errors.push(new CustomError(reason, "ERROR", "VAULTNONCES_OLD_NONEXISTANT"))
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while unlinking vaultNonces.csv.old.`;
            metaLog("database", "ERROR", reason);
            errors.push(new CustomError(reason, "ERROR", code));
        }
    });

    if(errors.length == 0) {
        metaLog("database", "INFO", "Successfully saved vault passwords from in-memory database to file.");
    } else {
        metaLog("database", "INFO", "Saved vault passwords from in-memory database to file with warnings / errors.");
    }
    return errors;
}

function localVerifyVaultNonce(vault: string, nonce: number) {
    return nonce === vaultNonceMap.get(vault);
}

function localGetVaultNonce(vault: string): number | undefined {
    return vaultNonceMap.get(vault);
}

async function localSetVaultNonce(vault: string) {
    let nonce = Math.floor(Math.random() * 4294967295);
    while(localVerifyVaultNonce(vault, nonce)) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    vaultNonceMap.set(vault, nonce);
    await saveVaultNoncesToFile();
}

async function localDeleteVaultNonce(vault: string) {
    vaultNonceMap.delete(vault);
    await saveVaultNoncesToFile();
}

export type NodeType = InstanceType<typeof Node>;
export {
    loadOutdatedTokensFromFile as _loadOutdatedTokensFromFile,
    saveOutdatedTokensToFile as _saveOutdatedTokensToFile,
    localAddOutdatedToken,
    localIsOutdatedToken,
    purgeAllOutdated as _purgeAllOutdated,

    loadVaultPasswordsFromFile as _loadVaultPasswordsFromFile,
    saveVaultPasswordsToFile as _saveVaultPasswordsToFile,
    localSetVaultPassword,
    localVerifyVaultPassword,
    localVaultExists,
    localDeleteVaultPassword,

    loadVaultNoncesFromFile as _loadVaultNoncesFromFile,
    saveVaultNoncesToFile as _saveVaultNoncesToFile,
    localVerifyVaultNonce,
    localGetVaultNonce,
    localDeleteVaultNonce,

    tokenList as _tokenList,
    tokenSet as _tokenSet,
    vaultPasswordMap as _vaultPasswordMap,
    vaultNonceMap as _vaultNonceMap,
};