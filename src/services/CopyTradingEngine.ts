// src/services/CopyTradingEngine.ts
import { TradeDetector, TradeDetection } from './TradeDetector';
import { JupiterService, SwapResult } from './JupiterService';
import { TradeLogger } from './TradeLogger';
import { config } from '../config';

export class CopyTradingEngine {
    private jupiterService: JupiterService;
    private isProcessing = false;

    constructor() {
        this.jupiterService = new JupiterService();
    }

    async processCopyTradeOpportunity(
        sourceWallet: string,
        previousHoldings: any[],
        currentHoldings: any[]
    ): Promise<void> {
        if (this.isProcessing) {
            console.log('⏳ Copy trading engine busy, skipping...');
            return;
        }

        this.isProcessing = true;

        try {
            // Find wallet configuration
            const walletConfig = config.wallets.find(w => w.address === sourceWallet);
            if (!walletConfig || !walletConfig.copyEnabled) {
                return;
            }

            console.log(`🎯 Analyzing trades from ${walletConfig.name} ${walletConfig.emoji}`);

            // Detect trades
            const detections = TradeDetector.detectTrades(previousHoldings, currentHoldings);

            if (detections.length === 0) {
                console.log('📊 No significant trades detected');
                return;
            }

            // Process each detection
            for (const detection of detections) {
                await this.executeCopyTrade(detection, walletConfig, sourceWallet);
            }

        } catch (error) {
            console.error('❌ Copy trading engine error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    private async executeCopyTrade(
        detection: TradeDetection,
        walletConfig: any,
        sourceWallet: string
    ): Promise<void> {
        try {
            // Check if we should copy this trade
            if (!TradeDetector.shouldExecuteCopyTrade(detection, walletConfig, {})) {
                console.log(`⏭️  Skipping trade: ${detection.type} ${detection.tokenMint.slice(0, 8)}...`);
                return;
            }

            console.log(`🤖 EXECUTING COPY TRADE: ${detection.type} ${detection.tokenMint.slice(0, 8)}...`);

            // Calculate copy trade size
            const copyMultiplier = walletConfig.copyMultiplier || 0.1;
            const maxTradeAmount = parseFloat(process.env.MAX_TRADE_AMOUNT || '10');
            const defaultSlippage = parseFloat(process.env.DEFAULT_SLIPPAGE || '0.02');

            // Log trade attempt
            const tradeId = await TradeLogger.logTrade({
                source_wallet: sourceWallet,
                token_mint: detection.tokenMint,
                action: detection.type,
                amount_tokens: detection.amountChange,
                copy_multiplier: copyMultiplier,
                status: 'PENDING'
            });

            let swapResult: SwapResult;

            if (detection.type === 'BUY') {
                // Calculate SOL amount to spend
                const solAmount = Math.min(maxTradeAmount / 200, 0.05); // Assume SOL ~$200, max 0.05 SOL

                swapResult = await this.jupiterService.buyToken({
                    tokenMint: detection.tokenMint,
                    solAmount: solAmount,
                    slippageBps: Math.floor(defaultSlippage * 10000) // Convert to basis points
                });

            } else {
                // For SELL, we need to get our current holdings of this token
                // This is simplified - you'd want to check actual balance
                const tokenAmount = Math.floor(detection.amountChange * copyMultiplier);

                swapResult = await this.jupiterService.sellToken({
                    tokenMint: detection.tokenMint,
                    tokenAmount: tokenAmount,
                    slippageBps: Math.floor(defaultSlippage * 10000)
                });
            }

            // Update trade status
            await TradeLogger.updateTradeStatus(
                tradeId,
                swapResult.success ? 'SUCCESS' : 'FAILED',
                swapResult
            );

            if (swapResult.success) {
                console.log(`✅ Copy trade successful! TxHash: ${swapResult.txnHash}`);
                console.log(`💰 ${detection.type}: ${swapResult.inputAmount} → ${swapResult.outputAmount}`);
            } else {
                console.log(`❌ Copy trade failed: ${swapResult.error}`);
            }

        } catch (error: any) {
            console.error(`❌ Copy trade execution error:`, error.message);
        }
    }
}