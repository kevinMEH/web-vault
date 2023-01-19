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
    
    addClaim(claimName: string, value: string | number | boolean) {
        if(JWT.reservedClaims.includes(claimName)) {
            throw new Error("You cannot redefine the " + claimName + " claim as it is a reserved claim.");
        }
        this.payload[claimName] = value;
        return this;
    }
    
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
    
    getToken() {
        if(this.token === "") {
            throw new Error("The JSON Web Token has not been finalized yet.");
        }
        return this.token;
    }
    
    getEncryptedToken() {
        if(this.token === "") {
            throw new Error("The JSON Web Token has not been finalized yet.");
        }
        // TODO:
    }
}

function toBase64(object: Object) {
    return Buffer.from(JSON.stringify(object)).toString("base64url");
}

function fromBase64(string: string): object {
    return JSON.parse(Buffer.from(string, "base64url").toString());
}

export default JWT;