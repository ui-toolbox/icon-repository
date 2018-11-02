import loggerFactory from "./logger";

export const throwErrorWOStackTrace: (errorMessage: string) => void
= errorMessage => {
    const error = new Error(errorMessage);
    loggerFactory("util#throwErrorWOStackTrace").error("", error.stack);
    delete error.stack;
    throw error.message;
};
