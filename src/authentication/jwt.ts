import { createCipheriv, createDecipheriv, createHmac, randomFillSync } from "crypto";
import { unixTime } from "../helper.js";

type Header = {
    alg: string,
    typ: string
};

type Payload = {
    iss: string,
    exp: number,
    iat: number,
    [key: string]: any
};

class JWT {

    header?: Header;
    encodedHeader: string;
    payload: Payload;

    token = "";
    
    static reservedClaims = ["iss", "exp", "iat"];

    constructor(issuer: string, expiration: number, issuedAt?: number) {
        // this.header = {
        //     alg: "HS256",
        //     typ: "JWT"
        // };
        // this.encodedHeader = toBase64(header);
        // Simplified for performance
        this.encodedHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        this.payload = Object.create(null);
        this.payload.iss = issuer;
        this.payload.exp = expiration;
        this.payload.iat = issuedAt || unixTime();
    }
    
    addClaim(claimName: string, value: any) {
        if(JWT.reservedClaims.includes(claimName)) {
            throw new Error("You cannot redefine the " + claimName + " claim as it is a reserved claim.");
        }
        this.payload[claimName] = value;
        return this;
    }
    
    // Secret must be compact hex string.
    finalize(secret: string) {
        if(!(/^[a-fA-F0-9]+$/.test(secret))) {
            throw new Error("Secret must be a hex string. (No 0x)");
        }
        const body = this.encodedHeader + "." + objectToBase64(this.payload);
        const hmac = createHmac("sha256", Buffer.from(secret, "hex"));
        hmac.update(body);
        const signature = hmac.digest("base64url");
        this.token = body + "." + signature;
        return this;
    }
    
    getToken(secret?: string) {
        if(this.token === "") {
            if(secret === undefined) {
                throw new Error("The JSON Web Token has not been finalized yet. (Provide a secret to automatically finalize.)");
            } else {
                this.finalize(secret);
            }
        }
        return this.token;
    }
    
    static algorithm = "aes-256-cbc";
    // Encrypts token using AES.
    // 1st part of token will be the initialization vector,
    // 2nd part will be the encrypted token. Separated by a "."
    // AES key must be compact hex string
    getEncryptedToken(aesKey: string, secret?: string) {
        if(this.token === "") {
            if(secret === undefined) {
                throw new Error("The JSON Web Token has not been finalized yet.");
            } else {
                this.finalize(secret);
            }
        }
        if(!(/^[a-fA-F0-9]+$/.test(aesKey)) || aesKey.length != 64) { // Using AES 256
            throw new Error("AES key must be a hex string length 64 (256 bits). (No 0x)");
        }
        // AES block size 16 bytes
        const initVector = randomFillSync(new Uint8Array(16));
        const cipher = createCipheriv(JWT.algorithm, Buffer.from(aesKey, "hex"), initVector);
        const encodedToken = toBase64(this.token); // We have to encode again because of the "." in the token. (Not valid base64url)
        
        return Buffer.from(initVector).toString("base64url") + "." + cipher.update(encodedToken, "base64url", "base64url") + cipher.final("base64url");
    }
    

    static #verify(token: string, secret: string) {
        const parts: string[] = token.split(".");
        if(parts.length !== 3) {
            throw new Error("Invalid JSON Web Token format.");
        }
        if(!(/^[a-fA-F0-9]+$/.test(secret))) {
            throw new Error("Secret must be a hex string. (No 0x)");
        }
        const body = parts[0] + "." + parts[1];
        const hmac = createHmac("sha256", Buffer.from(secret, "hex"));
        hmac.update(body);
        const signature = hmac.digest("base64url");
        return signature === parts[2];
    }
    
    // Token will be verified before unwrapping.
    // Header and payload structure will not be verified.
    // Expiration will not be checked.
    // Throws error on bad token, secret, or signature.
    // 
    // Note on payload structure: Assuming that we issue the token, we should know
    // and be able to expect the format the token is in. If user tries to pass in
    // a token with modified header keys and values, the signature will not verify
    // and an error will be thrown before the bad payload and header is returned.
    static unwrap(token: string, secret: string): [Header, Payload] {
        if(!JWT.#verify(token, secret)) {
            throw new Error("Token signature does not match header and body.");
        }
        const parts = token.split(".");
        return [objectFromBase64(parts[0]) as Header, objectFromBase64(parts[1]) as Payload];
    }
    
    // Token will be decrypted, verified, and unwrapped.
    // Header and payload structure will not be verified.
    // Expiration will not be checked.
    // Will throw error on bad token structure, bad initialization vector.
    static unwarpEncrypted(encryptedToken: string, aesKey: string, secret: string): [Header, Payload] {
        if(!(/^[a-fA-F0-9]+$/.test(aesKey)) || aesKey.length != 64) { // Using AES 256
            throw new Error("AES key must be a hex string length 64 (256 bits). (No 0x)");
        }

        const encryptedParts = encryptedToken.split(".");
        if(encryptedParts.length !== 2) {
            throw new Error("Invalid encrypted token format.");
        }

        const initVector = Uint8Array.from(Buffer.from(encryptedParts[0], "base64url"));
        if(initVector.length !== 16) {
            throw new Error("Bad initialization vector length. Expected 16 unsigned 8 bit integers, received " + initVector.length + ".");
        }

        const decipher = createDecipheriv(JWT.algorithm, Buffer.from(aesKey, "hex"), initVector);
        const encodedToken = decipher.update(encryptedParts[1], "base64url", "base64url") + decipher.final("base64url");
        const token = fromBase64(encodedToken);
        return this.unwrap(token, secret);
    }
}

function toBase64(string: string) {
    return Buffer.from(string).toString("base64url");
}

function fromBase64(string: string) {
    return Buffer.from(string, "base64url").toString();
}

function objectToBase64(object: object) {
    return Buffer.from(JSON.stringify(object)).toString("base64url");
}

function objectFromBase64(string: string): object {
    return JSON.parse(Buffer.from(string, "base64url").toString());
}

export default JWT;