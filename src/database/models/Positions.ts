// src/database/models/Positions.ts - Trading positions model
export interface Position {
    id?: number;
    tokenMint: string;         // Token being traded
    walletAddress: string;     // Our wallet address
    sourceWallet: string;      // Wallet we copied from

    // Position details
    side: 'LONG' | 'SHORT';    // Position side (mainly LONG for spot trading)
    status: 'OPEN' | 'CLOSED' | 'PARTIAL' | 'FAILED';

    // Entry details
    entryPrice: number;        // Entry price in USD
    entryAmount: number;       // Amount of tokens purchased
    entryValue: number;        // Total USD value at entry
    entryTimestamp: Date;      // When position was opened
    entryTxHash?: string;      // Entry transaction hash

    // Current details
    currentPrice?: number;     // Current token price
    currentValue?: number;     // Current position value
    unrealizedPnl?: number;    // Unrealized P&L
    unrealizedPnlPercent?: number; // Unrealized P&L percentage

    // Exit details (when closed)
    exitPrice?: number;        // Exit price in USD
    exitAmount?: number;       // Amount of tokens sold
    exitValue?: number;        // Total USD value at exit
    exitTimestamp?: Date;      // When position was closed
    exitTxHash?: string;       // Exit transaction hash
    realizedPnl?: number;      // Realized P&L
    realizedPnlPercent?: number; // Realized P&L percentage

    // Risk management
    stopLossPrice?: number;    // Stop loss trigger price
    takeProfitPrice?: number;  // Take profit trigger price
    maxLossUsd?: number;       // Maximum allowed loss

    // Metadata
    copyTradeId?: string;      // ID linking to original trade
    notes?: string;            // Additional notes
    lastUpdated: Date;         // Last update timestamp
}

export interface PositionSummary {
    totalPositions: number;
    openPositions: number;
    closedPositions: number;
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    winRate: number;
    avgWinPercent: number;
    avgLossPercent: number;
    biggestWin: number;
    biggestLoss: number;
}

export interface PositionRepository {
    // Basic CRUD
    createPosition(position: Omit<Position, 'id'>): Promise<number>;
    updatePosition(id: number, updates: Partial<Position>): Promise<void>;
    getPosition(id: number): Promise<Position | null>;
    deletePosition(id: number): Promise<void>;

    // Queries
    getOpenPositions(walletAddress?: string): Promise<Position[]>;
    getClosedPositions(walletAddress?: string, limit?: number): Promise<Position[]>;
    getPositionsByToken(tokenMint: string): Promise<Position[]>;
    getPositionsBySourceWallet(sourceWallet: string): Promise<Position[]>;

    // Analytics
    getPositionSummary(walletAddress?: string): Promise<PositionSummary>;
    getDailyPnl(date: string, walletAddress?: string): Promise<number>;
    getTopPerformers(limit: number): Promise<Position[]>;
    getWorstPerformers(limit: number): Promise<Position[]>;

    // Risk management
    getPositionsAtRisk(stopLossThreshold: number): Promise<Position[]>;
    getTotalExposure(walletAddress?: string): Promise<number>;
    getExposureByToken(): Promise<{[tokenMint: string]: number}>;
}

// Utility functions
export const calculateUnrealizedPnl = (position: Position, currentPrice: number): {
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    currentValue: number;
} => {
    const currentValue = position.entryAmount * currentPrice;
    const unrealizedPnl = currentValue - position.entryValue;
    const unrealizedPnlPercent = (unrealizedPnl / position.entryValue) * 100;

    return {
        unrealizedPnl,
        unrealizedPnlPercent,
        currentValue
    };
};

export const calculateRealizedPnl = (position: Position): {
    realizedPnl: number;
    realizedPnlPercent: number;
} => {
    if (!position.exitValue || position.status !== 'CLOSED') {
        return { realizedPnl: 0, realizedPnlPercent: 0 };
    }

    const realizedPnl = position.exitValue - position.entryValue;
    const realizedPnlPercent = (realizedPnl / position.entryValue) * 100;

    return { realizedPnl, realizedPnlPercent };
};

export const shouldTriggerStopLoss = (position: Position, currentPrice: number): boolean => {
    if (!position.stopLossPrice || position.status !== 'OPEN') return false;

    if (position.side === 'LONG') {
        return currentPrice <= position.stopLossPrice;
    } else {
        return currentPrice >= position.stopLossPrice;
    }
};

export const shouldTriggerTakeProfit = (position: Position, currentPrice: number): boolean => {
    if (!position.takeProfitPrice || position.status !== 'OPEN') return false;

    if (position.side === 'LONG') {
        return currentPrice >= position.takeProfitPrice;
    } else {
        return currentPrice <= position.takeProfitPrice;
    }
};

export const createPositionFromTrade = (
    tokenMint: string,
    sourceWallet: string,
    entryPrice: number,
    entryAmount: number,
    walletAddress: string
): Omit<Position, 'id'> => {
    const entryValue = entryPrice * entryAmount;

    return {
        tokenMint,
        walletAddress,
        sourceWallet,
        side: 'LONG',
        status: 'OPEN',
        entryPrice,
        entryAmount,
        entryValue,
        entryTimestamp: new Date(),
        lastUpdated: new Date(),
        // Set stop loss at 25% loss by default
        stopLossPrice: entryPrice * 0.75,
        maxLossUsd: entryValue * 0.25,
    };
};