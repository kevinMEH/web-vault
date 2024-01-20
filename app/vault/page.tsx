"use client"
import { useEffect, useState } from "react";

import { File, Directory } from "../../src/vfs";
import { sortByName } from "../../src/helper";

import Resizable from "../../components/Resizable";
import ExplorerItem from "../../components/ExplorerItem";


import Header from "./Header";
import TileView from "./Managers/TileView";
import Details from "./Details";

let testFolder: Directory;
let testFolder2: Directory;

const vault = new Directory("Project", []);

// TODO: Integrate frontend with backend
{
    vault.addEntry(new File("index.js", 69, ""), false);
    vault.addEntry(new File("package.json", 130, ""), false);
    vault.addEntry(new File("package-lock.json", 13300, ""), false);
    
    testFolder = new Directory("src", []);
    vault.addEntry(testFolder, false);
    testFolder.addEntry(new File("module.js", 130, ""), false);
    testFolder.addEntry(new File("helper.js", 130, ""), false);
    testFolder.addEntry(new File("main.cpp", 200, ""), false);
    
    testFolder = new Directory("node_modules", []);
    vault.addEntry(testFolder, false);
    
    testFolder2 = new Directory("next", [])
    testFolder.addEntry(testFolder2, false);
    testFolder2.addEntry(new File("index.js", 42, ""), false);
    testFolder2.addEntry(new File("package.json", 42, ""), false);
    testFolder2.addEntry(new File("README.md", 42, ""), false);
    
    testFolder2 = new Directory("react", [])
    testFolder.addEntry(testFolder2, false);
    testFolder2.addEntry(new File("index.js", 42, ""), false);
    testFolder2.addEntry(new File("LICENSE", 42, ""), false);
    
    testFolder2 = new Directory("ioredis", [])
    testFolder.addEntry(testFolder2, false);
    testFolder2.addEntry(new File("index.js", 42, ""), false);
    testFolder2.addEntry(new File("package.json", 42, ""), false);
    testFolder2.addEntry(new Directory("src", []), false);
}

const Vault = () => {
    const [activeDirectoryChain, setActiveDirectoryChain] = useState([vault])
    const [activeItem, setActiveItem] = useState(null as null | Directory | File);

    vault.contents.sort(sortByName);
    
    useEffect(() => {
        document.querySelector("body")?.classList.add("!bg-white")
    }, [])

    return <>
        {/* <StandardHead title={vault.name} noIndex={true} /> */}
        <div className="flex flex-col h-full">
            <Header vaultName={vault.name} />
            <main className="flex flex-shrink flex-grow w-full h-full overflow-x-clip overflow-y-auto hide-scrollbar">
                <Resizable sashPosition="right-0" defaultWidth={320} minWidth={200} maxWidth={400}
                onDoubleClick={event => {
                    setActiveItem(null);
                    event.stopPropagation();
                    event.preventDefault();
                }}>
                    <div className="font-mono text-quiet text-sm pt-4 pb-2 pl-8 whitespace-nowrap select-none">Vault: {vault.name}</div>
                    {
                        vault.contents.map(
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
    </>
}

export default Vault;