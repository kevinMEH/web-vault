import { File, Directory } from "./vfs.js";
import fs from "fs/promises";

/**
 * Passed in directory must exist. Recursively generates a virtual
 * file system representation from the specified directory.
 * 
 * If the directory does not exist, an error will be thrown.
 * 
 * Directory should not end in a slash "/".
 * 
 * @param directory - File path of the directory
 */
 async function generateVFS(directory: string): Promise<Directory> {
    const contents: (File | Directory)[] = [];
    const entries = await fs.readdir(directory);
    for(const entry of entries) {
        const stat = await fs.stat(directory + "/" + entry);
        if(stat.isDirectory()) {
            contents.push(await generateVFS(directory + "/" + entry));
        } else {
            contents.push(new File(entry, stat.size, stat.mtime));
        }
    }
    const stats = await fs.stat(directory);
    return new Directory(directory.substring(directory.lastIndexOf("/") + 1), contents, stats.mtime);
}

export { generateVFS };