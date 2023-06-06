import { memo, useCallback, useEffect, useRef, useState } from "react";

import ItemIcon from "./ItemIcon";
import Triangle from "./Triangle";
import RightArrowSVG from "./RightArrowSVG";

import { File, Directory } from "../src/vfs";

type ExplorerItemParameters = {
    item: File | Directory;
    depth: number;
    activeDirectoryChain: Directory[];
    setActiveDirectoryChain: (setFunc: (prev: Directory[]) => Directory[]) => void;
}

const ExplorerItem = memo(function ExplorerItem({ item, depth, activeDirectoryChain, setActiveDirectoryChain }: ExplorerItemParameters) {
    const [_nonce, rerender] = useState(0);
    const thisItem = useRef(null as null | HTMLElement)

    const isFolder = item.isDirectory;
    const isOpen = item.isOpen;
    
    const handleNewActiveDirectory = useCallback((event: CustomEvent) => {
        event.detail.directoryChain[depth] = item;
        if(depth === 1) {
            event.stopPropagation();
            event.preventDefault();
            setActiveDirectoryChain(() => {
                return event.detail.directoryChain;
            });
        }
    }, [depth, item, setActiveDirectoryChain]);
    
    useEffect(() => {
        const currentItem = thisItem?.current;
        if(item.isDirectory) {
            currentItem?.addEventListener("new_active_directory", handleNewActiveDirectory as (_: Event) => void);
            return () => {
                currentItem?.removeEventListener("new_active_directory", handleNewActiveDirectory as (_: Event) => void);
            }
        }
    }, [handleNewActiveDirectory, item])


    return <div className="block" ref={thisItem as any} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        item.isOpen = !item.isOpen;
        rerender(prev => prev + 1);
    }}>
        <div className="flex items-center h-9 text-quiet hover:text-main text-sm font-mono font-[425] bg-white hover:bg-light-gray transition-colors cursor-pointer justify-between group"
        style={{ paddingLeft: 12 * depth + "px"}} >
            <div className="flex items-center">
                {
                    isFolder
                    ? (
                        isOpen
                        ? <Triangle transparentX={true} borderSizes="border-x-4 border-t-4 border-t-quiet" className="mx-1.5" />
                        : <Triangle transparentX={false} borderSizes="border-y-4 border-l-4 border-l-quiet" className="mx-2" />
                    )
                    : <div className="min-w-[4px] mx-2" />
                }
                <ItemIcon name={item.name} isFolder={isFolder} isOpen={isOpen} width={20} height={20} className="" />
                <p className="pl-3 whitespace-nowrap">{item.name}</p>
            </div>
            {isFolder && <div className={`relative h-5 w-5 mr-3 flex-shrink-0`}>
                <RightArrowSVG name="Set active directory" className={`text-quiet opacity-0 group-hover:opacity-100 hover:text-accent-dark transition-all
                ${item === activeDirectoryChain[activeDirectoryChain.length - 1] ? "!opacity-100 !text-accent-dark" : ""}`}
                onClick={event => {
                    event.target?.dispatchEvent(new CustomEvent("new_active_directory", {
                        bubbles: true, cancelable: true, detail: {
                            directoryChain: [activeDirectoryChain[0]]
                        }
                    }));
                    event.preventDefault();
                    event.stopPropagation();
                }} />
            </div>}
        </div>
        {isOpen && isFolder && (item as Directory).contents.sort((first, second) => {
            if(first.isDirectory != second.isDirectory) {
                return first.isDirectory ? -1 : 1;
            } else {
                return first.name.localeCompare(second.name);
            }
        }) && <div>
            {(item as Directory).contents.map(
                item => <ExplorerItem item={item} depth={depth + 1} key={item.name} activeDirectoryChain={activeDirectoryChain} setActiveDirectoryChain={setActiveDirectoryChain} />
            )}
        </div>}
    </div>
}, (previous, current) => {
    return previous.item === current.item &&
    previous.depth === current.depth &&
    current.item !== previous.activeDirectoryChain[current.depth] &&
    current.item !== current.activeDirectoryChain[current.depth];
});

export default ExplorerItem;