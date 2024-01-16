// Frontend only

export function setVaultToken(vaultToken: string) {
    localStorage.setItem("vault_token", vaultToken); // eslint-disable-line
}

export function getVaultToken(): string | null {
    return localStorage.getItem("vault_token"); // eslint-disable-line
}