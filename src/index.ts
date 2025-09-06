// src/index.ts - Fixed with correct import names
import { PublicKey } from "@solana/web3.js";
import WebSocket from "ws";
import * as dotenv from "dotenv";
import { getDoubleHoldings, getWalletTokenHoldings } from "./walletTracker";
import {
    getAccountInfoStreamReponseWithConfirmation,
    GetWalletTokenHoldingsResponse,
    MintWithOwnersResponse,
    SplTokenHolding,
    SplTokenStoreResponse,
    WalletConfig,
} from "./types";
import { config } from "./config";
import { clearHoldingsTable, updateHoldings } from "./db";
import { logger } from "./utils/logger";

// Load env variables
dotenv.config();

// Get wallets
const SUBSCRIBE_WALLETS = config.wallets;

// Create utility functions
const saveLogTo = (logsArray: string[], ...args: unknown[]): void => {
    const message = args.map((arg) => String(arg)).join(" ");
    logsArray.unshift(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
    if (logsArray.length > 50) logsArray.splice(50);
};

function shortenAddress(address: string): string {
    const start = address.slice(0, 4);
    const end = address.slice(-4);
    return `${start}...${end}`;
}

// Create logging arrays
const actionsLogs: string[] = [];
let duplicateLogs: string[] = [];
const holdingLogs = new Map<string, string>();

function showLogs() {
    console.clear();
    console.log(`💼 Solana Wallet Tracker`);
    console.log("=".repeat(80));

    if (SUBSCRIBE_WALLETS.length === 0) {
        console.log("🔎 No wallets configured");
    } else {
        Array.from(holdingLogs.values()).forEach(log => console.log(log));
    }

    console.log("\n🔥 Duplicate Holdings");
    console.log("=".repeat(80));
    duplicateLogs.slice(0, 10).forEach(log => console.log(log));

    console.log("\n📜 Action Logs");
    console.log("=".repeat(80));
    actionsLogs.slice(0, 15).forEach(log => console.log(log));

    console.log("\n" + "=".repeat(80));
    console.log(`⏰ Last updated: ${new Date().toLocaleString()}`);
}

// Main functionality
let firstRun = true;
async function fetchHoldings(walletToSync?: string): Promise<void> {
    try {
        // Clear database on first run
        if (firstRun) {
            const removal = await clearHoldingsTable();
            if (!removal) {
                console.log("🚫 Could not clear database holdings");
            }
            firstRun = false;
        }

        let wallets = SUBSCRIBE_WALLETS;
        if (walletToSync) {
            const filteredWallet = wallets.find((w: WalletConfig) => w.address === walletToSync);
            if (filteredWallet) wallets = [filteredWallet];
        }

        for (const wallet of wallets) {
            await processWallet(wallet);
        }

        // Update duplicate holdings
        await updateDuplicateHoldings();
        showLogs();

    } catch (error) {
        logger.error("Error fetching holdings:", error);
        saveLogTo(actionsLogs, `❌ Error fetching holdings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function processWallet(wallet: WalletConfig): Promise<void> {
    try {
        // Verify wallet address
        let publicKey: PublicKey;
        try {
            publicKey = new PublicKey(wallet.address);
        } catch (error) {
            console.warn(`🚫 Invalid wallet address for ${wallet.name}`);
            return;
        }

        // Get token holdings
        const tokenHoldings: GetWalletTokenHoldingsResponse = await getWalletTokenHoldings(publicKey.toString());

        if (!tokenHoldings.success) {
            saveLogTo(actionsLogs, `❌ ${wallet.name}: ${tokenHoldings.msg}`);
            return;
        }

        // Update display
        const inspectText = `${config.settings.inspectUrlWallet}${wallet.address}`;
        holdingLogs.set(
            wallet.address,
            `${wallet.name} ${wallet.emoji} (${shortenAddress(wallet.address)}) holds ${tokenHoldings.data.length} SPL-Tokens`
        );

        // Store in database
        const stored: SplTokenStoreResponse = await updateHoldings(tokenHoldings.data, publicKey.toString());
        if (stored.success) {
            const addedCount = stored.added.length;
            const removedCount = stored.removed.length;

            if (addedCount > 0 || removedCount > 0) {
                saveLogTo(actionsLogs, `🔄 ${wallet.name}: +${addedCount} new, -${removedCount} removed`);
            }
        } else {
            saveLogTo(actionsLogs, `⛔ ${wallet.name}: ${stored.msg}`);
        }

    } catch (error) {
        logger.error(`Error processing wallet ${wallet.name}:`, error);
        saveLogTo(actionsLogs, `❌ ${wallet.name}: Processing error`);
    }
}

async function updateDuplicateHoldings(): Promise<void> {
    try {
        const duplicateResponse: MintWithOwnersResponse = await getDoubleHoldings();

        if (duplicateResponse.success && duplicateResponse.duplicates.length > 0) {
            duplicateLogs = duplicateResponse.duplicates
                .slice(0, config.settings.showMaxDuplicates)
                .map(duplicate => {
                    if (duplicate.owners.length >= config.settings.showDuplicateMinHolders) {
                        const shortMint = shortenAddress(duplicate.mint);
                        const walletEmojis = duplicate.owners
                            .map(owner => {
                                const wallet = config.wallets.find((w: WalletConfig) => w.address === owner);
                                return wallet ? wallet.emoji : '💼';
                            })
                            .join(' ');

                        return `🔍 Token ${shortMint} (${duplicate.owners.length} 💼): ${walletEmojis} ${config.settings.inspectName}`;
                    }
                    return '';
                })
                .filter(log => log.length > 0);

            if (duplicateResponse.duplicates.length > config.settings.showMaxDuplicates) {
                const remaining = duplicateResponse.duplicates.length - config.settings.showMaxDuplicates;
                duplicateLogs.unshift(`📢 There are ${remaining} more duplicates not shown.`);
            }
        } else {
            duplicateLogs = ['🔍 No duplicate holdings found'];
        }
    } catch (error) {
        logger.error('Error updating duplicate holdings:', error);
        duplicateLogs = ['❌ Error checking duplicates'];
    }
}

// WebSocket handling
const subscriptions = new Map<number, string>();
const messageQueue: string[] = [];
let isProcessingQueue = false;
let ws: WebSocket | null = null;
let wasClosed = false;

async function processQueue(): Promise<void> {
    if (isProcessingQueue || messageQueue.length === 0) return;

    isProcessingQueue = true;
    try {
        const uniqueWallets = [...new Set(messageQueue)];
        messageQueue.length = 0;

        for (const walletAddress of uniqueWallets) {
            const wallet = config.wallets.find((w: WalletConfig) => w.address === walletAddress);
            if (wallet) {
                saveLogTo(actionsLogs, `🔄 Change detected: ${wallet.emoji} ${wallet.name}`);
                await processWallet(wallet);
            }
        }

        await updateDuplicateHoldings();
        showLogs();
    } catch (error) {
        logger.error('Error processing queue:', error);
    } finally {
        isProcessingQueue = false;
    }
}

function accountSubscribeStream(): void {
    const wsUri = process.env.HELIUS_WSS_URI || process.env.HELIUS_HTTPS_URI?.replace('https', 'wss') || '';

    ws = new WebSocket(wsUri);

    ws.on('open', () => {
        wasClosed = false;
        saveLogTo(actionsLogs, '🔓 WebSocket connected. Subscribing to wallets...');

        // Subscribe to each wallet
        SUBSCRIBE_WALLETS.forEach((wallet: WalletConfig) => {
            const subscriptionMessage = {
                jsonrpc: "2.0",
                id: wallet.address,
                method: "accountSubscribe",
                params: [
                    wallet.address,
                    {
                        encoding: "jsonParsed",
                        commitment: config.solana?.commitment || "confirmed",
                    },
                ],
            };

            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(subscriptionMessage));
            }
        });
    });

    ws.on('message', async (data: WebSocket.Data) => {
        try {
            const jsonString = data.toString();
            const accountInfo: getAccountInfoStreamReponseWithConfirmation = JSON.parse(jsonString);

            // Handle subscription confirmation
            if ('result' in accountInfo && typeof accountInfo.result === 'number' && accountInfo.id) {
                const walletAddress = accountInfo.id;
                const subscriptionId = accountInfo.result;
                const wallet = SUBSCRIBE_WALLETS.find((w: WalletConfig) => w.address === walletAddress);

                if (wallet && !wasClosed) {
                    saveLogTo(actionsLogs, `✅ Subscribed to ${wallet.emoji} ${wallet.name}`);
                    subscriptions.set(subscriptionId, walletAddress);
                    showLogs();
                }
                return;
            }

            // Handle account notifications
            if (accountInfo.method === 'accountNotification' && accountInfo.params) {
                const subscriptionId = accountInfo.params.subscription;
                const walletAddress = subscriptions.get(subscriptionId);

                if (walletAddress) {
                    messageQueue.push(walletAddress);
                    processQueue();
                }
            }

        } catch (error) {
            logger.error('Error processing WebSocket message:', error);
        }
    });

    ws.on('error', (err: Error) => {
        logger.error('🚫 WebSocket error:', err);
        saveLogTo(actionsLogs, `❌ WebSocket error: ${err.message}`);
    });

    let retryCount = 0;
    const maxRetries = 5;

    ws.on('close', () => {
        wasClosed = true;
        subscriptions.clear();

        console.log(`🔐 WebSocket closed. Reconnecting in ${2 ** retryCount}s...`);

        if (retryCount < maxRetries) {
            setTimeout(() => {
                accountSubscribeStream();
                retryCount++;
            }, 2 ** retryCount * 1000);
        } else {
            logger.error('❌ Max retries reached. Exiting...');
            process.exit(1);
        }
    });
}

// Start the application
async function main(): Promise<void> {
    try {
        logger.info('🚀 Starting Solana Wallet Tracker...');

        // Ensure database directory exists
        const path = require('path');
        const fs = require('fs');
        const dbDir = path.dirname(config.database.path);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Fetch initial holdings
        await fetchHoldings();

        // Start WebSocket connection
        accountSubscribeStream();

        logger.info('✅ Wallet Tracker started successfully');
    } catch (error) {
        logger.error('❌ Failed to start wallet tracker:', error);
        process.exit(1);
    }
}

// Export for testing
export { fetchHoldings, processWallet, updateDuplicateHoldings };

// Run if this file is executed directly
if (require.main === module) {
    main();
}