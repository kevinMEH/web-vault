"use client"

import { useEffect, useState } from "react";
import Image, { StaticImageData } from "next/image";
import { useRouter } from "next/navigation";
import Button from "../../components/Button";
import TextField from "../../components/TextField";

import { post } from "../../src/requests";
import { getVaultToken, removeVaultToken, setVaultToken } from "../../src/storage";
import type { Expect as TrimExpect, Data as TrimData } from "../api/vault/trim/route";
import type { Expect as LoginExpect, Data as LoginData } from "../api/vault/login/route";

type VaultLoginParameters = {
    title: string;
    description: string;
    image: StaticImageData;
    imageAlt: string;
    className?: string;
}

const VaultLogin = ({ title, description, image, imageAlt, className = "" }: VaultLoginParameters) => {
    const [vaultName, setVaultName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null as string | null);
    
    const router = useRouter();
    
    useEffect(() => {
        (async () => {
            const vaultToken = getVaultToken();
            if(vaultToken !== null) {
                const trimmed = (await post<TrimExpect, TrimData>("/api/vault/trim", { token: vaultToken })).token ?? null;
                if(trimmed === null) {
                    removeVaultToken();
                } else {
                    setVaultToken(trimmed);
                }
            }
        })();
    }, [router]);
    
    async function onLogin() {
        if(vaultName === "" || password === "") {
            setError("Please enter in the vault name and password.");
            return;
        }
        const existingToken = getVaultToken() ?? undefined;
        setSubmitting(true);
        const newToken = (await post<LoginExpect, LoginData>("/api/vault/login", { vaultName, password, existingToken })).token ?? null;
        setSubmitting(false);
        if(newToken === null) {
            setError("Invalid vault name and password combination.");
            return;
        }
        setVaultToken(newToken);
        router.push(`/vault/${vaultName}`);
    }

    return <div className={`flex flex-row bg-white border border-gray rounded-3xl overflow-clip ` + className}>
        <div className="basis-[55%] py-14 px-12 flex items-center">
            <div className="w-full">
                <h1 className="text-4xl text-main font-title font-bold">{title}</h1>
                <p className="text-base font-inter text-sub pt-4">{description}</p>
                { error !== null && <p className="text-sm font-inter text-error-light pt-3">{error}</p> }
                <TextField name="Vault Name" labelText="Vault Name" id="vault-field"
                    placeholder="Vault Name" value={vaultName} setValue={setVaultName}
                    type="text" error={error !== null} disabled={submitting}
                    className={"!mt-1 max-w-xs !w-auto " + (error === null ? "pt-5" : "pt-3")}
                />
                <TextField name="Password" labelText="Password" id="password-field"
                    placeholder="Password" value={password} setValue={setPassword}
                    type="password" error={error !== null} disabled={submitting}
                    className="pt-5 max-w-xs !w-auto"
                />
                <Button onClick={onLogin} disabled={submitting}
                    className="mt-5 text-sm font-inter font-medium text-main w-full max-w-xs 
                    rounded-lg py-3 bg-accent-light hover:bg-accent-medium transition-colors
                    disabled:bg-accent-extra-light disabled:text-main/50"
                >Access Vault</Button>
            </div>
        </div>
        <div className="basis-[45%] relative">
            <Image src={image} alt={imageAlt} priority={true}
                className="w-full h-full absolute inset-0 object-cover"
            />
        </div>
    </div>
}

export default VaultLogin;