// src/index.ts - Enhanced with copy trading integration
import { PublicKey } from "@solana/web3.js";
import WebSocket from "ws";
import * as dotenv from "dotenv";
import { getDoubleHoldings, getWalletTokenHoldings } from "./walletTracker";
import {
    getAccountInfoStreamReponseWithConfirmation,
    GetWalletTokenHoldingsResponse,
    MintWithOwnersResponse,
    SplTokenHolding,
    SplTokenStoreReponse,
    WalletConfig,
} from "./types";
import { config } from "./config";
import { clearHoldingsTable, updateHoldings } from "./db";
import { detectTrades, shouldExecuteCopyTrade, logCopyTradeOpportunity } from "./copyTrading";

// Load env variables
dotenv.config();

// Get wallets
const SUBSCRIBE_WALLETS = config.wallets;

// Create utility functions
const saveLogTo = (logsArray: string[], ...args: unknown[]): void => {
    const message = args.map((arg) => String(arg)).join(" ");
    logsArray[logsArray.length] = message;
};

function shortenAddress(address: string): string {
    const start = address.slice(0, 4);
    const end = address.slice(-4);
    return `${start}...${end}`;
}

// Create Action and holdings Log constant
const actionsLogs: string[] = [];
let duplicateLogs: string[] = [];
const holdingLogs = new Map<string, string>();

function showLogs() {
    console.log("\n".repeat(100));
    console.clear();
    console.log(`💼 Solana Wallet Tracker ${process.env.COPY_TRADING_ENABLED === 'true' ? '+ Copy Trading' : ''}`);
    console.log("================================================================================");

    if (SUBSCRIBE_WALLETS.length === 0) {
        console.log("🔎 No wallets to track at this moment: ", new Date().toISOString());
    }

    const holdingLogsArray = Array.from(holdingLogs.entries())
        .map(([walletAddress, msg]) => msg)
        .join("\n");
    console.log(holdingLogsArray);

    // Output Copy Trading Status
    if (process.env.COPY_TRADING_ENABLED === 'true') {
        console.log("\n🤖 Copy Trading Status");
        console.log("================================================================================");
        const copyEnabledWallets = SUBSCRIBE_WALLETS.filter(w => w.copyEnabled);
        if (copyEnabledWallets.length > 0) {
            copyEnabledWallets.forEach(wallet => {
                console.log(`🎯 Copying: ${wallet.name} ${wallet.emoji} (${(wallet.copyMultiplier || 0.1) * 100}%)`);
            });
        } else {
            console.log("⚠️ No wallets enabled for copy trading");
        }
    }

    // Output Duplicates
    console.log("\n\n🔥 Duplicate holdings");
    console.log("================================================================================");
    console.log(duplicateLogs.slice().reverse().join("\n"));

    // Output Action Logs
    console.log("\n\n📜 Action Logs");
    console.log("================================================================================");
    console.log(actionsLogs.slice().reverse().join("\n"));
}

// Main function to fetch token holdings for provided wallets
let firstRun = true;
async function fetchHoldings(walletToSync?: string): Promise<void> {
    try {
        // Clear database on first run
        if (firstRun) {
            const removal = await clearHoldingsTable();
            if (!removal) {
                console.log("🚫 Could not remove database holdings. Please remove database manually and try again.");
            }
            firstRun = false;
        }

        let wallets = SUBSCRIBE_WALLETS;
        if (walletToSync) {
            const filteredWallet = wallets.filter((w) => w.address === walletToSync);
            if (filteredWallet.length > 0) wallets = filteredWallet;
        }

        for (const wallet of wallets) {
            await processWallet(wallet);
        }

        // Update duplicate holdings
        await updateDuplicateHoldings();

        // Show logs
        showLogs();

    } catch (error) {
        console.error("Error:", error);
    }
}

