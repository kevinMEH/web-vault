type IconedText = {
    IconFunction: (_: any) => JSX.Element;
    text: string;
    iconName: string;
    className?: string;
};

const IconedText = ({ IconFunction, text, iconName, className = "" }: IconedText) => {
    return <div className={"space-x-1.5 " + className}>
        <IconFunction name={iconName} className="inline-block h-4 w-4" />
        <span className="align-text-top select-none">
        { text }
        </span>
    </div>
}

export default IconedText;