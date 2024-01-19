import { Dispatch, SetStateAction, useState } from "react";

type TextFieldParameters = {
    name: string;
    labelText: string;
    placeholder: string;
    type: "email" | "password" | "text";
    value: string;
    setValue: Dispatch<SetStateAction<string>>;
    id: string;

    error?: boolean | string;

    disabled?: boolean;
    readOnly?: boolean;
    copyButton?: boolean;
    
    className?: string;
}

/**
 * Error parameter: Accepts a boolean or a string.
 * True: Error, but no text displayed
 * Nonempty string: Error with text
 * 
 * @returns 
 */
const TextField = ({
    name, labelText, placeholder, type, value, setValue, id, error = false,
    disabled = false, readOnly = false, copyButton = false, className = ""
}: TextFieldParameters) => {
    const [lastError, setLastError] = useState("" as boolean | string);
    const [newError, setNewError] = useState(true);
    if(error != lastError) {
        setLastError(error);
        setNewError(true);
    }

    return(
        <div className={className}>
            <div className={"relative"}>
                <input
                    name={name}
                    placeholder={placeholder}
                    type={type}
                    value={value}
                    onChange={event => {
                        setNewError(false);
                        setValue(event.target.value)
                    }}
                    id={id}
        
                    inputMode={ type === "email" ? "email" : "text" }
                    disabled={disabled}
                    readOnly={readOnly}
                    
                    className={`px-5 py-3 bsm:py-2.5 w-full rounded-md text-sm peer cursor-text
                    font-inter text-main ${error && newError ? "!text-error-light" : ""}
                    border border-gray ${error && newError ? "!border-error-light" : ""}
                    ${disabled ? "text-quiet" : ""}
                    focus:outline-accent-dark disabled:bg-light-gray/50`}
                />
                <label htmlFor={id}
                className={`absolute left-4 -top-2 bg-white font-inter text-xs
                text-sub ${error && newError ? "!text-error-light" : ""} peer-focus:text-accent-dark
                border-x-4 border-white`}>{labelText}</label>
                
                { copyButton && "TODO:" && <div className="absolute text-sm text-sub right-2 top-1/2 p-1 -translate-y-1/2 border bg-white border-gray rounded-md">
                    Copy
                </div> }
            </div>
            { error && error !== true && <p className="inline-block pt-1.5 text-sm text-error-light">{error}</p> }
        </div>
    )
}

export default TextField;