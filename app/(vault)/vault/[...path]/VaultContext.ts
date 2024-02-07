import { createContext, Dispatch, SetStateAction } from "react";
import { Directory } from "../../../../src/vfs";

type DirectoryChainContextType = {
    activeDirectoryChain: Directory[],
    setActiveDirectoryChain: Dispatch<SetStateAction<Directory[]>>;
}

const DirectoryChainContext = createContext(null as unknown as DirectoryChainContextType);

export default DirectoryChainContext;