import { File, Directory } from "./vfs";

const allDotRegex = /^\.+$/;
const endsInSpaceRegex = /^.* $/
const incompleteValidNameRegex = /^[a-zA-Z0-9_.][a-zA-Z0-9_\-. ]*$/;
const maximumNameLength = 72;

/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 * Only matches a single entry, most often the vault's name.
 */
function validName(name: string) {
    if(name.length > maximumNameLength) {
        return false;
    }
    if(allDotRegex.test(name)) {
        return false;
    }
    return name.length <= maximumNameLength
        && allDotRegex.test(name) === false
        && endsInSpaceRegex.test(name) === false
        && incompleteValidNameRegex.test(name) === true;
}

/**
 * Allowed characters: Alpha numerical, "_", "-", ".", " "
 * Names consisting only of dots and spaces not allowed.
 * There must be at least one entry after the vault name.
 */
function validPath(path: string) {
    const parts = path.split("/");
    return parts.length >= 2 && parts.every(part => validName(part));
}

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

function timeAgo(date: Date): string {
    const current = new Date();
    let difference = current.getTime() - date.getTime(); // Milliseconds
    if(difference < 5000) return "right now";
    difference = Math.floor(difference / 1000); // Seconds
    if(difference < 60) return difference + " seconds ago";
    difference = Math.floor(difference / 60); // Minutes
    if(difference == 1) return difference + " minute ago";
    if(difference < 60) return difference + " minutes ago";
    difference = Math.floor(difference / 60); // Hours
    if(difference == 1) return difference + " hour ago";
    if(difference < 24) return difference + " hours ago";
    difference = Math.floor(difference / 24); // Days
    if(difference == 1) return difference + " day ago";
    if(difference < 28) return difference + " days ago";
    difference = Math.floor(difference / 7); // Weeks
    if(difference < 9) return difference + " weeks ago";
    let months = (date.getFullYear() - current.getFullYear()) * 12;
    months -= date.getMonth();
    months += date.getMonth();
    if(months < 12) return months + " months ago";
    return (date.getFullYear() - current.getFullYear()) + " years ago";
}

function convertBytes(bytes: number): string {
    let postfix: string;
    if(bytes < 1024) {
        postfix = " B";
    } else if((bytes /= 1024) < 1024) {
        postfix = " kB";
        // eslint-disable-next-line no-dupe-else-if
    } else if((bytes /= 1024) < 1024) {
        postfix = " MB";
        // eslint-disable-next-line no-dupe-else-if
    } else if((bytes /= 1024) < 1024) {
        postfix = " GB";
    } else {
        bytes = bytes / 1024;
        postfix = " TB";
    }
    const byteString = bytes.toString();
    const dotIndex = byteString.indexOf(".");
    if(dotIndex === -1) return byteString + postfix;
    return byteString.substring(0, dotIndex + 2) + postfix;
}

export { validName, validPath, unixTime, sortByName, timeAgo, convertBytes };