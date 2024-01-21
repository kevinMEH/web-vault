"use client"

import { useState } from "react";
import Button from "../../../components/Button";
import TextField from "../../../components/TextField";

type SimpleTwoFieldsParameters = {
    label: string,

    fieldOneId: string,
    fieldOneLabelText: string,
    fieldOnePlaceholder: string,
    fieldOneType: "text" | "password",

    fieldTwoId: string,
    fieldTwoLabelText: string,
    fieldTwoPlaceholder: string,
    fieldTwoType: "text" | "password",
    
    // Takes in fieldOne and fieldTwo, returns the status message
    submit: (fieldOne: string, fieldTwo: string) => Promise<string>
}

const SimpleTwoFields = ({ label, fieldOneId, fieldOneLabelText, fieldOnePlaceholder, fieldOneType, fieldTwoId, fieldTwoLabelText, fieldTwoPlaceholder, fieldTwoType, submit }: SimpleTwoFieldsParameters) => {
    const [ fieldOne, setFieldOne ] = useState("");
    const [ fieldTwo, setFieldTwo ] = useState("");
    const [ status, setStatus ] = useState("");
    return <div className="space-y-3">
        <h2 className="font-semibold text-xl">{ label }</h2>
        <div className="space-x-3 flex">
            <TextField className="inline-block"
                name={fieldOneId}
                id={fieldOneId}
                labelText={fieldOneLabelText}
                placeholder={fieldOnePlaceholder}
                type={fieldOneType}
                value={fieldOne}
                setValue={setFieldOne}
            />
            <TextField className="inline-block"
                name={fieldTwoId}
                id={fieldTwoId}
                labelText={fieldTwoLabelText}
                placeholder={fieldTwoPlaceholder}
                type={fieldTwoType}
                value={fieldTwo}
                setValue={setFieldTwo}
            />
            <Button className="border border-gray bg-white w-36 rounded-md" onClick={async () => setStatus(await submit(fieldOne, fieldTwo))} >Submit</Button>
        </div>
        { status !== "" && <p className="leading-tight">Status: {status}</p> }
    </div>
}

export default SimpleTwoFields;