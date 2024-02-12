
import React, { useContext } from "react";

import Tile from "./Tile";
import DirectoryChainContext from "../DirectoryChainContext";

import { File, Directory } from "../../../../../src/vfs";
import { sortByName } from "../../../../../src/helper";
import Actions from "../Actions/Actions";

type TileViewParameters = {
    setActiveItem: (item: File | Directory | null) => void;
}

const TileView = ({ setActiveItem }: TileViewParameters) => {
    const { activeDirectoryChain, setActiveDirectoryChain } = useContext(DirectoryChainContext);
    const paths = activeDirectoryChain.map(directory => directory.name);
    const activeDirectory = activeDirectoryChain[activeDirectoryChain.length - 1];
    activeDirectory.contents.sort(sortByName);

    return <div className="bg-light-gray h-full w-full px-6 relative" onDoubleClick={event => {
        setActiveItem(null);
        event.stopPropagation();
        event.preventDefault();
    }}>
        <div className="py-3.5 space-x-1 font-mono text-quiet text-sm font-medium">{paths.map((path, i) => {
            return i !== paths.length - 1
                ? <React.Fragment key={i}>
                    <div className="inline-block cursor-pointer hover:bg-half-gray py-1 px-2.5 rounded-md" onClick={() => {
                        setActiveDirectoryChain(prev => {
                            const newDirectoryChain = [...prev];
                            newDirectoryChain.length = i + 1;
                            return newDirectoryChain;
                        });
                    }}>{path}</div>
                    <div className="inline-block select-none">/</div>
                </React.Fragment>
                : <React.Fragment key={i}>
                    <div className="text-accent-dark inline-block cursor-pointer hover:bg-half-gray py-1 px-2.5 rounded-md" onClick={() => {
                        setActiveDirectoryChain(prev => {
                            const newDirectoryChain = [...prev];
                            newDirectoryChain.length = i + 1;
                            return newDirectoryChain;
                        });
                    }}>{path}</div>
                </React.Fragment>
        })}</div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(225px,1fr))] pb-4">{
            activeDirectory.contents.map(item =>
                item.isDirectory && <Tile item={item} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} key={item.name}></Tile>
        )}</div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(225px,1fr))]">{
            activeDirectory.contents.map(item =>
                !item.isDirectory && <Tile item={item} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} key={item.name}></Tile>
        )}</div>
        <Actions />
    </div>
}

export default TileView;