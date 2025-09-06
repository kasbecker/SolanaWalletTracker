// src/config/trading.ts - Trading configuration
export interface TradingConfig {
    enabled: boolean;
    mode: 'live' | 'paper' | 'simulation';

    // Execution settings
    defaultSlippage: number;
    priorityFeeSol: number;
    maxPriorityFeeSol: number;
    antiMevEnabled: boolean;

    // Position sizing
    maxPositionSizeUsd: number;
    defaultCopyPercentage: number;
    minTradeAmount: number;
    maxTradeAmount: number;

    // Risk management
    maxDailyLoss: number;
    maxDailyTrades: number;
    maxOpenPositions: number;
    stopLossPercentage: number;

    // Trading rules
    blacklistedTokens: string[];
    whitelistedTokens: string[];
    minLiquidityUsd: number;
    maxPriceImpact: number;

    // Timing
    executionDelayMs: number;
    maxExecutionTimeMs: number;
    retryAttempts: number;
    retryDelayMs: number;
}

export const tradingConfig: TradingConfig = {
    // Main controls
    enabled: process.env.COPY_TRADING_ENABLED === 'true' || false,
    mode: (process.env.TRADING_MODE as 'live' | 'paper' | 'simulation') || 'simulation',

    // Execution settings
    defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '0.01'), // 1%
    priorityFeeSol: parseFloat(process.env.PRIORITY_FEE_SOL || '0.005'), // 0.005 SOL
    maxPriorityFeeSol: parseFloat(process.env.MAX_PRIORITY_FEE_SOL || '0.02'), // 0.02 SOL max
    antiMevEnabled: process.env.ANTI_MEV_ENABLED !== 'false',

    // Position sizing
    maxPositionSizeUsd: parseFloat(process.env.MAX_POSITION_SIZE_USD || '1000'), // $1000 max
    defaultCopyPercentage: parseFloat(process.env.DEFAULT_COPY_PERCENTAGE || '0.1'), // 10%
    minTradeAmount: parseFloat(process.env.MIN_TRADE_AMOUNT || '10'), // $10 min
    maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT || '5000'), // $5000 max

    // Risk management
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '500'), // $500 daily loss limit
    maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '20'), // 20 trades per day max
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '10'), // 10 open positions max
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.25'), // 25% stop loss

    // Trading rules
    blacklistedTokens: process.env.BLACKLISTED_TOKENS?.split(',') || [
        // Add known scam/honeypot tokens here
    ],
    whitelistedTokens: process.env.WHITELISTED_TOKENS?.split(',') || [],
    minLiquidityUsd: parseFloat(process.env.MIN_LIQUIDITY_USD || '10000'), // $10k min liquidity
    maxPriceImpact: parseFloat(process.env.MAX_PRICE_IMPACT || '0.05'), // 5% max price impact

    // Timing
    executionDelayMs: parseInt(process.env.EXECUTION_DELAY_MS || '500'), // 500ms delay
    maxExecutionTimeMs: parseInt(process.env.MAX_EXECUTION_TIME_MS || '30000'), // 30s timeout
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'), // 3 retry attempts
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'), // 1s retry delay
};

// Helper functions
export const isTradingEnabled = (): boolean => {
    return tradingConfig.enabled && tradingConfig.mode !== 'simulation';
};

export const isTokenBlacklisted = (tokenAddress: string): boolean => {
    return tradingConfig.blacklistedTokens.includes(tokenAddress);
};

export const isTokenWhitelisted = (tokenAddress: string): boolean => {
    return tradingConfig.whitelistedTokens.length === 0 ||
        tradingConfig.whitelistedTokens.includes(tokenAddress);
};

export const canExecuteTrade = (tokenAddress: string): boolean => {
    return !isTokenBlacklisted(tokenAddress) && isTokenWhitelisted(tokenAddress);
};