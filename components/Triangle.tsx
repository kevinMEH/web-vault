type TriangleParameters = {
    transparentX: boolean;
    borderSizes: string;
    className: string;
}

const Triangle = ({ transparentX, borderSizes, className }: TriangleParameters) => {
    return <div className={`w-0 h-0 ${transparentX ? "border-x-transparent" : "border-y-transparent"} ${borderSizes} ${className}`} />
}

export default Triangle;