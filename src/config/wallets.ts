// src/config/wallets.ts - Wallet configurations
export interface WalletConfig {
    name: string;
    address: string;
    emoji: string;
    tags: string[];
    copyEnabled?: boolean;          // NEW: Enable/disable copying this wallet
    copyMultiplier?: number;        // NEW: Multiplier for copy amounts (default 1.0)
    maxCopyAmount?: number;         // NEW: Max amount to copy from this wallet
    riskLevel?: 'low' | 'medium' | 'high'; // NEW: Risk assessment
}

export const wallets: WalletConfig[] = [
    {
        name: "Wallet0",
        address: "D19dE6p8C3Ex3yw9E8VbN7cpTxwevRUKzRJ2Z7Y16y5w",
        emoji: "👽",
        tags: [],
        copyEnabled: true,
        copyMultiplier: 0.1,          // Copy 10% of their trades
        maxCopyAmount: 1000,          // Max $1000 per copy trade
        riskLevel: 'medium',
    },
    {
        name: "Wallet1",
        address: "Dfy6wjn59Cx294QANW81WtK3aPqeWvgjBj9aM8ASpCSD",
        emoji: "🀄️",
        tags: [],
        copyEnabled: true,
        copyMultiplier: 0.05,         // Copy 5% of their trades
        maxCopyAmount: 500,           // Max $500 per copy trade
        riskLevel: 'low',
    },
    /*{
        name: "Frank",
        address: "CRVidEDtEUTYZisCxBZkpELzhQc9eauMLR3FWg74tReL",
        emoji: "😂",
        tags: [],
        copyEnabled: false,           // Monitoring only, no copying
        riskLevel: 'high',
    },
    {
        name: "Profit",
        address: "G5nxEXuFMfV74DSnsrSatqCW32F34XUnBeq3PfDS7w5E",
        emoji: "💰",
        tags: [],
        copyEnabled: true,
        copyMultiplier: 0.2,          // Copy 20% of their trades
        maxCopyAmount: 2000,          // Max $2000 per copy trade
        riskLevel: 'medium',
    },
    {
        name: "DigBen",
        address: "CKddnqDi9hTPDr3ovyLfseJ17ddr553u1MXKV9VpGiJ9",
        emoji: "🚀",
        tags: [],
        copyEnabled: true,
        copyMultiplier: 0.15,         // Copy 15% of their trades
        maxCopyAmount: 1500,          // Max $1500 per copy trade
        riskLevel: 'medium',
    },*/
];

// Helper functions
export const getCopyEnabledWallets = (): WalletConfig[] => {
    return wallets.filter(wallet => wallet.copyEnabled);
};

export const getWalletByAddress = (address: string): WalletConfig | undefined => {
    return wallets.find(wallet => wallet.address === address);
};

export const getWalletsByRiskLevel = (riskLevel: 'low' | 'medium' | 'high'): WalletConfig[] => {
    return wallets.filter(wallet => wallet.riskLevel === riskLevel);
};