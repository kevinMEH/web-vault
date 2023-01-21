import { unixTime } from "./helper.js"

const purgeInterval = parseInt(process.env.PURGE_INTERVAL as string) || 60 * 60 * 24; // Default is every day


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

const set: Set<string> = new Set();
const list = new LinkedList({ token: "sentinel", expireAt: 2147483646 });

// TODO: Load from files
// TODO: Save database to files

if(process.env.PRODUCTION) {
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





// Add outdated token
async function localAddOutdatedToken(token: string, expireAt: number) {
    set.add(token);
    await list.add({ token, expireAt });
}

function localIsOutdated(token: string) {
    return set.has(token);
}

async function purgeAllOutdated() {
    while(!list.setBusy()) { // Try for a lock
        await new Promise(resolve => setTimeout(resolve, 250)); // Busy, wait 250 ms
    }

    const time = unixTime() - 5;
    let lastValid: Node = list.head;
    let current: Node | null = list.head;
    while(current) {
        if(current.getExp() < time) { // Has expired already, remove from list and set
            set.delete(current.value.token);
            lastValid.next = current.next;
        } else { // Not expired, update lastValid
            lastValid = current;
        }
        current = lastValid.next;
    }
    list.tail = lastValid;
    
    // Release lock
    list.busy = false;
}

export type NodeType = InstanceType<typeof Node>;
export { localAddOutdatedToken, localIsOutdated, purgeAllOutdated, list as _list };