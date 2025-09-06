import * as dotenv from "dotenv";
import { WalletConfig } from "../types";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['HELIUS_HTTPS_URI'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export interface Config {
    api: {
        helius: {
            httpsUri: string;
            wssUri: string;
        };
    };
    database: {
        path: string;
    };
    settings: {
        wsolPcMint: string;
        inspectUrl: string;
        inspectName: string;
        inspectUrlWallet: string;
        showMaxDuplicates: number;
        showDuplicateMinHolders: number;
    };
    wallets: WalletConfig[];
}

export const config: Config = {
    api: {
        helius: {
            httpsUri: process.env.HELIUS_HTTPS_URI!,
            wssUri: process.env.HELIUS_WSS_URI || process.env.HELIUS_HTTPS_URI!.replace('https', 'wss'),
        },
    },
    database: {
        path: process.env.DB_PATH || "src/db/holdings.db",
    },
    settings: {
        wsolPcMint: "So11111111111111111111111111111111111111112",
        inspectUrl: "https://gmgn.ai/sol/token/",
        inspectName: "👽 Open GMGN",
        inspectUrlWallet: "https://gmgn.ai/sol/address/",
        showMaxDuplicates: parseInt(process.env.MAX_DUPLICATES_SHOWN || "5"),
        showDuplicateMinHolders: parseInt(process.env.MIN_HOLDERS_FOR_DUPLICATE || "3"),
    },
    wallets: loadWalletConfig(),
};

function loadWalletConfig(): WalletConfig[] {
    const wallets: WalletConfig[] = [];

    // Load wallets from environment variables
    let index = 1;
    while (true) {
        const name = process.env[`WALLET_${index}_NAME`];
        const address = process.env[`WALLET_${index}_ADDRESS`];
        const emoji = process.env[`WALLET_${index}_EMOJI`];

        if (!name || !address) break;

        wallets.push({
            name,
            address,
            emoji: emoji || "💼",
            tags: [],
        });

        index++;
    }

    // Fallback to default wallets if none configured
    if (wallets.length === 0) {
        console.warn("⚠️ No wallets configured via environment variables, using defaults");
        return [
            {
                name: "Wallet0",
                address: "GchNdch4w3L9SoRmHvD6G4zNYrNdQgpScLVF7DojMK4s",
                emoji: "👽",
                tags: [],
            },
            {
                name: "Wallet1",
                address: "KEN7s6mHAFpqmvppk7L9VaJW3htu3jz6z3dDjiaWdYT",
                emoji: "🀄️",
                tags: [],
            },
        ];
    }

    return wallets;
}

/*
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
*/
