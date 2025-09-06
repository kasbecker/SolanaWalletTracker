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
        enabled: false, // Disabled by default for simple wallet tracker
        mode: "simulation",
        defaultSlippage: 0.01,
        priorityFeeSol: 0.001,
        antiMevEnabled: true,
        maxTradeAmount: 100,
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
            address: "GchNdch4w3L9SoRmHvD6G4zNYrNdQgpScLVF7DojMK4s",
            emoji: "👽",
            tags: [],
            copyEnabled: false,
        },
        {
            name: "Wallet1",
            address: "KEN7s6mHAFpqmvppk7L9VaJW3htu3jz6z3dDjiaWdYT",
            emoji: "🀄️",
            tags: [],
            copyEnabled: false,
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
    ],
};