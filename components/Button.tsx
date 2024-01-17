type ButtonParameters = {
    children: React.ReactNode;

    href?: string;
    onClick?: (event: MouseEvent) => any;
    disabled?: boolean;

    className?: string;
}

const defaultClassNames = `justify-center inline-flex rounded-lg`;

const Button = ({ children, href, onClick = undefined, disabled = false, className = "" }: ButtonParameters) => {
    return <>
        {href ? <a href={href} onClick={onClick as any} className={defaultClassNames + " " + className}>
            {children}
        </a> : <button disabled={disabled} onClick={onClick as any} className={defaultClassNames + " " + className}>
            {children}
        </button>}
    </>
}

export default Button;