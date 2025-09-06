// const { getWalletTokenHoldings } = require('./dist/walletTracker');
import { getWalletTokenHoldings } from './dist/walletTracker';


async function checkMyHoldings() {
    const myWallet = process.env.WALLET_ADDRESS;
    console.log(`🔍 Checking holdings for: ${myWallet?.slice(0,8)}...`);
    
    const holdings = await getWalletTokenHoldings(myWallet);
    
    if (holdings.success) {
        console.log(`💼 You currently hold ${holdings.data.length} different tokens:`);
        holdings.data.forEach((token, i) => {
            console.log(`${i+1}. ${token.mint.slice(0,8)}... (Amount: ${token.amount})`);
        });
    }
}

checkMyHoldings();
