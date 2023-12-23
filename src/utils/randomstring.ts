import * as crypto from "crypto";

export default (length?: number | null): string => {
	const safeLength = typeof length === "undefined" || length === null
		? 32
		: length;
	return crypto.randomBytes(safeLength).toString("hex");
};
