type TriangleParameters = {
    borderSizes: string;
    className: string;
}

const Triangle = ({ borderSizes, className }: TriangleParameters) => {
    return <div className={`w-0 h-0 ${borderSizes} border-x-transparent ${className}`} />
}

export default Triangle;