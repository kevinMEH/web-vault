// This is a helper script to generate a random hex string which can be used as
// the JWT_SECRET or the PASSWORD_SALT.

import readline from "readline/promises";

const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("This helper script will generate a random hex string.");
console.log("Recommended hex string length for JWT_SECRET: 64 to 128");
console.log("Recommended hex string length for PASSWORD_SALT: 32 and above");
console.log();
const lengthString = await readlineInterface.question("Please enter in the length of your desired hex string: ");
const length = parseInt(lengthString);
if(isNaN(length)) {
    console.error("Error: Please enter in a valid number.");
    process.exit(0);
}
console.log();
console.log("Your desired hex string:")
console.log();
{
    const keyset = "1234567890ABCDEF".split("");
    let secret = "";
    for(let i = 0; i < length; i++) {
        secret += keyset[Math.floor(Math.random() * 16)];
    }
    console.log(secret);
}
console.log();
readlineInterface.close();