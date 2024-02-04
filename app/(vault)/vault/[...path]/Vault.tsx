"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post } from "../../../../src/requests";
import { getVaultToken } from "../../../../src/storage";
import { Directory, File } from "../../../../src/vfs";
import type { ErrorResponse } from "../../../../src/route_helpers";
import type { Data as RefreshData, Expect as RefreshExpect } from "../../../api/vault/refresh/route";
import type { Data as VFSData, Expect as VFSExpect } from "../../../api/file/vfs/route";
import Header from "../Header";
import Resizable from "../../../../components/Resizable";
import TileView from "../Managers/TileView";
import Details from "../Details";
import ExplorerItem from "../../../../components/ExplorerItem";

type VaultParameters = {
    path: string[]
}


const Vault = ({ path }: VaultParameters) => {
    const [ vfs, setVfs ] = useState(new Directory(path[0], []));
    const [ activeItem, setActiveItem ] = useState(null as null | Directory | File);
    const [ activeDirectoryChain, setActiveDirectoryChain ] = useState([ vfs ]);
    
    const router = useRouter();

    const vaultName = path[0];
    
    useEffect(() => {
        (async () => {
            const vaultToken = getVaultToken();
            if(vaultToken === null) {
                console.log("Null token");
                router.push("/login");
                return;
            }
            
            // Precreate directories for all segments and send vfs requests
            const directoryChain: Directory[] = [];
            const vault = vfs;
            directoryChain.push(vault);
            for(let i = 1; i < path.length; i++) {
                const current = new Directory(path[i], []);
                directoryChain[directoryChain.length - 1].addEntry(current, false);
                directoryChain.push(current);
            }
            let cancelIndex = Infinity;
            const vfsUpdateOperations = [] as Promise<void>[];
            const abortControllers = [] as AbortController[];
            for(let i = 0; i < path.length; i++) {
                const abortController = new AbortController();
                const request = post<VFSExpect, VFSData>(
                    "/api/file/vfs",
                    { vaultToken, path: path.slice(0, i + 1).join("/"), depth: 1 },
                    abortController.signal
                ).then(data => {
                    if(i > cancelIndex) {
                        return;
                    }
                    const { vfs, depth } = data;
                    if(vfs !== undefined) {
                        directoryChain[i].update(vfs, depth);
                    } else {
                        cancelIndex = i;
                        if(i === 0) {
                            console.log("No permission to vault");
                            router.push("/login");
                        } else {
                            directoryChain.splice(i);
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
            setVfs(vault);
            setActiveDirectoryChain(directoryChain);
        })();
    }, []);

    return <div className="flex flex-col h-full">
        <Header vaultName={vaultName} />
        <main className="flex flex-shrink flex-grow w-full h-full overflow-x-clip overflow-y-auto hide-scrollbar">
            <Resizable sashPosition="right-0" defaultWidth={320} minWidth={200} maxWidth={400}
            onDoubleClick={event => {
                setActiveItem(null);
                event.stopPropagation();
                event.preventDefault();
            }}>
                <div className="font-mono text-quiet text-sm pt-4 pb-2 pl-8 whitespace-nowrap select-none">Vault: {vaultName}</div>
                {
                    activeDirectoryChain[0].contents.map(
                        item => <ExplorerItem item={item} depth={1} key={item.name} activeDirectoryChain={activeDirectoryChain} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} />
                    )
                }
            </Resizable>
            <TileView activeDirectoryChain={activeDirectoryChain} setActiveDirectoryChain={setActiveDirectoryChain} setActiveItem={setActiveItem} />
            <Resizable sashPosition="left-0" defaultWidth={350} minWidth={270} maxWidth={450}>
                <Details item={activeItem} />
            </Resizable>
        </main>
    </div>
}

export default Vault;