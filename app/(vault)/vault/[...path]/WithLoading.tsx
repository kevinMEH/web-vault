"use client";

import { useState } from "react";
import Image from "next/image";
import ReadyContext from "./ReadyContext";
import Logo from "../../../../public/logos/logo-text.svg";

type WithLoadingParameters = {
    children: React.ReactNode
}

const WithLoading = ({ children }: WithLoadingParameters) => {
    const [ remove, setRemove ] = useState(false);
    const [ readyMap, setReadyMap ] = useState(() => {
        const readyMap = new Map<string, boolean>();
        readyMap.set("explorer", false);
        readyMap.set("details", false);
        return readyMap;
    });
    
    const display = [...readyMap.values()].some(value => value === false);
    if(!display && !remove) {
        setTimeout(() => {
            setRemove(true);
        }, 300);
    }

    return <ReadyContext.Provider value={{ readyMap, setReadyMap }} >
        {!remove &&
            <div className={`absolute top-0 left-0 bottom-0 right-0 bg-off-white-bg z-50 flex items-center justify-center transition-opacity duration-300 ${display ? "opacity-100" : "opacity-0"}`}>
                <Image src={Logo} alt="Logo with text" height={40} className="mx-auto" />
            </div>
        }
        { children }
    </ReadyContext.Provider>
}

export default WithLoading;