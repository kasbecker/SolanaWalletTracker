// src/config/index.ts - Main configuration file
import * as dotenv from 'dotenv';
import { wallets } from './wallets';
import { databaseConfig } from './database';
import { tradingConfig } from './trading';

dotenv.config();

export const config = {
    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Your existing wallet configuration
    wallets,

    // Database configuration
    database: databaseConfig,

    // Trading configuration
    trading: tradingConfig,

    // Existing settings from your config.ts
    settings: {
        wsol_pc_mint: "So11111111111111111111111111111111111111112",
        inspect_url: "https://gmgn.ai/sol/token/",
        inspect_name: "👽 Open GMGN",
        inspect_url_wallet: "https://gmgn.ai/sol/address/",
        show_max_duplicates: 5,
        show_duplicate_min_holders: 3,
    },

    // Solana RPC configuration
    solana: {
        rpcUrl: process.env.HELIUS_HTTPS_URI || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        wsUrl: process.env.HELIUS_WSS_URI || process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
        commitment: 'confirmed' as const,
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        console: process.env.NODE_ENV !== 'production',
        file: process.env.NODE_ENV === 'production',
    },

    // API configuration (for future REST API)
    api: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || 'localhost',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    },

    // Notification configuration
    notifications: {
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID,
            enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        },
        console: {
            enabled: true,
        },
    },
};

export default config;
