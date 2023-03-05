class CustomError extends Error implements NodeJS.ErrnoException {
    isCustom = true;
    type: "ERROR" | "WARNING" | "INFO";
    // NO_ERROR_CODE if no error code.
    code: string;

    constructor(message: string, type: "ERROR" | "WARNING" | "INFO", code?: string) {
        super(message);
        this.type = type;
        this.code = code || "NO_ERROR_CODE";
    }
}

export default CustomError;