import { memo, useState } from "react";
import { File, Directory } from "../src/vfs";
import ItemIcon from "./ItemIcon";
import Triangle from "./Triangle";

type ExplorerItemParameters = {
    item: File | Directory;
    depth: number;
}

const ExplorerItem = memo(function ExplorerItem({ item, depth }: ExplorerItemParameters) {
    console.log("Rerendered " + item.name);
    const [_nonce, rerender] = useState(0);

    const isFolder = item.isDirectory;
    const isOpen = item.isOpen;

    const icon = <ItemIcon name={item.name} isFolder={isFolder} isOpen={isOpen}
        width={20} height={20} className="" />
    return <div className="block" onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        item.isOpen = !item.isOpen;
        rerender(prev => prev + 1);
    }}>
        <div className="flex items-center h-9 text-sub text-sm font-mono font-[425] hover:bg-light-gray cursor-pointer"
        style={{ paddingLeft: 12 * depth + "px"}} >
            {
                isFolder
                ? (
                    isOpen
                    ? <Triangle transparentX={true} borderSizes="border-x-4 border-t-4 border-t-quiet" className="mx-1.5" />
                    : <Triangle transparentX={false} borderSizes="border-y-4 border-l-4 border-l-quiet" className="mx-2" />
                )
                : <div className="min-w-[4px] mx-2" />
            }
            {icon}
            <span className="pl-3">{item.name}</span>
        </div>
        {
            isOpen && isFolder && <div>
                {
                    (item as Directory).contents.sort((first, second) => {
                        if(first.isDirectory != second.isDirectory) {
                            return first.isDirectory ? -1 : 1;
                        } else {
                            return first.name.localeCompare(second.name);
                        }
                    })
                    && (item as Directory).contents.map(
                        item => <ExplorerItem item={item} depth={depth + 1} key={item.name} />
                    )
                }
            </div>
        }
    </div>
});

export default ExplorerItem;