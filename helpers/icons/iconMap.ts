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

const folderBaseMap = new Map<string, string>();

for(const folder of folderIcons) {
    const openSvgName = folder.name;
    for(const folderName of folder.folderNames) {
        folderBaseMap.set(folderName, openSvgName);
    }
}

export { fileExtensionMap, fileNameMap, folderBaseMap };