import { createContext, Dispatch, SetStateAction } from "react";

type ContextType = {
    readyMap: Map<string, boolean>;
    setReadyMap: Dispatch<SetStateAction<Map<string, boolean>>>;
}

const ReadyContext = createContext(null as unknown as ContextType);

export default ReadyContext;