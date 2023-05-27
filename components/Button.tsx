type ButtonParameters = {
    children: React.ReactNode;

    href?: string;
    onClick?: (event: MouseEvent) => any;
    disabled?: boolean;

    wrapperClassName?: string;
    className?: string;
}

const defaultClassNames = `justify-center inline-flex rounded-lg`;

const Button = ({ children, href, onClick = undefined, disabled = false, wrapperClassName = "", className = "" }: ButtonParameters) => {
    return <div className={wrapperClassName}>
        {href ? <a href={href} onClick={onClick as any} className={defaultClassNames + " " + className}>
            {children}
        </a> : <button disabled={disabled} onClick={onClick as any} className={defaultClassNames + " " + className}>
            {children}
        </button>}
    </div>
}

export default Button;