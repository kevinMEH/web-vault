import { memo } from "react";

import { BUNDLED_LANGUAGES, Lang } from "shiki";

import ItemIcon from "../../../components/ItemIcon";
import TabDisplay, { Tab } from "../../../components/TabDisplay";
import CodePreview from "../../../components/Code/CodePreview";
import TextField from "../../../components/TextField";
import DetailsSVG from "../../../components/SVGS/DetailsSVG";

import { File, Directory } from "../../../src/vfs";
import { timeAgo, convertBytes } from "../../../src/helper";
import ActivitySVG from "../../../components/SVGS/ActivitySVG";

type DetailsParameters = {
    item: File | Directory | null;
}

const code = `import fs from "fs/promises";
import path from "path";
import { metaLog, vaultLog } from "./logger";
import { ValidatedPath, getVaultFromPath, getDirectoryAt, splitParentChild, getAt, VaultPath, getVaultVFS } from "./controller";
import { File, Directory } from "./vfs";

import { BASE_VAULT_DIRECTORY } from "./env";

import { shutdown } from "./cleanup";

const deletionTimeout = 15 * 1000;
const tempFileDirectory = path.join(BASE_VAULT_DIRECTORY, "temp");
const hexTo12 = Math.pow(16, 12);

function randomFileName(): string {
    return Math.floor(Math.random() * hexTo12).toString(16).padStart(12, "0");
}`

const Details = memo(function Details({ item }: DetailsParameters) {
    const name = item?.name;
    const nameExtension = name !== undefined ? name.substring(name.lastIndexOf(".") + 1) : undefined;
    const displayable = nameExtension !== undefined ? BUNDLED_LANGUAGES.some(bundle => {
        return bundle.id === nameExtension || bundle.aliases?.includes(nameExtension);
    }) : false;

    const tabs: Tab[] = [{
        title: "Details",
        iconFunction: DetailsSVG,
        children: <div className="px-6 py-6 space-y-8">
            { displayable && <CodePreview code={code} language={nameExtension as Lang} /> }
            <div className="space-y-3">
                <h3 className="text-main">File Details</h3>
                <div>
                    <h4 className="text-quiet text-xs">Size</h4>
                    <p className="text-sub text-sm leading-relaxed">{convertBytes(item?.getByteSize() as number)}</p>
                    {/* TODO: If it is a directory, get byte size from server. */}
                </div>
                <div>
                    <h4 className="text-quiet text-xs">Created</h4>
                    <p className="text-sub text-sm leading-relaxed">{item?.lastModified.toLocaleString(undefined, { month:"short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" })}</p>
                    {/* TODO: Add this field */}
                </div>
                <div>
                    <h4 className="text-quiet text-xs">Modified</h4>
                    <p className="text-sub text-sm leading-relaxed" >{item?.lastModified.toLocaleString(undefined, { month:"short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" })}</p>
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-main">Sharing</h3>
                <p className="text-quiet text-sm">Available to everyone with password</p>
                {/* TODO: Add sharing and sharing availability and functions */}
                <TextField name="sharing-link" labelText="" value={"https://vault.liao.gg/5b89bd15399292"}
                placeholder="" type="text" setValue={() => {void 0}} id="sharing-link-text-field"
                disabled={true} copyButton={true} />
            </div>
        </div>
    }, {
        title: "Activity",
        iconFunction: ActivitySVG,
        children: <div className="px-6 py-4">
            { "TODO: Add activity view. Track activity on file on VFS or somewhere on backend" && "Activity"}
        </div>
    }];

    return <div className="h-full">{
        item == null
        ? <div className="h-full flex justify-center items-center">
            <div className="mb-36 px-6 text-center text-sub text-sm select-none">Select an item to view details</div>
        </div>
        : <div className="overflow-y-scroll hide-scrollbar">
            <div className="px-6 pt-4 pb-6 space-y-1">
                <div className="align-top">
                    <ItemIcon name={item.name} isFolder={item.isDirectory} isOpen={false} width={26} height={26} className="-ml-[0.0625rem] select-none" />
                    <span className="font-mono text-sub text-base font-[425] pl-2 tracking-tight truncate">{item.name}</span>
                </div>
                <div className="text-sm text-quiet truncate">{"Last modified " + timeAgo(item.lastModified)}</div>
            </div>
            <TabDisplay tabs={tabs} />
        </div>
    }</div>
});

export default Details;