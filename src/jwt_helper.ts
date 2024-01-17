// Frontend only

export function objectFromBase64(string: string): Record<string, unknown> | null {
    try {
        return JSON.parse(atob(string));
    } catch(error) {
        return null;
    }
}