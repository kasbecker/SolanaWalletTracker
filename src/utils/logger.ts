// src/utils/logger.ts - Simple logger for basic functionality
export class Logger {
    info(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    warn(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    error(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    debug(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.debug(`[${timestamp}] DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}

export const logger = new Logger();