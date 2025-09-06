// src/database/models/RiskMetrics.ts - Risk management tracking model
export interface RiskMetrics {
    id?: number;
    date: string;              // Date in YYYY-MM-DD format

    // Daily limits tracking
    dailyTradeCount: number;   // Number of trades today
    dailyVolumeUsd: number;    // Total trading volume today
    dailyLossUsd: number;      // Total losses today
    dailyProfitUsd: number;    // Total profits today
    dailyNetPnl: number;       // Net P&L today

    // Position limits
    openPositionsCount: number; // Current open positions
    totalExposureUsd: number;  // Total USD exposure
    maxSinglePositionUsd: number; // Largest single position

    // Risk ratios
    portfolioRiskRatio: number; // Total exposure / available capital
    concentrationRisk: number;  // Largest position / total exposure
    winRate: number;           // Success rate today
    avgPositionSizeUsd: number; // Average position size

    // Violation tracking
    dailyLimitViolations: number; // Times daily limits were hit
    riskLimitViolations: number;  // Times risk limits were hit
    stopLossTriggered: number;    // Number of stop losses triggered

    // Performance metrics
    sharpeRatio?: number;      // Risk-adjusted returns
    maxDrawdown?: number;      // Maximum drawdown %
    volatility?: number;       // Portfolio volatility

    // Timestamps
    lastUpdated: Date;
    createdAt: Date;
}

export interface RiskAlert {
    id?: number;
    alertType: 'DAILY_LOSS_LIMIT' | 'POSITION_LIMIT' | 'EXPOSURE_LIMIT' |
        'CONCENTRATION_RISK' | 'STOP_LOSS' | 'DRAWDOWN' | 'VOLATILITY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    currentValue: number;
    limitValue: number;
    tokenMint?: string;        // If alert is token-specific
    positionId?: number;       // If alert is position-specific

    // Alert state
    isActive: boolean;
    acknowledgedAt?: Date;
    resolvedAt?: Date;

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

export interface RiskConfiguration {
    // Daily limits
    maxDailyLossUsd: number;
    maxDailyTradesCount: number;
    maxDailyVolumeUsd: number;

    // Position limits
    maxOpenPositions: number;
    maxSinglePositionUsd: number;
    maxTotalExposureUsd: number;

    // Risk ratios
    maxPortfolioRiskRatio: number;  // 0.0 - 1.0
    maxConcentrationRisk: number;   // 0.0 - 1.0
    minWinRateThreshold: number;    // 0.0 - 1.0

    // Performance limits
    maxDrawdownPercent: number;     // Maximum allowed drawdown
    maxVolatilityPercent: number;   // Maximum allowed volatility

    // Token-specific limits
    maxPositionPerToken: number;    // Max USD per single token
    blacklistedTokens: string[];   // Tokens to never trade
    maxTokenExposureRatio: number;  // Max % of portfolio in one token
}

export interface RiskRepository {
    // Risk metrics CRUD
    createDailyMetrics(metrics: Omit<RiskMetrics, 'id'>): Promise<number>;
    updateDailyMetrics(date: string, updates: Partial<RiskMetrics>): Promise<void>;
    getDailyMetrics(date: string): Promise<RiskMetrics | null>;
    getMetricsHistory(days: number): Promise<RiskMetrics[]>;

    // Risk alerts
    createAlert(alert: Omit<RiskAlert, 'id'>): Promise<number>;
    updateAlert(id: number, updates: Partial<RiskAlert>): Promise<void>;
    getActiveAlerts(): Promise<RiskAlert[]>;
    getAlertHistory(days: number): Promise<RiskAlert[]>;
    acknowledgeAlert(id: number): Promise<void>;
    resolveAlert(id: number): Promise<void>;

    // Risk analysis
    getCurrentRiskLevel(): Promise<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
    getMaxDrawdown(days: number): Promise<number>;
    getVolatility(days: number): Promise<number>;
    getSharpeRatio(days: number): Promise<number>;
}

// Risk assessment functions
export const assessCurrentRisk = (
    metrics: RiskMetrics,
    config: RiskConfiguration
): {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number;
    violations: string[];
} => {
    let score = 0;
    const violations: string[] = [];

    // Daily loss check
    if (metrics.dailyLossUsd >= config.maxDailyLossUsd * 0.8) {
        score += 30;
        violations.push('Approaching daily loss limit');
    }
    if (metrics.dailyLossUsd >= config.maxDailyLossUsd) {
        score += 50;
        violations.push('Daily loss limit exceeded');
    }

    // Position limits check
    if (metrics.openPositionsCount >= config.maxOpenPositions * 0.9) {
        score += 20;
        violations.push('Approaching max positions');
    }

    // Exposure check
    if (metrics.totalExposureUsd >= config.maxTotalExposureUsd * 0.9) {
        score += 25;
        violations.push('High portfolio exposure');
    }

    // Concentration risk
    if (metrics.concentrationRisk >= config.maxConcentrationRisk) {
        score += 30;
        violations.push('High concentration risk');
    }

    // Win rate check
    if (metrics.winRate < config.minWinRateThreshold && metrics.dailyTradeCount >= 5) {
        score += 20;
        violations.push('Low win rate');
    }

    // Determine risk level
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score >= 80) level = 'CRITICAL';
    else if (score >= 50) level = 'HIGH';
    else if (score >= 25) level = 'MEDIUM';
    else level = 'LOW';

    return { level, score, violations };
};

export const shouldStopTrading = (
    metrics: RiskMetrics,
    config: RiskConfiguration
): { shouldStop: boolean; reasons: string[] } => {
    const reasons: string[] = [];

    // Hard limits
    if (metrics.dailyLossUsd >= config.maxDailyLossUsd) {
        reasons.push('Daily loss limit reached');
    }

    if (metrics.dailyTradeCount >= config.maxDailyTradesCount) {
        reasons.push('Daily trade limit reached');
    }

    if (metrics.openPositionsCount >= config.maxOpenPositions) {
        reasons.push('Maximum positions reached');
    }

    if (metrics.totalExposureUsd >= config.maxTotalExposureUsd) {
        reasons.push('Maximum exposure reached');
    }

    return {
        shouldStop: reasons.length > 0,
        reasons
    };
};

export const calculatePositionSize = (
    availableCapital: number,
    riskPercentage: number,
    stopLossDistance: number
): number => {
    // Position sizing using risk percentage method
    const riskAmount = availableCapital * riskPercentage;
    const positionSize = riskAmount / stopLossDistance;
    return Math.max(0, positionSize);
};

export const createDailyMetrics = (date: string): Omit<RiskMetrics, 'id'> => {
    const now = new Date();

    return {
        date,
        dailyTradeCount: 0,
        dailyVolumeUsd: 0,
        dailyLossUsd: 0,
        dailyProfitUsd: 0,
        dailyNetPnl: 0,
        openPositionsCount: 0,
        totalExposureUsd: 0,
        maxSinglePositionUsd: 0,
        portfolioRiskRatio: 0,
        concentrationRisk: 0,
        winRate: 0,
        avgPositionSizeUsd: 0,
        dailyLimitViolations: 0,
        riskLimitViolations: 0,
        stopLossTriggered: 0,
        lastUpdated: now,
        createdAt: now,
    };
};

export const createRiskAlert = (
    type: RiskAlert['alertType'],
    severity: RiskAlert['severity'],
    message: string,
    currentValue: number,
    limitValue: number
): Omit<RiskAlert, 'id'> => {
    const now = new Date();

    return {
        alertType: type,
        severity,
        message,
        currentValue,
        limitValue,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };
};