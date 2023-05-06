import { close } from "../src/authentication/redis.js";

const intervals: number[] = [];

function addInterval(interval: number) {
    intervals.push(interval);
}

function clearIntervals() {
    for(const interval of intervals) {
        clearInterval(interval);
    }
}

async function cleanup() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");
    console.log("Clearing intervals...");
    clearIntervals();
    console.log("Intervals cleared.");
    
    console.log("Done.");
}

async function shutdown() {
    await cleanup();
}

export { addInterval, cleanup, shutdown };