// src/services/TradingEngine.ts - Main copy trading orchestrator
import { PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PositionManager } from './PositionManager';
import { RiskManager } from './RiskManager';
import { PriceService } from './PriceService';
import { GMGNService } from '../integrations/gmgn/GMGNService';
import {
    WalletTransaction,
    TradeResult,
    CopyTradeSettings,
    TradingEngineStatus
} from '../core/types';
import {
    Trade,
    createTradeFromExecution,
    generateCopyTradeId
} from '../database/models/Trades';
import { getDatabase } from '../database/db';

export class TradingEngine {
    private wallet: Keypair;
    private positionManager: PositionManager;
    private riskManager: RiskManager;
    private priceService: PriceService;
    private gmgnService: GMGNService;
    private isInitialized: boolean = false;
    private db: any;

    constructor() {
        // Initialize wallet from environment
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }

        try {
            const privateKeyBytes = bs58.decode(process.env.PRIVATE_KEY);
            this.wallet = Keypair.fromSecretKey(privateKeyBytes);
        } catch (error) {
            throw new Error('Invalid PRIVATE_KEY format. Must be base58 encoded.');
        }

        // Initialize services
        this.positionManager = new PositionManager();
        this.riskManager = new RiskManager();
        this.priceService = new PriceService();
        this.gmgnService = new GMGNService();
    }

    async initialize(): Promise<void> {
        try {
            logger.info('🚀 Initializing Trading Engine...');

            // Initialize database
            this.db = await getDatabase();

            // Initialize all services
            await this.positionManager.initialize();
            await this.riskManager.initialize();
            await this.priceService.initialize();
            await this.gmgnService.initialize();

            // Log wallet info
            logger.info(`💼 Trading wallet: ${this.wallet.publicKey.toString()}`);
            logger.info(`🎯 Trading mode: ${config.trading.mode.toUpperCase()}`);
            logger.info(`⚡ Copy trading: ${config.trading.enabled ? 'ENABLED' : 'DISABLED'}`);

            this.isInitialized = true;
            logger.info('✅ Trading Engine initialized successfully');

        } catch (error) {
            logger.error('❌ Failed to initialize Trading Engine:', error);
            throw error;
        }
    }

    async handleCopyTrade(
        transaction: WalletTransaction,
        settings: CopyTradeSettings
    ): Promise<TradeResult> {
        if (!this.isInitialized) {
            throw new Error('Trading Engine not initialized');
        }

        try {
            logger.info(`🔄 Processing copy trade: ${transaction.action} ${transaction.token}`);

            // Risk validation
            const riskCheck = await this.riskManager.validateTrade(transaction, settings);
            if (!riskCheck.approved) {
                logger.warn(`❌ Trade rejected: ${riskCheck.reason}`);
                return {
                    status: 'rejected',
                    reason: riskCheck.reason,
                    timestamp: Date.now()
                };
            }

            // Check if trading is enabled
            if (!config.trading.enabled) {
                logger.info('📋 Trading disabled - logging trade only');
                return {
                    status: 'skipped',
                    reason: 'Trading disabled in configuration',
                    timestamp: Date.now()
                };
            }

            // Execute trade based on action
            if (transaction.action === 'BUY') {
                return await this.executeBuy(transaction, settings);
            } else if (transaction.action === 'SELL') {
                return await this.executeSell(transaction, settings);
            }

            throw new Error(`Unknown transaction action: ${transaction.action}`);

        } catch (error) {
            logger.error('❌ Copy trade execution failed:', error);
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            };
        }
    }

    private async executeBuy(
        transaction: WalletTransaction,
        settings: CopyTradeSettings
    ): Promise<TradeResult> {
        try {
            logger.info('📈 Executing BUY order...');

            // Calculate copy amount
            const copyAmount = this.calculateCopyAmount(transaction.amount, settings);
            logger.info(`💰 Copy amount calculated: ${copyAmount} lamports`);

            // Get current price for validation
            const tokenPrice = await this.priceService.getTokenPrice(transaction.token);
            if (!tokenPrice) {
                throw new Error('Unable to fetch token price');
            }

            // Check if amount meets minimum requirements
            const usdValue = (copyAmount / Math.pow(10, 9)) * tokenPrice;
            if (usdValue < config.trading.minTradeAmount) {
                return {
                    status: 'rejected',
                    reason: `Trade amount $${usdValue.toFixed(2)} below minimum $${config.trading.minTradeAmount}`,
                    timestamp: Date.now()
                };
            }

            // Create trade record
            const trade = createTradeFromExecution(
                'BUY',
                transaction.token,
                transaction.sourceWallet,
                copyAmount,
                0, // Will be filled after execution
                tokenPrice,
                config.trading.defaultSlippage
            );
            trade.copyTradeId = generateCopyTradeId();

            // Insert trade record
            const tradeId = await this.db.run(`
        INSERT INTO trades (
          trade_id, copy_trade_id, source_wallet, type, token_mint,
          input_token, output_token, input_amount, output_amount,
          input_amount_ui, output_amount_ui, price_usd, total_value_usd,
          slippage, price_impact, status, timestamp, priority_fee,
          network_fee, total_fees_usd, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                trade.tradeId, trade.copyTradeId, trade.sourceWallet, trade.type,
                trade.tokenMint, trade.inputToken, trade.outputToken, trade.inputAmount,
                trade.outputAmount, trade.inputAmountUi, trade.outputAmountUi,
                trade.priceUsd, trade.totalValueUsd, trade.slippage, trade.priceImpact,
                trade.status, trade.timestamp.toISOString(), trade.priorityFee,
                trade.networkFee, trade.totalFeesUsd, trade.createdAt.toISOString(),
                trade.updatedAt.toISOString()
            ]);

            // Execute swap based on mode
            let result: TradeResult;

            if (config.trading.mode === 'simulation' || config.trading.mode === 'paper') {
                result = await this.simulateTrade(trade, 'BUY');
            } else {
                result = await this.executeRealTrade(trade, 'BUY');
            }

            // Update trade record with result
            await this.updateTradeRecord(tradeId.lastID, result);

            // Create position if successful
            if (result.status === 'success' && result.outputAmount) {
                await this.positionManager.createPosition({
                    tokenMint: transaction.token,
                    sourceWallet: transaction.sourceWallet,
                    entryPrice: tokenPrice,
                    entryAmount: result.outputAmount,
                    entryValue: usdValue,
                    entryTxHash: result.txHash
                });
            }

            // Update risk metrics
            await this.riskManager.recordTrade(result, usdValue);

            logger.info(`✅ Buy order completed: ${result.status}`);
            return result;

        } catch (error) {
            logger.error('❌ Buy execution failed:', error);
            throw error;
        }
    }

    private async executeSell(
        transaction: WalletTransaction,
        settings: CopyTradeSettings
    ): Promise<TradeResult> {
        try {
            logger.info('📉 Executing SELL order...');

            // Get current position
            const position = await this.positionManager.getPositionByToken(transaction.token);
            if (!position) {
                return {
                    status: 'rejected',
                    reason: 'No position to sell',
                    timestamp: Date.now()
                };
            }

            // Calculate sell amount based on position and settings
            const sellAmount = this.calculateSellAmount(position, transaction, settings);

            // Get current price
            const tokenPrice = await this.priceService.getTokenPrice(transaction.token);
            if (!tokenPrice) {
                throw new Error('Unable to fetch token price');
            }

            // Create trade record
            const trade = createTradeFromExecution(
                'SELL',
                transaction.token,
                transaction.sourceWallet,
                sellAmount,
                0, // Will be filled after execution
                tokenPrice,
                config.trading.defaultSlippage
            );

            // Execute based on mode
            let result: TradeResult;

            if (config.trading.mode === 'simulation' || config.trading.mode === 'paper') {
                result = await this.simulateTrade(trade, 'SELL');
            } else {
                result = await this.executeRealTrade(trade, 'SELL');
            }

            // Update position
            if (result.status === 'success') {
                await this.positionManager.updatePositionAfterSell(
                    position.id!,
                    sellAmount,
                    tokenPrice,
                    result.txHash
                );
            }

            logger.info(`✅ Sell order completed: ${result.status}`);
            return result;

        } catch (error) {
            logger.error('❌ Sell execution failed:', error);
            throw error;
        }
    }

    private async simulateTrade(trade: Trade, type: 'BUY' | 'SELL'): Promise<TradeResult> {
        logger.info(`🧪 [SIMULATION] Executing ${type} trade`);

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Simulate success/failure (95% success rate)
        const isSuccess = Math.random() > 0.05;

        if (isSuccess) {
            const mockTxHash = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const outputAmount = type === 'BUY' ?
                trade.inputAmount * 0.98 : // Simulate 2% slippage on buy
                trade.inputAmount * 1.02;  // Simulate price appreciation on sell

            return {
                status: 'success',
                txHash: mockTxHash,
                inputAmount: trade.inputAmount,
                outputAmount,
                actualSlippage: 0.02,
                timestamp: Date.now()
            };
        } else {
            return {
                status: 'failed',
                error: 'Simulated transaction failure',
                timestamp: Date.now()
            };
        }
    }

    private async executeRealTrade(trade: Trade, type: 'BUY' | 'SELL'): Promise<TradeResult> {
        logger.info(`🌐 [LIVE] Executing ${type} trade`);

        try {
            // Get swap route from GMGN
            const route = await this.gmgnService.getSwapRoute(
                trade.inputToken,
                trade.outputToken,
                trade.inputAmount.toString(),
                this.wallet.publicKey.toString(),
                config.trading.defaultSlippage
            );

            // Execute the swap
            const txHash = await this.executeSwap(route);

            return {
                status: 'success',
                txHash,
                inputAmount: trade.inputAmount,
                outputAmount: route.outputAmount,
                actualSlippage: route.slippage || config.trading.defaultSlippage,
                timestamp: Date.now()
            };

        } catch (error) {
            logger.error('❌ Real trade execution failed:', error);
            return {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            };
        }
    }

    private async executeSwap(route: any): Promise<string> {
        try {
            // Deserialize transaction
            const swapTransactionBuf = Buffer.from(route.swapTransaction, 'base64');
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

            // Sign transaction
            transaction.sign([this.wallet]);

            // Serialize signed transaction
            const signedTx = Buffer.from(transaction.serialize()).toString('base64');

            // Send via GMGN
            const result = await this.gmgnService.sendTransaction(signedTx);

            logger.info(`✅ Transaction sent: ${result.hash}`);
            return result.hash;

        } catch (error) {
            logger.error('❌ Swap execution failed:', error);
            throw error;
        }
    }

    private calculateCopyAmount(originalAmount: string, settings: CopyTradeSettings): number {
        const original = parseFloat(originalAmount);
        const copyAmount = original * settings.followPercentage;

        // Apply limits
        const maxAmount = Math.min(
            settings.maxCopyAmount || config.trading.maxTradeAmount,
            config.trading.maxPositionSizeUsd
        );

        const minAmount = settings.minCopyAmount || config.trading.minTradeAmount;

        return Math.max(minAmount, Math.min(copyAmount, maxAmount));
    }

    private calculateSellAmount(position: any, transaction: WalletTransaction, settings: CopyTradeSettings): number {
        // For now, sell the proportional amount
        const sellRatio = settings.followPercentage;
        return position.entryAmount * sellRatio;
    }

    private async updateTradeRecord(tradeId: number, result: TradeResult): Promise<void> {
        await this.db.run(`
      UPDATE trades SET 
        status = ?, 
        tx_hash = ?, 
        output_amount = ?,
        slippage = ?,
        execution_time_ms = ?,
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
            result.status,
            result.txHash || null,
            result.outputAmount || null,
            result.actualSlippage || null,
            Date.now() - result.timestamp,
            result.error || null,
            tradeId
        ]);
    }

    getStatus(): TradingEngineStatus {
        return {
            initialized: this.isInitialized,
            walletAddress: this.wallet.publicKey.toString(),
            tradingEnabled: config.trading.enabled,
            tradingMode: config.trading.mode,
            // Additional status info would be added here
        };
    }

    async shutdown(): Promise<void> {
        logger.info('🛑 Shutting down Trading Engine...');

        // Close any open positions if needed
        // Clean up resources

        this.isInitialized = false;
        logger.info('✅ Trading Engine shutdown complete');
    }
}

/*
export class TradingEngine {
    async initialize() {
        console.log('🚀 Trading Engine initialized (MOCK MODE)');
    }

    async executeCopyTrade(walletTransaction: any) {
        console.log('🔄 Mock copy trade executed:', walletTransaction);
        // Start with console logs, add real execution later
    }
}*/
