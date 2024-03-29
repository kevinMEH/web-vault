import { memo, useState } from "react";

import ItemIcon from "../../../../components/ItemIcon";
import Triangle from "../../../../components/Triangle";

import type { FrontFile, FrontDirectory } from "../../../../src/vfs";
import { sortByName } from "../../../../helpers/helper";

type ExplorerItemParameters = {
    item: FrontFile | FrontDirectory;
    depth: number;
    activeDirectoryChain: FrontDirectory[];
    setActiveDirectoryChain: (setFunc: (prev: FrontDirectory[]) => FrontDirectory[]) => void;
    setActiveItem: (item: FrontFile) => void;
}

const ExplorerItem = memo(function ExplorerItem({ item, depth, activeDirectoryChain, setActiveDirectoryChain, setActiveItem }: ExplorerItemParameters) {
    const [_nonce, rerender] = useState(0);

    const isFolder = item.isDirectory;
    const isOpen = item.isOpen;

    return <div className="block"
        onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            item.isOpen = !item.isOpen;
            rerender(prev => prev + 1);
        }}
        onDoubleClick={!item.isDirectory ? event => {
            setActiveItem(item as FrontFile);
            event.stopPropagation();
            event.preventDefault();
        } : event => {
            event.stopPropagation();
            event.preventDefault();
        }}
    >
        <div className="flex items-center h-9 text-quiet hover:text-main text-sm font-mono font-[425]
        bg-white hover:bg-light-gray transition-colors cursor-pointer justify-between group select-none"
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
        </div>
        {isOpen && isFolder && (item as FrontDirectory).contents.sort(sortByName) && <div>
            {(item as FrontDirectory).contents.map(
                item => <ExplorerItem item={item} depth={depth + 1} key={item.name} activeDirectoryChain={activeDirectoryChain} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} />
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