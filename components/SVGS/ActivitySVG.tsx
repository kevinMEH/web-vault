type ActivitySVG = {
    name: string;
    className?: string;
};

const ActivitySVG = ({ name, className = "" }: ActivitySVG) => (
    <svg name={name} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 28"
        className={"relative, inset-0 " + className}
    >
        <polyline
            points="30 14 24 14 20 26 12 2 8 14 2 14"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
        />
    </svg>
);

export default ActivitySVG;