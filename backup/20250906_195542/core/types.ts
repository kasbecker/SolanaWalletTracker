// src/core/types.ts - Enhanced type definitions for copy trading
import { SplTokenHolding } from '../database/models/Holdings';

// Your existing types (enhanced)
export interface GetTokenAccountsResponse {
    total: number;
    limit: number;
    cursor: string;
    token_accounts: {
        address: string;
        mint: string;
        owner: string;
        amount: number;
        delegated_amount: number;
        frozen: boolean;
    }[];
}

export interface GetWalletTokenHoldingsResponse {
    data: SplTokenHolding[];
    success: boolean;
    msg: string;
}

export interface SplTokenStoreReponse {
    success: boolean;
    added: SplTokenHolding[];
    removed: string[];
    msg: string;
}

// Enhanced WebSocket types
export interface getAccountInfoStreamReponse {
    jsonrpc: string;
    method: "accountNotification";
    params: {
        result: {
            context: {
                slot: number;
            };
            value: {
                data: {
                    program: string;
                    parsed: {
                        type: string;
                        info: {
                            authority: string;
                            blockhash: string;
                            feeCalculator: {
                                lamportsPerSignature: number;
                            };
                        };
                    };
                };
                executable: boolean;
                lamports: number;
                owner: string;
                rentEpoch: number;
                space: number;
            };
        };
        subscription: number;
    };
}

export interface getAccountInfoStreamReponseWithConfirmation extends getAccountInfoStreamReponse {
    id?: string;
    result?: null;
}

// New copy trading types
export interface WalletTransaction {
    sourceWallet: string;         // Wallet address we're copying from
    token: string;                // Token mint address
    action: 'BUY' | 'SELL';      // Transaction type
    amount: string;               // Amount in raw token units
    amountUi?: number;            // Human readable amount
    priceUsd?: number;            // Price per token in USD
    valueUsd?: number;            // Total transaction value in USD
    timestamp: Date;              // When transaction occurred
    txHash?: string;              // Solana transaction hash
    slotNumber?: number;          // Solana slot number

    // Context information
    walletBalance?: number;       // Wallet's SOL balance after transaction
    tokenBalance?: number;        // Wallet's token balance after transaction
    isNewToken?: boolean;         // Is this a new token for the wallet
    portfolioWeight?: number;     // % of portfolio this represents

    // Copy trading metadata
    detectionTime: Date;          // When we detected this transaction
    copyEligible: boolean;        // Should we copy this transaction
    copyReason?: string;          // Why we should/shouldn't copy
}

export interface CopyTradeSettings {
    enabled: boolean;             // Is copy trading enabled for this wallet
    followPercentage: number;     // % of original trade to copy (0.0-1.0)
    maxCopyAmount: number;        // Maximum USD amount to copy
    minCopyAmount: number;        // Minimum USD amount to copy

    // Token filters
    blacklistedTokens: string[];  // Never copy these tokens
    whitelistedTokens?: string[]; // Only copy these tokens (if specified)
    minLiquidity?: number;        // Minimum token liquidity required
    maxPriceImpact?: number;      // Maximum acceptable price impact

    // Timing settings
    delayMs?: number;             // Delay before copying (0 = immediate)
    maxDelayMs?: number;          // Maximum delay before skipping

    // Risk settings
    stopLossPercent?: number;     // Auto stop loss percentage
    takeProfitPercent?: number;   // Auto take profit percentage
    maxHoldTime?: number;         // Maximum hold time in hours
}

export interface TradeResult {
    status: 'success' | 'failed' | 'rejected' | 'skipped' | 'error';
    txHash?: string;              // Transaction hash if successful

    // Trade details
    inputAmount?: number;         // Amount sent
    outputAmount?: number;        // Amount received
    actualSlippage?: number;      // Actual slippage experienced
    executionTimeMs?: number;     // Time taken to execute

    // Error information
    error?: string;               // Error message if failed
    reason?: string;              // Reason for rejection/skip

    // Metadata
    timestamp: number;            // Execution timestamp
    gasFee?: number;              // Gas fee paid
    priorityFee?: number;         // Priority fee paid
}

export interface TradingEngineStatus {
    initialized: boolean;
    walletAddress: string;
    tradingEnabled: boolean;
    tradingMode: 'live' | 'paper' | 'simulation';

    // Current state
    openPositions?: number;
    dailyTrades?: number;
    dailyPnl?: number;

    // Health indicators
    lastTradeTime?: Date;
    lastError?: string;
    connectionStatus?: 'connected' | 'disconnected' | 'error';
}

// Duplicate holdings types (enhanced from your existing)
export interface DuplicateOwnerMintRecord {
    mint: string;
    owner: string;
}

export interface MintWithOwners {
    mint: string;
    owners: string[];
    // Enhanced fields
    holderCount?: number;         // Total number of holders
    totalValue?: number;          // Combined USD value held
    averageHolding?: number;      // Average holding size
    priceUsd?: number;            // Current token price
    tokenInfo?: {
        symbol: string;
        name: string;
        decimals: number;
    };
}

export interface MintWithOwnersResponse {
    success: boolean;
    duplicates: MintWithOwners[];
    msg: string;
}

