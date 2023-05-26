// Maps a name or an extension to an icon

import fileIcons from "./fileIcons";
import folderIcons from "./folderIcons";

const fileExtensionMap = new Map<string, string>();
const fileNameMap = new Map<string, string>();

for(const file of fileIcons) {
    const svgName = file.name + ".svg";
    if(file.fileExtensions !== undefined) {
        for(const extension of file.fileExtensions) {
            fileExtensionMap.set(extension, svgName);
        }
    }
    if(file.fileNames !== undefined) {
        for(const fileName of file.fileNames) {
            fileNameMap.set(fileName, svgName);
        }
    }
}

const closedFolderMap = new Map<string, string>();
const openFolderMap = new Map<string, string>();

for(const folder of folderIcons) {
    const closedSvgName = folder.name + ".svg";
    const openSvgName = folder.name + "-open.svg";
    for(const folderName of folder.folderNames) {
        closedFolderMap.set(folderName, closedSvgName);
        openFolderMap.set(folderName, openSvgName);
    }
}

export { fileExtensionMap, fileNameMap, closedFolderMap, openFolderMap };