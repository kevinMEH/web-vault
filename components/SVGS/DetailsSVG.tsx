type DetailsSVG = {
    name: string;
    className?: string;
};

const DetailsSVG = ({ name, className = "" }: DetailsSVG) => (
    <svg name={name} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"
        className={"relative inset-0 " + className}
    >
        <circle
            cx="16"
            cy="16"
            r="14.5"
            fill="none"
            stroke="currentColor"
            stroke-miterlimit="10"
            stroke-width="3"
        />
        <path
            d="m11.5,23v-2.26h3.8v2.26h-3.8Zm.55-7.32v-2.26h5.55v2.26h-5.55Zm4.2-3.55c-.47,0-.86-.14-1.15-.43-.3-.29-.44-.67-.44-1.13s.15-.84.44-1.13c.3-.29.68-.43,1.15-.43s.86.14,1.15.43c.3.29.44.67.44,1.13s-.15.84-.44,1.13c-.29.29-.68.43-1.15.43Zm-1.13,10.87v-9.04h2.49v9.04h-2.49Zm2.31,0v-2.26h3.08v2.26h-3.08Z"
            fill="currentColor"
        />
    </svg>
)

export default DetailsSVG;