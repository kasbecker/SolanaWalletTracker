// src/services/TradeLogger.ts
import { getDatabase } from '../db';
import { TradeDetection } from './TradeDetector';
import { SwapResult } from './JupiterService';

export interface BotTrade {
    id: string;
    timestamp: number;
    source_wallet: string;
    target_wallet: string;
    token_mint: string;
    token_symbol?: string;
    action: 'BUY' | 'SELL';
    amount_tokens: number;
    amount_sol?: number;
    amount_usd?: number;
    price_per_token?: number;
    slippage_used?: number;
    priority_fee?: number;
    txn_hash?: string;
    jupiter_route?: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    error_message?: string;
    copy_multiplier?: number;
    execution_time_ms?: number;
}

export class TradeLogger {
    static async logTrade(trade: Partial<BotTrade>): Promise<string> {
        const db = await getDatabase();

        const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const fullTrade: BotTrade = {
            id: tradeId,
            timestamp: Date.now(),
            source_wallet: trade.source_wallet || '',
            target_wallet: trade.target_wallet || process.env.WALLET_ADDRESS || '',
            token_mint: trade.token_mint || '',
            token_symbol: trade.token_symbol || 'UNKNOWN',
            action: trade.action || 'BUY',
            amount_tokens: trade.amount_tokens || 0,
            amount_sol: trade.amount_sol || 0,
            amount_usd: trade.amount_usd || 0,
            price_per_token: trade.price_per_token || 0,
            slippage_used: trade.slippage_used || 0,
            priority_fee: trade.priority_fee || 0,
            txn_hash: trade.txn_hash || '',
            jupiter_route: trade.jupiter_route || '',
            status: trade.status || 'PENDING',
            error_message: trade.error_message || '',
            copy_multiplier: trade.copy_multiplier || 0,
            execution_time_ms: trade.execution_time_ms || 0,
        };

        await db.run(`
            INSERT INTO bot_trades (
                id, timestamp, source_wallet, target_wallet, token_mint, token_symbol,
                action, amount_tokens, amount_sol, amount_usd, price_per_token,
                slippage_used, priority_fee, txn_hash, jupiter_route, status,
                error_message, copy_multiplier, execution_time_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fullTrade.id, fullTrade.timestamp, fullTrade.source_wallet, fullTrade.target_wallet,
            fullTrade.token_mint, fullTrade.token_symbol, fullTrade.action, fullTrade.amount_tokens,
            fullTrade.amount_sol, fullTrade.amount_usd, fullTrade.price_per_token,
            fullTrade.slippage_used, fullTrade.priority_fee, fullTrade.txn_hash,
            fullTrade.jupiter_route, fullTrade.status, fullTrade.error_message,
            fullTrade.copy_multiplier, fullTrade.execution_time_ms
        ]);

        console.log(`📊 Trade logged: ${fullTrade.action} ${fullTrade.token_symbol} (${tradeId})`);

        return tradeId;
    }

    static async updateTradeStatus(
        tradeId: string,
        status: 'SUCCESS' | 'FAILED',
        swapResult?: SwapResult
    ): Promise<void> {
        const db = await getDatabase();

        if (swapResult) {
            await db.run(`
                UPDATE bot_trades SET
                    status = ?,
                    txn_hash = ?,
                    slippage_used = ?,
                    execution_time_ms = ?,
                    error_message = ?
                WHERE id = ?
            `, [
                status,
                swapResult.txnHash || '',
                swapResult.slippage || 0,
                swapResult.executionTime || 0,
                swapResult.error || '',
                tradeId
            ]);
        } else {
            await db.run(`
                UPDATE bot_trades SET status = ? WHERE id = ?
            `, [status, tradeId]);
        }

        console.log(`📊 Trade ${tradeId} updated: ${status}`);
    }

    static async getBotTrades(limit: number = 50): Promise<BotTrade[]> {
        const db = await getDatabase();

        const trades = await db.all(`
            SELECT * FROM bot_trades 
            ORDER BY timestamp DESC 
            LIMIT ?
        `, [limit]);

        return trades as BotTrade[];
    }

    static async getTradesByToken(tokenMint: string): Promise<BotTrade[]> {
        const db = await getDatabase();

        const trades = await db.all(`
            SELECT * FROM bot_trades 
            WHERE token_mint = ?
            ORDER BY timestamp DESC
        `, [tokenMint]);

        return trades as BotTrade[];
    }

    static async getTradeStats(): Promise<{
        totalTrades: number;
        successfulTrades: number;
        failedTrades: number;
        totalVolumeSol: number;
        successRate: number;
    }> {
        const db = await getDatabase();

        const stats = await db.get(`
            SELECT 
                COUNT(*) as totalTrades,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successfulTrades,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedTrades,
                SUM(CASE WHEN status = 'SUCCESS' THEN amount_sol ELSE 0 END) as totalVolumeSol
            FROM bot_trades
        `);

        const successRate = stats.totalTrades > 0
            ? (stats.successfulTrades / stats.totalTrades) * 100
            : 0;

        return {
            totalTrades: stats.totalTrades || 0,
            successfulTrades: stats.successfulTrades || 0,
            failedTrades: stats.failedTrades || 0,
            totalVolumeSol: stats.totalVolumeSol || 0,
            successRate: Math.round(successRate * 100) / 100
        };
    }
}