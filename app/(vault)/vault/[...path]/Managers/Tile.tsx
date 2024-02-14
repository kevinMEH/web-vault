import ItemIcon from "../../../../../components/ItemIcon";

import type { FrontFile, FrontDirectory } from "../../../../../src/vfs";

type TileParameters = {
    item: FrontFile | FrontDirectory;
    setActiveDirectoryChain: (setFunc: (prev: FrontDirectory[]) => FrontDirectory[]) => void;
    setActiveItem: (item: FrontFile | FrontDirectory) => void;
}

const Tile = ({ item, setActiveDirectoryChain, setActiveItem }: TileParameters) => {
    return <div className="bg-white hover:bg-light-gray border border-gray rounded-lg px-3.5 py-3
    flex items-center cursor-pointer select-none" onDoubleClick={item.isDirectory ? (event => {
        setActiveDirectoryChain(prev => {
            const newDirectoryChain = [...prev, item as FrontDirectory];
            return newDirectoryChain;
        });
        event.stopPropagation();
        event.preventDefault();
    }) : (event => {
        event.stopPropagation();
        event.preventDefault();
    })} onClick={item.isDirectory ? (event => {
        event.stopPropagation();
        event.preventDefault();
    }) : (event => {
        setActiveItem(item);
        event.stopPropagation();
        event.preventDefault();
    })}>
        <ItemIcon name={item.name} isFolder={item.isDirectory} isOpen={false} width={22} height={22} className="" />
        <div className="pl-2 font-mono text-sm text-sub font-[425] w-full whitespace-nowrap truncate">
            {item.name}
        </div>
    </div>
}

export default Tile;