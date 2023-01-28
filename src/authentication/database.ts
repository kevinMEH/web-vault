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
    
    async add(value: TokenPair) {
        while(!this.setBusy()) { // Try for a lock
            await new Promise(resolve => setTimeout(resolve, 250)); // Another script is busy, wait 250 ms
        }
        
        this.tail = this.tail.add(value);
        
        // Release locks
        this.busy = false;
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

const tokenSet: Set<string> = new Set();
const tokenList = new LinkedList({ token: "sentinel", expireAt: 2147483646 });

const outdatedTokensDatabaseFile = path.join(process.cwd(), "database", "outdatedTokens.csv");

if(process.env.PRODUCTION && process.env.REDIS == undefined) {
    try {
        await fs.access(outdatedTokensDatabaseFile);
        await loadOutdatedTokensFromFile();
    } catch(error) {
        if((error as Error).message.includes("no such file")) {
            metaLog("database", "WARNING", "No outdated tokens database file found, skipping load from database. If this is your first time running Web Vault, this is normal, you can safely ignore this message.");
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${(error as Error).message}" while checking if outdated tokens database file exists.`);
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
    metaLog("database", "INFO", "Loading outdated tokens into memory from file...");

    const stream = createReadStream(outdatedTokensDatabaseFile);
    const readlineInterface = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    for await(const line of readlineInterface) {
        if(line === "") continue;
        const parts = line.split(",");
        const token = parts[0].substring(1, parts[0].length - 1);
        const expireAt = parseInt(parts[1]);
        await localAddOutdatedToken(token, expireAt);
    }
    
    readlineInterface.close();
    stream.close();
    
    metaLog("database", "INFO", "Finished loading oudated tokens from file.");
}

let firstTime = true;
async function saveOutdatedTokensToFile() {
    metaLog("database", "INFO", "Saving in-memory outdated tokens database to file...")
    // We will write to a temp file and replace the main file with temp file
    // after we finish writing.
    const tempFilePath = path.join(process.cwd(), "database", "tempOutdatedTokens.csv");

    // Attempting temp file creation. Expecting file to be not there.
    let file: fs.FileHandle;
    try {
        file = await fs.open(tempFilePath, "ax");
    } catch(error) {
        if((error as Error).message.includes("file already exists")) {
            metaLog("database", "ERROR",
            `Trying to save tokens database to file, but temp file already exists. This means that there is currently an ongoing tokens database save operation, or that the last operation has completed unsuccessfully. Waiting 15 seconds and retrying...`);
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${(error as Error).message}" while opening temp file for saving tokens database. Waiting 15 seconds and retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, 15000));

        try {
            file = await fs.open(tempFilePath, "ax");
        } catch(error) {
            if((error as Error).message.includes("file already exists")) {
                metaLog("database", "ERROR",
                `Trying to save tokens database to file (2nd try), but temp file still exists. Truncating file and continuing.`);
                file = await fs.open(tempFilePath, "w");
            } else {
                metaLog("database", "ERROR",
                `Encountered unrecognized error "${(error as Error).message}" while opening temp file for saving tokens database (2nd try). Aborting save operation.`);
                return;
            }
        }
    }
    
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
    const realFilePath = outdatedTokensDatabaseFile;
    const oldFilePath = path.join(process.cwd(), "database", "outdatedTokens.csv.old");
    try {
        await fs.rename(realFilePath, oldFilePath);
    } catch(error) {
        if((error as Error).message.includes("no such file")) {
            if(!firstTime) {
                metaLog("database", "WARNING",
                `outdatedTokens.csv is somehow nonexistant. Ignoring and continuing.`);
            }
        } else {
            metaLog("database", "ERROR",
            `Encountered unrecognized error "${(error as Error).message}" while renaming outdatedTokens.csv.`);
        }
    } finally {
        await fs.rename(tempFilePath, realFilePath);
        await fs.unlink(oldFilePath).catch(error => {
            if((error as Error).message.includes("no such file")) {
                if(!firstTime) {
                    metaLog("database", "ERROR",
                    `There was an error unlinking outdatedTokens.csv.old (old tokens database file.)`);
                }
            } else {
                metaLog("database", "ERROR",
                `Encountered unrecognized error "${(error as Error).message}" while unlinking outdatedTokens.csv.old.`);
            }
        });

        if(firstTime) {
            firstTime = false;
        }

        metaLog("database", "INFO", `Finished saving in-memory outdated tokens database to file.`);
    }
}

// Add outdated token
async function localAddOutdatedToken(token: string, expireAt: number) {
    tokenSet.add(token);
    await tokenList.add({ token, expireAt });
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
}

export type NodeType = InstanceType<typeof Node>;
export { loadOutdatedTokensFromFile, saveOutdatedTokensToFile, localAddOutdatedToken, localIsOutdatedToken, purgeAllOutdated, tokenList as _tokenList, tokenSet as _tokenSet };