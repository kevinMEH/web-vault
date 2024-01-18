import type { Metadata } from "next";
import Image from "next/image";
import AdminLogin from "./AdminLogin";
import Logo from "../../../public/logos/logo-text.svg";
import Banner from "../../../images/banner.jpeg";

export const metadata: Metadata = {
    title: "Vault Management",
    description: "Admin panel for Web Vault management",
    robots: {
        index: false,
        follow: false
    }
}

const Admin = () => {
    return <>
        <Image src={Logo} alt="Logo with text" height={24} className="fixed left-10 top-5 bsm:left-0 bsm:right-0 bsm:mx-auto" />
        <main className="px-8 bg-light-gray min-h-screen flex items-center justify-center">
            <AdminLogin
                title="Admin Login"
                description="Super secret login page for admins only!!!"
                image={Banner}
                imageAlt="Admin login side image"
                className="max-w-4xl w-[60vw] min-h-[440px] mx-auto mb-12"
            />
        </main>
    </>
}

export default Admin;