// src/services/PositionManager.ts - Position tracking and management
import { logger } from '../utils/logger';
import { config } from '../config';
import { getDatabase } from '../database/db';
import {
    Position,
    PositionSummary,
    createPositionFromTrade,
    calculateUnrealizedPnl,
    shouldTriggerStopLoss,
    shouldTriggerTakeProfit
} from '../database/models/Positions';
import { PriceService } from './PriceService';

export interface CreatePositionParams {
    tokenMint: string;
    sourceWallet: string;
    entryPrice: number;
    entryAmount: number;
    entryValue: number;
    entryTxHash?: string;
}

export interface PositionUpdate {
    currentPrice: number;
    currentValue: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
}

export class PositionManager {
    private db: any;
    private priceService: PriceService;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.priceService = new PriceService();
    }

    async initialize(): Promise<void> {
        try {
            logger.info('📊 Initializing Position Manager...');

            this.db = await getDatabase();
            await this.priceService.initialize();

            // Start position monitoring
            this.startPositionMonitoring();

            logger.info('✅ Position Manager initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Position Manager:', error);
            throw error;
        }
    }

    async createPosition(params: CreatePositionParams): Promise<number> {
        try {
            const position = createPositionFromTrade(
                params.tokenMint,
                params.sourceWallet,
                params.entryPrice,
                params.entryAmount,
                config.wallets[0].address // Assuming first wallet is our trading wallet
            );

            position.entryValue = params.entryValue;
            position.entryTxHash = params.entryTxHash;

            const result = await this.db.run(`
        INSERT INTO positions (
          token_mint, wallet_address, source_wallet, side, status,
          entry_price, entry_amount, entry_value, entry_timestamp,
          entry_tx_hash, stop_loss_price, max_loss_usd, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                position.tokenMint,
                position.walletAddress,
                position.sourceWallet,
                position.side,
                position.status,
                position.entryPrice,
                position.entryAmount,
                position.entryValue,
                position.entryTimestamp.toISOString(),
                position.entryTxHash,
                position.stopLossPrice,
                position.maxLossUsd,
                position.lastUpdated.toISOString()
            ]);

            const positionId = result.lastID;
            logger.info(`📈 Created position ${positionId} for ${params.tokenMint}`);

            return positionId;
        } catch (error) {
            logger.error('❌ Failed to create position:', error);
            throw error;
        }
    }

    async getPosition(id: number): Promise<Position | null> {
        try {
            const row = await this.db.get(`
        SELECT * FROM positions WHERE id = ?
      `, [id]);

            return row ? this.mapRowToPosition(row) : null;
        } catch (error) {
            logger.error('❌ Failed to get position:', error);
            return null;
        }
    }

    async getPositionByToken(tokenMint: string): Promise<Position | null> {
        try {
            const row = await this.db.get(`
        SELECT * FROM positions 
        WHERE token_mint = ? AND status = 'OPEN'
        ORDER BY entry_timestamp DESC 
        LIMIT 1
      `, [tokenMint]);

            return row ? this.mapRowToPosition(row) : null;
        } catch (error) {
            logger.error('❌ Failed to get position by token:', error);
            return null;
        }
    }

    async getOpenPositions(): Promise<Position[]> {
        try {
            const rows = await this.db.all(`
        SELECT * FROM positions 
        WHERE status = 'OPEN'
        ORDER BY entry_timestamp DESC
      `);

            return rows.map(row => this.mapRowToPosition(row));
        } catch (error) {
            logger.error('❌ Failed to get open positions:', error);
            return [];
        }
    }

    async updatePosition(id: number, updates: Partial<Position>): Promise<void> {
        try {
            const setClause = Object.keys(updates)
                .map(key => `${this.camelToSnake(key)} = ?`)
                .join(', ');

            const values = Object.values(updates);
            values.push(new Date().toISOString()); // last_updated
            values.push(id);

            await this.db.run(`
        UPDATE positions 
        SET ${setClause}, last_updated = ?
        WHERE id = ?
      `, values);

            logger.debug(`📊 Updated position ${id}`);
        } catch (error) {
            logger.error('❌ Failed to update position:', error);
            throw error;
        }
    }

    async updatePositionAfterSell(
        positionId: number,
        sellAmount: number,
        exitPrice: number,
        txHash?: string
    ): Promise<void> {
        try {
            const position = await this.getPosition(positionId);
            if (!position) {
                throw new Error(`Position ${positionId} not found`);
            }

            const isFullSell = sellAmount >= position.entryAmount;
            const exitValue = sellAmount * exitPrice;
            const proportionalEntryValue = (sellAmount / position.entryAmount) * position.entryValue;
            const realizedPnl = exitValue - proportionalEntryValue;
            const realizedPnlPercent = (realizedPnl / proportionalEntryValue) * 100;

            if (isFullSell) {
                // Close position completely
                await this.updatePosition(positionId, {
                    status: 'CLOSED',
                    exitPrice,
                    exitAmount: sellAmount,
                    exitValue,
                    exitTimestamp: new Date(),
                    exitTxHash: txHash,
                    realizedPnl,
                    realizedPnlPercent
                });

                logger.info(`🔒 Closed position ${positionId} with ${realizedPnl > 0 ? 'profit' : 'loss'}: $${realizedPnl.toFixed(2)}`);
            } else {
                // Partial sell - reduce position size
                const remainingAmount = position.entryAmount - sellAmount;
                const remainingValue = (remainingAmount / position.entryAmount) * position.entryValue;

                await this.updatePosition(positionId, {
                    status: 'PARTIAL',
                    entryAmount: remainingAmount,
                    entryValue: remainingValue,
                    exitPrice,
                    exitAmount: sellAmount,
                    exitValue,
                    exitTimestamp: new Date(),
                    exitTxHash: txHash,
                    realizedPnl: (position.realizedPnl || 0) + realizedPnl,
                    realizedPnlPercent
                });

                logger.info(`📉 Partial sell position ${positionId}: $${realizedPnl.toFixed(2)} realized`);
            }
        } catch (error) {
            logger.error('❌ Failed to update position after sell:', error);
            throw error;
        }
    }

    async updatePositionPrices(): Promise<void> {
        try {
            const openPositions = await this.getOpenPositions();

            for (const position of openPositions) {
                try {
                    const currentPrice = await this.priceService.getTokenPrice(position.tokenMint);
                    if (!currentPrice) continue;

                    const pnlData = calculateUnrealizedPnl(position, currentPrice);

                    await this.updatePosition(position.id!, {
                        currentPrice,
                        currentValue: pnlData.currentValue,
                        unrealizedPnl: pnlData.unrealizedPnl,
                        unrealizedPnlPercent: pnlData.unrealizedPnlPercent
                    });

                    // Check for stop loss triggers
                    if (shouldTriggerStopLoss(position, currentPrice)) {
                        logger.warn(`🔴 Stop loss triggered for position ${position.id} at $${currentPrice}`);
                        await this.triggerStopLoss(position.id!);
                    }

                    // Check for take profit triggers
                    if (shouldTriggerTakeProfit(position, currentPrice)) {
                        logger.info(`🟢 Take profit triggered for position ${position.id} at $${currentPrice}`);
                        await this.triggerTakeProfit(position.id!);
                    }

                } catch (error) {
                    logger.error(`❌ Failed to update price for position ${position.id}:`, error);
                }
            }
        } catch (error) {
            logger.error('❌ Failed to update position prices:', error);
        }
    }

    async getPositionSummary(): Promise<PositionSummary> {
        try {
            const summary = await this.db.get(`
        SELECT 
          COUNT(*) as totalPositions,
          SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as openPositions,
          SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closedPositions,
          SUM(CASE WHEN status = 'OPEN' THEN current_value ELSE 0 END) as totalValue,
          SUM(CASE WHEN status = 'CLOSED' THEN realized_pnl ELSE unrealized_pnl END) as totalPnl,
          AVG(CASE WHEN status = 'CLOSED' THEN realized_pnl_percent ELSE unrealized_pnl_percent END) as totalPnlPercent,
          SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as winRate,
          AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl_percent ELSE NULL END) as avgWinPercent,
          AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl_percent ELSE NULL END) as avgLossPercent,
          MAX(realized_pnl) as biggestWin,
          MIN(realized_pnl) as biggestLoss
        FROM positions
        WHERE status IN ('OPEN', 'CLOSED')
      `);

            return {
                totalPositions: summary.totalPositions || 0,
                openPositions: summary.openPositions || 0,
                closedPositions: summary.closedPositions || 0,
                totalValue: summary.totalValue || 0,
                totalPnl: summary.totalPnl || 0,
                totalPnlPercent: summary.totalPnlPercent || 0,
                winRate: summary.winRate || 0,
                avgWinPercent: summary.avgWinPercent || 0,
                avgLossPercent: summary.avgLossPercent || 0,
                biggestWin: summary.biggestWin || 0,
                biggestLoss: summary.biggestLoss || 0,
            };
        } catch (error) {
            logger.error('❌ Failed to get position summary:', error);
            return {
                totalPositions: 0,
                openPositions: 0,
                closedPositions: 0,
                totalValue: 0,
                totalPnl: 0,
                totalPnlPercent: 0,
                winRate: 0,
                avgWinPercent: 0,
                avgLossPercent: 0,
                biggestWin: 0,
                biggestLoss: 0,
            };
        }
    }

    async getPositionsAtRisk(): Promise<Position[]> {
        try {
            const riskThreshold = -0.15; // 15% loss threshold

            const rows = await this.db.all(`
        SELECT * FROM positions 
        WHERE status = 'OPEN' 
        AND unrealized_pnl_percent < ?
        ORDER BY unrealized_pnl_percent ASC
      `, [riskThreshold]);

            return rows.map(row => this.mapRowToPosition(row));
        } catch (error) {
            logger.error('❌ Failed to get positions at risk:', error);
            return [];
        }
    }

    async getTotalExposure(): Promise<number> {
        try {
            const result = await this.db.get(`
        SELECT SUM(current_value) as totalExposure 
        FROM positions 
        WHERE status = 'OPEN'
      `);

            return result.totalExposure || 0;
        } catch (error) {
            logger.error('❌ Failed to get total exposure:', error);
            return 0;
        }
    }

    private async triggerStopLoss(positionId: number): Promise<void> {
        try {
            const position = await this.getPosition(positionId);
            if (!position) return;

            logger.warn(`🚨 Triggering stop loss for position ${positionId}`);

            // Mark position for stop loss execution
            await this.updatePosition(positionId, {
                status: 'CLOSED',
                exitTimestamp: new Date(),
                // Note: In a real implementation, this would trigger an actual sell order
            });

            // TODO: Integrate with trading engine to execute actual stop loss order
            // await this.tradingEngine.executeSellOrder(position);

        } catch (error) {
            logger.error(`❌ Failed to trigger stop loss for position ${positionId}:`, error);
        }
    }

    private async triggerTakeProfit(positionId: number): Promise<void> {
        try {
            const position = await this.getPosition(positionId);
            if (!position) return;

            logger.info(`🎯 Triggering take profit for position ${positionId}`);

            // Mark position for take profit execution
            await this.updatePosition(positionId, {
                status: 'CLOSED',
                exitTimestamp: new Date(),
                // Note: In a real implementation, this would trigger an actual sell order
            });

            // TODO: Integrate with trading engine to execute actual take profit order
            // await this.tradingEngine.executeSellOrder(position);

        } catch (error) {
            logger.error(`❌ Failed to trigger take profit for position ${positionId}:`, error);
        }
    }

    private startPositionMonitoring(): void {
        // Update position prices every 30 seconds
        this.updateInterval = setInterval(async () => {
            try {
                await this.updatePositionPrices();
            } catch (error) {
                logger.error('❌ Position monitoring error:', error);
            }
        }, 30000);

        logger.info('📊 Position monitoring started (30s intervals)');
    }

    private stopPositionMonitoring(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            logger.info('📊 Position monitoring stopped');
        }
    }

    private mapRowToPosition(row: any): Position {
        return {
            id: row.id,
            tokenMint: row.token_mint,
            walletAddress: row.wallet_address,
            sourceWallet: row.source_wallet,
            side: row.side,
            status: row.status,
            entryPrice: row.entry_price,
            entryAmount: row.entry_amount,
            entryValue: row.entry_value,
            entryTimestamp: new Date(row.entry_timestamp),
            entryTxHash: row.entry_tx_hash,
            currentPrice: row.current_price,
            currentValue: row.current_value,
            unrealizedPnl: row.unrealized_pnl,
            unrealizedPnlPercent: row.unrealized_pnl_percent,
            exitPrice: row.exit_price,
            exitAmount: row.exit_amount,
            exitValue: row.exit_value,
            exitTimestamp: row.exit_timestamp ? new Date(row.exit_timestamp) : undefined,
            exitTxHash: row.exit_tx_hash,
            realizedPnl: row.realized_pnl,
            realizedPnlPercent: row.realized_pnl_percent,
            stopLossPrice: row.stop_loss_price,
            takeProfitPrice: row.take_profit_price,
            maxLossUsd: row.max_loss_usd,
            copyTradeId: row.copy_trade_id,
            notes: row.notes,
            lastUpdated: new Date(row.last_updated),
        };
    }

    private camelToSnake(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    async shutdown(): Promise<void> {
        logger.info('📊 Shutting down Position Manager...');
        this.stopPositionMonitoring();
        logger.info('✅ Position Manager shutdown complete');
    }
}