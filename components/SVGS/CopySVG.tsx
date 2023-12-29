type CopySVG = {
    name: string;
    className?: string;
    strokeWidth?: number;
    onClick?: (event: Event) => void;
};

const CopySVG = ({ name, className = "", strokeWidth = 4, onClick }: CopySVG) => (
    <svg name={name} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"
        className={"relative inset-0 " + className} onClick={onClick as any | undefined}
    >
        <rect
            x="12"
            y="12"
            width="18"
            height="18"
            rx="3"
            ry="3"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={strokeWidth}
        />
        <path
            d="m6,20h-1c-1.66,0-3-1.34-3-3V5c0-1.66,1.34-3,3-3h12c1.66,0,3,1.34,3,3v1"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={strokeWidth}
        />
    </svg>
);

export default CopySVG;
