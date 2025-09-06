// scripts/view-trades.js
const { TradeLogger } = require('../dist/services/TradeLogger');

async function viewTradeHistory() {
    console.log('📊 Bot Trade History\n');

    const trades = await TradeLogger.getBotTrades(20);

    if (trades.length === 0) {
        console.log('🔍 No bot trades found yet');
        return;
    }

    console.log(`Found ${trades.length} recent trades:\n`);

    trades.forEach((trade, index) => {
        const date = new Date(trade.timestamp).toLocaleString();
        const status = trade.status === 'SUCCESS' ? '✅' :
            trade.status === 'FAILED' ? '❌' : '⏳';

        console.log(`${index + 1}. ${status} ${trade.action} ${trade.token_symbol || 'Unknown'}`);
        console.log(`   Date: ${date}`);
        console.log(`   Amount: ${trade.amount_tokens} tokens`);
        console.log(`   Value: ${trade.amount_sol?.toFixed(4)} SOL ($${trade.amount_usd?.toFixed(2)})`);
        console.log(`   Source: ${trade.source_wallet.slice(0, 8)}...`);
        if (trade.txn_hash) {
            console.log(`   TxHash: ${trade.txn_hash}`);
        }
        if (trade.error_message) {
            console.log(`   Error: ${trade.error_message}`);
        }
        console.log('');
    });

    // Show overall stats
    const stats = await TradeLogger.getTradeStats();
    console.log('📈 Overall Statistics:');
    console.log(`   Success Rate: ${stats.successRate}%`);
    console.log(`   Total Volume: ${stats.totalVolumeSol.toFixed(4)} SOL`);
    console.log(`   Total Trades: ${stats.totalTrades}`);
}

viewTradeHistory().catch(console.error);