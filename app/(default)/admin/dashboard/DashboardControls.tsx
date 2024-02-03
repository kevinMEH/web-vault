"use client"

import { useEffect, useState } from "react";

import SimpleTwoFields from "./SimpleTwoFields";

import { post } from "../../../../src/requests";
import type { Expect as GetVaultsExpect, Data as GetVaultsData } from "../../../api/admin/get_vaults/route";
import type { Expect as CreateVaultExpect, Data as CreateVaultData } from "../../../api/admin/create_vault/route";
import type { Expect as DeleteVaultExpect, Data as DeleteVaultData } from "../../../api/admin/delete_vault/route";
import type { Expect as ChangeVaultPasswordExpect, Data as ChangeVaultPasswordData } from "../../../api/admin/change_vault_password/route";
import { getAdminToken, removeAdminToken } from "../../../../src/storage";
import { useRouter } from "next/navigation";


const DashboardControls = () => {
    const router = useRouter();
    const [ adminToken, setAdminToken ] = useState("");
    useEffect(() => {
        const token = getAdminToken();
        if(token === null) {
            router.push("/admin/login");
            setAdminToken("");
        } else {
            setAdminToken(token);
        }
    }, [router])
    const [ vaults, setVaults ] = useState(undefined as string[] | undefined);
    const [ nonce, setNonce ] = useState(0);

    useEffect(() => {
        (async () => {
            const adminToken = getAdminToken();
            if(adminToken === null) {
                router.push("/admin/login");
                return;
            }
            let vaults = (await post<GetVaultsExpect, GetVaultsData>("/api/admin/get_vaults", { adminToken })).vaults;
            if(vaults === undefined) {
                removeAdminToken();
                router.push("/admin/login");
                return;
            }
            if(vaults.length === 0) {
                vaults = [ "No vaults to display." ];
            }
            setVaults(vaults);
        })();
    }, [router, nonce]);

    return <div className="space-y-5">
        <div>
            <h2 className="font-inter text-xl font-semibold">Current Vaults:</h2>
            <div>
                { vaults === undefined ? <p>Loading vaults...</p> : vaults.map(vault =>
                    <p key={vault}>{vault}</p>
                ) }
            </div>
        </div>
        <SimpleTwoFields
            label="Create New Vault"
            fieldOneId="new-vault-name"
            fieldOneLabelText="New Vault Name"
            fieldOnePlaceholder="vault_name"
            fieldOneType="text"
            fieldTwoId="new-vault-password"
            fieldTwoLabelText="New Vault Password"
            fieldTwoPlaceholder="Password"
            fieldTwoType="password"
            submit={async (vaultName, password): Promise<string> => {
                const result = await post<CreateVaultExpect, CreateVaultData>("/api/admin/create_vault", { adminToken, vaultName, password });
                setNonce(prev => prev + 1);
                if(result.success === true) {
                    return "Success!";
                } else {
                    return result.failureReason || "Failed with unknown reason.";
                }
            }}
        />
        <SimpleTwoFields
            label="Delete Vault"
            fieldOneId="delete-vault-name"
            fieldOneLabelText="Delete Vault Name"
            fieldOnePlaceholder="vault_name"
            fieldOneType="text"
            fieldTwoId="delete-vault-password"
            fieldTwoLabelText="Useless (Leave blank)"
            fieldTwoPlaceholder="Useless (Leave blank)"
            fieldTwoType="password"
            submit={async (vaultName): Promise<string> => {
                await post<DeleteVaultExpect, DeleteVaultData>("/api/admin/delete_vault", { adminToken, vaultName });
                setNonce(prev => prev + 1);
                return "";
            }}
        />
        <SimpleTwoFields
            label="Change Vault Password"
            fieldOneId="vault-name"
            fieldOneLabelText="Vault Name"
            fieldOnePlaceholder="vault_name"
            fieldOneType="text"
            fieldTwoId="vault-password"
            fieldTwoLabelText="Vault Password"
            fieldTwoPlaceholder="Password"
            fieldTwoType="password"
            submit={async (vaultName, password): Promise<string> => {
                const result = await post<ChangeVaultPasswordExpect, ChangeVaultPasswordData>("/api/admin/change_vault_password", { adminToken, vaultName, password });
                setNonce(prev => prev + 1);
                if(result.success === true) {
                    return "Success!";
                } else {
                    return "Failed.";
                }
            }}
        />
    </div>
}

export default DashboardControls;