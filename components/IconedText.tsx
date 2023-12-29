type IconedText = {
    IconFunction: (_: any) => JSX.Element;
    text: string;
    iconName: string;
    wrapperClassName?: string;
};

const IconedText = ({ IconFunction, text, iconName, wrapperClassName = "" }: IconedText) => {
    return <div className={"space-x-1 " + wrapperClassName}>
        <IconFunction name={iconName} className="inline-block h-4 w-4" />
        <span className="align-text-top">
        { text }
        </span>
    </div>
}

export default IconedText;