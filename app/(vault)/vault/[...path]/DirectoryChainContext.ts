import { createContext, Dispatch, SetStateAction } from "react";
import { FrontDirectory } from "../../../../src/vfs";

type DirectoryChainContextType = {
    activeDirectoryChain: FrontDirectory[],
    setActiveDirectoryChain: Dispatch<SetStateAction<FrontDirectory[]>>;
}

const DirectoryChainContext = createContext(null as unknown as DirectoryChainContextType);

export default DirectoryChainContext;