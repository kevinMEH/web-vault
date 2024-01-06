import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline/promises";
import path from "path";
import { unixTime } from "../../helper"
import { metaLog } from "../../logger";

import { PRODUCTION, USING_REDIS, PURGE_INTERVAL, DATABASE_SAVE_INTERVAL } from "../../env";

type TokenPair = {
    token: string,
    expireAt: number
}

class LinkedList {
    head: Node;
    tail: Node;

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

// First time flags for tokens database and vault credentials database
let firstTokenSave = true;
let firstVaultSave = true;

const tokenSet: Set<string> = new Set();
const tokenList = new LinkedList({ token: "sentinel", expireAt: 2147483646 });

const vaultCredentialsMap: Map<string, [string, number]> = new Map();

const outdatedTokensFile = path.join(process.cwd(), "database", "outdated_tokens.csv");
const vaultCredentialsFile = path.join(process.cwd(), "database", "vault_credentials.csv");

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

    await saveOutdatedTokensToFile();
    firstTokenSave = false;

    try {
        await fs.access(vaultCredentialsFile);
        await loadVaultCredentialsFromFile();
    } catch(error) {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            metaLog("database", "WARNING", "No vault credentials database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if ${vaultCredentialsFile} exists.`);
        }
    }

    await saveVaultCredentialsToFile();
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
 */
async function saveOutdatedTokensToFile(): Promise<void> {
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
            return;
        } else {
            const reason = `Encountered unrecognized error "${message}" while opening temp file for saving tokens database. Aborting...`;
            metaLog("database", "ERROR", reason);
            return;
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
    }
    

    let catastrophic = false;
    let noncatastrophic = false;

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
                noncatastrophic = true;
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while renaming outdatedTokens.csv.`;
            metaLog("database", "ERROR", reason);
            noncatastrophic = true;
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        const reason = `There as an error "${message}" renaming tempOutdatedTokens.csv to outdatedTokens.csv.`;
        metaLog("database", "ERROR", reason);
        catastrophic = true;
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        const code = (error as NodeJS.ErrnoException).code;
        if(code === "ENOENT") {
            if(!firstTokenSave) {
                const reason = `There was an error unlinking outdatedTokens.csv.old because it does not exist.`;
                metaLog("database", "ERROR", reason);
                noncatastrophic = true;
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while unlinking outdatedTokens.csv.old.`;
            metaLog("database", "ERROR", reason);
            noncatastrophic = true;
        }
    });

    if(!noncatastrophic && !catastrophic) {
        metaLog("database", "INFO", `Successfully saved in-memory outdated tokens database to file.`);
    } else if(catastrophic) {
        metaLog("database", "INFO", `Failed to save in-memory outdated tokens database to file.`);
    } else {
        metaLog("database", "INFO", `Saved in-memory outdated tokens database to file with warnings and/or errors.`);
    }
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
}

/**
 * An uncatchable error will be thrown if the file does not exist. Do not try
 * catching it. TODO: In the future, try and handle this error.
 */
