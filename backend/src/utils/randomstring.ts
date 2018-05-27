import * as crypto from "crypto";

export default (length?: number) => crypto.randomBytes(length ? length : 32).toString("hex");
