// src/utils/logger.ts - Structured logging utility
import { config } from '../config';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 'WALLET_TRACKING' | 'COPY_TRADING' | 'RISK_MANAGEMENT' | 'API' | 'DATABASE' | 'SYSTEM';

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: LogCategory;
    message: string;
    metadata?: { [key: string]: any };
    error?: Error;
}

class Logger {
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 10000;
    private readonly LOG_LEVELS: { [key in LogLevel]: number } = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
    };

    private getCurrentLogLevel(): number {
        const configLevel = config.logging?.level?.toUpperCase() as LogLevel || 'INFO';
        return this.LOG_LEVELS[configLevel];
    }

    private shouldLog(level: LogLevel): boolean {
        return this.LOG_LEVELS[level] >= this.getCurrentLogLevel();
    }

    private formatMessage(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.padEnd(5);
        const category = entry.category.padEnd(15);

        let message = `[${timestamp}] ${level} ${category} ${entry.message}`;

        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            const metadataStr = JSON.stringify(entry.metadata, null, 0);
            message += ` | ${metadataStr}`;
        }

        if (entry.error) {
            message += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                message += `\n  Stack: ${entry.error.stack}`;
            }
        }

        return message;
    }

    private addLog(level: LogLevel, category: LogCategory, message: string, metadata?: any, error?: Error): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            metadata,
            error,
        };

        // Add to in-memory logs
        this.logs.push(entry);

        // Trim logs if too many
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(-this.MAX_LOGS + 1000); // Keep last 9000 + new 1000
        }

        // Console output
        if (config.logging?.console !== false) {
            const formattedMessage = this.formatMessage(entry);

            switch (level) {
                case 'DEBUG':
                    console.debug(formattedMessage);
                    break;
                case 'INFO':
                    console.info(formattedMessage);
                    break;
                case 'WARN':
                    console.warn(formattedMessage);
                    break;
                case 'ERROR':
                    console.error(formattedMessage);
                    break;
            }
        }

        // File logging (if enabled)
        if (config.logging?.file) {
            this.writeToFile(entry);
        }
    }

    private async writeToFile(entry: LogEntry): Promise<void> {
        try {
            // In a real implementation, you'd use fs.appendFile
            // For now, just queue for batch writing
            // This is a placeholder for file logging implementation
        } catch (error) {
            console.error('Failed to write log to file:', error);
        }
    }

    // Main logging methods
    debug(message: string, metadata?: any): void {
        this.addLog('DEBUG', 'SYSTEM', message, metadata);
    }

    info(message: string, metadata?: any): void {
        this.addLog('INFO', 'SYSTEM', message, metadata);
    }

    warn(message: string, metadata?: any): void {
        this.addLog('WARN', 'SYSTEM', message, metadata);
    }

    error(message: string, errorOrMetadata?: Error | any, metadata?: any): void {
        let error: Error | undefined;
        let meta: any = metadata;

        if (errorOrMetadata instanceof Error) {
            error = errorOrMetadata;
        } else {
            meta = errorOrMetadata;
        }

        this.addLog('ERROR', 'SYSTEM', message, meta, error);
    }

    // Category-specific logging methods
    walletTracking = {
        debug: (message: string, metadata?: any) => this.addLog('DEBUG', 'WALLET_TRACKING', message, metadata),
        info: (message: string, metadata?: any) => this.addLog('INFO', 'WALLET_TRACKING', message, metadata),
        warn: (message: string, metadata?: any) => this.addLog('WARN', 'WALLET_TRACKING', message, metadata),
        error: (message: string, errorOrMetadata?: Error | any, metadata?: any) => {
            const error = errorOrMetadata instanceof Error ? errorOrMetadata : undefined;
            const meta = errorOrMetadata instanceof Error ? metadata : errorOrMetadata;
            this.addLog('ERROR', 'WALLET_TRACKING', message, meta, error);
        },
    };

    copyTrading = {
        debug: (message: string, metadata?: any) => this.addLog('DEBUG', 'COPY_TRADING', message, metadata),
        info: (message: string, metadata?: any) => this.addLog('INFO', 'COPY_TRADING', message, metadata),
        warn: (message: string, metadata?: any) => this.addLog('WARN', 'COPY_TRADING', message, metadata),
        error: (message: string, errorOrMetadata?: Error | any, metadata?: any) => {
            const error = errorOrMetadata instanceof Error ? errorOrMetadata : undefined;
            const meta = errorOrMetadata instanceof Error ? metadata : errorOrMetadata;
            this.addLog('ERROR', 'COPY_TRADING', message, meta, error);
        },
    };

    riskManagement = {
        debug: (message: string, metadata?: any) => this.addLog('DEBUG', 'RISK_MANAGEMENT', message, metadata),
        info: (message: string, metadata?: any) => this.addLog('INFO', 'RISK_MANAGEMENT', message, metadata),
        warn: (message: string, metadata?: any) => this.addLog('WARN', 'RISK_MANAGEMENT', message, metadata),
        error: (message: string, errorOrMetadata?: Error | any, metadata?: any) => {
            const error = errorOrMetadata instanceof Error ? errorOrMetadata : undefined;
            const meta = errorOrMetadata instanceof Error ? metadata : errorOrMetadata;
            this.addLog('ERROR', 'RISK_MANAGEMENT', message, meta, error);
        },
    };

    api = {
        debug: (message: string, metadata?: any) => this.addLog('DEBUG', 'API', message, metadata),
        info: (message: string, metadata?: any) => this.addLog('INFO', 'API', message, metadata),
        warn: (message: string, metadata?: any) => this.addLog('WARN', 'API', message, metadata),
        error: (message: string, errorOrMetadata?: Error | any, metadata?: any) => {
            const error = errorOrMetadata instanceof Error ? errorOrMetadata : undefined;
            const meta = errorOrMetadata instanceof Error ? metadata : errorOrMetadata;
            this.addLog('ERROR', 'API', message, meta, error);
        },
    };

    database = {
        debug: (message: string, metadata?: any) => this.addLog('DEBUG', 'DATABASE', message, metadata),
        info: (message: string, metadata?: any) => this.addLog('INFO', 'DATABASE', message, metadata),
        warn: (message: string, metadata?: any) => this.addLog('WARN', 'DATABASE', message, metadata),
        error: (message: string, errorOrMetadata?: Error | any, metadata?: any) => {
            const error = errorOrMetadata instanceof Error ? errorOrMetadata : undefined;
            const meta = errorOrMetadata instanceof Error ? metadata : errorOrMetadata;
            this.addLog('ERROR', 'DATABASE', message, meta, error);
        },
    };

    // Utility methods
    getRecentLogs(count: number = 100): LogEntry[] {
        return this.logs.slice(-count);
    }

    getLogsByLevel(level: LogLevel, count: number = 100): LogEntry[] {
        return this.logs
            .filter(log => log.level === level)
            .slice(-count);
    }

    getLogsByCategory(category: LogCategory, count: number = 100): LogEntry[] {
        return this.logs
            .filter(log => log.category === category)
            .slice(-count);
    }

    getErrorLogs(count: number = 50): LogEntry[] {
        return this.getLogsByLevel('ERROR', count);
    }

    clearLogs(): void {
        this.logs = [];
        this.info('Log history cleared');
    }

    getLogStats(): {
        total: number;
        byLevel: { [key in LogLevel]: number };
        byCategory: { [key in LogCategory]: number };
        oldestLog?: Date;
        newestLog?: Date;
    } {
        const stats = {
            total: this.logs.length,
            byLevel: {
                DEBUG: 0,
                INFO: 0,
                WARN: 0,
                ERROR: 0,
            } as { [key in LogLevel]: number },
            byCategory: {
                WALLET_TRACKING: 0,
                COPY_TRADING: 0,
                RISK_MANAGEMENT: 0,
                API: 0,
                DATABASE: 0,
                SYSTEM: 0,
            } as { [key in LogCategory]: number },
            oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : undefined,
            newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : undefined,
        };

        this.logs.forEach(log => {
            stats.byLevel[log.level]++;
            stats.byCategory[log.category]++;
        });

        return stats;
    }

    // Performance logging
    time(label: string): void {
        console.time(label);
    }

    timeEnd(label: string): void {
        console.timeEnd(label);
    }

    // Structured logging for specific events
    logTradeDetection(walletAddress: string, tokenMint: string, action: 'BUY' | 'SELL', amount: number): void {
        this.copyTrading.info('Trade detected', {
            walletAddress,
            tokenMint,
            action,
            amount,
            event: 'TRADE_DETECTION',
        });
    }

    logTradeExecution(tradeId: string, status: 'SUCCESS' | 'FAILED', txHash?: string, error?: string): void {
        this.copyTrading.info('Trade executed', {
            tradeId,
            status,
            txHash,
            error,
            event: 'TRADE_EXECUTION',
        });
    }

    logRiskAlert(alertType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details: any): void {
        this.riskManagement.warn('Risk alert triggered', {
            alertType,
            severity,
            details,
            event: 'RISK_ALERT',
        });
    }

    logWalletChange(walletAddress: string, changeType: string, details: any): void {
        this.walletTracking.info('Wallet change detected', {
            walletAddress,
            changeType,
            details,
            event: 'WALLET_CHANGE',
        });
    }

    logAPICall(endpoint: string, method: string, duration: number, status: number): void {
        this.api.debug('API call completed', {
            endpoint,
            method,
            duration,
            status,
            event: 'API_CALL',
        });
    }

    logDatabaseOperation(operation: string, table: string, duration: number, recordCount?: number): void {
        this.database.debug('Database operation completed', {
            operation,
            table,
            duration,
            recordCount,
            event: 'DATABASE_OPERATION',
        });
    }

    // Create child logger with default metadata
    createChildLogger(defaultMetadata: any): Logger {
        const childLogger = new Logger();

        // Override addLog to include default metadata
        const originalAddLog = childLogger.addLog.bind(childLogger);
        childLogger.addLog = (level: LogLevel, category: LogCategory, message: string, metadata?: any, error?: Error) => {
            const mergedMetadata = { ...defaultMetadata, ...metadata };
            originalAddLog(level, category, message, mergedMetadata, error);
        };

        return childLogger;
    }

    // Export logs in various formats
    exportLogs(format: 'json' | 'csv' | 'text' = 'json'): string {
        switch (format) {
            case 'json':
                return JSON.stringify(this.logs, null, 2);

            case 'csv':
                const headers = 'timestamp,level,category,message,metadata\n';
                const rows = this.logs.map(log => {
                    const timestamp = log.timestamp.toISOString();
                    const metadata = log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '';
                    return `"${timestamp}","${log.level}","${log.category}","${log.message.replace(/"/g, '""')}","${metadata}"`;
                }).join('\n');
                return headers + rows;

            case 'text':
                return this.logs.map(log => this.formatMessage(log)).join('\n');

            default:
                return JSON.stringify(this.logs, null, 2);
        }
    }
}

