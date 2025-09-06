// src/config.ts - Update your existing config
import { WalletConfig } from "./types";

export const config = {
    settings: {
        wsol_pc_mint: "So11111111111111111111111111111111111111112",
        inspect_url: "https://gmgn.ai/sol/token/",
        inspect_name: "👽 Open GMGN",
        inspect_url_wallet: "https://gmgn.ai/sol/address/",
        show_max_duplicates: 5,
        show_duplicate_min_holders: 3,
    },
    db: {
        db_name_tracker_transfers: "src/db/holdings.db",
    },
    wallets: [
        {
            name: "Wallet0",
            address: "GchNdch4w3L9SoRmHvD6G4zNYrNdQgpScLVF7DojMK4s",
            emoji: "👽",
            tags: [],
            copyEnabled: false, // Set to true to enable copy trading
            copyMultiplier: 0.1, // Copy 10% of their trade size
        },
        {
            name: "Wallet1",
            address: "KEN7s6mHAFpqmvppk7L9VaJW3htu3jz6z3dDjiaWdYT",
            emoji: "🀄️",
            tags: [],
            copyEnabled: true,  // Enable copy trading for this wallet
            copyMultiplier: 0.1,
        },
        {
            name: "Frank",
            address: "CRVidEDtEUTYZisCxBZkpELzhQc9eauMLR3FWg74tReL",
            emoji: "😂",
            tags: [],
            copyEnabled: false,
        },
        {
            name: "Profit",
            address: "G5nxEXuFMfV74DSnsrSatqCW32F34XUnBeq3PfDS7w5E",
            emoji: "💰",
            tags: [],
            copyEnabled: false,
        },
        {
            name: "DigBen",
            address: "CKddnqDi9hTPDr3ovyLfseJ17ddr553u1MXKV9VpGiJ9",
            emoji: "🚀",
            tags: [],
            copyEnabled: false,
        },
    ] as WalletConfig[], // Add type annotation
};

/*
// src/config.ts - Simple configuration for wallet tracker
import { WalletConfig } from "./types";

export interface Config {
    settings: {
        wsolPcMint: string;
        inspectUrl: string;
        inspectName: string;
        inspectUrlWallet: string;
        showMaxDuplicates: number;
        showDuplicateMinHolders: number;
    };
    database: {
        path: string;
        sqlite?: {
            filename: string;
        };
    };
    solana?: {
        commitment?: string;
    };
    trading?: {
        enabled: boolean;
        mode: string;
        defaultSlippage: number;
        priorityFeeSol: number;
        antiMevEnabled: boolean;
        maxTradeAmount: number;
        minTradeAmount: number;
        maxPositionSizeUsd: number;
        maxOpenPositions: number;
        maxDailyTrades: number;
        maxDailyLoss: number;
        blacklistedTokens: string[];
        executionDelayMs: number;
    };
    wallets: WalletConfig[];
}

export const config: Config = {
    settings: {
        wsolPcMint: "So11111111111111111111111111111111111111112",
        inspectUrl: "https://gmgn.ai/sol/token/",
        inspectName: "👽 Open GMGN",
        inspectUrlWallet: "https://gmgn.ai/sol/address/",
        showMaxDuplicates: 5,
        showDuplicateMinHolders: 3,
    },
    database: {
        path: "src/db/holdings.db",
        sqlite: {
            filename: "src/db/holdings.db",
        },
    },
    solana: {
        commitment: "confirmed",
    },
    trading: {
        enabled: true, // ✅ Must be true for copy trading
        mode: "live", // "simulation" | "paper" | "live"
        // enabled: false, // Disabled by default for simple wallet tracker
        // mode: "simulation",
        defaultSlippage: 0.01,
        // defaultSlippage: 0.01,
        priorityFeeSol: 0.001,
        antiMevEnabled: true,
        maxTradeAmount: 10,
        // maxTradeAmount: 100,
        minTradeAmount: 10,
        maxPositionSizeUsd: 1000,
        maxOpenPositions: 10,
        maxDailyTrades: 50,
        maxDailyLoss: 500,
        blacklistedTokens: [],
        executionDelayMs: 1000,
    },
    wallets: [
        {
            name: "Wallet0",
            address: "9fsqG3KMqHWAjPMABnWyAcymy9gWhpPZBhc4pSYEDiyz",
            emoji: "👽",
            tags: [],
            copyEnabled: true,
            copyMultiplier: 0.001, // Optional: Copy 10% of their trade size
            maxCopyAmount: 100,  // Optional: Max $100 per copy trade
        },
        {
            name: "Wallet1",
            address: "B6Zqk3FXcQDSMaLe5SdytQjpTYgHzU5hz2pR8qqonNPQ",
            emoji: "🀄️",
            tags: [],
            copyEnabled: true,
            copyMultiplier: 0.001, // Optional: Copy 10% of their trade size
            maxCopyAmount: 100,  // Optional: Max $100 per copy trade
        },
        {
            name: "Wallet2",
            address: "4XBjBWW3RBHsRwDkSHEnCkFnrSWNZbuZSV5SD9zz6Qti",
            emoji: "😂",
            tags: [],
            copyEnabled: true,
            copyMultiplier: 0.001, // Optional: Copy 10% of their trade size
            maxCopyAmount: 100,  // Optional: Max $100 per copy trade
        },
    ],
};*/
