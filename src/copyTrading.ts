// src/copyTrading.ts - Simple copy trading without external dependencies
import { SplTokenHolding, TradeDetection, WalletConfig } from './types';

// Store previous holdings for comparison
const previousHoldingsMap = new Map<string, SplTokenHolding[]>();

export function detectTrades(
    walletAddress: string,
    currentHoldings: SplTokenHolding[]
): TradeDetection[] {
    const previousHoldings = previousHoldingsMap.get(walletAddress) || [];
    const trades: TradeDetection[] = [];

    // Create maps for easy comparison
    const prevMap = new Map(previousHoldings.map(h => [h.mint, h.amount]));
    const currentMap = new Map(currentHoldings.map(h => [h.mint, h.amount]));

    // Check for new tokens (BUY signals)
    for (const [mint, currentAmount] of currentMap) {
        const previousAmount = prevMap.get(mint) || 0;

        if (previousAmount === 0 && currentAmount > 0) {
            // New token = BUY
            trades.push({
                type: 'BUY',
                tokenMint: mint,
                amountChange: currentAmount,
                confidence: 'HIGH',
                previousAmount: 0,
                currentAmount
            });
        } else if (currentAmount > previousAmount) {
            // Increased position = Additional BUY
            trades.push({
                type: 'BUY',
                tokenMint: mint,
                amountChange: currentAmount - previousAmount,
                confidence: 'MEDIUM',
                previousAmount,
                currentAmount
            });
        }
    }

    // Check for reduced/removed tokens (SELL signals)
    for (const [mint, previousAmount] of prevMap) {
        const currentAmount = currentMap.get(mint) || 0;

        if (previousAmount > 0 && currentAmount === 0) {
            // Complete exit = SELL ALL
            trades.push({
                type: 'SELL',
                tokenMint: mint,
                amountChange: previousAmount,
                confidence: 'HIGH',
                previousAmount,
                currentAmount: 0
            });
        } else if (currentAmount < previousAmount) {
            // Reduced position = Partial SELL
            trades.push({
                type: 'SELL',
                tokenMint: mint,
                amountChange: previousAmount - currentAmount,
                confidence: 'MEDIUM',
                previousAmount,
                currentAmount
            });
        }
    }

    // Store current holdings for next comparison
    previousHoldingsMap.set(walletAddress, currentHoldings);

    return trades;
}

export function shouldExecuteCopyTrade(
    detection: TradeDetection,
    walletConfig: WalletConfig
): boolean {
    // Only copy if enabled
    if (!walletConfig.copyEnabled) return false;

    // Only copy high-confidence trades
    if (detection.confidence === 'LOW') return false;

    // Skip very small amounts (dust)
    if (detection.amountChange < 1000) return false;

    // Check if copy trading is enabled globally
    if (process.env.COPY_TRADING_ENABLED !== 'true') return false;

    return true;
}

export async function logCopyTradeOpportunity(
    detection: TradeDetection,
    sourceWallet: WalletConfig
): Promise<void> {
    const timestamp = new Date().toISOString();
    const shortMint = detection.tokenMint.slice(0, 8);

    console.log(`🎯 COPY TRADE OPPORTUNITY DETECTED:`);
    console.log(`   Source: ${sourceWallet.name} ${sourceWallet.emoji}`);
    console.log(`   Action: ${detection.type}`);
    console.log(`   Token: ${shortMint}...`);
    console.log(`   Amount Change: ${detection.amountChange}`);
    console.log(`   Confidence: ${detection.confidence}`);
    console.log(`   Time: ${timestamp}`);

    // For now, just log. Later we can add actual trade execution
    if (detection.type === 'BUY') {
        const copyAmount = (parseFloat(process.env.MAX_TRADE_AMOUNT || '10'));
        console.log(`🤖 Would execute BUY: $${copyAmount} worth of ${shortMint}...`);
    } else {
        console.log(`🤖 Would execute SELL: Some amount of ${shortMint}...`);
    }
}