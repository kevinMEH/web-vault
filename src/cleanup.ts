import { close } from "./authentication/database/redis";
import { metaLog } from "./logger";

const intervals: Array<[string, Function, number, boolean]> = [];

function addInterval(intervalName: string, intervalFunction: Function, interval: number, runBeforeShutdown: boolean) {
    const identifier = setInterval(intervalFunction, interval); // eslint-disable-line
    intervals.push([intervalName, intervalFunction, identifier, runBeforeShutdown]);
}

async function runClearIntervals() {
    for(const [intervalName, intervalFunction, identifier, runBeforeShutdown] of intervals) {
        console.log("Clearing interval " + intervalName);
        clearInterval(identifier);
        if(runBeforeShutdown) {
            console.log("Running interval function one last time for " + intervalName);
            await intervalFunction();
        }
    }
}

type TimeoutInfo = {
    timeoutName: string,
    timeoutFunction: Function,
    timeoutIdentifier: NodeJS.Timeout,
    theoreticalExecutionTime: number
}
const timeouts: TimeoutInfo[] = [];

// Cleans up after self after it is finished executing runFunction
function runFunctionAndSelfDelete(runFunction: Function, selfTimeoutInfo: TimeoutInfo) {
    runFunction();
    for(let i = 0; i < timeouts.length; i++) {
        if(timeouts[i] === selfTimeoutInfo) {
            timeouts.splice(i, 1);
            return;
        }
    }
    metaLog("runtime", "ERROR", "Attempting to delete timeout with identified by " + selfTimeoutInfo + " from timeouts, but it does not exist.");
}

function addLongTimeout(timeoutName: string, timeoutFunction: Function, delay: number) {
    const theoreticalExecutionTime = Date.now() + delay;
    const timeoutInfo: TimeoutInfo = {
        timeoutName,
        timeoutFunction,
        timeoutIdentifier: undefined as any,
        theoreticalExecutionTime
    };
    timeouts.push(timeoutInfo);
    timeoutInfo.timeoutIdentifier = setTimeout(() => runFunctionAndSelfDelete(timeoutFunction, timeoutInfo), delay); // eslint-disable-line
}

async function runClearTimeouts() {
    for(let i = 0; i < timeouts.length; i++) {
        const { timeoutName, timeoutFunction, timeoutIdentifier, theoreticalExecutionTime } = timeouts[i];
        if(theoreticalExecutionTime >= Date.now()) { // Hasn't executed yet
            console.log("Clearing timeout " + timeoutName);
            clearTimeout(timeoutIdentifier);
            console.log("Running timeout function for " + timeoutName + " immediately.");
            await timeoutFunction();
        } else { // Should've executed, but somehow still not removed
            metaLog("runtime", "ERROR", `While running cleanup, the timeout ${timeoutName} should've been executed at ${theoreticalExecutionTime} (which was ${Date.now() - theoreticalExecutionTime} ms ago) but has not been removed from timeouts.`);
        }
    }
}

async function cleanup() {
    console.log("Closing Redis connection...");
    await close();
    console.log("Closed.");

    console.log("Clearing intervals...");
    await runClearIntervals();
    console.log("Intervals cleared.");
    
    console.log("Clearing timeouts...");
    await runClearTimeouts();
    console.log("Timeouts cleared.");
    
    console.log("Done.");

    console.log("If the application still have not exited by this point, please wait 5 more seconds. If it has not exitted after 5 more seconds, there may be a problem.");
    // 5 seconds = deletion timeout for vault and VFS files
}

async function shutdown() {
    await cleanup();
    process.exit();
}

export { addInterval, addLongTimeout, cleanup, shutdown };