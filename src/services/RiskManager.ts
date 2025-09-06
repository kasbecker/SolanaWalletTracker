// src/services/RiskManager.ts - Risk controls and limits
import { logger } from '../utils/logger';
import { config } from '../config';
import { getDatabase } from '../database/db';
import {
    RiskMetrics,
    RiskAlert,
    RiskConfiguration,
    createDailyMetrics,
    createRiskAlert,
    assessCurrentRisk,
    shouldStopTrading
} from '../database/models/RiskMetrics';
import { WalletTransaction, CopyTradeSettings, TradeResult } from '../core/types';

export interface RiskCheckResult {
    approved: boolean;
    reason?: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommendations?: string[];
}

export class RiskManager {
    private db: any;
    private riskConfig: RiskConfiguration;
    private dailyMetrics: RiskMetrics | null = null;
    private lastMetricsUpdate: Date = new Date(0);

    constructor() {
        // Initialize risk configuration from config
        this.riskConfig = {
            // Daily limits
            maxDailyLossUsd: config.trading.maxDailyLoss,
            maxDailyTradesCount: config.trading.maxDailyTrades,
            maxDailyVolumeUsd: config.trading.maxTradeAmount * config.trading.maxDailyTrades,

            // Position limits
            maxOpenPositions: config.trading.maxOpenPositions,
            maxSinglePositionUsd: config.trading.maxPositionSizeUsd,
            maxTotalExposureUsd: config.trading.maxPositionSizeUsd * config.trading.maxOpenPositions,

            // Risk ratios
            maxPortfolioRiskRatio: 0.8, // 80% max exposure
            maxConcentrationRisk: 0.3, // 30% max in single token
            minWinRateThreshold: 0.4, // 40% minimum win rate

            // Performance limits
            maxDrawdownPercent: 0.25, // 25% max drawdown
            maxVolatilityPercent: 0.5, // 50% max volatility

            // Token-specific limits
            maxPositionPerToken: config.trading.maxPositionSizeUsd,
            blacklistedTokens: config.trading.blacklistedTokens,
            maxTokenExposureRatio: 0.2, // 20% max per token
        };
    }

    async initialize(): Promise<void> {
        try {
            logger.info('🛡️ Initializing Risk Manager...');

            this.db = await getDatabase();

            // Load or create today's metrics
            await this.loadTodaysMetrics();

            // Clean up old alerts
            await this.cleanupOldAlerts();

            logger.info('✅ Risk Manager initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Risk Manager:', error);
            throw error;
        }
    }

