import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline/promises";
import path from "path";
import { unixTime } from "../helper.js"
import { metaLog } from "../logger.js";

const purgeInterval = parseInt(process.env.PURGE_INTERVAL as string) || 60 * 60 * 24; // Default is every day

const databaseSaveInterval = parseInt(process.env.DATABASE_SAVE_INTERVAL as string) || 60 * 60; // Default is once per hour

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
    
    // Atomic function for setting busy to true. Returns false if busy.
    setBusy() {
        if(this.busy) {
            return false;
        } else {
            return this.busy = true;
        }
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

const outdatedTokensFile = path.join(process.cwd(), "database", "outdatedTokens.csv");
const vaultPasswordFile = path.join(process.cwd(), "database", "vaultPasswords.csv");

if(process.env.PRODUCTION && process.env.REDIS == undefined) {
    try {
        await fs.access(outdatedTokensFile);
        await loadOutdatedTokensFromFile();
    } catch(error) {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            metaLog("database", "WARNING", "No outdated tokens database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if outdated tokens database file exists.`);
        }
    }

    try {
        await fs.access(vaultPasswordFile);
        await loadVaultPasswordsFromFile();
    } catch(error) {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            metaLog("database", "WARNING", "No vault passwords database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while checking if outdated tokens database file exists.`);
        }
    }
    
    // Interval for saving database to file. Default is once per hour.
    setInterval(() => {
        saveOutdatedTokensToFile();
    }, databaseSaveInterval);

    // Interval for purging. Default is once per day.
    // If an offset is specified, the initial interval function will be delayed
    // by the amount of offset.
    if(process.env.FIRST_PURGE_OFFSET) {
        setTimeout(() => {
            setInterval(() => {
                purgeAllOutdated();
            }, purgeInterval * 1000);
        }, parseInt(process.env.FIRST_PURGE_OFFSET) * 1000)
    } else {
        setInterval(() => {
            purgeAllOutdated();
        }, purgeInterval * 1000);
    }
}

// --------------------



// File database/outdatedTokens.csv must exist for this operation to succeed.
// An uncatchable error will be thrown if the file does not exist. Do not try
// catching it. TODO: In the future, try and handle this error
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

async function saveOutdatedTokensToFile() {
    metaLog("database", "INFO", "Saving in-memory outdated tokens database to file...")
    // We will write to a temp file and replace the main file with temp file
    // after we finish writing.
    const tempFilePath = path.join(process.cwd(), "database", "tempOutdatedTokens.csv");

    // Attempting temp file creation. Expecting file to be not there.
    let exit = false;
    const file = await fs.open(tempFilePath, "ax")
    .catch(async error => {
        const message = (error as Error).message;
        if(message.includes("file already exists")) {
            metaLog("database", "ERROR",
            `Trying to save tokens database to file, but temp file already exists. This means that there is currently an ongoing tokens database save operation, or that the last operation has completed unsuccessfully. Waiting 15 seconds and retrying...`);
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while opening temp file for saving tokens database. Waiting 15 seconds and retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, 15000));
        return fs.open(tempFilePath, "ax");
    }).catch(error => {
        const message = (error as Error).message;
        if(message.includes("file already exists")) {
            metaLog("database", "ERROR",
            `Trying to save tokens database to file (2nd try), but temp file still exists. Truncating file and continuing.`);
            return fs.open(tempFilePath, "w");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while opening temp file for saving tokens database (2nd try). Aborting save operation.`);
            exit = true;
            return null;
        }
    });
    
    if(exit || file === null) return;
    
    // Writing to temp file
    let current = tokenList.head.next; // Sentinel is automatically added so is not written.
    while(current) {
        const value = current.value;
        await file.appendFile(`"${value.token}",${value.expireAt}\n`);
        current = current.next;
    }
    await file.close();
    

    // Replacing main file with temp file
    // Main file -> Old file
    // Temp file -> Main file
    // Unlink Old file
    const realFilePath = outdatedTokensFile;
    const oldFilePath = path.join(process.cwd(), "database", "outdatedTokens.csv.old");

    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            if(!firstTokenSave) {
                metaLog("database", "WARNING",
                `outdatedTokens.csv is somehow nonexistant. Ignoring and continuing.`);
            }
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while renaming outdatedTokens.csv.`);
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        metaLog("database", "ERROR",
        `There as an error "${message}" renaming tempOutdatedTokens.csv to outdatedTokens.csv.`)
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            if(!firstTokenSave) {
                metaLog("database", "ERROR",
                `There was an error unlinking outdatedTokens.csv.old because it does not exist.`);
            }
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while unlinking outdatedTokens.csv.old.`);
        }
    });

    if(firstTokenSave) {
        firstTokenSave = false;
    }

    metaLog("database", "INFO", `Finished saving in-memory outdated tokens database to file.`);
}

// Add outdated token
function localAddOutdatedToken(token: string, expireAt: number) {
    tokenSet.add(token);
    tokenList.add({ token, expireAt });
}

function localIsOutdatedToken(token: string) {
    return tokenSet.has(token);
}

async function purgeAllOutdated() {
    while(!tokenList.setBusy()) { // Try for a lock
        await new Promise(resolve => setTimeout(resolve, 250)); // Busy, wait 250 ms
    }

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



// File database/vaultPasswords.csv must exist for this operation to succeed.
// An uncatchable error will be thrown if the file does not exist. Do not try
// catching it. TODO: In the future, try and handle this error
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
        localSetVaultPassword(vaultName, password);
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", "FInished loading vault passwords from file.");
}

// Will be called every time vault is created, password is changed, or vault is removed.
// Should be relatively fast, and each of the operations above will be performed sequentially
// so there should be no conflicts.
// Returns an explanation message if unsuccessful, otherwise returns undefined.
async function saveVaultPasswordsToFile() {
    metaLog("database", "INFO", "Saving vault passwords to file...");
    // Write to temp file, replace main with temp
    const tempFilePath = path.join(process.cwd(), "database", "tempVaultPasswords.csv");
    
    let reason = "";
    const file = await fs.open(tempFilePath, "w")
    .catch(error => {
        reason = `Trying to save vault passwords to temp file, but encountered unrecognized error "${(error as Error).message}" while opening temp file. Aborting...`;
        metaLog("database", "ERROR", reason);
    }) as fs.FileHandle;
    if(reason !== ""){
        return reason;
    }


    // Writing to temp file
    for(const [vault, password] of vaultPasswordMap) {
        await file.appendFile(`${vault},${password}\n`);
    }
    await file.close();
    

    const realFilePath = vaultPasswordFile;
    const oldFilePath = path.join(process.cwd(), "database", "vaultPasswords.csv.old");
    await fs.rename(realFilePath, oldFilePath).catch(error => {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            if(!firstVaultSave) {
                metaLog("database", "WARNING",
                `vaultPasswords.csv is somehow nonexistant. Ignoring and continuing.`);
            }
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while renaming vaultPasswords.csv.`)
        }
    });
    await fs.rename(tempFilePath, realFilePath).catch(error => {
        const message = (error as Error).message;
        metaLog("database", "ERROR",
        `There was an error "${message}" renaming tempVaultPasswords.csv to vaultPasswords.csv.`);
    });
    await fs.unlink(oldFilePath).catch(error => {
        const message = (error as Error).message;
        if(message.includes("no such file")) {
            if(!firstVaultSave) {
                metaLog("database", "ERROR",
                `There was an error unlinking vaultPasswords.csv.old because it does not exist.`);
            }
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${message}" while unlinking vaultPasswords.csv.old.`);
        }
    });
        
    if(firstVaultSave) {
        firstVaultSave = false;
    }
    
    metaLog("database", "INFO", "Finished saving vault passwords from in-memory database to file.");
}

function localSetVaultPassword(vault: string, password: string) {
    vaultPasswordMap.set(vault, password);
}

function localVerifyVaultPassword(vault: string, password: string) {
    return password === vaultPasswordMap.get(vault);
}

function localVaultExists(vault: string) {
    return vaultPasswordMap.has(vault);
}

function localDeleteVaultPassword(vault: string) {
    vaultPasswordMap.delete(vault);
}

export type NodeType = InstanceType<typeof Node>;
export {
    loadOutdatedTokensFromFile,
    saveOutdatedTokensToFile,
    localAddOutdatedToken,
    localIsOutdatedToken,
    purgeAllOutdated,

    loadVaultPasswordsFromFile,
    saveVaultPasswordsToFile,
    localSetVaultPassword,
    localVerifyVaultPassword,
    localVaultExists,
    localDeleteVaultPassword,

    tokenList as _tokenList,
    tokenSet as _tokenSet,
    vaultPasswordMap as _vaultPasswordMap
};