// src/core/index.ts - Enhanced main entry point with copy trading
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
    WalletTransaction,
    CopyTradeSettings,
    WalletChange,
} from "./types";
import { config } from "../config";
import { clearHoldingsTable, updateHoldings, getDatabase } from "../database/db";
import { logger } from "../utils/logger";
import { formatters } from "../utils/formatters";
import { TradingEngine } from "../services/TradingEngine";
import { PositionManager } from "../services/PositionManager";
import { RiskManager } from "../services/RiskManager";
import { PriceService } from "../services/PriceService";
import { compareHoldings, HoldingChange } from "../database/models/Holdings";

// Load environment variables
dotenv.config();

// Get wallets from enhanced config
const SUBSCRIBE_WALLETS = config.wallets;

// Enhanced logging functions
const saveLogTo = (logsArray: string[], ...args: unknown[]): void => {
    const message = args.map((arg) => String(arg)).join(" ");
    logsArray[logsArray.length] = message;

    // Also log to structured logger
    logger.walletTracking.info(message);
};

// Initialize trading services
let tradingEngine: TradingEngine;
let positionManager: PositionManager;
let riskManager: RiskManager;
let priceService: PriceService;

// State management
const actionsLogs: string[] = [];
let duplicateLogs: string[] = [];
const holdingLogs = new Map<string, string>();
const subscriptions = new Map<number, string>();
const messageQueue: string[] = [];
const previousHoldings = new Map<string, SplTokenHolding[]>();
let isProcessing = false;
let wasClosed = false;

// Enhanced display function
function showLogs() {
    console.log("\n".repeat(100));
    console.clear();

    // Header with trading status
    console.log(`💼 Solana Wallet Tracker ${config.trading.enabled ? '+ Copy Trading' : ''}`);
    console.log("================================================================================");

    // Trading status
    if (config.trading.enabled) {
        const status = tradingEngine?.getStatus();
        console.log(formatters.colorize(`🚀 Copy Trading: ${status?.tradingMode.toUpperCase() || 'INITIALIZING'}`, 'green'));
        console.log(formatters.colorize(`💰 Trading Wallet: ${formatters.shortenAddress(status?.walletAddress || 'N/A')}`, 'cyan'));
        console.log("================================================================================");
    }

    // Wallet overview
    if (SUBSCRIBE_WALLETS.length === 0) {
        console.log(formatters.colorize("🔎 No wallets to track at this moment: " + new Date().toISOString(), 'yellow'));
    } else {
        const holdingLogsArray = Array.from(holdingLogs.entries())
            .map(([walletAddress, msg]) => msg)
            .join("\n");
        console.log(holdingLogsArray);
    }

    // Duplicate holdings
    console.log("\n\n🔥 Duplicate holdings");
    console.log("================================================================================");
    if (duplicateLogs.length === 0) {
        console.log(formatters.colorize("📊 No duplicate holdings found yet", 'gray'));
    } else {
        console.log(duplicateLogs.slice().reverse().join("\n"));
    }

    // Action logs
    console.log("\n\n📜 Activity Logs");
    console.log("================================================================================");
    if (actionsLogs.length === 0) {
        console.log(formatters.colorize("⏳ Waiting for wallet activity...", 'gray'));
    } else {
        console.log(actionsLogs.slice(-10).reverse().join("\n")); // Show last 10 actions
    }

    // Trading performance (if copy trading enabled)
    if (config.trading.enabled && tradingEngine?.getStatus().initialized) {
        showTradingStats();
    }
}

