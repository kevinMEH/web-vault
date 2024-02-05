import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { getResizableWidth, setResizableWidth } from "../../../../src/storage";

type ResizableParameters = {
    name: string;

    sashPosition: "left-0" | "right-0";
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;

    children: React.ReactNode;

    onClick?: (event: MouseEvent) => any;
    onDoubleClick?: (event: MouseEvent) => any;
};

const Resizable = ({ name, sashPosition, defaultWidth, minWidth, maxWidth, children, onClick = undefined, onDoubleClick = undefined }: ResizableParameters) => {
    const { setReadyMap } = useContext(ReadyContext);
    const sashElement = useRef(null as null | HTMLElement);
    const lastX = useRef(0);
    const containerWidth = useRef(defaultWidth);
    const realWidth = useRef(defaultWidth);
    const [_nonce, rerender] = useState(0);
    
    useEffect(() => {
        const existingWidth = getResizableWidth(name);
        if(existingWidth !== null) {
            containerWidth.current = existingWidth;
            realWidth.current = existingWidth;
        }
        rerender(prev => prev + 1);
    }, []);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        event.preventDefault();

        let desiredWidth = realWidth.current +
        (sashPosition === "right-0" ? event.clientX - lastX.current : -event.clientX + lastX.current);
        containerWidth.current = Math.max(Math.min(desiredWidth, maxWidth), minWidth);
        realWidth.current = desiredWidth;
        lastX.current = event.clientX;

        rerender(prev => prev + 1);
    }, [sashPosition, maxWidth, minWidth]);
    
    const handleMouseUp = useCallback((event: MouseEvent) => {
        event.preventDefault();
        sashElement.current?.classList.remove("before:!bg-accent-extra-light");
        document.body.classList.remove("cursor-ew-resize");
        
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        realWidth.current = containerWidth.current;
        
        setResizableWidth(name, containerWidth.current);
    }, [handleMouseMove]);
    
    const handleMouseDown = useCallback((event: MouseEvent) => {
        event.preventDefault();
        sashElement.current?.classList.add("before:!bg-accent-extra-light");
        document.body.classList.add("cursor-ew-resize");

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        lastX.current = event.clientX;
    }, [handleMouseMove, handleMouseUp]);
    
    return <div className={`relative flex`}>
        <div className="bg-white font-inter overflow-x-clip overflow-y-scroll hide-scrollbar" style={{ width: containerWidth.current }}
        onClick={onClick as any} onDoubleClick={onDoubleClick as any}>
            {children}
        </div>
        <div className={`w-[1px] h-full group bg-gray
        cursor-col-resize transition-all absolute ${sashPosition}
        before:absolute before:w-[3px] before:h-full before:right-[calc(50%-1.5px)] 
        before:bg-transparent before:hover:bg-accent-extra-light
        before:transition-colors before:duration-300 cursor-ew-resize`}
        onMouseDown={handleMouseDown as any} ref={sashElement as any} />
    </div>
}

export default Resizable;