    async validateTrade(
        transaction: WalletTransaction,
        settings: CopyTradeSettings
    ): Promise<RiskCheckResult> {
        try {
            await this.refreshMetrics();

            const checks: { passed: boolean; reason: string }[] = [];
            const recommendations: string[] = [];

            // Check if trading should be stopped
            const stopCheck = shouldStopTrading(this.dailyMetrics!, this.riskConfig);
            if (stopCheck.shouldStop) {
                return {
                    approved: false,
                    reason: `Trading stopped: ${stopCheck.reasons.join(', ')}`,
                    riskLevel: 'CRITICAL'
                };
            }

            // Daily trade count check
            const dailyTradeCheck = this.dailyMetrics!.dailyTradeCount < this.riskConfig.maxDailyTradesCount;
            checks.push({
                passed: dailyTradeCheck,
                reason: `Daily trades: ${this.dailyMetrics!.dailyTradeCount}/${this.riskConfig.maxDailyTradesCount}`
            });

            // Daily loss check
            const approachingLossLimit = this.dailyMetrics!.dailyLossUsd >= this.riskConfig.maxDailyLossUsd * 0.8;
            const dailyLossCheck = this.dailyMetrics!.dailyLossUsd < this.riskConfig.maxDailyLossUsd;
            checks.push({
                passed: dailyLossCheck,
                reason: `Daily loss: $${this.dailyMetrics!.dailyLossUsd.toFixed(2)}/$${this.riskConfig.maxDailyLossUsd}`
            });

            if (approachingLossLimit) {
                recommendations.push('Approaching daily loss limit - consider reducing position sizes');
            }

            // Position count check
            const positionCountCheck = this.dailyMetrics!.openPositionsCount < this.riskConfig.maxOpenPositions;
            checks.push({
                passed: positionCountCheck,
                reason: `Open positions: ${this.dailyMetrics!.openPositionsCount}/${this.riskConfig.maxOpenPositions}`
            });

            // Token blacklist check
            const tokenBlacklistCheck = !this.riskConfig.blacklistedTokens.includes(transaction.token);
            checks.push({
                passed: tokenBlacklistCheck,
                reason: tokenBlacklistCheck ? 'Token not blacklisted' : 'Token is blacklisted'
            });

            // Calculate trade value
            const tradeValueUsd = this.calculateTradeValue(transaction, settings);

            // Single position size check
            const positionSizeCheck = tradeValueUsd <= this.riskConfig.maxSinglePositionUsd;
            checks.push({
                passed: positionSizeCheck,
                reason: `Position size: $${tradeValueUsd.toFixed(2)}/$${this.riskConfig.maxSinglePositionUsd}`
            });

            // Total exposure check
            const newTotalExposure = this.dailyMetrics!.totalExposureUsd + tradeValueUsd;
            const exposureCheck = newTotalExposure <= this.riskConfig.maxTotalExposureUsd;
            checks.push({
                passed: exposureCheck,
                reason: `Total exposure: $${newTotalExposure.toFixed(2)}/$${this.riskConfig.maxTotalExposureUsd}`
            });

            // Win rate check (only if we have enough trades)
            let winRateCheck = true;
            if (this.dailyMetrics!.dailyTradeCount >= 10) {
                winRateCheck = this.dailyMetrics!.winRate >= this.riskConfig.minWinRateThreshold;
                checks.push({
                    passed: winRateCheck,
                    reason: `Win rate: ${(this.dailyMetrics!.winRate * 100).toFixed(1)}%`
                });

                if (!winRateCheck) {
                    recommendations.push('Low win rate detected - consider adjusting strategy');
                }
            }

            // Source wallet check (avoid following bad performers)
            const sourceWalletRisk = await this.assessSourceWalletRisk(transaction.sourceWallet);
            const sourceWalletCheck = sourceWalletRisk !== 'HIGH';
            checks.push({
                passed: sourceWalletCheck,
                reason: `Source wallet risk: ${sourceWalletRisk}`
            });

            // Determine overall result
            const failedChecks = checks.filter(check => !check.passed);
            const approved = failedChecks.length === 0;

            // Assess risk level
            const riskAssessment = assessCurrentRisk(this.dailyMetrics!, this.riskConfig);

            // Log risk check results
            if (!approved) {
                logger.warn(`🚨 Trade rejected: ${failedChecks.map(c => c.reason).join(', ')}`);
            } else if (riskAssessment.level === 'HIGH') {
                logger.warn(`⚠️ High risk trade approved: ${riskAssessment.violations.join(', ')}`);
            }

            return {
                approved,
                reason: approved ? undefined : failedChecks[0].reason,
                riskLevel: riskAssessment.level,
                recommendations: recommendations.length > 0 ? recommendations : undefined
            };

        } catch (error) {
            logger.error('❌ Risk validation failed:', error);
            return {
                approved: false,
                reason: 'Risk validation error',
                riskLevel: 'CRITICAL'
            };
        }
    }

    async recordTrade(result: TradeResult, tradeValueUsd: number): Promise<void> {
        try {
            await this.refreshMetrics();

            // Update daily metrics
            this.dailyMetrics!.dailyTradeCount += 1;
            this.dailyMetrics!.dailyVolumeUsd += tradeValueUsd;

            if (result.status === 'success') {
                // For now, we don't know profit/loss until position is closed
                // This will be updated when positions are closed
            } else {
                // Failed trades count as small losses (fees)
                this.dailyMetrics!.dailyLossUsd += 10; // Assume $10 loss for failed trade
            }

            // Recalculate win rate
            const successfulTrades = await this.getSuccessfulTradesCount();
            this.dailyMetrics!.winRate = this.dailyMetrics!.dailyTradeCount > 0 ?
                successfulTrades / this.dailyMetrics!.dailyTradeCount : 0;

            // Update position count and exposure
            await this.updatePositionMetrics();

            // Save updated metrics
            await this.saveDailyMetrics();

            // Check for risk alerts
            await this.checkRiskAlerts();

        } catch (error) {
            logger.error('❌ Failed to record trade in risk manager:', error);
        }
    }