async function showTradingStats() {
    try {
        const db = await getDatabase();

        // Get today's stats
        const today = new Date().toISOString().split('T')[0];
        const dailyStats = await db.get(`
      SELECT 
        COUNT(*) as trades,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
        SUM(total_value_usd) as volume
      FROM trades 
      WHERE DATE(timestamp) = ?
    `, [today]);

        const positionStats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_positions,
        SUM(CASE WHEN status = 'OPEN' THEN current_value ELSE 0 END) as total_exposure,
        SUM(CASE WHEN status = 'CLOSED' THEN realized_pnl ELSE 0 END) as realized_pnl
      FROM positions
    `);

        console.log("\n\n💹 Trading Performance (Today)");
        console.log("================================================================================");
        console.log(`📊 Trades: ${dailyStats?.trades || 0} (${dailyStats?.successful || 0} successful)`);
        console.log(`💵 Volume: ${formatters.formatUSD(dailyStats?.volume || 0)}`);
        console.log(`📈 Open Positions: ${positionStats?.open_positions || 0}`);
        console.log(`💰 Total Exposure: ${formatters.formatUSD(positionStats?.total_exposure || 0)}`);

        const pnl = positionStats?.realized_pnl || 0;
        const pnlFormatted = formatters.formatPnL(pnl);
        console.log(`${pnlFormatted.emoji} Realized P&L: ${formatters.colorize(pnlFormatted.text, pnlFormatted.color)}`);

    } catch (error) {
        logger.error('Failed to show trading stats:', error);
    }
}

// Enhanced wallet change detection
async function detectWalletChanges(walletAddress: string, currentHoldings: SplTokenHolding[]): Promise<WalletChange[]> {
    const previous = previousHoldings.get(walletAddress) || [];
    const changes = compareHoldings(currentHoldings, previous);

    // Store current holdings for next comparison
    previousHoldings.set(walletAddress, [...currentHoldings]);

    const walletConfig = config.wallets.find(w => w.address === walletAddress);
    const walletName = walletConfig?.name || formatters.shortenAddress(walletAddress);

    // Convert HoldingChange to WalletChange format
    const walletChanges: WalletChange[] = changes.map(change => ({
        walletAddress,
        walletName,
        changeType: change.changeType as any,
        tokenMint: change.tokenMint,
        tokenSymbol: undefined, // Would need to fetch from token metadata
        previousAmount: undefined,
        newAmount: change.amountChange > 0 ? change.amountChange : 0,
        amountChange: change.amountChange,
        valueChangeUsd: change.valueUsdChange,
        timestamp: change.timestamp,
        txHash: change.transactionHash,
        priceUsd: change.priceUsd,
        shouldTriggerCopy: change.isCopyable && (walletConfig?.copyEnabled || false),
        copyReason: change.copyTriggerReason,
    }));

    return walletChanges;
}

// Enhanced copy trading integration
async function processCopyTrade(walletChange: WalletChange): Promise<void> {
    if (!config.trading.enabled || !walletChange.shouldTriggerCopy) {
        return;
    }

    try {
        const walletConfig = config.wallets.find(w => w.address === walletChange.walletAddress);
        if (!walletConfig || !walletConfig.copyEnabled) {
            return;
        }

        // Create copy trade settings
        const copySettings: CopyTradeSettings = {
            enabled: true,
            followPercentage: walletConfig.copyMultiplier || 0.1,
            maxCopyAmount: walletConfig.maxCopyAmount || config.trading.maxTradeAmount,
            minCopyAmount: config.trading.minTradeAmount,
            blacklistedTokens: config.trading.blacklistedTokens,
            delayMs: config.trading.executionDelayMs,
        };

        // Create wallet transaction
        const transaction: WalletTransaction = {
            sourceWallet: walletChange.walletAddress,
            token: walletChange.tokenMint,
            action: walletChange.changeType === 'NEW_TOKEN' || walletChange.changeType === 'INCREASED_HOLDING' ? 'BUY' : 'SELL',
            amount: walletChange.amountChange.toString(),
            amountUi: walletChange.amountChange / Math.pow(10, 9), // Assuming 9 decimals
            priceUsd: walletChange.priceUsd,
            valueUsd: walletChange.valueChangeUsd,
            timestamp: walletChange.timestamp,
            detectionTime: new Date(),
            copyEligible: true,
            copyReason: walletChange.copyReason,
        };

        // Log trade detection
        logger.copyTrading.info(`🎯 Copy trade opportunity detected`, {
            sourceWallet: walletChange.walletName,
            token: formatters.shortenAddress(walletChange.tokenMint),
            action: transaction.action,
            valueUsd: formatters.formatUSD(walletChange.valueChangeUsd || 0),
        });

        saveLogTo(actionsLogs,
            `🎯 ${walletChange.walletName} ${transaction.action} ${formatters.shortenAddress(walletChange.tokenMint)} ` +
            `(${formatters.formatUSD(walletChange.valueChangeUsd || 0)})`
        );

        // Execute copy trade
        const result = await tradingEngine.handleCopyTrade(transaction, copySettings);

        // Log result
        const resultFormatted = formatters.formatTradeStatus(result.status);
        saveLogTo(actionsLogs,
            `${resultFormatted.emoji} Copy trade ${result.status}: ${result.reason || result.txHash || 'Unknown'}`
        );

        if (result.status === 'success') {
            logger.copyTrading.info(`✅ Copy trade executed successfully`, {
                txHash: result.txHash,
                sourceWallet: walletChange.walletName,
            });
        } else {
            logger.copyTrading.warn(`❌ Copy trade ${result.status}`, {
                reason: result.reason || result.error,
                sourceWallet: walletChange.walletName,
            });
        }

    } catch (error) {
        logger.copyTrading.error('Copy trade processing failed:', error, {
            walletAddress: walletChange.walletAddress,
            tokenMint: walletChange.tokenMint,
        });

        saveLogTo(actionsLogs, `❌ Copy trade error: ${formatters.formatError(error as Error)}`);
    }
}

// Enhanced message queue processing
function processQueue() {
    if (isProcessing || messageQueue.length === 0) return;

    isProcessing = true;
    setTimeout(async () => {
        try {
            const subscriptionId = messageQueue.shift();
            if (subscriptionId) {
                const walletAddress = subscriptions.get(parseInt(subscriptionId));
                if (walletAddress) {
                    await processWalletUpdate(walletAddress);
                }
            }
        } catch (error) {
            logger.error('Queue processing error:', error);
        } finally {
            isProcessing = false;
            if (messageQueue.length > 0) {
                processQueue();
            }
        }
    }, 100);
}

// Enhanced wallet processing
async function processWalletUpdate(walletAddress: string): Promise<void> {
    try {
        const wallet = SUBSCRIBE_WALLETS.find(w => w.address === walletAddress);
        if (!wallet) return;

        logger.walletTracking.debug(`Processing update for ${wallet.name}`, { walletAddress });

        // Fetch current holdings
        const holdings = await getWalletTokenHoldings(walletAddress);
        if (!holdings.success) {
            logger.walletTracking.error(`Failed to fetch holdings for ${wallet.name}:`, holdings.msg);
            return;
        }

        // Detect changes
        const changes = await detectWalletChanges(walletAddress, holdings.data);

        // Update database
        const updateResult = await updateHoldings(holdings.data, walletAddress);
        if (!updateResult.success) {
            logger.database.error(`Failed to update holdings for ${wallet.name}:`, updateResult.msg);
            return;
        }

        // Update display
        const totalTokens = holdings.data.length;
        const totalValue = holdings.data.reduce((sum, holding) => sum + (holding.valueUsd || 0), 0);

        holdingLogs.set(walletAddress,
            `${wallet.emoji} ${wallet.name} (${formatters.shortenAddress(walletAddress)}) ` +
            `holds ${totalTokens} tokens ${totalValue > 0 ? `(${formatters.formatUSD(totalValue)})` : ''}`
        );

        // Process copy trades for significant changes
        for (const change of changes) {
            if (change.shouldTriggerCopy) {
                await processCopyTrade(change);
            }

            // Log significant changes
            if (Math.abs(change.amountChange) > 0) {
                const changeType = change.changeType.replace('_', ' ').toLowerCase();
                saveLogTo(actionsLogs,
                    `📈 ${wallet.name} ${changeType} ${formatters.shortenAddress(change.tokenMint)} ` +
                    `(${change.valueChangeUsd ? formatters.formatUSD(Math.abs(change.valueChangeUsd)) : 'Unknown value'})`
                );
            }
        }

        showLogs();

    } catch (error) {
        logger.walletTracking.error(`Error processing wallet update:`, error, { walletAddress });
    }
}

// Initialize copy trading services
async function initializeTradingServices(): Promise<void> {
    if (!config.trading.enabled) {
        logger.info('📋 Copy trading disabled - running in monitoring mode only');
        return;
    }

    try {
        logger.info('🚀 Initializing copy trading services...');

        // Initialize services
        tradingEngine = new TradingEngine();
        positionManager = new PositionManager();
        riskManager = new RiskManager();
        priceService = new PriceService();

        // Initialize in correct order
        await priceService.initialize();
        await riskManager.initialize();
        await positionManager.initialize();
        await tradingEngine.initialize();

        logger.info('✅ Copy trading services initialized successfully');

    } catch (error) {
        logger.error('❌ Failed to initialize trading services:', error);
        throw error;
    }
}

// Enhanced holdings fetching
async function fetchHoldings() {
    logger.info('📊 Fetching initial holdings for all wallets...');

    try {
        const db = await getDatabase();

        for (const wallet of SUBSCRIBE_WALLETS) {
            try {
                const holdings = await getWalletTokenHoldings(wallet.address);

                if (holdings.success) {
                    await updateHoldings(holdings.data, wallet.address);

                    // Store as previous holdings for change detection
                    previousHoldings.set(wallet.address, [...holdings.data]);

                    const totalTokens = holdings.data.length;
                    const totalValue = holdings.data.reduce((sum, holding) => sum + (holding.valueUsd || 0), 0);

                    holdingLogs.set(wallet.address,
                        `${wallet.emoji} ${wallet.name} (${formatters.shortenAddress(wallet.address)}) ` +
                        `holds ${totalTokens} tokens ${totalValue > 0 ? `(${formatters.formatUSD(totalValue)})` : ''}`
                    );

                    logger.walletTracking.info(`✅ Fetched holdings for ${wallet.name}`, {
                        tokenCount: totalTokens,
                        totalValue: formatters.formatUSD(totalValue),
                    });

                } else {
                    logger.walletTracking.error(`❌ Failed to fetch holdings for ${wallet.name}:`, holdings.msg);
                    holdingLogs.set(wallet.address,
                        `${wallet.emoji} ${wallet.name} (${formatters.shortenAddress(wallet.address)}) ` +
                        `❌ Error fetching holdings`
                    );
                }
            } catch (error) {
                logger.walletTracking.error(`Error fetching holdings for ${wallet.name}:`, error);
            }
        }

        // Fetch and display duplicate holdings
        await updateDuplicateHoldings();

        logger.info('📊 Initial holdings fetch completed');

    } catch (error) {
        logger.error('❌ Error in fetchHoldings:', error);
        throw error;
    }
}

// Enhanced duplicate holdings tracking
async function updateDuplicateHoldings() {
    try {
        const duplicates = await getDoubleHoldings();

        if (duplicates.success && duplicates.duplicates.length > 0) {
            duplicateLogs = [];

            const sortedDuplicates = duplicates.duplicates
                .sort((a, b) => b.owners.length - a.owners.length)
                .slice(0, config.settings.show_max_duplicates);

            for (const duplicate of sortedDuplicates) {
                if (duplicate.owners.length >= config.settings.show_duplicate_min_holders) {
                    const tokenDisplay = formatters.shortenAddress(duplicate.mint);
                    const walletNames = duplicate.owners.map(owner => {
                        const wallet = SUBSCRIBE_WALLETS.find(w => w.address === owner);
                        return wallet ? wallet.name : formatters.shortenAddress(owner);
                    }).join(', ');

                    duplicateLogs.push(
                        `🔥 ${tokenDisplay} held by ${duplicate.owners.length} wallets: ${walletNames}`
                    );
                }
            }

            if (duplicates.duplicates.length > config.settings.show_max_duplicates) {
                const remaining = duplicates.duplicates.length - config.settings.show_max_duplicates;
                duplicateLogs.push(`📢 ${remaining} more duplicates not shown...`);
            }

            logger.walletTracking.info(`🔥 Found ${duplicates.duplicates.length} duplicate holdings`);
        } else {
            duplicateLogs = ['📊 No duplicate holdings found yet'];
        }
    } catch (error) {
        logger.error('Error updating duplicate holdings:', error);
        duplicateLogs = ['❌ Error fetching duplicate holdings'];
    }
}

// Enhanced WebSocket connection
async function accountSubscribeStream() {
    logger.info('🌐 Establishing WebSocket connection...');

    const wsUrl = process.env.HELIUS_WSS_URI || process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
    const ws = new WebSocket(wsUrl);

    // Connection opened
    ws.on("open", () => {
        wasClosed = false;
        logger.info('✅ WebSocket connection established');
        logger.info('📡 Subscribing to wallet address changes...');

        saveLogTo(actionsLogs, "🌐 WebSocket connected - subscribing to wallets...");

        // Subscribe to each wallet's address
        SUBSCRIBE_WALLETS.forEach((wallet) => {
            const subscriptionMessage = {
                jsonrpc: "2.0",
                id: wallet.address,
                method: "accountSubscribe",
                params: [
                    wallet.address,
                    {
                        encoding: "jsonParsed",
                        commitment: config.solana.commitment,
                    },
                ],
            };

            ws.send(JSON.stringify(subscriptionMessage));
            logger.walletTracking.debug(`📡 Subscribing to ${wallet.name}`, { address: wallet.address });
        });
    });

    // Message received
    ws.on("message", async (data: WebSocket.Data) => {
        try {
            const jsonString = data.toString();
            const accountInfo: getAccountInfoStreamReponseWithConfirmation = JSON.parse(jsonString);

            // Handle subscription confirmation
            if (
                "result" in accountInfo &&
                typeof accountInfo.result === "number" &&
                accountInfo.id &&
                SUBSCRIBE_WALLETS.some((wallet) => wallet.address === accountInfo.id)
            ) {
                const walletAddress = accountInfo.id;
                const subscriptionId = accountInfo.result;
                const wallet = SUBSCRIBE_WALLETS.find((w) => w.address === walletAddress);

                if (!wasClosed && wallet) {
                    saveLogTo(actionsLogs, `✅ Subscribed to ${wallet.emoji} ${wallet.name} (ID: ${subscriptionId})`);
                    logger.walletTracking.info(`✅ Subscribed to ${wallet.name}`, {
                        subscriptionId,
                        address: walletAddress
                    });
                }

                // Store subscription for wallet
                subscriptions.set(subscriptionId, walletAddress);
                showLogs();
                return;
            }

            // Handle account notifications
            if (accountInfo.method === "accountNotification" && accountInfo.params) {
                const subscriptionId = accountInfo.params.subscription;

                if (subscriptions.has(subscriptionId)) {
                    messageQueue.push(subscriptionId.toString());
                    processQueue();
                }
            }

        } catch (error) {
            logger.error("Error processing WebSocket message:", error);
        }
    });

    // WebSocket error
    ws.on("error", (err: Error) => {
        logger.error("🚫 WebSocket error:", err);
        saveLogTo(actionsLogs, `🚫 WebSocket error: ${err.message}`);
    });

    // WebSocket closed - implement reconnection logic
    let retryCount = 0;
    const maxRetries = 5;

    ws.on("close", (code, reason) => {
        wasClosed = true;
        const reasonStr = reason ? reason.toString() : 'Unknown reason';

        logger.warn(`🔐 WebSocket closed (Code: ${code}, Reason: ${reasonStr})`);
        saveLogTo(actionsLogs, `🔐 WebSocket disconnected - attempting reconnection...`);

        if (retryCount < maxRetries) {
            const delayMs = Math.min(2 ** retryCount * 1000, 30000); // Max 30 second delay

            logger.info(`🔄 Reconnecting in ${delayMs / 1000}s... (Attempt ${retryCount + 1}/${maxRetries})`);

            setTimeout(() => {
                retryCount++;
                accountSubscribeStream().catch(error => {
                    logger.error('Reconnection failed:', error);
                });
            }, delayMs);
        } else {
            logger.error("❌ Max reconnection attempts reached. Manual restart required.");
            saveLogTo(actionsLogs, "❌ Connection failed - manual restart required");

            // Graceful shutdown
            shutdown().then(() => {
                process.exit(1);
            });
        }
    });

    // Reset retry count on successful connection
    ws.on("open", () => {
        retryCount = 0;
    });
}

// Periodic duplicate holdings update
function startPeriodicUpdates() {
    // Update duplicate holdings every 5 minutes
    setInterval(async () => {
        try {
            await updateDuplicateHoldings();
            showLogs();
        } catch (error) {
            logger.error('Periodic update error:', error);
        }
    }, 5 * 60 * 1000);

    // Health check every minute
    setInterval(async () => {
        try {
            if (config.trading.enabled && tradingEngine) {
                const status = tradingEngine.getStatus();
                if (!status.initialized) {
                    logger.warn('⚠️ Trading engine not properly initialized');
                }
            }

            // Check database health
            const db = await getDatabase();
            await db.get('SELECT 1'); // Simple connectivity test

        } catch (error) {
            logger.error('Health check failed:', error);
        }
    }, 60 * 1000);

    logger.info('⏰ Periodic updates started');
}

// Graceful shutdown
async function shutdown(): Promise<void> {
    logger.info('🛑 Initiating graceful shutdown...');

    try {
        // Shutdown trading services
        if (config.trading.enabled) {
            if (tradingEngine) await tradingEngine.shutdown();
            if (positionManager) await positionManager.shutdown();
            if (riskManager) await riskManager.shutdown();
            if (priceService) await priceService.shutdown();
        }

        // Close database connections
        const { closeDatabase } = await import('../database/db');
        await closeDatabase();

        logger.info('✅ Graceful shutdown completed');
    } catch (error) {
        logger.error('❌ Error during shutdown:', error);
    }
}

// Process signal handlers
process.on('SIGINT', () => {
    logger.info('📥 Received SIGINT signal');
    shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    logger.info('📥 Received SIGTERM signal');
    shutdown().then(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception:', error);
    shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled rejection:', reason);
    logger.error('Promise:', promise);
});

// Main execution function
async function main(): Promise<void> {
    try {
        logger.info('🚀 Starting Solana Wallet Tracker with Copy Trading...');
        logger.info(`📊 Monitoring ${SUBSCRIBE_WALLETS.length} wallets`);

        // Validate configuration
        if (SUBSCRIBE_WALLETS.length === 0) {
            throw new Error('No wallets configured for tracking');
        }

        // Log configuration
        logger.info('⚙️ Configuration:', {
            copyTradingEnabled: config.trading.enabled,
            tradingMode: config.trading.mode,
            walletsToTrack: SUBSCRIBE_WALLETS.length,
            copyEnabledWallets: SUBSCRIBE_WALLETS.filter(w => w.copyEnabled).length,
        });

        // Initialize database
        await getDatabase();
        logger.info('✅ Database initialized');

        // Initialize trading services (if enabled)
        await initializeTradingServices();

        // Fetch initial holdings
        await fetchHoldings();

        // Start periodic updates
        startPeriodicUpdates();

        // Show initial display
        showLogs();

        // Start WebSocket monitoring
        await accountSubscribeStream();

    } catch (error) {
        logger.error('❌ Failed to start application:', error);
        await shutdown();
        process.exit(1);
    }
}

// Export main function and key components for testing
export {
    main,
    fetchHoldings,
    accountSubscribeStream,
    processWalletUpdate,
    detectWalletChanges,
    processCopyTrade,
    shutdown,
};

// Auto-start if this file is run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}