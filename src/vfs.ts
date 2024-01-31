// Simplified File which can be stringified and parsed
export type SimpleFile = {
    name: string;
    byteSize: number;
    lastModified: string;
    realFile: string;
    isDirectory: boolean;
} & { __type: "FlatFile" };
// Simplified Directory which can be stringified and parsed
export type SimpleDirectory = {
    name: string;
    lastModified: string;
    isDirectory: boolean;
    contents: (SimpleFile | SimpleDirectory)[];
} & { __type: "FlatDirectory" };

// Files will be laid out in a flat structure in the root vault directory
// The VFS will represent the actual directory subdirectory structure.
// This enables efficient modification of the structure of the VFS and prevents
// possible inconsistencies between the file system and the VFS, as the VFS is
// now solely responsible for the structuring of the files.

class File {
    name: string;
    byteSize: number;
    lastModified: Date;
    realFile: string;

    isDirectory = false;
    isOpen = false; // Typing purposes only, no use on file
    
    constructor(name: string, byteSize: number, realFile: string, lastModified?: string | Date) {
        this.name = name;
        this.byteSize = byteSize;
        this.realFile = realFile;
        
        if(lastModified !== undefined) {
            if(typeof lastModified === "string") {
                this.lastModified = new Date(lastModified);
            } else {
                this.lastModified = new Date(lastModified.toJSON());
            }
        } else {
            this.lastModified = new Date();
        }
    }

    modifiedNow(): void {
        this.lastModified = new Date();
    }
    
    getByteSize(): number {
        return this.byteSize;
    }

    /**
     * Returns an object representation of this File for stringifying.
     * Set includeRealFile to true if you want to include the realFile name.
     * Set it to false if you do not want to include it, such as for sending to
     * the client.
     * 
     * @param includeRealFile 
     * @returns Object representation of this File
     */
    flat(includeRealFile: boolean): SimpleFile {
        return {
            name: this.name,
            byteSize: this.byteSize,
            lastModified: this.lastModified.toJSON(),
            realFile: includeRealFile ? this.realFile : "",
            isDirectory: false
        } as SimpleFile;
    }
    
    clone(modified: boolean): File {
        return new File(this.name, this.byteSize, this.realFile, modified ? undefined : this.lastModified.toJSON());
    }
    
    update(flatFile: SimpleFile): void {
        this.byteSize = flatFile.byteSize;
        this.lastModified = new Date(flatFile.lastModified);
        this.realFile = flatFile.realFile;
    }
}


class Directory {
    name: string;
    lastModified: Date;

    contents: (File | Directory)[];

    isDirectory = true;
    isOpen = false; // For displaying directory on frontend
    
    constructor(name: string, contents: (File | Directory)[], lastModified?: string | Date) {
        this.name = name;

        if(lastModified !== undefined) {
            if(typeof lastModified === "string") {
                this.lastModified = new Date(lastModified);
            } else {
                this.lastModified = new Date(lastModified.toJSON());
            }
        } else {
            this.lastModified = new Date();
        }

        this.contents = contents;
    }
    
    getAny(name: string): File | Directory | null {
        for(const item of this.contents) {
            if(item.name === name) return item;
        }
        return null;
    }
    
    getFile(name: string): File | null {
        for(const item of this.contents) {
            if(!item.isDirectory && item.name === name) return item as File;
        }
        return null;
    }
    
    getDirectory(name: string): Directory | null {
        for(const item of this.contents) {
            if(item.isDirectory && item.name === name) return item as Directory;
        }
        return null;
    }

    /**
     * Gets an entry using a path, traversing subdirectories.
     * Do not include the current directory's name in the path.
     * For ex: Good: "subfolder/file", Bad: "this.name/subfolder/file"
     * 
     * @param path 
     * @returns 
     */
    getPath(path: string): File | Directory | null {
        let last: File | Directory | null = this;
        const items = path.split("/");
        for(let i = 0; i < items.length; i++) {
            if(last !== null && last.isDirectory) {
                last = (last as Directory).getAny(items[i]);
            } else {
                return null;
            }
        }
        return last;
    }
    
    getAllSubfiles(): File[] {
        const realFiles = [];
        for(const item of this.contents) {
            if(item.isDirectory) {
                realFiles.push(...(item as Directory).getAllSubfiles());
            } else {
                realFiles.push(item as File);
            }
        }
        return realFiles;
    }
    
    /**
     * Adds a new entry to the Directory.
     * 
     * The realChange parameter indicates if this is a real change to
     * the file system, or if it is just an informational update. If
     * it is true, then modification time will be updated.
     * 
     * RealChange should be true only when updating the Directory after
     * performing serverside file operations.
     * 
     * @param item 
     * @param realChange - Update byteSize and lastModified or not.
     */
    addEntry(item: File | Directory, realChange: boolean) {
        this.contents.push(item);
        if(realChange) {
            this.modifiedNow();
        }
    }
    
