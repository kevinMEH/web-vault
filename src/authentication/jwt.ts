import { createHmac } from "crypto";
import CustomError from "../custom_error.js";
import { unixTime } from "../helper.js";

export type Header = {
    alg: string,
    typ: string
};

export type Payload = {
    iss: string,
    exp: number,
    iat: number,
    [key: string]: any
};

export type UnwrappedToken = [Header, Payload, string];

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
}

function objectToBase64(object: object) {
    return Buffer.from(JSON.stringify(object)).toString("base64url");
}

function objectFromBase64(string: string): object {
    return JSON.parse(Buffer.from(string, "base64url").toString());
}

export default JWT;