"use client"
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getVaultToken } from "../../../helpers/storage";

const Vault = () => {
    const router = useRouter();

    useEffect(() => {
        const vaultToken = getVaultToken();
        if(vaultToken === null) {
            router.push("/login");
        } else {
            router.push("/");
        }
    }, []);

    return <>
    </>
}

export default Vault;