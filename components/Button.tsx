type ButtonParameters = {
    children: React.ReactNode;

    href?: string;
    onClick?: (event: MouseEvent) => any;
    disabled?: boolean;

    className?: string;
}

const Button = ({ children, href, onClick = undefined, disabled = false, className = "" }: ButtonParameters) => {
    return <>
        {href ? <a href={href} onClick={onClick as any} className={className}>
            {children}
        </a> : <button disabled={disabled} onClick={onClick as any} className={className}>
            {children}
        </button>}
    </>
}

export default Button;