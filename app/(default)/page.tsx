import type { Metadata } from "next";
import Image from "next/image";

import VaultList from "./VaultList";

import Logo from "../../public/logos/logo-text.svg";


export const metadata: Metadata = {
    title: "Web Vault"
}

const Page = () => {
    return <>
        <Image src={Logo} alt="Logo with text" height={24} className="fixed left-10 top-5" />
        <main className="min-h-screen flex items-center justify-center">
            <div className="px-10 pt-9 max-w-4xl w-[60vw] h-[50vh] bg-white border border-gray rounded-xl flex flex-col">
                <h1 className="font-title text-3xl text-main font-bold pl-1 mb-4">Vault Access</h1>
                <div className="border-t border-gray mb-5 mx-0.5"></div>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))] overflow-scroll hide-scrollbar pb-9">
                    <VaultList />
                </div>
            </div>
        </main>
    </>
}


export default Page;