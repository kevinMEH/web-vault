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
    required?: boolean;
    readOnly?: boolean;
    
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
    disabled = false, required = false, readOnly = false, className = ""
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
                    required={required}
                    readOnly={readOnly}
                    
                    className={`px-5 py-2.5 sm:py-3 w-full rounded-md text-sm peer
                    font-inter ${error && newError ? "!text-error-light" : ""}
                    border border-gray ${error && newError ? "!border-error-light" : ""}
                    focus:outline-accent-dark disabled:bg-light-gray/50`}
                />
                <label htmlFor={id} className={`absolute font-inter text-xs text-sub left-4 -top-2 bg-white
                ${error && newError ? "!text-error-light" : ""} peer-focus:text-accent-dark
                border-x-4 border-white`}>{labelText}</label>
                { error && error !== true && <p className="inline-block pt-1.5 text-sm text-error-light">{error}</p> }
            </div>
        </div>
    )
}

export default TextField;