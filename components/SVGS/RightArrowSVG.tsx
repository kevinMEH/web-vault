type RightArrowSVGParameters = {
    name: string;
    className?: string;
    strokeWidth?: number;
    onClick?: (event: Event) => void;
}

const RightArrowSVG = ({ name, className = "", strokeWidth = 5, onClick }: RightArrowSVGParameters) => (
    <svg
        name={name}
        xmlns="http://www.w3.org/2000/svg"
        xmlSpace="preserve"
        viewBox="0 0 48 48"
        className={"absolute inset-0 " + className}
        onClick={onClick as any | undefined}
    >
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={strokeWidth}>
            <path d="M10 24h28" />
            <path strokeLinejoin="round" d="m24 10 14 14-14 14" />
        </g>
    </svg>
);

export default RightArrowSVG;
