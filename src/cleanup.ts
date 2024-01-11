import { close } from "./authentication/database/redis";

const intervals: Array<[string, Function, number, boolean]> = [];

function addInterval(intervalName: string, intervalFunction: Function, interval: number, runBeforeShutdown: boolean) {
    const identifier = setInterval(intervalFunction, interval); // eslint-disable-line
    intervals.push([intervalName, intervalFunction, identifier, runBeforeShutdown]);
}

async function runClearIntervals() {
    for(const [intervalName, intervalFunction, identifier, runBeforeShutdown] of intervals) {
        console.log("Clearing interval " + intervalName)
        clearInterval(identifier);
        if(runBeforeShutdown) {
            console.log("Running interval function one last time for " + intervalName);
            await intervalFunction();
        }
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