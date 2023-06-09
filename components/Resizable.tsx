import { useCallback, useRef, useState } from "react";

type ResizableParameters = {
    sashPosition: "left-0" | "right-0";
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;

    children: React.ReactNode;

    onClick?: (event: MouseEvent) => any;
    onDoubleClick?: (event: MouseEvent) => any;
};

const Resizable = ({ sashPosition, defaultWidth, minWidth, maxWidth, children, onClick = undefined, onDoubleClick = undefined }: ResizableParameters) => {
    const sashElement = useRef(null as null | HTMLElement);
    const lastX = useRef(0);
    const containerWidth = useRef(defaultWidth);
    const [_nonce, rerender] = useState(0);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        event.preventDefault();

        let newWidth = containerWidth.current +
        (sashPosition === "right-0" ? event.clientX - lastX.current : -event.clientX + lastX.current);
        if(newWidth > maxWidth) newWidth = maxWidth;
        if(newWidth < minWidth) newWidth = minWidth;
        containerWidth.current = newWidth;
        lastX.current = event.clientX;

        rerender(prev => prev + 1);
    }, [sashPosition, maxWidth, minWidth]);
    
    const handleMouseUp = useCallback((event: MouseEvent) => {
        event.preventDefault();
        sashElement.current?.classList.remove("before:!bg-accent-extra-light");
        
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseMove]);
    
    const handleMouseDown = useCallback((event: MouseEvent) => {
        event.preventDefault();
        sashElement.current?.classList.add("before:!bg-accent-extra-light");

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        lastX.current = event.clientX;
    }, [handleMouseMove, handleMouseUp]);
    
    return <div className={`relative flex flex-shrink-0`}>
        <div className="bg-white font-inter overflow-clip" style={{ width: containerWidth.current }}
        onClick={onClick as any} onDoubleClick={onDoubleClick as any}>
            {children}
        </div>
        <div className={`w-[1px] h-full group bg-gray
        cursor-col-resize transition-all absolute ${sashPosition}
        before:absolute before:w-[3px] before:h-full before:right-[calc(50%-1.5px)] 
        before:bg-transparent before:hover:bg-accent-extra-light
        before:transition-colors before:duration-300`}
        onMouseDown={handleMouseDown as any} ref={sashElement as any} />
    </div>
}

export default Resizable;