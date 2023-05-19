import { close } from "./authentication/database/redis";

const intervals: Array<[Function, number]> = [];

function addInterval(intervalFunction: Function, interval: number) {
    intervals.push([intervalFunction, interval]);
}

async function runClearIntervals() {
    for(const [intervalFunction, interval] of intervals) {
        await intervalFunction();
        clearInterval(interval);
    }
}

async function cleanup() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");
    console.log("Clearing intervals...");
    runClearIntervals();
    console.log("Intervals cleared.");
    
    console.log("Done.");
}

async function shutdown() {
    await cleanup();
    process.exit();
}

export { addInterval, cleanup, shutdown };