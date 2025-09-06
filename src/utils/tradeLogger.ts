// src/utils/tradeLogger.ts
interface TradeRecord {
    id: string;
    timestamp: number;
    type: 'BUY' | 'SELL';
    token_mint: string;
    amount: number;
    price_usd: number;
    txn_hash: string;
    source: 'BOT' | 'MANUAL';
    copied_from?: string; // Source wallet if it's a copy trade
}

export class TradeLogger {
    private static trades: TradeRecord[] = [];

    static logTrade(trade: TradeRecord) {
        this.trades.push(trade);
        console.log(`📊 TRADE LOGGED: ${trade.type} ${trade.amount} tokens for $${trade.price_usd}`);

        // Save to file or database
        this.saveToFile();
    }

    static getBotTrades(): TradeRecord[] {
        return this.trades.filter(t => t.source === 'BOT');
    }

    static getTradeHistory(): TradeRecord[] {
        return this.trades;
    }

    private static saveToFile() {
        const fs = require('fs');
        fs.writeFileSync('trade-history.json', JSON.stringify(this.trades, null, 2));
    }
}