// Create singleton logger instance
export const logger = new Logger();

// Utility functions for common logging patterns
export const logExecutionTime = async <T>(
    operation: string,
    fn: () => Promise<T>,
    category: LogCategory = 'SYSTEM'
): Promise<T> => {
    const start = Date.now();

    try {
        const result = await fn();
        const duration = Date.now() - start;
        logger.debug(`${operation} completed in ${duration}ms`, { duration, operation, category });
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error(`${operation} failed after ${duration}ms`, error, { duration, operation, category });
        throw error;
    }
};

export const logWithRetry = async <T>(
    operation: string,
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            if (attempt > 1) {
                logger.info(`${operation} succeeded on attempt ${attempt}/${maxRetries}`);
            }
            return result;
        } catch (error) {
            lastError = error as Error;
            logger.warn(`${operation} failed on attempt ${attempt}/${maxRetries}`, error);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    logger.error(`${operation} failed after ${maxRetries} attempts`, lastError!);
    throw lastError!;
};

// Performance monitoring utilities
export class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();

    recordMetric(name: string, value: number): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const values = this.metrics.get(name)!;
        values.push(value);

        // Keep only last 1000 values
        if (values.length > 1000) {
            values.shift();
        }
    }

    getMetricStats(name: string): {
        count: number;
        avg: number;
        min: number;
        max: number;
        latest: number;
    } | null {
        const values = this.metrics.get(name);
        if (!values || values.length === 0) return null;

        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            avg: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            latest: values[values.length - 1],
        };
    }

    getAllMetrics(): { [key: string]: ReturnType<PerformanceMonitor['getMetricStats']> } {
        const result: any = {};
        for (const [name] of this.metrics) {
            result[name] = this.getMetricStats(name);
        }
        return result;
    }

    clearMetrics(): void {
        this.metrics.clear();
    }
}

