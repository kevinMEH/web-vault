import { pbkdf2Sync } from "node:crypto";

/**
 * Hashes a password using the given salt and iteration count,
 * and returns the hex. Uses a 32 byte key length (256 bits)
 * and SHA256 as digest.
 * 
 * @param password plaintext string
 * @param salt Buffer, preferably 16+ bytes
 * @param iterations 
 * @returns Hex string of hashed password
 */
function hashPassword(password: string, salt: Buffer, iterations: number): string {
    const key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
    return key.toString("hex");
}

export { hashPassword };