export const toBase64: (source: string) => string = source => Buffer.from(source).toString("base64");
export const fromBase64: (b64string: string) => string = b64string => Buffer.from(b64string, "base64").toString("utf8");
