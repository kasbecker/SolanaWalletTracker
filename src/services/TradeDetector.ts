// src/services/TradeDetector.ts
import { SplTokenHolding } from '../types';

export interface TradeDetection {
    type: 'BUY' | 'SELL';
    tokenMint: string;
    amountChange: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    metadata?: {
        previousAmount: number;
        currentAmount: number;
        isNewToken: boolean;
        isCompleteExit: boolean;
    };
}

export class TradeDetector {
    static detectTrades(
        previousHoldings: SplTokenHolding[],
        currentHoldings: SplTokenHolding[]
    ): TradeDetection[] {
        const trades: TradeDetection[] = [];

        // Create maps for easy lookup
        const prevMap = new Map(previousHoldings.map(h => [h.mint, h.amount]));
        const currentMap = new Map(currentHoldings.map(h => [h.mint, h.amount]));

        // Check for new tokens (BUY signals)
        for (const [mint, currentAmount] of currentMap) {
            const previousAmount = prevMap.get(mint) || 0;

            if (previousAmount === 0 && currentAmount > 0) {
                // New token acquired = BUY
                trades.push({
                    type: 'BUY',
                    tokenMint: mint,
                    amountChange: currentAmount,
                    confidence: 'HIGH',
                    metadata: {
                        previousAmount: 0,
                        currentAmount,
                        isNewToken: true,
                        isCompleteExit: false
                    }
                });
            } else if (currentAmount > previousAmount) {
                // Increased position = Additional BUY
                trades.push({
                    type: 'BUY',
                    tokenMint: mint,
                    amountChange: currentAmount - previousAmount,
                    confidence: 'MEDIUM',
                    metadata: {
                        previousAmount,
                        currentAmount,
                        isNewToken: false,
                        isCompleteExit: false
                    }
                });
            }
        }

        // Check for reduced/removed tokens (SELL signals)
        for (const [mint, previousAmount] of prevMap) {
            const currentAmount = currentMap.get(mint) || 0;

            if (previousAmount > 0 && currentAmount === 0) {
                // Complete token exit = SELL ALL
                trades.push({
                    type: 'SELL',
                    tokenMint: mint,
                    amountChange: previousAmount,
                    confidence: 'HIGH',
                    metadata: {
                        previousAmount,
                        currentAmount: 0,
                        isNewToken: false,
                        isCompleteExit: true
                    }
                });
            } else if (currentAmount < previousAmount) {
                // Reduced position = Partial SELL
                trades.push({
                    type: 'SELL',
                    tokenMint: mint,
                    amountChange: previousAmount - currentAmount,
                    confidence: 'MEDIUM',
                    metadata: {
                        previousAmount,
                        currentAmount,
                        isNewToken: false,
                        isCompleteExit: false
                    }
                });
            }
        }

        return trades;
    }

    static shouldExecuteCopyTrade(
        detection: TradeDetection,
        walletConfig: any,
        riskSettings: any
    ): boolean {
        // Only copy high-confidence trades
        if (detection.confidence === 'LOW') return false;

        // Skip if copy trading disabled for this wallet
        if (!walletConfig.copyEnabled) return false;

        // Skip very small amounts (dust)
        if (detection.amountChange < 1000) return false; // Adjust threshold as needed

        // Apply additional risk filters here
        return true;
    }
}