async function processWallet(wallet: WalletConfig): Promise<void> {
    const walletAddress = wallet.address;
    const walletName = wallet.name;
    const walletEmoji = wallet.emoji;

    // Verify if this is a valid walletAddress
    let publicKey;
    try {
        publicKey = new PublicKey(walletAddress);
    } catch (error) {
        console.log(`🚫 Invalid walletAddress, proceeding with next wallet`);
        return;
    }

    // Get all the spl-token holdings for this wallet
    const tokenHoldings: GetWalletTokenHoldingsResponse = await getWalletTokenHoldings(publicKey.toString());

    // Check if fetching the holdings was successful
    if (!tokenHoldings.success) {
        saveLogTo(actionsLogs, tokenHoldings.msg);
        return;
    }

    // Store in safe variable
    const tokenHoldingsData: SplTokenHolding[] = tokenHoldings.data;

    // Copy Trading Detection (NEW FEATURE)
    if (process.env.COPY_TRADING_ENABLED === 'true') {
        const detectedTrades = detectTrades(walletAddress, tokenHoldingsData);

        for (const detection of detectedTrades) {
            if (shouldExecuteCopyTrade(detection, wallet)) {
                await logCopyTradeOpportunity(detection, wallet);
                // Here you would add actual trade execution later
            }
        }
    }

    // Output the wallets that we are tracking
    const inspectText = `\x1b]8;;${config.settings.inspect_url_wallet}${walletAddress}\x1b\\${shortenAddress(walletAddress)}\x1b]8;;\x1b\\`;
    const copyStatus = wallet.copyEnabled ? ' 🎯' : '';
    holdingLogs.set(walletAddress, `${walletName} ${walletEmoji}${copyStatus} (${inspectText}) holds ${tokenHoldingsData.length} SPL-Tokens`);

    // Store holdings in local database
    const stored: SplTokenStoreReponse = await updateHoldings(tokenHoldingsData, publicKey.toString());
    if (!stored.success) {
        saveLogTo(actionsLogs, `⛔ Error while storing transfers for wallet ${walletName}: ${stored.msg}`);
        return;
    }

    // Log any changes
    if (stored.added.length > 0 || stored.removed.length > 0) {
        saveLogTo(actionsLogs, `🔄 ${walletName}: +${stored.added.length} new, -${stored.removed.length} removed tokens`);
    }
}

async function updateDuplicateHoldings(): Promise<void> {
    try {
        const duplicates: MintWithOwnersResponse = await getDoubleHoldings();

        if (duplicates.success && duplicates.duplicates.length > 0) {
            duplicateLogs = [];

            // Show limited number of duplicates
            const maxDuplicates = config.settings.show_max_duplicates;
            const duplicatesToShow = duplicates.duplicates.slice(0, maxDuplicates);

            for (const duplicate of duplicatesToShow) {
                if (duplicate.owners.length >= config.settings.show_duplicate_min_holders) {
                    const shortMint = shortenAddress(duplicate.mint);
                    const walletEmojis = duplicate.owners.map(owner => {
                        const wallet = config.wallets.find(w => w.address === owner);
                        return wallet ? wallet.emoji : '💼';
                    }).join(' ');

                    duplicateLogs.push(`🔍 Token ${shortMint} (${duplicate.owners.length} 💼): ${walletEmojis} ${config.settings.inspect_name}`);
                }
            }

            if (duplicates.duplicates.length > maxDuplicates) {
                const remaining = duplicates.duplicates.length - maxDuplicates;
                duplicateLogs.unshift(`📢 There are ${remaining} more duplicates not shown.`);
            }
        } else {
            duplicateLogs = ['🔍 No duplicate holdings found'];
        }
    } catch (error) {
        console.error('Error updating duplicate holdings:', error);
        duplicateLogs = ['❌ Error checking duplicates'];
    }
}

// WebSocket and subscription logic (existing code with minor enhancements)
const messageQueue: string[] = [];
let processing = false;
const subscriptions = new Map<number, string>();

async function processQueue() {
    if (processing) return;
    processing = true;

    while (messageQueue.length > 0) {
        const processedMessage = messageQueue.shift();
        if (processedMessage) {
            const processedMessageObject = Number(processedMessage);

            if (subscriptions.has(processedMessageObject)) {
                const walletAddress = subscriptions.get(processedMessageObject);
                if (walletAddress) {
                    const wallet = SUBSCRIBE_WALLETS.find((w) => w.address === walletAddress);
                    if (wallet) {
                        saveLogTo(actionsLogs, `🔄 Change detected: ${wallet.emoji} ${wallet.name}`);
                        await fetchHoldings(wallet.address);
                    }
                } else {
                    await fetchHoldings();
                }
            }
        }
    }

    processing = false;
}