export const performanceMonitor = new PerformanceMonitor();

// Error tracking utilities
export class ErrorTracker {
    private errors: Map<string, number> = new Map();
    private recentErrors: Array<{ error: string; count: number; lastSeen: Date }> = [];

    recordError(error: string): void {
        const count = this.errors.get(error) || 0;
        this.errors.set(error, count + 1);

        // Update recent errors
        const existing = this.recentErrors.find(e => e.error === error);
        if (existing) {
            existing.count = count + 1;
            existing.lastSeen = new Date();
        } else {
            this.recentErrors.push({
                error,
                count: 1,
                lastSeen: new Date(),
            });
        }

        // Keep only last 100 unique errors
        if (this.recentErrors.length > 100) {
            this.recentErrors.shift();
        }
    }

    getErrorStats(): {
        totalErrors: number;
        uniqueErrors: number;
        topErrors: Array<{ error: string; count: number }>;
        recentErrors: Array<{ error: string; count: number; lastSeen: Date }>;
    } {
        const totalErrors = Array.from(this.errors.values()).reduce((a, b) => a + b, 0);
        const uniqueErrors = this.errors.size;

        const topErrors = Array.from(this.errors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([error, count]) => ({ error, count }));

        return {
            totalErrors,
            uniqueErrors,
            topErrors,
            recentErrors: this.recentErrors.slice(-20),
        };
    }

