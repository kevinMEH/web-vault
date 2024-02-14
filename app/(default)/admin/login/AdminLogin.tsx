"use client"

import { useEffect, useState } from "react";
import Image, { StaticImageData } from "next/image";
import { useRouter } from "next/navigation";
import Button from "../../../../components/Button";
import TextField from "../../../../components/TextField";

import { post } from "../../../../helpers/requests";
import { getAdminToken, removeAdminToken, setAdminToken, } from "../../../../helpers/storage";
import type { Expect as LoginExpect, Data as LoginData } from "../../../api/admin/login/route";
import type { Expect as AdminAccessExpect, Data as AdminAccessData } from "../../../api/admin/admin_access/route";

type AdminLoginParameters = {
    title: string;
    description: string;
    image: StaticImageData;
    imageAlt: string;
    className?: string;
};

const AdminLogin = ({ title, description, image, imageAlt, className = "" }: AdminLoginParameters) => {
    const [ adminName, setAdminName ] = useState("");
    const [ password, setPassword ] = useState("");
    const [ submitting, setSubmitting ] = useState(false);
    const [ error, setError ] = useState(null as string | null);
    
    const router = useRouter();
    
    useEffect(() => {
        (async () => {
            const adminToken = getAdminToken();
            if(adminToken !== null) {
                const validToken = (await post<AdminAccessExpect, AdminAccessData>("/api/admin/admin_access", { adminToken })).access === true;
                if(validToken) {
                    router.push("/admin/dashboard");
                } else {
                    removeAdminToken();
                }
            }
        })();
    }, [router]);
    
    async function onLogin() {
        if(adminName === "" || password === "") {
            setError("Please enter the admin name and password.");
            return;
        }
        setSubmitting(true);
        const token = (await post<LoginExpect, LoginData>("/api/admin/login", { adminName, password })).token ?? null;
        setSubmitting(false);
        if(token === null) {
            setError("Invalid admin name and password combination.");
            return;
        }
        setAdminToken(token);
        router.push("/admin/dashboard");
    }

    return <div className={"flex flex-row bg-white border border-gray rounded-3xl overflow-clip " + className}>
        <div className="basis-[55%] py-14 px-12 flex items-center">
            <div className="w-full">
                <h1 className="text-4xl text-main font-title font-bold">{title}</h1>
                <p className="text-base font-inter text-sub pt-4">{description}</p>
                { error !== null && <p className="text-sm font-inter text-error-light pt-3">{error}</p> }
                <TextField name="Admin Name" labelText="Admin Name" id="admin-field"
                    placeholder="Admin name" value={adminName} setValue={setAdminName}
                    type="text" error={error !== null} disabled={submitting}
                    className={"!mt-1 max-w-xs !w-auto " + (error === null ? "pt-5" : "pt-3")}
                />
                <TextField name="Password" labelText="Password" id="password-field"
                    placeholder="Password" value={password} setValue={setPassword}
                    type="password" error={error !== null} disabled={submitting}
                    className="pt-5 max-w-xs !w-auto"
                />
                <Button onClick={onLogin} disabled={adminName === "" || password === "" || submitting}
                    className="mt-5 text-sm font-inter font-medium text-main w-full max-w-xs
                    rounded-lg py-3 bg-accent-light hover:bg-accent-medium transition-colors
                    disabled:bg-accent-extra-light disabled:text-main/50"
                >Login</Button>
            </div>
        </div>
        <div className="basis-[45%] relative">
            <Image src={image} alt={imageAlt} priority={true}
                className="w-full h-full absolute inset-0 object-cover"
            />
        </div>
    </div>
}

export default AdminLogin;