// WebSocket connection logic
let wasClosed = false;
async function accountSubscribeStream(): Promise<void> {
    let ws: WebSocket | null = new WebSocket(process.env.HELIUS_WSS_URI || "");

    ws.on("open", () => {
        saveLogTo(actionsLogs, "🔓 WebSocket open. Proceeding with wallet subscriptions...");

        SUBSCRIBE_WALLETS.forEach((wallet) => {
            const subscriptionMessage = {
                jsonrpc: "2.0",
                id: wallet.address,
                method: "accountSubscribe",
                params: [
                    wallet.address,
                    {
                        encoding: "jsonParsed",
                        commitment: "confirmed",
                    },
                ],
            };
            ws!.send(JSON.stringify(subscriptionMessage));
        });
    });

    ws.on("message", async (data: WebSocket.Data) => {
        try {
            const jsonString = data.toString();
            const accountInfo: getAccountInfoStreamReponseWithConfirmation = JSON.parse(jsonString);

            if (
                "result" in accountInfo &&
                typeof accountInfo.result === "number" &&
                accountInfo.id &&
                SUBSCRIBE_WALLETS.some((wallet) => wallet.address === accountInfo.id)
            ) {
                const getWallet = accountInfo.id;
                const subscriptionId = accountInfo.result;
                const wallet = SUBSCRIBE_WALLETS.find((w) => w.address === getWallet);

                if (!wasClosed) {
                    saveLogTo(actionsLogs, `✅ Subscribed and listening to websocket stream for ${wallet?.emoji} ${wallet?.name}`);
                }

                subscriptions.set(subscriptionId, getWallet);
                showLogs();
                return;
            }

            if (accountInfo.params?.subscription) {
                messageQueue.push(accountInfo.params.subscription.toString());
                processQueue();
            }
        } catch (e) {
            console.error("Error processing message:", e);
        }
    });

    ws.on("error", (err: Error) => {
        console.error("🚫 WebSocket error:", err);
    });

    let retryCount = 0;
    const maxRetries = 5;
    ws.on("close", () => {
        wasClosed = true;
        console.log(`🔐 WebSocket closed. Reconnecting in ${2 ** retryCount}s...`);
        if (retryCount < maxRetries) {
            setTimeout(() => {
                accountSubscribeStream();
                retryCount++;
            }, 2 ** retryCount * 1000);
        } else {
            console.error("Max retries reached. Exiting...");
            process.exit(1);
        }
    });
}

// Start the application
fetchHoldings()
    .then(accountSubscribeStream)
    .catch((err) => {
        console.error("Initialization error:", err.message);
        process.exit(1);
    });

/*
// Add these imports at the top of src/index.ts
import { CopyTradingEngine } from './services/CopyTradingEngine';
import { TradeLogger } from './services/TradeLogger';

// Add after existing imports
const copyTradingEngine = new CopyTradingEngine();

// Store previous holdings for comparison
const previousHoldingsMap = new Map<string, SplTokenHolding[]>();

// Update the processWallet function to store previous holdings
async function processWallet(wallet: WalletConfig): Promise<void> {
    try {
        // Get previous holdings for comparison
        const previousHoldings = previousHoldingsMap.get(wallet.address) || [];

        // ... existing processWallet code ...

        // After successful holdings fetch, check for copy trading opportunities
        if (wallet.copyEnabled && process.env.COPY_TRADING_ENABLED === 'true') {
            await copyTradingEngine.processCopyTradeOpportunity(
                wallet.address,
                previousHoldings,
                tokenHoldings.data
            );
        }

        // Store current holdings as previous for next comparison
        previousHoldingsMap.set(wallet.address, tokenHoldings.data);

    } catch (error) {
        // ... existing error handling ...
    }
}

// Add trade stats to logs display
async function showTradeStats(): Promise<void> {
    try {
        const stats = await TradeLogger.getTradeStats();
        console.log('\n📊 Copy Trading Stats');
        console.log('='.repeat(80));
        console.log(`Total Trades: ${stats.totalTrades}`);
        console.log(`Success Rate: ${stats.successRate}%`);
        console.log(`Total Volume: ${stats.totalVolumeSol.toFixed(4)} SOL`);
        console.log(`Successful: ${stats.successfulTrades} | Failed: ${stats.failedTrades}`);
    } catch (error) {
        console.log('📊 Trade stats unavailable');
    }
}

// Update showLogs function to include trade stats
function showLogs() {
    // ... existing showLogs code ...

    // Add trade stats at the end
    showTradeStats();
}
*/
