// src/database/models/Holdings.ts - Holdings data model
export interface SplTokenHolding {
    address: string;           // Token account address
    mint: string;              // Token mint address
    owner: string;             // Wallet address
    amount: number;            // Token amount (raw)
    decimals?: number;         // Token decimals
    uiAmount?: number;         // Human readable amount
    delegated_amount: number;  // Delegated amount
    frozen: boolean;           // Is account frozen

    // Enhanced fields for copy trading
    priceUsd?: number;         // Current price in USD
    valueUsd?: number;         // Total value in USD
    lastUpdated: Date;         // When this holding was last updated
    changeAmount?: number;     // Change in amount since last update
    changeValueUsd?: number;   // Change in USD value since last update
}

export interface WalletSnapshot {
    id?: number;
    walletAddress: string;
    snapshotDate: Date;
    totalTokens: number;       // Total number of different tokens
    totalValueUsd: number;     // Total portfolio value in USD
    solBalance: number;        // SOL balance
    holdings: SplTokenHolding[]; // JSON field with all holdings

    // Calculated fields
    portfolioChange24h?: number;    // 24h portfolio change %
    newTokensCount?: number;        // New tokens since last snapshot
    soldTokensCount?: number;       // Tokens sold since last snapshot
}

export interface HoldingChange {
    id?: number;
    walletAddress: string;
    tokenMint: string;
    changeType: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    amountChange: number;      // Change in token amount
    valueUsdChange?: number;   // Change in USD value
    priceUsd?: number;         // Price at time of change
    timestamp: Date;
    transactionHash?: string;  // Solana transaction hash

    // Copy trading relevance
    isCopyable: boolean;       // Should this change trigger copy trading?
    copyTriggerReason?: string; // Why this change is copyable
}

// Database operations interface
export interface HoldingsRepository {
    // Basic CRUD operations
    insertHolding(holding: SplTokenHolding): Promise<void>;
    updateHolding(holding: SplTokenHolding): Promise<void>;
    deleteHolding(address: string): Promise<void>;
    getHoldingsByWallet(walletAddress: string): Promise<SplTokenHolding[]>;
    getHoldingByAddress(address: string): Promise<SplTokenHolding | null>;

    // Snapshot operations
    createWalletSnapshot(snapshot: WalletSnapshot): Promise<number>;
    getLatestSnapshot(walletAddress: string): Promise<WalletSnapshot | null>;
    getSnapshotHistory(walletAddress: string, limit: number): Promise<WalletSnapshot[]>;

    // Change tracking
    recordHoldingChange(change: HoldingChange): Promise<void>;
    getRecentChanges(walletAddress: string, hoursBack: number): Promise<HoldingChange[]>;
    getCopyableChanges(sinceDate: Date): Promise<HoldingChange[]>;

    // Analytics
    getDuplicateHoldings(): Promise<{mint: string, owners: string[]}[]>;
    getTrendingTokens(timeframe: '1h' | '24h' | '7d'): Promise<{mint: string, holders: number, volume: number}[]>;
    getWalletPerformance(walletAddress: string): Promise<{
        totalValue: number,
        change24h: number,
        bestPerformer: string,
        worstPerformer: string
    }>;
}

// Utility functions for holdings
export const calculateHoldingValue = (holding: SplTokenHolding): number => {
    if (!holding.priceUsd || !holding.uiAmount) return 0;
    return holding.uiAmount * holding.priceUsd;
};

export const compareHoldings = (
    current: SplTokenHolding[],
    previous: SplTokenHolding[]
): HoldingChange[] => {
    const changes: HoldingChange[] = [];
    const prevMap = new Map(previous.map(h => [h.mint, h]));

    // Check for changes in current holdings
    for (const holding of current) {
        const prevHolding = prevMap.get(holding.mint);

        if (!prevHolding) {
            // New token
            changes.push({
                walletAddress: holding.owner,
                tokenMint: holding.mint,
                changeType: 'BUY',
                amountChange: holding.amount,
                valueUsdChange: calculateHoldingValue(holding),
                priceUsd: holding.priceUsd,
                timestamp: new Date(),
                isCopyable: true,
                copyTriggerReason: 'New token purchase detected'
            });
        } else if (holding.amount !== prevHolding.amount) {
            // Amount changed
            const amountChange = holding.amount - prevHolding.amount;
            changes.push({
                walletAddress: holding.owner,
                tokenMint: holding.mint,
                changeType: amountChange > 0 ? 'BUY' : 'SELL',
                amountChange,
                valueUsdChange: amountChange * (holding.priceUsd || 0),
                priceUsd: holding.priceUsd,
                timestamp: new Date(),
                isCopyable: Math.abs(amountChange) > 0, // Any change is copyable
                copyTriggerReason: amountChange > 0 ? 'Token purchase increase' : 'Token sale detected'
            });
        }

        prevMap.delete(holding.mint);
    }

    // Check for sold tokens (remaining in prevMap)
    for (const [mint, prevHolding] of prevMap) {
        changes.push({
            walletAddress: prevHolding.owner,
            tokenMint: mint,
            changeType: 'SELL',
            amountChange: -prevHolding.amount,
            valueUsdChange: -calculateHoldingValue(prevHolding),
            priceUsd: prevHolding.priceUsd,
            timestamp: new Date(),
            isCopyable: true,
            copyTriggerReason: 'Complete token sale detected'
        });
    }

    return changes;
};