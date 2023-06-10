type SearchSVG = {
    name: string;
    className?: string;
    strokeWidth?: number;
    onClick?: (event: Event) => void;
}

const SearchSVG = ({ name, className = "", strokeWidth = 5, onClick }: SearchSVG) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={"absolute inset-0 " + className} onClick={onClick as any | undefined}>
        <circle
            name={name}
            cx={10.5} cy={10.5} r={5.5}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
        />
        <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="m19 19-4.5-4.5"
        />
    </svg>
);

export default SearchSVG;
