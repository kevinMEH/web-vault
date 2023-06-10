import { useEffect, useState } from "react";
import { getHighlighter, setCDN } from "shiki";
import { Highlighter, Lang } from "shiki"; // Type

setCDN("/shiki/")

let highlighter: Highlighter | null = null;

type CodePreviewParameters = {
    code: string;
    language: Lang;
};

// Parent should check if language is available
const CodePreview = ({ code, language }: CodePreviewParameters) => {
    const [ codeHTML, setCodeHTML ] = useState(
        <pre className="bg-white w-[350px] h-[180px] mx-4 mt-5 rounded-t-xl border-x border-t border-gray" />
    )
    code = code.substring(0, 600);
    useEffect(() => {
        async function initialize() {
            if(highlighter === null) {
                highlighter = await getHighlighter({
                    themes: [ "github-light", "github-dark" ]
                })
            }
            if(!highlighter.getLoadedLanguages().includes(language)) {
                await highlighter.loadLanguage(language);
            }
            setCodeHTML(<pre className="w-[350px] h-[180px] mx-4 mt-5 px-4 pt-3 overflow-x-scroll
            overflow-y-clip text-[7px] rounded-t-xl border-x border-t border-gray [&>*]:outline-0"
            style={{ backgroundColor: highlighter.getBackgroundColor("github-light") }}
            dangerouslySetInnerHTML={{
                __html: highlighter.codeToHtml(code, { lang: language, theme: "github-light" })
            }}/>)
        }
        initialize();
    }, [code, language]);
    return <div className="bg-light-gray border border-gray rounded-xl flex justify-center">
        { codeHTML }
    </div>;
};

export default CodePreview;