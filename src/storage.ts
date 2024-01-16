// Frontend only

export function setAdminToken(vaultToken: string) {
    localStorage.setItem("admin_token", vaultToken); // eslint-disable-line
}

export function getAdminToken(): string | null {
    return localStorage.getItem("admin_token"); // eslint-disable-line
}