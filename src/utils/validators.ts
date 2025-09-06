// src/utils/validators.ts - Input validation utilities
import { PublicKey } from '@solana/web3.js';

export class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export const validators = {
    // Solana address validation
    isValidSolanaAddress: (address: string): boolean => {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    },

    validateSolanaAddress: (address: string, fieldName: string = 'address'): void => {
        if (!address) {
            throw new ValidationError(`${fieldName} is required`, fieldName);
        }

        if (!validators.isValidSolanaAddress(address)) {
            throw new ValidationError(`Invalid Solana address format for ${fieldName}`, fieldName);
        }
    },

    // Amount validation
    validateAmount: (amount: number | string, fieldName: string = 'amount'): number => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

        if (isNaN(numAmount)) {
            throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
        }

        if (numAmount < 0) {
            throw new ValidationError(`${fieldName} must be positive`, fieldName);
        }

        if (numAmount === 0) {
            throw new ValidationError(`${fieldName} must be greater than zero`, fieldName);
        }

        return numAmount;
    },

    validateAmountRange: (
        amount: number,
        min: number,
        max: number,
        fieldName: string = 'amount'
    ): void => {
        if (amount < min) {
            throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName);
        }

        if (amount > max) {
            throw new ValidationError(`${fieldName} must not exceed ${max}`, fieldName);
        }
    },

    // Percentage validation
    validatePercentage: (percent: number, fieldName: string = 'percentage'): void => {
        if (isNaN(percent)) {
            throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
        }

        if (percent < 0 || percent > 100) {
            throw new ValidationError(`${fieldName} must be between 0 and 100`, fieldName);
        }
    },

    validateSlippage: (slippage: number): void => {
        validators.validatePercentage(slippage, 'slippage');

        if (slippage > 50) {
            throw new ValidationError('Slippage cannot exceed 50%', 'slippage');
        }
    },

    // String validation
    validateString: (
        value: string,
        fieldName: string,
        minLength: number = 1,
        maxLength: number = 255
    ): void => {
        if (!value || typeof value !== 'string') {
            throw new ValidationError(`${fieldName} is required`, fieldName);
        }

        if (value.trim().length < minLength) {
            throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
        }

        if (value.length > maxLength) {
            throw new ValidationError(`${fieldName} must not exceed ${maxLength} characters`, fieldName);
        }
    },

    // Email validation
    validateEmail: (email: string): void => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            throw new ValidationError('Email is required', 'email');
        }

        if (!emailRegex.test(email)) {
            throw new ValidationError('Invalid email format', 'email');
        }
    },

    // Trading configuration validation
    validateCopyTradeSettings: (settings: any): void => {
        // Validate follow percentage
        if (typeof settings.followPercentage !== 'number') {
            throw new ValidationError('Follow percentage must be a number', 'followPercentage');
        }

        if (settings.followPercentage <= 0 || settings.followPercentage > 1) {
            throw new ValidationError('Follow percentage must be between 0 and 1', 'followPercentage');
        }

        // Validate copy amounts
        validators.validateAmount(settings.maxCopyAmount, 'maxCopyAmount');
        validators.validateAmount(settings.minCopyAmount, 'minCopyAmount');

        if (settings.minCopyAmount >= settings.maxCopyAmount) {
            throw new ValidationError('Minimum copy amount must be less than maximum', 'minCopyAmount');
        }

        // Validate token lists
        if (settings.blacklistedTokens && !Array.isArray(settings.blacklistedTokens)) {
            throw new ValidationError('Blacklisted tokens must be an array', 'blacklistedTokens');
        }

        if (settings.blacklistedTokens) {
            settings.blacklistedTokens.forEach((token: string, index: number) => {
                try {
                    validators.validateSolanaAddress(token, `blacklistedTokens[${index}]`);
                } catch (error) {
                    throw new ValidationError(`Invalid token address in blacklist at index ${index}`, 'blacklistedTokens');
                }
            });
        }

        // Validate optional fields
        if (settings.stopLossPercent !== undefined) {
            validators.validatePercentage(settings.stopLossPercent, 'stopLossPercent');
        }

        if (settings.takeProfitPercent !== undefined) {
            validators.validatePercentage(settings.takeProfitPercent, 'takeProfitPercent');
        }

        if (settings.maxHoldTime !== undefined) {
            validators.validateAmount(settings.maxHoldTime, 'maxHoldTime');
        }
    },

    // Risk configuration validation
    validateRiskConfig: (config: any): void => {
        // Daily limits
        validators.validateAmount(config.maxDailyLoss, 'maxDailyLoss');
        validators.validateAmount(config.maxDailyTrades, 'maxDailyTrades');
        validators.validateAmount(config.maxDailyVolume, 'maxDailyVolume');

        // Position limits
        validators.validateAmount(config.maxOpenPositions, 'maxOpenPositions');
        validators.validateAmount(config.maxSinglePositionUsd, 'maxSinglePositionUsd');
        validators.validateAmount(config.maxTotalExposureUsd, 'maxTotalExposureUsd');

        // Risk ratios
        if (config.maxPortfolioRiskRatio < 0 || config.maxPortfolioRiskRatio > 1) {
            throw new ValidationError('Portfolio risk ratio must be between 0 and 1', 'maxPortfolioRiskRatio');
        }

        if (config.maxConcentrationRisk < 0 || config.maxConcentrationRisk > 1) {
            throw new ValidationError('Concentration risk must be between 0 and 1', 'maxConcentrationRisk');
        }

        if (config.minWinRateThreshold < 0 || config.minWinRateThreshold > 1) {
            throw new ValidationError('Win rate threshold must be between 0 and 1', 'minWinRateThreshold');
        }
    },

    // Wallet configuration validation
    validateWalletConfig: (wallet: any): void => {
        validators.validateString(wallet.name, 'name', 1, 50);
        validators.validateSolanaAddress(wallet.address, 'address');
        validators.validateString(wallet.emoji, 'emoji', 1, 10);

        if (!Array.isArray(wallet.tags)) {
            throw new ValidationError('Tags must be an array', 'tags');
        }

        if (wallet.copyEnabled && wallet.copySettings) {
            validators.validateCopyTradeSettings(wallet.copySettings);
        }

        if (wallet.riskLevel && !['low', 'medium', 'high'].includes(wallet.riskLevel)) {
            throw new ValidationError('Risk level must be low, medium, or high', 'riskLevel');
        }
    },

    // Transaction validation
    validateTransaction: (tx: any): void => {
        validators.validateSolanaAddress(tx.sourceWallet, 'sourceWallet');
        validators.validateSolanaAddress(tx.token, 'token');

        if (!['BUY', 'SELL'].includes(tx.action)) {
            throw new ValidationError('Action must be BUY or SELL', 'action');
        }

        validators.validateAmount(tx.amount, 'amount');

        if (tx.priceUsd !== undefined) {
            validators.validateAmount(tx.priceUsd, 'priceUsd');
        }

        if (tx.valueUsd !== undefined) {
            validators.validateAmount(tx.valueUsd, 'valueUsd');
        }

        if (tx.timestamp && !(tx.timestamp instanceof Date)) {
            throw new ValidationError('Timestamp must be a Date object', 'timestamp');
        }
    },

    // API request validation
    validateSwapRouteRequest: (request: any): void => {
        validators.validateSolanaAddress(request.inputToken, 'inputToken');
        validators.validateSolanaAddress(request.outputToken, 'outputToken');
        validators.validateAmount(request.inputAmount, 'inputAmount');
        validators.validateSolanaAddress(request.fromAddress, 'fromAddress');

        if (request.slippage !== undefined) {
            validators.validateSlippage(request.slippage * 100); // Convert to percentage
        }

        if (request.priorityFee !== undefined) {
            validators.validateAmount(request.priorityFee, 'priorityFee');

            if (request.priorityFee > 0.1) { // 0.1 SOL max
                throw new ValidationError('Priority fee cannot exceed 0.1 SOL', 'priorityFee');
            }
        }
    },

    // Environment validation
    validateEnvironmentConfig: (config: any): void => {
        // Required environment variables
        const required = ['PRIVATE_KEY', 'HELIUS_HTTPS_URI'];

        for (const key of required) {
            if (!config[key]) {
                throw new ValidationError(`Environment variable ${key} is required`, key);
            }
        }

        // Validate private key format (base58)
        if (config.PRIVATE_KEY) {
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
            if (!base58Regex.test(config.PRIVATE_KEY)) {
                throw new ValidationError('PRIVATE_KEY must be base58 encoded', 'PRIVATE_KEY');
            }
        }

        // Validate URLs
        if (config.HELIUS_HTTPS_URI) {
            try {
                new URL(config.HELIUS_HTTPS_URI);
            } catch {
                throw new ValidationError('HELIUS_HTTPS_URI must be a valid URL', 'HELIUS_HTTPS_URI');
            }
        }

        if (config.HELIUS_WSS_URI) {
            try {
                new URL(config.HELIUS_WSS_URI);
            } catch {
                throw new ValidationError('HELIUS_WSS_URI must be a valid WebSocket URL', 'HELIUS_WSS_URI');
            }
        }

        // Validate numeric environment variables
        const numericFields = [
            'MAX_DAILY_LOSS',
            'MAX_DAILY_TRADES',
            'MAX_POSITION_SIZE_USD',
            'DEFAULT_SLIPPAGE',
            'PRIORITY_FEE_SOL'
        ];

        for (const field of numericFields) {
            if (config[field] !== undefined) {
                const value = parseFloat(config[field]);
                if (isNaN(value)) {
                    throw new ValidationError(`${field} must be a valid number`, field);
                }

                if (value < 0) {
                    throw new ValidationError(`${field} must be positive`, field);
                }
            }
        }

        // Validate boolean environment variables
        const booleanFields = ['COPY_TRADING_ENABLED', 'ANTI_MEV_ENABLED'];

        for (const field of booleanFields) {
            if (config[field] !== undefined) {
                const value = config[field].toLowerCase();
                if (!['true', 'false'].includes(value)) {
                    throw new ValidationError(`${field} must be 'true' or 'false'`, field);
                }
            }
        }
    },

    // Database validation
    validateDatabaseConfig: (config: any): void => {
        if (!config.type || !['sqlite', 'postgresql'].includes(config.type)) {
            throw new ValidationError('Database type must be sqlite or postgresql', 'type');
        }

        if (config.type === 'sqlite' && config.sqlite) {
            validators.validateString(config.sqlite.filename, 'sqlite.filename');

            if (config.sqlite.maxConnections !== undefined) {
                validators.validateAmount(config.sqlite.maxConnections, 'sqlite.maxConnections');
            }
        }

        if (config.type === 'postgresql' && config.postgresql) {
            validators.validateString(config.postgresql.connectionString, 'postgresql.connectionString');

            if (config.postgresql.maxConnections !== undefined) {
                validators.validateAmount(config.postgresql.maxConnections, 'postgresql.maxConnections');
            }
        }
    },

    // Sanitization helpers
    sanitize: {
        string: (input: string, maxLength: number = 255): string => {
            if (!input || typeof input !== 'string') return '';
            return input.trim().slice(0, maxLength);
        },

        number: (input: any, defaultValue: number = 0): number => {
            const num = Number(input);
            return isNaN(num) ? defaultValue : num;
        },

        boolean: (input: any, defaultValue: boolean = false): boolean => {
            if (typeof input === 'boolean') return input;
            if (typeof input === 'string') {
                return input.toLowerCase() === 'true';
            }
            return defaultValue;
        },

        array: (input: any, defaultValue: any[] = []): any[] => {
            return Array.isArray(input) ? input : defaultValue;
        },

        solanaAddress: (input: string): string | null => {
            try {
                validators.validateSolanaAddress(input);
                return input.trim();
            } catch {
                return null;
            }
        },
    },

    // Batch validation
    validateBatch: (items: any[], validator: (item: any) => void): {
        valid: any[];
        invalid: Array<{ item: any; error: string; index: number }>
    } => {
        const valid: any[] = [];
        const invalid: Array<{ item: any; error: string; index: number }> = [];

        items.forEach((item, index) => {
            try {
                validator(item);
                valid.push(item);
            } catch (error) {
                invalid.push({
                    item,
                    error: error instanceof Error ? error.message : String(error),
                    index,
                });
            }
        });

        return { valid, invalid };
    },

    // Advanced validation rules
    validateAdvanced: {
        // Portfolio validation
        portfolioBalance: (positions: any[], maxExposure: number): void => {
            const totalExposure = positions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0);

            if (totalExposure > maxExposure) {
                throw new ValidationError(
                    `Total portfolio exposure (${totalExposure}) exceeds maximum (${maxExposure})`,
                    'portfolioExposure'
                );
            }
        },

        // Token diversity validation
        tokenDiversity: (positions: any[], maxConcentration: number): void => {
            if (positions.length === 0) return;

            const totalValue = positions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0);

            for (const position of positions) {
                const concentration = (position.currentValue || 0) / totalValue;
                if (concentration > maxConcentration) {
                    throw new ValidationError(
                        `Token concentration (${(concentration * 100).toFixed(2)}%) exceeds maximum (${(maxConcentration * 100).toFixed(2)}%)`,
                        'tokenConcentration'
                    );
                }
            }
        },

        // Trading frequency validation
        tradingFrequency: (trades: any[], maxTradesPerHour: number): void => {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            const recentTrades = trades.filter(trade =>
                trade.timestamp && new Date(trade.timestamp) >= oneHourAgo
            );

            if (recentTrades.length >= maxTradesPerHour) {
                throw new ValidationError(
                    `Trading frequency (${recentTrades.length} trades/hour) exceeds maximum (${maxTradesPerHour})`,
                    'tradingFrequency'
                );
            }
        },

        // Loss streak validation
        lossStreak: (recentTrades: any[], maxConsecutiveLosses: number): void => {
            let consecutiveLosses = 0;

            // Check recent trades in reverse order (most recent first)
            for (let i = recentTrades.length - 1; i >= 0; i--) {
                const trade = recentTrades[i];
                if (trade.realizedPnl < 0) {
                    consecutiveLosses++;
                } else if (trade.realizedPnl > 0) {
                    break; // Reset streak on profit
                }
            }

            if (consecutiveLosses >= maxConsecutiveLosses) {
                throw new ValidationError(
                    `Consecutive losses (${consecutiveLosses}) exceed maximum (${maxConsecutiveLosses})`,
                    'lossStreak'
                );
            }
        },
    },

    // Custom validation builder
    createValidator: (rules: Array<{
        field: string;
        validator: (value: any) => boolean;
        message: string
    }>) => {
        return (obj: any): void => {
            for (const rule of rules) {
                const value = obj[rule.field];
                if (!rule.validator(value)) {
                    throw new ValidationError(rule.message, rule.field);
                }
            }
        };
    },

    // Async validation helpers
    async: {
        validateTokenExists: async (tokenMint: string, priceService: any): Promise<void> => {
            try {
                const tokenInfo = await priceService.getTokenInfo(tokenMint);
                if (!tokenInfo) {
                    throw new ValidationError(`Token ${tokenMint} not found or invalid`, 'tokenMint');
                }
            } catch (error) {
                throw new ValidationError(`Failed to validate token: ${error}`, 'tokenMint');
            }
        },

        validateWalletBalance: async (walletAddress: string, requiredBalance: number, solanaService: any): Promise<void> => {
            try {
                const balance = await solanaService.getBalance(walletAddress);
                if (balance < requiredBalance) {
                    throw new ValidationError(
                        `Insufficient balance. Required: ${requiredBalance}, Available: ${balance}`,
                        'walletBalance'
                    );
                }
            } catch (error) {
                throw new ValidationError(`Failed to validate wallet balance: ${error}`, 'walletBalance');
            }
        },
    },
};

// Export convenience functions
export const {
    validateSolanaAddress,
    validateAmount,
    validatePercentage,
    validateString,
    validateCopyTradeSettings,
    sanitize,
} = validators;

export default validators;