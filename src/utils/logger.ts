export const logger = {
    info: (category: string, message: string) => {
        const timestamp = new Date().toLocaleString();
        console.log(`[\x1b[90m${timestamp}\x1b[0m] [\x1b[36m${category}\x1b[0m] ${message}`);
    },
    success: (category: string, message: string) => {
        const timestamp = new Date().toLocaleString();
        console.log(`[\x1b[90m${timestamp}\x1b[0m] [\x1b[32m${category}\x1b[0m] ${message}`);
    },
    warn: (category: string, message: string) => {
        const timestamp = new Date().toLocaleString();
        console.log(`[\x1b[90m${timestamp}\x1b[0m] [\x1b[33m${category}\x1b[0m] ${message}`);
    },
    error: (category: string, message: string) => {
        const timestamp = new Date().toLocaleString();
        console.error(`[\x1b[90m${timestamp}\x1b[0m] [\x1b[31m${category}\x1b[0m] ${message}`);
    }
};