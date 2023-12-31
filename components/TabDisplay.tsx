import { useState } from "react";
import IconedText from "./IconedText";

export type Tab = {
    title: string;
    iconFunction: (_: any) => JSX.Element;
    children: React.ReactNode;
}

type TabDisplayParameters = {
    tabs: Tab[];
}

const TabDisplay = ({ tabs }: TabDisplayParameters) => {
    const [ activeTab, setActiveTab ] = useState(0);
    return <div>
        <div className="flex space-x-3 mx-6">{ tabs.map((tab, i) => {
            return <div
                className={`flex-1 bg-white px-3.5 py-2 h-full text-sm rounded-t-md hover:bg-light-gray
                    text-center box-border border-b-[3px] transition-all cursor-pointer font-medium 
                    ${activeTab === i ? "text-accent-dark border-accent-dark" : "text-sub border-transparent hover:border-b-half-gray"}`
                }
                key={tab.title}
                onClick={() => { setActiveTab(i); }
            }>
                <IconedText IconFunction={tab.iconFunction} text={tab.title} iconName={tab.title} />
            </div>})}
        </div>
        { tabs[activeTab].children }
    </div>
}

export default TabDisplay;