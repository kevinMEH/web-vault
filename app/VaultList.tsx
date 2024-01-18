"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "../components/Button";

import { post } from "../src/requests";
import { getVaultToken } from "../src/storage";
import { objectFromBase64 } from "../src/jwt_helper";
import type { Data, Expect } from "../app/api/vault/trim/route";
import type { WebVaultPayload } from "../src/authentication/vault_token";


const VaultList = () => {
    const router = useRouter();
    const [ vaults, setVaults ] = useState([] as string[]);

    useEffect(() => {
        async function fetchVaults(): Promise<string[]> {
            const vaultToken = getVaultToken();
            if(vaultToken === null) {
                return [];
            }
            const trimmedToken = (await post<Expect, Data>("/api/vault/trim", { token: vaultToken })).token ?? null;
            if(trimmedToken === null) {
                return [];
            }
            const payload = objectFromBase64(trimmedToken.split(".")[1]) as WebVaultPayload;
            if(payload.access.length === 0) {
                return [];
            }
            return payload.access.map(access => access.vault);
        }
        fetchVaults().then(vaults => {
            if(vaults.length === 0) {
                router.push("/login");
            } else {
                setVaults(vaults);
            }
        })
    }, [router]);

    return <>{
        vaults.map(vault => 
        <Button href={`vault/${vault}`} key={vault} className="border border-gray rounded-md h-20 px-4 py-3 flex justify-between select-none">
            <h2 className="font-mono text-base font-medium text-main">{vault}</h2>
            <div className="flex flex-col justify-end">
                <Button className="border border-gray py-1.5 px-3 font-inter text-sm rounded-md block">Logout</Button>
            </div>
        </Button>)
    }</>
}

export default VaultList;