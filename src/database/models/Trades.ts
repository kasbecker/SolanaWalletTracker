// src/database/models/Trades.ts - Trade execution tracking model
export interface Trade {
    id?: number;

    // Trade identification
    tradeId: string;           // Unique trade identifier
    copyTradeId?: string;      // Links multiple trades in same copy operation
    sourceWallet: string;      // Wallet we copied from

    // Trade details
    type: 'BUY' | 'SELL';
    tokenMint: string;         // Token being traded
    inputToken: string;        // Input token (usually SOL)
    outputToken: string;       // Output token

    // Amounts
    inputAmount: number;       // Input amount (raw)
    outputAmount: number;      // Output amount (raw)
    inputAmountUi: number;     // Input amount (UI formatted)
    outputAmountUi: number;    // Output amount (UI formatted)

    // Pricing
    priceUsd: number;          // Price per token in USD
    totalValueUsd: number;     // Total trade value in USD
    slippage: number;          // Actual slippage %
    priceImpact: number;       // Price impact %

    // Execution details
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    txHash?: string;           // Transaction hash
    blockNumber?: number;      // Block number
    timestamp: Date;           // Execution timestamp
    executionTimeMs?: number;  // How long execution took

    // Fees
    priorityFee: number;       // Priority fee paid (SOL)
    networkFee: number;        // Network fee (SOL)
    totalFeesUsd: number;      // Total fees in USD

    // Source analysis
    sourceTradeData?: {
        originalAmount: number;   // Original trade amount
        copyRatio: number;       // What % we copied
        timeDifference: number;  // Seconds between source and copy
    };

    // Risk/Quality metrics
    liquidityUsd?: number;     // Available liquidity
    volumeUsd24h?: number;     // 24h trading volume
    holderCount?: number;      // Token holder count
    isHoneypot?: boolean;      // Honeypot detection result
    riskScore?: number;        // Overall risk score (0-100)

    // Error details (if failed)
    errorMessage?: string;     // Error description
    errorCode?: string;        // Error code
    retryCount?: number;       // Number of retry attempts

    // Metadata
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TradeStats {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalVolumeUsd: number;
    totalFeesUsd: number;
    avgExecutionTimeMs: number;
    avgSlippage: number;
    avgPriceImpact: number;
    bestTrade: number;         // Best trade profit
    worstTrade: number;        // Worst trade loss
}

export interface DailyTradeStats {
    date: string;
    tradeCount: number;
    volumeUsd: number;
    feesUsd: number;
    successRate: number;
    avgExecutionTime: number;
    profitLoss: number;
}

export interface TradeRepository {
    // Basic CRUD
    createTrade(trade: Omit<Trade, 'id'>): Promise<number>;
    updateTrade(id: number, updates: Partial<Trade>): Promise<void>;
    getTrade(id: number): Promise<Trade | null>;
    deleteTrade(id: number): Promise<void>;

    // Queries
    getTradesByStatus(status: Trade['status'], limit?: number): Promise<Trade[]>;
    getTradesByToken(tokenMint: string, limit?: number): Promise<Trade[]>;
    getTradesBySourceWallet(sourceWallet: string, limit?: number): Promise<Trade[]>;
    getRecentTrades(limit: number): Promise<Trade[]>;
    getTradesByCopyId(copyTradeId: string): Promise<Trade[]>;

    // Analytics
    getTradeStats(timeframe?: '24h' | '7d' | '30d'): Promise<TradeStats>;
    getDailyStats(days: number): Promise<DailyTradeStats[]>;
    getTopPerformingTokens(limit: number): Promise<{
        tokenMint: string;
        tradeCount: number;
        totalVolume: number;
        successRate: number;
        avgProfit: number;
    }[]>;

    // Risk analysis
    getFailedTrades(limit?: number): Promise<Trade[]>;
    getHighSlippageTrades(threshold: number): Promise<Trade[]>;
    getSlowExecutionTrades(thresholdMs: number): Promise<Trade[]>;
}

// Utility functions
export const generateTradeId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `trade_${timestamp}_${random}`;
};

export const generateCopyTradeId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `copy_${timestamp}_${random}`;
};

export const calculateTradeProfit = (trade: Trade, currentPrice?: number): number => {
    if (trade.type === 'BUY') {
        if (!currentPrice) return 0;
        const currentValue = trade.outputAmountUi * currentPrice;
        return currentValue - trade.totalValueUsd;
    } else {
        // For SELL trades, profit is already realized
        return trade.totalValueUsd - (trade.inputAmountUi * trade.priceUsd);
    }
};

