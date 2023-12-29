import ItemIcon from "../../components/ItemIcon";

import { File, Directory } from "../../src/vfs";

type TileParameters = {
    item: File | Directory;
    setActiveDirectoryChain: (setFunc: (prev: Directory[]) => Directory[]) => void;
    setActiveItem: (item: File | Directory) => void;
}

const Tile = ({ item, setActiveDirectoryChain, setActiveItem }: TileParameters) => {
    return <div className="bg-white hover:bg-light-gray border border-gray rounded-lg px-5 py-3.5
    flex items-center cursor-pointer select-none" onDoubleClick={item.isDirectory ? (event => {
        setActiveDirectoryChain(prev => {
            const newDirectoryChain = [...prev, item as Directory];
            return newDirectoryChain;
        });
        event.stopPropagation();
        event.preventDefault();
    }) : (event => {
        setActiveItem(item);
        event.stopPropagation();
        event.preventDefault();
    })}>
        <ItemIcon name={item.name} isFolder={item.isDirectory} isOpen={false} width={22} height={22} className="" />
        <div className="pl-3 font-mono text-sm text-sub font-[425] w-full whitespace-nowrap truncate">
            {item.name}
        </div>
    </div>
}

export default Tile;