// Wallet monitoring types
export interface WalletMonitorConfig {
    address: string;
    name: string;
    emoji: string;
    tags: string[];

    // Copy trading settings
    copyEnabled: boolean;
    copySettings: CopyTradeSettings;

    // Monitoring settings
    trackHoldings: boolean;
    trackTransactions: boolean;
    alertOnChanges: boolean;

    // Performance tracking
    lastSeen?: Date;
    errorCount?: number;
    successRate?: number;
}

export interface WalletChange {
    walletAddress: string;
    walletName: string;
    changeType: 'NEW_TOKEN' | 'INCREASED_HOLDING' | 'DECREASED_HOLDING' | 'REMOVED_TOKEN';
    tokenMint: string;
    tokenSymbol?: string;

    // Change details
    previousAmount?: number;
    newAmount: number;
    amountChange: number;
    valueChangeUsd?: number;

    // Context
    timestamp: Date;
    txHash?: string;
    priceUsd?: number;

    // Copy trading relevance
    shouldTriggerCopy: boolean;
    copyReason?: string;
}

// Performance and analytics types
export interface WalletPerformance {
    walletAddress: string;
    walletName: string;

    // Portfolio metrics
    totalValueUsd: number;
    change24h: number;
    change7d: number;
    change30d: number;

    // Trading metrics
    totalTrades: number;
    trades24h: number;
    winRate: number;
    avgTradeSize: number;

    // Token diversity
    totalTokens: number;
    newTokens24h: number;
    topHoldings: {
        mint: string;
        symbol: string;
        valueUsd: number;
        percentage: number;
    }[];

    // Risk metrics
    sharpeRatio?: number;
    maxDrawdown?: number;
    volatility?: number;

    // Last updated
    lastUpdated: Date;
}

export interface CopyTradingSummary {
    // Overall stats
    totalCopiedTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;

    // Financial performance
    totalPnl: number;
    totalPnlPercent: number;
    totalVolume: number;
    totalFees: number;

    // Best/worst performers
    bestTrade: {
        token: string;
        pnl: number;
        pnlPercent: number;
    };
    worstTrade: {
        token: string;
        pnl: number;
        pnlPercent: number;
    };

    // Source wallet performance
    sourceWallets: {
        address: string;
        name: string;
        copiedTrades: number;
        successRate: number;
        totalPnl: number;
    }[];

    // Time periods
    performance24h: {
        trades: number;
        pnl: number;
        volume: number;
    };
    performance7d: {
        trades: number;
        pnl: number;
        volume: number;
    };
    performance30d: {
        trades: number;
        pnl: number;
        volume: number;
    };
}

// Error and logging types
export interface TradingError {
    type: 'EXECUTION_ERROR' | 'VALIDATION_ERROR' | 'API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
    message: string;
    details?: any;
    timestamp: Date;
    walletAddress?: string;
    tokenMint?: string;
    tradeId?: string;

    // Context
    action?: 'BUY' | 'SELL';
    amount?: number;
    retryCount?: number;

    // Resolution
    resolved?: boolean;
    resolution?: string;
}

export interface LogEntry {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: Date;
    category: 'WALLET_TRACKING' | 'COPY_TRADING' | 'RISK_MANAGEMENT' | 'API' | 'DATABASE' | 'SYSTEM';
    metadata?: {
        walletAddress?: string;
        tokenMint?: string;
        tradeId?: string;
        [key: string]: any;
    };
}

// Configuration types
export interface CopyTradingConfig {
    enabled: boolean;
    mode: 'live' | 'paper' | 'simulation';

    // Global limits
    maxDailyTrades: number;
    maxDailyVolume: number;
    maxDailyLoss: number;
    maxOpenPositions: number;

    // Default copy settings
    defaultCopyPercentage: number;
    defaultMaxCopyAmount: number;
    defaultMinCopyAmount: number;

    // Risk management
    globalStopLoss: number;
    globalTakeProfit: number;
    maxSlippage: number;
    maxPriceImpact: number;

    // Execution settings
    executionDelay: number;
    maxExecutionTime: number;
    retryAttempts: number;
    priorityFee: number;

    // Filters
    globalBlacklist: string[];
    minTokenLiquidity: number;
    minTokenHolders: number;
}

// Event types for pub/sub system
export interface WalletEvent {
    type: 'HOLDING_CHANGE' | 'NEW_TOKEN' | 'TOKEN_SOLD' | 'BALANCE_CHANGE';
    walletAddress: string;
    walletName: string;
    data: any;
    timestamp: Date;
}

export interface CopyTradeEvent {
    type: 'TRADE_DETECTED' | 'TRADE_EXECUTED' | 'TRADE_FAILED' | 'POSITION_OPENED' | 'POSITION_CLOSED';
    sourceWallet: string;
    tradeId: string;
    data: any;
    timestamp: Date;
}

export interface RiskEvent {
    type: 'LIMIT_EXCEEDED' | 'STOP_LOSS_TRIGGERED' | 'TAKE_PROFIT_TRIGGERED' | 'RISK_ALERT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    data: any;
    timestamp: Date;
}