import type { Dispatch, SetStateAction } from "react";

type TextFieldParameters = {
    name: string;
    labelText: string;
    placeholder: string;
    type: "email" | "password" | "text";
    value: string;
    setValue: Dispatch<SetStateAction<string>>;

    inputMode?: "text" | "email";
    disabled?: boolean;
    readOnly?: boolean;
    
    className?: string;
}

const TextField = ({
    name, labelText, placeholder, type, value, setValue,
    inputMode = "text", disabled = false, readOnly = false,
    className = ""
}: TextFieldParameters) => {
    return(
        <div className={"relative w-80 " + className}>
            <label className="absolute font-inter text-xs text-sub left-4 -top-2 bg-white border-x-4 border-white">{labelText}</label>
            <input
                name={name}
                placeholder={placeholder}
                type={type}
                value={value}
                onChange={event => setValue(event.target.value)}
    
                inputMode={inputMode}
                disabled={disabled}
                readOnly={readOnly}
                
                className="px-5 py-3 w-full border border-gray rounded-md font-inter text-sm"
            />
        </div>
    )
}

export default TextField;