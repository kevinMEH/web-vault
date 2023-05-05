export type FlatFile = {
    name: string;
    byteSize: number;
    lastModified: string;
    realFile: string;
    isDirectory: boolean;
} & { __type: "FlatFile" };

export type FlatDirectory = {
    name: string;
    lastModified: string;
    isDirectory: boolean;
    contents: (FlatFile | FlatDirectory)[];
} & { __type: "FlatDirectory" };

export type FlatDirectoryString = string & { __type: "FlatDirectoryString" };

// Simplified FlatFile with an empty string for sending to the client
export type SimpleFlatFile = {
    name: string;
    byteSize: number;
    lastModified: string;
    realFile: "";
    isDirectory: boolean;
} & { __type: "SimpleFlatFile" };

// FlatDirectory containing simplified FlatFiles for sending to the client
export type SimpleFlatDirectory = {
    name: string;
    lastModified: string;
    isDirectory: boolean;
    contents: (SimpleFlatFile | SimpleFlatDirectory)[];
} & { __type: "SimpleFlatDirectory" };

export type FlatSimpleDirectoryString = string & { __type: "FlatSimpleDirectoryString" };

// Files will be laid out in a flat structure in the root vault directory
// The VFS will represent the actual directory subdirectory structure.
// This enables efficient modification of the structure of the VFS and prevents
// possible inconsistencies between the file system and the VFS, as the VFS is
// now solely responsible for the structuring of the files.

class File {
    name: string;
    byteSize: number;
    lastModified: Date;
    readonly realFile: string;

    isDirectory = false;
    
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
    
    duplicate(newName: string = this.name): File {
        return new File(newName, this.byteSize, this.realFile);
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
    flat(includeRealFile: true): FlatFile;
    flat(includeRealFile: false): SimpleFlatFile;
    flat(includeRealFile: true | false): FlatFile | SimpleFlatFile {
        if(includeRealFile) {
            return {
                name: this.name,
                byteSize: this.byteSize,
                lastModified: this.lastModified.toJSON(),
                realFile: this.realFile,
                isDirectory: false
            } as FlatFile;
        } else {
            return {
                name: this.name,
                byteSize: this.byteSize,
                lastModified: this.lastModified.toJSON(),
                realFile: "",
                isDirectory: false
            } as SimpleFlatFile;
        }
    }
    
    clone(): File {
        return new File(this.name, this.byteSize, this.lastModified.toJSON());
    }
    
    update(flatFile: FlatFile): void {
        this.byteSize = flatFile.byteSize;
        this.lastModified = new Date(flatFile.lastModified);
    }
}


class Directory {
    name: string;
    lastModified: Date;

    contents: (File | Directory)[];

    isDirectory = true;
    
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
     * Renames an entry.
     * 
     * Returns true if the entry exists and is renamed. False if it does not exist.
     * 
     * @param currentName 
     * @param newName 
     * @returns 
     */
    renameEntry(currentName: string, newName: string): boolean {
        const maybeCurrent = this.getAny(currentName);
        if(maybeCurrent === null) return false;
        maybeCurrent.name = newName;
        return true;
    }
    
    /**
     * Changes the byteSize of a File.
     * 
     * Returns true on success, returns false, if the file does not exist or is a directory
     * 
     * @param name 
     * @param newByteSize 
     * @param realChange 
     * @returns 
     */
    changeByteSize(name: string, newByteSize: number, realChange: boolean): boolean {
        const maybeCurrent = this.getFile(name);
        if(maybeCurrent === null) return false;
        (maybeCurrent as File).byteSize = newByteSize;
        if(realChange) maybeCurrent.modifiedNow();
        return true;
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
    
    duplicate(newName: string = this.name): Directory {
        const duplicatedContents = [];
        for(const item of this.contents) {
            duplicatedContents.push(item.duplicate());
        }
        return new Directory(newName, duplicatedContents, this.lastModified);
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
     * @param depth
     * @returns 
     */
    flat(includeRealFile: true, depth: number): FlatDirectory;
    flat(includeRealFile: false, depth: number): SimpleFlatDirectory;
    flat(includeRealFile: true | false, depth: number): FlatDirectory | SimpleFlatDirectory {
        if(depth == 0) {
            return {
                name: this.name,
                lastModified: this.lastModified.toJSON(),
                isDirectory: true,
                contents: []
            } as unknown as FlatDirectory | SimpleFlatDirectory;
        } else {
            depth--;
            const flatContents = [];
            for(const item of this.contents) {
                flatContents.push(item.flat(includeRealFile as any, depth));
            }
            return {
                name: this.name,
                lastModified: this.lastModified.toJSON(),
                isDirectory: true,
                contents: flatContents
            } as FlatDirectory | SimpleFlatDirectory;
        }
    }
    
    clone(): Directory {
        const clonedContents: (File | Directory)[] = [];
        for(const item of this.contents) {
            clonedContents.push(item.clone());
        }
        return new Directory(this.name, clonedContents, this.lastModified.toJSON());
    }
    
    /**
     * Captures a JSON representation of the current file system from this point
     * up to a certain depth. The JSON can then be sent to the client.
     * 
     * @param depth 
     * @returns 
     */
    stringify(includeRealFile: true, depth: number): FlatDirectoryString;
    stringify(includeRealFile: false, depth: number): FlatSimpleDirectoryString;
    stringify(includeRealFile: true | false, depth: number): FlatDirectoryString | FlatSimpleDirectoryString {
        return JSON.stringify(this.flat(includeRealFile as any, depth)) as FlatDirectoryString | FlatSimpleDirectoryString;
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
    private attach(flatItem: FlatFile | FlatDirectory): void {
        if(flatItem.isDirectory) {
            // Create new directory, and then update itself.
            const newDirectory = new Directory(flatItem.name, []);
            newDirectory.update(flatItem as FlatDirectory);
            this.addEntry(newDirectory, false);
        } else {
            // Create new file from flatFile
            const newFile = new File(flatItem.name, (flatItem as FlatFile).byteSize, flatItem.lastModified);
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
    update(flatDirectory: FlatDirectory): void {
        this.lastModified = new Date(flatDirectory.lastModified);

        const newContents: (File | Directory)[] = [];
        const toAttach: (FlatFile | FlatDirectory)[] = [];
        for(const item of flatDirectory.contents) {
            const maybeCurrent = this.getAny(item.name);
            if(maybeCurrent !== null && maybeCurrent.isDirectory === item.isDirectory) {
                // Update existing, and push to new contents
                maybeCurrent.update(item as any);
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