    clearErrors(): void {
        this.errors.clear();
        this.recentErrors = [];
    }
}

export const errorTracker = new ErrorTracker();

// Log analysis utilities
export const analyzeLogTrends = (logs: LogEntry[], timeWindowMs: number = 3600000): {
    errorRate: number;
    warningRate: number;
    activityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    topCategories: Array<{ category: LogCategory; count: number }>;
} => {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recentLogs = logs.filter(log => log.timestamp >= cutoff);

    if (recentLogs.length === 0) {
        return {
            errorRate: 0,
            warningRate: 0,
            activityLevel: 'LOW',
            topCategories: [],
        };
    }

    const errorCount = recentLogs.filter(log => log.level === 'ERROR').length;
    const warningCount = recentLogs.filter(log => log.level === 'WARN').length;

    const errorRate = (errorCount / recentLogs.length) * 100;
    const warningRate = (warningCount / recentLogs.length) * 100;

    let activityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    const logsPerMinute = recentLogs.length / (timeWindowMs / 60000);
    if (logsPerMinute < 1) activityLevel = 'LOW';
    else if (logsPerMinute < 10) activityLevel = 'MEDIUM';
    else activityLevel = 'HIGH';

    const categoryCount = new Map<LogCategory, number>();
    recentLogs.forEach(log => {
        categoryCount.set(log.category, (categoryCount.get(log.category) || 0) + 1);
    });

    const topCategories = Array.from(categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }));

    return {
        errorRate,
        warningRate,
        activityLevel,
        topCategories,
    };
};

export default logger;