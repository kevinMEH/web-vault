import { createCipheriv, createDecipheriv, createHmac, randomFillSync } from "crypto";
import CustomError from "../custom_error.js";
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
    
    /**
     * @param secret The secret represented as a compact hex string (No 0x)
     * @returns this, the finalized JWT object.
     */
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
    
    getToken(secret?: string): string {
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
    /**
     * Encrypts token using AES. 1st part of token will be the initialization vector,
     * 2nd part will be the encrypted token. Parts separated by a ".".
     * 
     * @param aesKey Compact hex string representation of the AES key.
     * @param secret Optional secret if the token has not been finalized yet.
     * @returns 
     */
    getEncryptedToken(aesKey: string, secret?: string): string {
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
    

    /**
     * Given a secret, verifies the JWT.
     * 
     * Returns true / false if the JWT is verified or not.
     * 
     * Returns false if the JWT format is invalid (not 3 parts separated by dots).
     * 
     * Throws a CustomError if the secret is not a compact hex string. (`NOT_HEX_STRING`)
     * This means setup error.
     * 
     * @param token 
     * @param secret The secret in the form of a compact hex string.
     * @returns 
     */
    static #verify(token: string, secret: string): boolean {
        if(!(/^[a-fA-F0-9]+$/.test(secret))) {
            throw new CustomError("Secret must be a hex string. (No 0x)", "ERROR", "NOT_HEX_STRING");
        }
        const parts: string[] = token.split(".");
        if(parts.length !== 3) {
            return false;
        }
        const body = parts[0] + "." + parts[1];
        const hmac = createHmac("sha256", Buffer.from(secret, "hex"));
        hmac.update(body);
        const signature = hmac.digest("base64url");
        return signature === parts[2];
    }
    
    /**
     * Token will be verified before unwrapping.
     * 
     * Header and payload structure will not be verified.
     * 
     * Expiration will not be checked.
     * 
     * Returns the Header and Payload on success.
     * 
     * Returns null if the token does not verify. Ex: invalid format
     * 
     * Throws an error on invalid secret. Error means setup error.
     * 
     * Note on payload structure: Assuming that we issued the token and sign it
     * with our signature, we can guarantee that the token structure is as we
     * issued or else the signature will not match.
     * 
     * @param token 
     * @param secret Must be hex string
     * @returns [Header, Payload] | null
     */
    static unwrap(token: string, secret: string): [Header, Payload] | null {
        if(!JWT.#verify(token, secret)) {
            return null;
        }
        const parts = token.split(".");
        return [objectFromBase64(parts[0]) as Header, objectFromBase64(parts[1]) as Payload];
    }
    
    /**
     * Token will be decrypted, verified, and unwrapped.
     * 
     * Header and payload structure will not be verified.
     * 
     * Expiration will not be checked.
     * 
     * Returns the Header and Payload on success.
     * 
     * Returns null if the token does not verify. Ex: invalid
     * format, bad initialization vector.
     * 
     * Throws an error on invalid AES key. Error means setup error.
     * 
     * Throws an error on invalid secret. Error means setup error.
     * 
     * @param encryptedToken 
     * @param aesKey Must be 64 character hex string
     * @param secret Must be hex string
     * @returns 
     */
    static unwarpEncrypted(encryptedToken: string, aesKey: string, secret: string): [Header, Payload] | null {
        if(!(/^[a-fA-F0-9]+$/.test(aesKey)) || aesKey.length != 64) { // Using AES 256
            throw new Error("AES key must be a hex string length 64 (256 bits). (No 0x)");
        }
        
        const encryptedParts = encryptedToken.split(".");
        if(encryptedParts.length !== 2) {
            return null;
        }

        const initVector = Uint8Array.from(Buffer.from(encryptedParts[0], "base64url"));
        if(initVector.length !== 16) {
            return null;
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