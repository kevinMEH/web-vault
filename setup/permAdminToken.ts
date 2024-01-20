import JWT from "jwt-km";
import { DOMAIN, JWT_SECRET } from "../src/env";

const jwt = new JWT(DOMAIN, 2800000000, 3100000000);
jwt.addClaim("type", "admin");
jwt.addClaim("adminName", "admin");
const token = jwt.getToken(JWT_SECRET);
console.log("Generated permenant admin token:")
console.log()
console.log(token);
console.log()
console.log("WARNING: Use this token for development only, using a development JWT_SECRET. If this token is generated using production JWT_SECRET and leaked, there will be catastrophic consequences.");