async function loadVaultCredentialsFromFile() {
    metaLog("database", "INFO", `Loading vault credentials into memory from file ${vaultCredentialsFile}`);
    
    const stream = createReadStream(vaultCredentialsFile);
    const readlineInterface = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    for await(const line of readlineInterface) {
        if(line === "") continue;
        const parts = line.split(",");
        if(parts.length != 3) {
            metaLog("database", "ERROR", `While loading vault credentials, encountered line with one or more fields missing: ${line}`);
            continue;
        }
        const [ vaultName, password, nonceString ] = parts;
        const nonce = parseInt(nonceString);
        if(isNaN(nonce)) {
            metaLog("database", "ERROR", `While loading vault credentials, encountered line with invalid nonce: ${line}`)
            continue;
        }
        vaultCredentialsMap.set(vaultName, [ password, nonce ]);
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", `Finished loading vault credentials from file ${vaultCredentialsFile}`);
}

/**
 * Will be called every time vault is created, password is changed, or vault is removed.
 * 
 * Should be relatively fast, and each of the operations above will be performed sequentially
 * so there should be no conflicts.
 */
async function saveVaultCredentialsToFile(): Promise<void> {
    metaLog("database", "INFO", `Saving vault credentials to file ${vaultCredentialsFile}`);
    // Write to temp file, then replace main with temp once complete
    const tempFilePath = vaultCredentialsFile + ".temp";
    
    let file: fs.FileHandle;
    try {
        file = await fs.open(tempFilePath, "w");
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to save vault credentials to temp file ${tempFilePath}, but encountered unrecognized error "${message}" while opening temp file. Aborting...`;
        metaLog("database", "ERROR", reason);
        return;
    }
    
    // Writing to temp file
    try {
        for(const [vault, [password, nonce]] of vaultCredentialsMap) {
            await file.appendFile(`${vault},${password},${nonce}\n`)
        }
        await file.close()
    } catch(error) {
        const message = (error as Error).message;
        const reason = `Trying to save vault credentials to temp file ${tempFilePath}, but encountered unrecognized error "${message}" while writing. Aborting...`
        metaLog("database", "ERROR", reason);
        await file.close();
        await fs.unlink(tempFilePath);
        return;
    }

    let catastrophic = false;
    let noncatastrophic = false;

    const realFilePath = vaultCredentialsFile;
    const oldFilePath = vaultCredentialsFile + ".old";
    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        if((error as NodeJS.ErrnoException).code == "ENOENT") {
            if(!firstVaultSave) {
                const reason = `${realFilePath} is somehow nonexistant. Ignoring and continuing.`;
                metaLog("database", "WARNING", reason);
                noncatastrophic = true;
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while renaming ${realFilePath} to ${oldFilePath}.`
            metaLog("database", "ERROR", reason);
            noncatastrophic = true;
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        const reason = `Encountered unrecognized error "${message}" while renaming ${tempFilePath} to ${realFilePath}.`
        metaLog("database", "ERROR", reason);
        catastrophic = true;
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        if((error as NodeJS.ErrnoException).code === "ENOENT") {
            if(!firstVaultSave) {
                const reason = `${oldFilePath} is somehow nonexistant. Ignoring and continuing.`;
                metaLog("database", "ERROR", reason);
                noncatastrophic = true;
            }
        } else {
            const reason = `Encountered unrecognized error "${message}" while unlinking ${oldFilePath}`;
            metaLog("database", "ERROR", reason);
            noncatastrophic = true;
        }
    });
        
    if(!noncatastrophic && !catastrophic) {
        metaLog("database", "INFO", "Successfully saved vault credentials from in-memory database to file.");
    } else if(catastrophic) {
        metaLog("database", "INFO", "Failed to save vault credentials from in-memory database to file.");
    } else {
        metaLog("database", "INFO", "Saved vault credentials from in-memory database to file with warnings and/or errors.");
    }
}

async function localSetVaultPassword(vault: string, password: string) {
    let nonce = Math.floor(Math.random() * 4294967295);
    while(vaultCredentialsMap.get(vault)?.[1] === nonce) {
        nonce = Math.floor(Math.random() * 4294967295);
    }
    vaultCredentialsMap.set(vault, [password, nonce]);
    await saveVaultCredentialsToFile();
}

function localVerifyVaultPassword(vault: string, password: string) {
    return password === vaultCredentialsMap.get(vault)?.[0];
}

function localVaultExists(vault: string) {
    return vaultCredentialsMap.has(vault);
}

async function localDeleteVault(vault: string) {
    vaultCredentialsMap.delete(vault);
    await saveVaultCredentialsToFile();
}

function localGetVaultNonce(vault: string): number | undefined {
    return vaultCredentialsMap.get(vault)?.[1];
}

function localVerifyVaultNonce(vault: string, nonce: number) {
    return vaultCredentialsMap.get(vault)?.[1] === nonce;
}

export type NodeType = InstanceType<typeof Node>;
export {
    loadOutdatedTokensFromFile as _loadOutdatedTokensFromFile,
    saveOutdatedTokensToFile as _saveOutdatedTokensToFile,
    purgeAllOutdated as _purgeAllOutdated,

    loadVaultCredentialsFromFile as _loadVaultCredentialsFromFile,
    saveVaultCredentialsToFile as _saveVaultCredentialsToFile,

    localIsOutdatedToken,
    localAddOutdatedToken,

    localSetVaultPassword,
    localVerifyVaultPassword,
    localVaultExists,
    localDeleteVault,

    localGetVaultNonce,
    localVerifyVaultNonce,

    tokenList as _tokenList,
    tokenSet as _tokenSet,
    vaultCredentialsMap as _vaultCredentialsMap,
};