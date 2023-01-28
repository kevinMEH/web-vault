import { pbkdf2Sync } from "node:crypto";

// Hashes a password using the given salt and iteration count, and returns the hex
// Uses a 32 byte key length (256 bits) and sha256 as digest
function hashPassword(password: string, salt: Buffer, iterations: number): string {
    const key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
    return key.toString("hex");
}

export { hashPassword };