import { createHmac } from "crypto";
import { unixTime } from "./helper.js";

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

    token: string = "";
    
    static reservedClaims = ["iss", "exp", "iat"];

    constructor(issuer: string, expiration: number, issuedAt: number) {
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
        const body = this.encodedHeader + "." + toBase64(this.payload);
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
    
    getEncryptedToken() {
        if(this.token === "") {
            throw new Error("The JSON Web Token has not been finalized yet.");
        }
        // TODO:
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
        return [fromBase64(parts[0]) as Header, fromBase64(parts[1]) as Payload];
    }
}

function toBase64(object: Object) {
    return Buffer.from(JSON.stringify(object)).toString("base64url");
}

function fromBase64(string: string): object {
    return JSON.parse(Buffer.from(string, "base64url").toString());
}

export default JWT;