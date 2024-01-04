import { useEffect, useState } from "react";
import { getHighlighter, setCDN } from "shiki";
import type { Highlighter, Lang } from "shiki";

setCDN("/shiki")

let highlighter: Highlighter | null = null;

type CodePreviewParameters = {
    code: string;
    language: Lang;
};

const placeholderElement = <pre className="bg-white w-[350px] h-[180px] mx-4 mt-5 px-4 pt-3 overflow-x-clip overflow-y-clip
text-[7px] rounded-t-xl border-x border-t border-gray [&>*]:outline-0"/>

const errorElement = <pre className="bg-white w-[350px] h-[180px] mx-4 mt-5 px-4 pt-8 overflow-x-clip overflow-y-clip
text-lg text-center rounded-t-xl border-x border-t border-gray [&>*]:outline-0">{
    `A preview could \n` + `not be displayed.`
}</pre>

// Parent should check if language is available
// WARNING: Potential XSS available if syntax highlighter dependencies poisoned.
// Dependencies: public/shiki/*
// Make sure all are from official sources. See public/shiki/info.md for more details.
const CodePreview = ({ code, language }: CodePreviewParameters) => {
    const [ codeHTML, setCodeHTML ] = useState(placeholderElement);
    code = code.substring(0, 600);
    code = code.split("\n").slice(0, 15).join("\n")
    useEffect(() => {
        async function initialize() {
            if(highlighter === null) {
                try {
                    highlighter = await getHighlighter({
                        themes: [ "github-light", "github-dark" ],
                        langs: []
                    });
                } catch(error) {
                    console.log("An error was encountered getting the syntax highlighter:");
                    console.log((error as Error).name);
                    console.log((error as Error).message);
                    setCodeHTML(errorElement);
                    highlighter = null;
                    return;
                }
            }
            if(!highlighter.getLoadedLanguages().includes(language)) {
                try {
                    await highlighter.loadLanguage(language);
                } catch(error) {
                    console.log("Could not load language with extension " + language + ".");
                    console.log("Error message from loading language:")
                    console.log((error as Error).name);
                    console.log((error as Error).message);
                    setCodeHTML(errorElement);
                    return;
                }
            }
            setCodeHTML(
                <pre className="w-[350px] h-[180px] mx-4 mt-5 px-4 pt-3 overflow-x-clip
                    overflow-y-clip text-[7px] rounded-t-xl border-x border-t border-gray [&>*]:outline-0"
                    style={{ backgroundColor: highlighter.getBackgroundColor("github-light") }}
                    dangerouslySetInnerHTML={{
                        __html: highlighter.codeToHtml(code, { lang: language, theme: "github-light" })
                }} />
            );
        }
        setCodeHTML(placeholderElement);
        initialize();
    }, [code, language]);
    return <>
    { codeHTML &&
        <div className="bg-light-gray border border-gray rounded-xl flex justify-center">
            { codeHTML }
        </div>
    }</>;
};

export default CodePreview;