import assert from "assert";

// Expects an error, throwing an error if there is no error.
// The error message can be a substring of the full error message.
// Returns a function that can be tested.
function expectError(testFunction: Function, errorMessage: string) {
    return () => {
        try {
            testFunction()
        } catch(error) {
            assert((error as Error).message.includes(errorMessage),
                "Error message \"" + (error as Error).message
                + "\" does not include the expected error message \""
                + errorMessage + "\".");
            return;
        }
        throw new Error("Expected error \"" + errorMessage + "\" but found success instead.");
    }
}

function asyncExpectError(testFunction: Function, errorMessage: string) {
    return async () => {
        try {
            await testFunction();
        } catch(error) {
            assert((error as Error).message.includes(errorMessage),
                "Error message \"" + (error as Error).message
                + "\" does not include the expected error message \""
                + errorMessage + "\".");
            return;
        }
        throw new Error("Expected error \"" + errorMessage + "\" but found success instead.");
    }
}

export { expectError, asyncExpectError };