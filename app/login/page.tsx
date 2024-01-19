import Image from "next/image";

import VaultLogin from "./VaultLogin";

import Logo from "../../public/logos/logo-text.svg";
import Banner from "../../images/banner.jpeg";
import { Metadata } from "next";


export const metadata: Metadata = {
    title: "Vault Login",
    description: "Login to your Web Vault instance"
}

const Login = () => {
    return <>
        {/* <StandardHead title="Vault Login" description="Login to your Web Vault instance" /> */}
        <Image src={Logo} alt="Logo with text" height={24} className="fixed left-10 bsm:left-0 bsm:right-0 bsm:mx-auto top-5" />
        <main className="bsm:px-6 px-8 bg-light-gray min-h-screen flex items-center justify-center">
            <VaultLogin title="Welcome to Kevin's Vaults"
                description="Welcome to my personal vaults! Please do not steal
                other people's files, upload pirated software, or do anything
                illegal. I do not want to be arrested."
                image={Banner} imageAlt="Aerial view of a beach"
                className="max-w-4xl mx-auto mb-12 bsm:-mb-6"
            />
        </main>
    </>
}

export default Login;