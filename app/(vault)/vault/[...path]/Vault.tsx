"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Resizable from "./Resizable";
import ExplorerItem from "./ExplorerItem";
import Header from "./Header";
import Details from "./Details";
import TileView from "./Managers/TileView";
import DirectoryChainContext from "./DirectoryChainContext";

import { post } from "../../../../helpers/requests";
import { getVaultToken } from "../../../../helpers/storage";
import { FrontDirectory, FrontFile } from "../../../../src/vfs";
import { sortByName } from "../../../../helpers/helper";

import type { Data as VFSData, Expect as VFSExpect } from "../../../api/file/vfs/route";

type VaultParameters = {
    path: string[]
}

const Vault = ({ path }: VaultParameters) => {
    const router = useRouter();
    const [ activeItem, setActiveItem ] = useState(null as null | FrontDirectory | FrontFile);
    const [ activeDirectoryChain, setActiveDirectoryChain ] = useState(() => {
        // Precreate directories for all segments
        const vault = new FrontDirectory(path[0], []);
        const directoryChain = [ vault ];
        for(let i = 1; i < path.length; i++) {
            const current = new FrontDirectory(path[i], []);
            directoryChain[directoryChain.length - 1].addEntry(current, false);
            directoryChain.push(current);
        }
        return directoryChain;
    });

    const vaultName = path[0];
    
    useEffect(() => {
        if(activeDirectoryChain[0].name !== "") {
            window.history.replaceState(window.history.state, "", `/vault/${activeDirectoryChain.map(directory => directory.name).join("/")}`);
        }
    }, [ activeDirectoryChain ])
    
    useEffect(() => {
        (async () => {
            const vaultToken = getVaultToken();
            if(vaultToken === null) {
                console.log("Null token");
                router.push("/login");
                return;
            }
            
            let cancelIndex = Infinity;
            const vfsUpdateOperations = [] as Promise<void>[];
            const abortControllers = [] as AbortController[];
            for(let i = 0; i < path.length; i++) {
                const abortController = new AbortController();
                const request = post<VFSExpect, VFSData>(
                    "/api/file/vfs",
                    { vaultToken, path: path.slice(0, i + 1).join("/"), depth: i == path.length - 1 ? 2 : 1 },
                    abortController.signal
                ).then(data => {
                    if(i > cancelIndex) {
                        return;
                    }
                    const { vfs, depth } = data;
                    if(vfs !== undefined) {
                        activeDirectoryChain[i].update(vfs, depth);
                    } else {
                        cancelIndex = i;
                        if(i === 0) {
                            console.log("No permission to vault");
                            router.push("/login");
                        } else {
                            activeDirectoryChain.splice(i);
                            path.splice(i);
                            // Note: No need to remove current directory from parent
                            // since the VFS update for parent will remove for us
                        }
                        for(let j = i + 1; j < abortControllers.length; j++) {
                            abortControllers[j].abort();
                        }
                    }
                });
                vfsUpdateOperations.push(request);
                abortControllers.push(abortController);
            }

            await Promise.all(vfsUpdateOperations);
            setActiveDirectoryChain([...activeDirectoryChain]);
        })();
    }, []);

    return <DirectoryChainContext.Provider value={{ activeDirectoryChain, setActiveDirectoryChain }} >
    <div className="flex flex-col h-full">
        <Header vaultName={vaultName} />
        <main className="flex flex-shrink flex-grow w-full h-full overflow-x-clip overflow-y-auto hide-scrollbar">
            <Resizable name="explorer" sashPosition="right-0" defaultWidth={340} minWidth={250} maxWidth={450}
                onDoubleClick={event => {
                    setActiveItem(null);
                    event.stopPropagation();
                    event.preventDefault();
                }}
            >
                <div className="font-mono text-quiet text-sm pt-4 pb-2 pl-8 whitespace-nowrap select-none">Vault: {vaultName}</div>
                {
                    activeDirectoryChain[0].contents.sort(sortByName) && activeDirectoryChain[0].contents.map(
                        item => <ExplorerItem item={item} depth={1} key={item.name} activeDirectoryChain={activeDirectoryChain} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} />
                    )
                }
            </Resizable>
            <TileView setActiveItem={setActiveItem} />
            <Resizable name="details" sashPosition="left-0" defaultWidth={340} minWidth={250} maxWidth={450}>
                <Details item={activeItem} />
            </Resizable>
        </main>
    </div>
    </DirectoryChainContext.Provider>
}

export default Vault;