import { File, Directory } from "./vfs";

function unixTime() {
    return Math.floor(Date.now() / 1000);
}

function sortByName(first: File | Directory, second: File | Directory) {
    if(first.isDirectory != second.isDirectory) {
        return first.isDirectory ? -1 : 1;
    } else {
        return first.name.localeCompare(second.name);
    }
}

export { unixTime, sortByName };