    async recordPositionClose(realizedPnl: number): Promise<void> {
        try {
            await this.refreshMetrics();

            if (realizedPnl > 0) {
                this.dailyMetrics!.dailyProfitUsd += realizedPnl;
            } else {
                this.dailyMetrics!.dailyLossUsd += Math.abs(realizedPnl);
            }

            this.dailyMetrics!.dailyNetPnl = this.dailyMetrics!.dailyProfitUsd - this.dailyMetrics!.dailyLossUsd;

            await this.updatePositionMetrics();
            await this.saveDailyMetrics();
            await this.checkRiskAlerts();

            logger.info(`📊 Recorded P&L: $${realizedPnl.toFixed(2)}, Daily Net: $${this.dailyMetrics!.dailyNetPnl.toFixed(2)}`);

        } catch (error) {
            logger.error('❌ Failed to record position close:', error);
        }
    }

    async getCurrentRiskLevel(): Promise<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> {
        await this.refreshMetrics();
        const assessment = assessCurrentRisk(this.dailyMetrics!, this.riskConfig);
        return assessment.level;
    }

    async getActiveAlerts(): Promise<RiskAlert[]> {
        try {
            const rows = await this.db.all(`
        SELECT * FROM risk_alerts 
        WHERE is_active = 1 
        ORDER BY severity DESC, created_at DESC
      `);

            return rows.map(row => this.mapRowToAlert(row));
        } catch (error) {
            logger.error('❌ Failed to get active alerts:', error);
            return [];
        }
    }

    async getRiskSummary(): Promise<{
        dailyMetrics: RiskMetrics;
        riskLevel: string;
        activeAlerts: number;
        tradingAllowed: boolean;
    }> {
        await this.refreshMetrics();

        const activeAlerts = await this.getActiveAlerts();
        const riskLevel = await this.getCurrentRiskLevel();
        const stopCheck = shouldStopTrading(this.dailyMetrics!, this.riskConfig);

        return {
            dailyMetrics: this.dailyMetrics!,
            riskLevel,
            activeAlerts: activeAlerts.length,
            tradingAllowed: !stopCheck.shouldStop
        };
    }

    private async loadTodaysMetrics(): Promise<void> {
        const today = new Date().toISOString().split('T')[0];

        const existing = await this.db.get(`
      SELECT * FROM risk_metrics WHERE date = ?
    `, [today]);

        if (existing) {
            this.dailyMetrics = this.mapRowToMetrics(existing);
        } else {
            this.dailyMetrics = createDailyMetrics(today);
            await this.saveDailyMetrics();
        }

        this.lastMetricsUpdate = new Date();
    }

    private async refreshMetrics(): Promise<void> {
        const now = new Date();
        const timeSinceUpdate = now.getTime() - this.lastMetricsUpdate.getTime();

        // Refresh every 5 minutes or if day changed
        if (timeSinceUpdate > 300000 || this.isDifferentDay(now, this.lastMetricsUpdate)) {
            await this.loadTodaysMetrics();
            await this.updatePositionMetrics();
        }
    }

    private async updatePositionMetrics(): Promise<void> {
        try {
            // Get current position data
            const positionSummary = await this.db.get(`
        SELECT 
          COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as openCount,
          SUM(CASE WHEN status = 'OPEN' THEN current_value ELSE 0 END) as totalExposure,
          MAX(CASE WHEN status = 'OPEN' THEN current_value ELSE 0 END) as maxPosition,
          AVG(CASE WHEN status = 'OPEN' THEN current_value ELSE NULL END) as avgPosition
        FROM positions
      `);

            this.dailyMetrics!.openPositionsCount = positionSummary.openCount || 0;
            this.dailyMetrics!.totalExposureUsd = positionSummary.totalExposure || 0;
            this.dailyMetrics!.maxSinglePositionUsd = positionSummary.maxPosition || 0;
            this.dailyMetrics!.avgPositionSizeUsd = positionSummary.avgPosition || 0;

            // Calculate risk ratios
            const portfolioValue = this.dailyMetrics!.totalExposureUsd + 10000; // Assume $10k base capital
            this.dailyMetrics!.portfolioRiskRatio = this.dailyMetrics!.totalExposureUsd / portfolioValue;
            this.dailyMetrics!.concentrationRisk = portfolioValue > 0 ?
                this.dailyMetrics!.maxSinglePositionUsd / portfolioValue : 0;

        } catch (error) {
            logger.error('❌ Failed to update position metrics:', error);
        }
    }

