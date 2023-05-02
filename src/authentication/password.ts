import { pbkdf2 } from "node:crypto";

// TODO: Add error handling for functions that use below
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
function hashPassword(password: string, salt: Buffer, iterations: number): Promise<string> {
    return new Promise((resolve, reject) => {
        pbkdf2(password, salt, iterations, 32, "sha256", (error, key) => {
            if(error) reject(error);
            resolve(key.toString("hex"));
        });
    });
}

export { hashPassword };