import logger from "./logger";

export const throwErrorWOStackTrace: (errorMessage: string) => void
= errorMessage => {
    const error = new Error(errorMessage);
    logger.createChild("util#throwErrorWOStackTrace").error("", error.stack);
    delete error.stack;
    throw error.message;
};