    private async saveDailyMetrics(): Promise<void> {
        try {
            await this.db.run(`
        INSERT OR REPLACE INTO risk_metrics (
          date, daily_trade_count, daily_volume_usd, daily_loss_usd,
          daily_profit_usd, daily_net_pnl, open_positions_count,
          total_exposure_usd, max_single_position_usd, portfolio_risk_ratio,
          concentration_risk, win_rate, avg_position_size_usd,
          daily_limit_violations, risk_limit_violations, stop_loss_triggered,
          last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                this.dailyMetrics!.date,
                this.dailyMetrics!.dailyTradeCount,
                this.dailyMetrics!.dailyVolumeUsd,
                this.dailyMetrics!.dailyLossUsd,
                this.dailyMetrics!.dailyProfitUsd,
                this.dailyMetrics!.dailyNetPnl,
                this.dailyMetrics!.openPositionsCount,
                this.dailyMetrics!.totalExposureUsd,
                this.dailyMetrics!.maxSinglePositionUsd,
                this.dailyMetrics!.portfolioRiskRatio,
                this.dailyMetrics!.concentrationRisk,
                this.dailyMetrics!.winRate,
                this.dailyMetrics!.avgPositionSizeUsd,
                this.dailyMetrics!.dailyLimitViolations,
                this.dailyMetrics!.riskLimitViolations,
                this.dailyMetrics!.stopLossTriggered,
                new Date().toISOString()
            ]);
        } catch (error) {
            logger.error('❌ Failed to save daily metrics:', error);
        }
    }

    private async checkRiskAlerts(): Promise<void> {
        const assessment = assessCurrentRisk(this.dailyMetrics!, this.riskConfig);

        // Create alerts for violations
        for (const violation of assessment.violations) {
            await this.createAlert('DAILY_LOSS_LIMIT', assessment.level, violation, 0, 0);
        }

        // Check for approaching limits
        if (this.dailyMetrics!.dailyLossUsd >= this.riskConfig.maxDailyLossUsd * 0.9) {
            await this.createAlert(
                'DAILY_LOSS_LIMIT',
                'HIGH',
                'Approaching daily loss limit',
                this.dailyMetrics!.dailyLossUsd,
                this.riskConfig.maxDailyLossUsd
            );
        }
    }

    private async createAlert(
        type: RiskAlert['alertType'],
        severity: RiskAlert['severity'],
        message: string,
        currentValue: number,
        limitValue: number
    ): Promise<void> {
        try {
            // Check if similar alert already exists
            const existing = await this.db.get(`
        SELECT id FROM risk_alerts 
        WHERE alert_type = ? AND is_active = 1 AND message = ?
      `, [type, message]);

            if (!existing) {
                const alert = createRiskAlert(type, severity, message, currentValue, limitValue);

                await this.db.run(`
          INSERT INTO risk_alerts (
            alert_type, severity, message, current_value, limit_value,
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    alert.alertType, alert.severity, alert.message, alert.currentValue,
                    alert.limitValue, alert.isActive ? 1 : 0, alert.createdAt.toISOString(),
                    alert.updatedAt.toISOString()
                ]);

                logger.warn(`🚨 Risk alert created: ${message}`);
            }
        } catch (error) {
            logger.error('❌ Failed to create risk alert:', error);
        }
    }

    private async getSuccessfulTradesCount(): Promise<number> {
        try {
            const result = await this.db.get(`
        SELECT COUNT(*) as count FROM trades 
        WHERE DATE(timestamp) = ? AND status = 'SUCCESS'
      `, [this.dailyMetrics!.date]);

            return result.count || 0;
        } catch (error) {
            return 0;
        }
    }

    private async assessSourceWalletRisk(sourceWallet: string): Promise<'LOW' | 'MEDIUM' | 'HIGH'> {
        try {
            // Simple assessment based on recent performance
            const recentTrades = await this.db.all(`
        SELECT realized_pnl FROM positions 
        WHERE source_wallet = ? AND status = 'CLOSED' 
        ORDER BY exit_timestamp DESC LIMIT 10
      `, [sourceWallet]);

            if (recentTrades.length < 3) return 'MEDIUM';

            const winRate = recentTrades.filter(t => t.realized_pnl > 0).length / recentTrades.length;
            const avgPnl = recentTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) / recentTrades.length;

            if (winRate >= 0.6 && avgPnl > 0) return 'LOW';
            if (winRate >= 0.4 || avgPnl >= 0) return 'MEDIUM';
            return 'HIGH';

        } catch (error) {
            return 'MEDIUM';
        }
    }

    private calculateTradeValue(transaction: WalletTransaction, settings: CopyTradeSettings): number {
        // Estimate USD value - this would need actual price data
        const estimatedSolValue = parseFloat(transaction.amount) / Math.pow(10, 9);
        const solPriceUsd = 100; // Placeholder - should get real SOL price
        return estimatedSolValue * solPriceUsd * settings.followPercentage;
    }

    private async cleanupOldAlerts(): Promise<void> {
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await this.db.run(`
      DELETE FROM risk_alerts 
      WHERE resolved_at < ? AND is_active = 0
    `, [cutoffDate]);
    }

    private isDifferentDay(date1: Date, date2: Date): boolean {
        return date1.toDateString() !== date2.toDateString();
    }

    private mapRowToMetrics(row: any): RiskMetrics {
        return {
            id: row.id,
            date: row.date,
            dailyTradeCount: row.daily_trade_count,
            dailyVolumeUsd: row.daily_volume_usd,
            dailyLossUsd: row.daily_loss_usd,
            dailyProfitUsd: row.daily_profit_usd,
            dailyNetPnl: row.daily_net_pnl,
            openPositionsCount: row.open_positions_count,
            totalExposureUsd: row.total_exposure_usd,
            maxSinglePositionUsd: row.max_single_position_usd,
            portfolioRiskRatio: row.portfolio_risk_ratio,
            concentrationRisk: row.concentration_risk,
            winRate: row.win_rate,
            avgPositionSizeUsd: row.avg_position_size_usd,
            dailyLimitViolations: row.daily_limit_violations,
            riskLimitViolations: row.risk_limit_violations,
            stopLossTriggered: row.stop_loss_triggered,
            sharpeRatio: row.sharpe_ratio,
            maxDrawdown: row.max_drawdown,
            volatility: row.volatility,
            lastUpdated: new Date(row.last_updated),
            createdAt: new Date(row.created_at),
        };
    }

    private mapRowToAlert(row: any): RiskAlert {
        return {
            id: row.id,
            alertType: row.alert_type,
            severity: row.severity,
            message: row.message,
            currentValue: row.current_value,
            limitValue: row.limit_value,
            tokenMint: row.token_mint,
            positionId: row.position_id,
            isActive: Boolean(row.is_active),
            acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
            resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }

    async shutdown(): Promise<void> {
        logger.info('🛡️ Shutting down Risk Manager...');

        // Save final metrics
        if (this.dailyMetrics) {
            try {
                await this.saveDailyMetrics();
                logger.info('💾 Final risk metrics saved');
            } catch (error) {
                logger.error('❌ Failed to save final metrics:', error);
            }
        }

        // Resolve any active alerts that should be closed
        try {
            await this.db.run(`
        UPDATE risk_alerts 
        SET is_active = 0, resolved_at = CURRENT_TIMESTAMP 
        WHERE is_active = 1 AND alert_type IN ('DAILY_LOSS_LIMIT', 'DAILY_TRADE_LIMIT')
      `);
        } catch (error) {
            logger.error('❌ Failed to resolve alerts:', error);
        }

        logger.info('✅ Risk Manager shutdown complete');
    }
}