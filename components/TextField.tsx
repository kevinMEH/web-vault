import { Dispatch, SetStateAction, useState } from "react";

type TextFieldParameters = {
    name: string;
    labelText: string;
    placeholder: string;
    type: "email" | "password" | "text";
    value: string;
    setValue: Dispatch<SetStateAction<string>>;
    id: string;

    error?: string;

    inputMode?: "text" | "email";
    disabled?: boolean;
    required?: boolean;
    readOnly?: boolean;
    
    className?: string;
}

const TextField = ({
    name, labelText, placeholder, type, value, setValue, id, error = "",
    inputMode = "text", disabled = false, required = false, readOnly = false,
    className = ""
}: TextFieldParameters) => {
    const [lastError, setLastError] = useState("");
    const [newError, setNewError] = useState(true);
    if(error != lastError) {
        setLastError(error);
        setNewError(true);
    }

    return(
        <div className={"relative w-80 " + className}>
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
    
                inputMode={inputMode}
                disabled={disabled}
                required={required}
                readOnly={readOnly}
                
                className={`px-5 py-3 w-full rounded-md text-sm peer
                font-inter text-main ${error && newError ? "!text-error-light" : ""}
                border border-gray ${error && newError ? "!border-error-light" : ""}
                focus:border-accent-light`}
            />
            <label htmlFor={id} className={`absolute font-inter text-xs text-sub left-4 -top-2 bg-white
            ${error && newError ? "!text-error-light" : ""} peer-focus:text-accent-light
            border-x-4 border-white`}>{labelText}</label>
            { error ? <p className="inline-block pt-1.5 text-sm text-error-light">{error}</p> : null }
        </div>
    )
}

export default TextField;