    /**
     * Removes the specified item from the Directory. Returns true if 
     * the item exists and is removed, returns false if the item does
     * not exist.
     * 
     * The realChange parameter indicates if this is a real change to
     * the file system, or if it is just an informational update. If
     * it is true, then modification time will be updated.
     * 
     * RealChange should be true only when updating the Directory after
     * performing serverside file operations.
     * 
     * @param entry 
     * @param realChange 
     * @returns 
     */
    removeEntry(entry: File | Directory | string, realChange: boolean): boolean {
        if(typeof entry === "string") {
            for(let i = 0; i < this.contents.length; i++) {
                if(this.contents[i].name === entry) {
                    this.contents.splice(i, 1);
                    if(realChange) this.modifiedNow();
                    return true;
                }
            }
            return false;
        } else {
            const index = this.contents.indexOf(entry);
            if(index === -1) return false;
            
            this.contents.splice(index, 1);
                if(realChange) this.modifiedNow();
            return true;
        }
    }
    
    modifiedNow(): void {
        this.lastModified = new Date();
    }
    
    getByteSize(): number {
        let total = 0;
        for(const item of this.contents) {
            total += item.getByteSize();
        }
        return total;
    }

    /**
     * Object representation of directory up to a current depth. Useful for large
     * file systems where you only want to send a portion of the file system at once.
     * 
     * This flat object can then be sent to the client.
     * 
     * Pass in a super large number, or just -1 to copy the entire tree.
     * 
     * TODO: Add maximum number of entries to return to prevent DOS
     * 
     * @param depth
     * @returns 
     */
    flat(includeRealFile: boolean, depth: number): SimpleDirectory {
        if(depth == 0) {
            return {
                name: this.name,
                lastModified: this.lastModified.toJSON(),
                isDirectory: true,
                contents: [] as (SimpleFile | SimpleDirectory)[]
            } as SimpleDirectory;
        } else {
            depth--;
            const flatContents = [];
            for(const item of this.contents) {
                flatContents.push(item.flat(includeRealFile, depth));
            }
            return {
                name: this.name,
                lastModified: this.lastModified.toJSON(),
                isDirectory: true,
                contents: flatContents
            } as SimpleDirectory;
        }
    }
    
    clone(modified: boolean): Directory {
        const clonedContents: (File | Directory)[] = [];
        for(const item of this.contents) {
            clonedContents.push(item.clone(modified));
        }
        return new Directory(this.name, clonedContents, modified ? undefined : this.lastModified.toJSON());
    }
    
    /**
     * Captures a JSON representation of the current file system from this point
     * up to a certain depth. The JSON can then be sent to the client.
     * 
     * @param depth 
     * @returns 
     */
    stringify(includeRealFile: boolean, depth: number): string {
        return JSON.stringify(this.flat(includeRealFile, depth));
    }

    /**
     * Attach a new entry to the current one given it does not exist.
     * 
     * About preexisting files and directories: Attach will only be called from
     * update IF no item with the same name exists, so it is safe to assume the
     * item and its name is unique in this directory.
     * 
     * This is used for client side updating of virtual file system.
     * 
     * @param flatItem 
     */
    private attach(flatItem: SimpleFile | SimpleDirectory): void {
        if(flatItem.isDirectory) {
            // Create new directory, and then update itself.
            const newDirectory = new Directory(flatItem.name, []);
            newDirectory.update(flatItem as SimpleDirectory);
            this.addEntry(newDirectory, false);
        } else {
            // Create new file from flatFile
            const newFile = new File(flatItem.name, (flatItem as SimpleFile).byteSize, (flatItem as SimpleFile).realFile, flatItem.lastModified);
            this.addEntry(newFile, false);
        }
    }
    
    /**
     * Update the current directory based on the object passed in.
     * 
     * This is used for client side updating of virtual file system, and turning
     * flattened file system back into Files and Directories.
     * 
     * @param flatDirectory - Flattened Directory object
     */
    update(flatDirectory: SimpleDirectory): void {
        this.lastModified = new Date(flatDirectory.lastModified);

        const newContents: (File | Directory)[] = [];
        const toAttach: (SimpleFile | SimpleDirectory)[] = [];
        for(const item of flatDirectory.contents) {
            const maybeCurrent = this.getAny(item.name);
            if(maybeCurrent !== null && maybeCurrent.isDirectory === item.isDirectory) {
                // Update existing, and push to new contents
                maybeCurrent.update(item as never);
                newContents.push(maybeCurrent);
            } else {
                // Does not currently exist, or is not of the same type: attach later
                toAttach.push(item);
            }
        }
        
        this.contents = newContents;
        for(const item of toAttach) {
            // Attach all new items to current directory
            this.attach(item);
        }
    }
}

export { File, Directory };