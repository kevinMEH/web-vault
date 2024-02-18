import JWT, { unixTime } from "jwt-km";
import { metaLog } from "./logger";
import { invalidAdminIssuingDate, resetAdminNonce, verifyAdminPassword } from "./authentication/database";
import { ADMIN_JWT_EXPIRATION, DOMAIN, JWT_SECRET } from "./env";
import type { VaultPayload } from "./authentication/vault_token";
import { addLongTimeout } from "./cleanup";

export type AdminPayload = {
    iss: string,
    exp: number,
    iat: number,
    type: "admin",
    adminName: string
}

function __createAdminToken(adminName: string) {
    const current = unixTime();
    const jwt = new JWT(DOMAIN, current + ADMIN_JWT_EXPIRATION, current);
    jwt.addClaim("type", "admin");
    jwt.addClaim("adminName", adminName);
    const token = jwt.getToken(JWT_SECRET);
    metaLog("admin", "INFO", `Created new admin token for admin ${adminName}. Token: ${token}`);
    return token;
}

async function __getUnwrappedAdmin(token: string): Promise<AdminPayload | null> {
    const unwrapped = JWT.unwrap(token, JWT_SECRET);
    if(unwrapped === null) {
        return null;
    }
    const [ _header, payload ] = unwrapped as [ unknown, AdminPayload | VaultPayload ];
    if(payload.type !== "admin") {
        return null;
    }
    if(payload.exp < unixTime()) {
        return null;
    }
    if(await invalidAdminIssuingDate(payload.adminName, payload.iat)) {
        return null;
    }
    return payload;
}

async function adminLogin(adminName: string, password: string): Promise<string | null> {
    if(await verifyAdminPassword(adminName, password)) {
        metaLog("admin", "INFO", `Successful login attempt for admin ${adminName}.`);
        addLongTimeout(`Automatic admin ${adminName} nounce change`, async () => {
            await resetAdminNonce(adminName);
        }, ADMIN_JWT_EXPIRATION * 1000);
        return __createAdminToken(adminName);
    }
    // TODO: Log unsuccessful login and also include IP
    // TODO: Rate limit and ban IPs for brute force logins
    // Perhaps implement on upper level?
    return null;
}

async function adminLogout(token: string): Promise<boolean> {
    const unwrapped = await __getUnwrappedAdmin(token);
    if(unwrapped === null) {
        // TODO: Rate limits, IP bans
        // Perhaps implement on upper level?
        return false;
    }
    const adminName = unwrapped.adminName;
    await resetAdminNonce(adminName);
    metaLog("admin", "INFO", `Successfully logged out and reset nonce for admin ${adminName}.`);
    return true;
}

// TODO: Add permissions, multiple access levels, etc.
async function adminAccess(token: string): Promise<boolean> {
    const unwrapped = await __getUnwrappedAdmin(token);
    if(unwrapped === null) {
        // TODO: Rate limits, IP bans
        // Perhaps implement on upper level?
        return false;
    }
    return true;
}

export {
    adminLogin,
    adminLogout,
    adminAccess
}