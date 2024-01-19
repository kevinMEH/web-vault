// Frontend only

export function setAdminToken(adminToken: string) {
    localStorage.setItem("admin_token", adminToken); // eslint-disable-line
}

export function getAdminToken(): string | null {
    return localStorage.getItem("admin_token"); // eslint-disable-line
}

export function removeAdminToken() {
    localStorage.removeItem("admin_token"); // eslint-disable-line
}

export function setVaultToken(vaultToken: string) {
    localStorage.setItem("vault_token", vaultToken); // eslint-disable-line
}

export function getVaultToken() {
    return localStorage.getItem("vault_token"); // eslint-disable-line
}

export function removeVaultToken() {
    return localStorage.removeItem("vault_token"); // eslint-disable-line
}