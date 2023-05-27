import { useCallback, useRef, useState } from "react";

type ResizableParameters = {
    position: "left-0" | "right-0";
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;

    children: React.ReactNode;
};

const Resizable = ({ position, defaultWidth, minWidth, maxWidth, children }: ResizableParameters) => {
    const sashElement = useRef(null as null | HTMLElement);
    const lastX = useRef(0);
    const containerWidth = useRef(defaultWidth);
    const [_nonce, rerender] = useState(0);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        event.preventDefault();

        let newWidth = containerWidth.current +
        (position === "right-0" ? event.clientX - lastX.current : -event.clientX + lastX.current);
        if(newWidth > maxWidth) newWidth = maxWidth;
        if(newWidth < minWidth) newWidth = minWidth;
        containerWidth.current = newWidth;
        lastX.current = event.clientX;

        rerender(prev => prev + 1);
    }, [position, maxWidth, minWidth]);
    
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
    
    return <div className={`relative flex`}>
        <div className="bg-white font-inter overflow-clip" style={{ width: containerWidth.current }}>
            {children}
        </div>
        <div className={`w-[1px] h-full group bg-gray
        cursor-col-resize transition-all absolute ${position}
        before:absolute before:w-[3px] before:h-full before:right-[calc(50%-1.5px)] 
        before:bg-transparent before:hover:bg-accent-extra-light
        before:transition-colors before:duration-300`}
        onMouseDown={handleMouseDown as any} ref={sashElement as any} />
    </div>
}

export default Resizable;