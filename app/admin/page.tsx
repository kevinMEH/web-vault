"use client"

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { post } from "../../src/requests";
import { getAdminToken, removeAdminToken } from "../../src/storage";
import { Data, Expect } from "../api/admin/admin_access/route";

const Page = () => {
    const router = useRouter();
    useEffect(() => {
        (async () =>  {
            const adminToken = getAdminToken();
            if(adminToken === null) {
                router.push("/admin/login");
                return;
            }
            const validToken = (await post<Expect, Data>("/api/admin/admin_access", { adminToken })).access === true;
            if(!validToken) {
                removeAdminToken();
                router.push("/admin/login");
                return;
            }
            router.push("/admin/dashboard");
        })();
    }, [router]);
    return <></>
}

export default Page;