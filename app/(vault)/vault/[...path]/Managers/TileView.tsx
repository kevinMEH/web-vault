
import React, { useContext, useEffect, useState } from "react";

import Tile from "./Tile";
import DirectoryChainContext from "../DirectoryChainContext";
import ActionsBar from "../Actions/ActionsBar";

import { sortByName } from "../../../../../helpers/helper";
import { getVaultToken } from "../../../../../helpers/storage";
import { pathFromChainNoEntry } from "../../../../../helpers/vaultHelpers";
import { post } from "../../../../../helpers/requests";
import type { Data as VFSData, Expect as VFSExpect } from "../../../../api/file/vfs/route";
import type { FrontFile, FrontDirectory } from "../../../../../src/vfs";

type TileViewParameters = {
    setActiveItem: (item: FrontFile | FrontDirectory | null) => void;
}

const TileView = ({ setActiveItem }: TileViewParameters) => {
    const [ _, rerender ] = useState(0);
    const { activeDirectoryChain, setActiveDirectoryChain } = useContext(DirectoryChainContext);
    const paths = activeDirectoryChain.map(directory => directory.name);
    const activeDirectory = activeDirectoryChain[activeDirectoryChain.length - 1];
    activeDirectory.contents.sort(sortByName);
    
    useEffect(() => {
        (async () => {
            const vaultToken = getVaultToken();
            if(vaultToken === null) {
                // TODO display error ribbon
                return;
            }
            const { vfs, depth } = await post<VFSExpect, VFSData>(
                "/api/file/vfs",
                { vaultToken, path: pathFromChainNoEntry(activeDirectoryChain), depth: 2 }
            );
            console.log(vfs, depth);
            if(vfs !== undefined) {
                activeDirectoryChain[activeDirectoryChain.length - 1].update(vfs, depth);
            } // TODO: Else display error ribbon
            rerender(prev => prev + 1);
        })();
    }, [activeDirectoryChain]);

    return <div className="bg-light-gray h-full w-full px-6 relative" onClick={event => {
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
        <ActionsBar />
    </div>
}

export default TileView;