import { createLogger } from "./logger";

export const throwErrorWOStackTrace = (errorMessage: string): void => {
	const error = new Error(errorMessage);
	createLogger("util#throwErrorWOStackTrace").error("", error.stack);
	delete error.stack;
	throw error;
};
