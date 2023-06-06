import Image from "next/image";
import { memo } from "react";

import { fileExtensionMap, fileNameMap, folderBaseMap } from "../src/icons/iconMap";

type ItemIconParameters = {
    name: string;
    isFolder: boolean;
    isOpen: boolean;
    width: number;
    height: number;
    className: string;
}

// Takes an item name, and then returns the material icon SVG for the item.
const ItemIcon = memo(function ItemIcon({ name, isFolder, isOpen, width, height, className }: ItemIconParameters) {
    let svgName: string | undefined;
    if(isFolder) {
        svgName = folderBaseMap.get(name);
        if(svgName !== undefined) {
            svgName += (isOpen ? "-open.svg" : ".svg");
        } else {
            svgName = isOpen ? "folder-open.svg" : "folder.svg";
        }
    } else {
        svgName = fileNameMap.get(name);
        if(svgName === undefined) {
            const dotIndex = name.lastIndexOf(".");
            if(dotIndex !== -1) {
                svgName = fileExtensionMap.get(name.substring(dotIndex + 1));
            }
            if(svgName === undefined) {
                svgName = "file.svg"
            }
        }
    }
    return <Image alt={name + " icon"} src={`/item-icons/${svgName}`} priority={true} width={width} height={height} style={{ width: width, height: height }} className={`inline-block ${className}`} />
});

export default ItemIcon