export const assessTradeQuality = (trade: Trade): {
    score: number;
    factors: string[];
} => {
    let score = 100;
    const factors: string[] = [];

    // Execution speed factor
    if (trade.executionTimeMs && trade.executionTimeMs > 10000) {
        score -= 20;
        factors.push('Slow execution');
    }

    // Slippage factor
    if (trade.slippage > 0.05) { // 5%
        score -= 30;
        factors.push('High slippage');
    }

    // Price impact factor
    if (trade.priceImpact > 0.03) { // 3%
        score -= 25;
        factors.push('High price impact');
    }

    // Liquidity factor
    if (trade.liquidityUsd && trade.liquidityUsd < 50000) { // Less than $50k
        score -= 15;
        factors.push('Low liquidity');
    }

    // Success factor
    if (trade.status === 'FAILED') {
        score = 0;
        factors.push('Trade failed');
    }

    return { score: Math.max(0, score), factors };
};

export const createTradeFromExecution = (
    type: 'BUY' | 'SELL',
    tokenMint: string,
    sourceWallet: string,
    inputAmount: number,
    outputAmount: number,
    priceUsd: number,
    slippage: number
): Omit<Trade, 'id'> => {
    const tradeId = generateTradeId();
    const timestamp = new Date();

    return {
        tradeId,
        sourceWallet,
        type,
        tokenMint,
        inputToken: type === 'BUY' ? 'So11111111111111111111111111111111111111112' : tokenMint,
        outputToken: type === 'BUY' ? tokenMint : 'So11111111111111111111111111111111111111112',
        inputAmount,
        outputAmount,
        inputAmountUi: inputAmount / Math.pow(10, 9), // Assuming SOL decimals
        outputAmountUi: outputAmount / Math.pow(10, 9), // Will need proper decimal handling
        priceUsd,
        totalValueUsd: (type === 'BUY' ? inputAmount : outputAmount) * priceUsd / Math.pow(10, 9),
        slippage,
        priceImpact: 0, // Will be calculated during execution
        status: 'PENDING',
        timestamp,
        priorityFee: 0.005, // Default priority fee
        networkFee: 0.000005, // Default network fee
        totalFeesUsd: 0, // Will be calculated after execution
        createdAt: timestamp,
        updatedAt: timestamp,
    };
};

/*
// src/database/models/Trades.ts - Trade execution tracking model
export interface Trade {
    id?: number;

    // Trade identification
    tradeId: string;           // Unique trade identifier
    copyTradeId?: string;      // Links multiple trades in same copy operation
    sourceWallet: string;      // Wallet we copied from

    // Trade details
    type: 'BUY' | 'SELL';
    tokenMint: string;         // Token being traded
    inputToken: string;        // Input token (usually SOL)
    outputToken: string;       // Output token

    // Amounts
    inputAmount: number;       // Input amount (raw)
    outputAmount: number;      // Output amount (raw)
    inputAmountUi: number;     // Input amount (UI formatted)
    outputAmountUi: number;    // Output amount (UI formatted)

    // Pricing
    priceUsd: number;          // Price per token in USD
    totalValueUsd: number;     // Total trade value in USD
    slippage: number;          // Actual slippage %
    priceImpact: number;       // Price impact %

    // Execution details
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    txHash?: string;           // Transaction hash
    blockNumber?: number;      // Block number
    timestamp: Date;           // Execution timestamp
    executionTimeMs?: number;  // How long execution took

    // Fees
    priorityFee: number;       // Priority fee paid (SOL)
    networkFee: number;        // Network fee (SOL)
    totalFeesUsd: number;      // Total fees in USD

    // Source analysis
    sourceTradeData?: {
        originalAmount: number;   // Original trade amount
        copyRatio: number;       // What % we copied
        timeDifference: number;  // Seconds between source and copy
    };

    // Risk/Quality metrics
    liquidityUsd?: number;     // Available liquidity
    volumeUsd24h?: number;     // 24h trading volume
    holderCount?: number;      // Token holder count
    isHoneypot?: boolean;      // Honeypot detection result
    riskScore?: number;        // Overall risk score (0-100)

    // Error details (if failed)
    errorMessage?: string;     // Error description
    errorCode?: string;        // Error code
    retryCount?: number;       // Number of retry attempts

    // Metadata
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TradeStats {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalVolumeUsd: number;
    totalFeesUsd: number;
    avgExecutionTimeMs: number;*/
