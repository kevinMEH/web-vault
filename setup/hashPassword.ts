// This is a helper script to quickly obtain a desired password's hash, for
// example to use as the DEFAULT_ADMIN_PASSWORD_HASH environment variable.

import readline from "readline/promises";
import { hashPassword } from "../src/authentication/password";
import { PASSWORD_SALT, ITERATION_COUNT } from "../src/env";

const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("ATTENTION: Make sure that the PASSWORD_SALT and ITERATION_COUNT environment variables are set in the .env.local file.")
console.log("Current password salt (hex): " + PASSWORD_SALT.toString("hex"));
console.log("Current iteration count: " + ITERATION_COUNT);
console.log();
const password = await readlineInterface.question("Please enter the password to hash: ");
const hashedPassword = await hashPassword(password, PASSWORD_SALT, ITERATION_COUNT);
console.log();
console.log("Hashed password:")
console.log();
console.log(hashedPassword);
console.log();
readlineInterface.close();