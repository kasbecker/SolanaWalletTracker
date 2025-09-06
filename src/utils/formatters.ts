// src/utils/formatters.ts - Display formatting utilities
export const formatters = {
    // Address formatting
    shortenAddress: (address: string, startChars: number = 4, endChars: number = 4): string => {
        if (!address || address.length <= startChars + endChars) return address;
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    },

    // Currency formatting
    formatUSD: (amount: number, decimals: number = 2): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(amount);
    },

    formatSOL: (lamports: number, decimals: number = 4): string => {
        const sol = lamports / Math.pow(10, 9);
        return `${sol.toFixed(decimals)} SOL`;
    },

    formatTokenAmount: (amount: number, decimals: number = 9, displayDecimals: number = 4): string => {
        const uiAmount = amount / Math.pow(10, decimals);
        if (uiAmount === 0) return '0';
        if (uiAmount < 0.0001) return '< 0.0001';
        if (uiAmount < 1) return uiAmount.toFixed(6);
        if (uiAmount < 1000) return uiAmount.toFixed(displayDecimals);
        if (uiAmount < 1000000) return `${(uiAmount / 1000).toFixed(2)}K`;
        if (uiAmount < 1000000000) return `${(uiAmount / 1000000).toFixed(2)}M`;
        return `${(uiAmount / 1000000000).toFixed(2)}B`;
    },

    formatLargeNumber: (num: number): string => {
        if (num === 0) return '0';
        if (Math.abs(num) < 1000) return num.toFixed(2);
        if (Math.abs(num) < 1000000) return `${(num / 1000).toFixed(2)}K`;
        if (Math.abs(num) < 1000000000) return `${(num / 1000000).toFixed(2)}M`;
        return `${(num / 1000000000).toFixed(2)}B`;
    },

    // Percentage formatting
    formatPercent: (value: number, decimals: number = 2): string => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
    },

    formatPercentWithColor: (value: number, decimals: number = 2): { text: string; color: 'green' | 'red' | 'gray' } => {
        const text = formatters.formatPercent(value, decimals);
        let color: 'green' | 'red' | 'gray' = 'gray';

        if (value > 0) color = 'green';
        else if (value < 0) color = 'red';

        return { text, color };
    },

    // Time formatting
    formatTimestamp: (timestamp: Date | number | string): string => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    },

    formatTimeAgo: (timestamp: Date | number | string): string => {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now.getTime() - past.getTime();

        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return past.toLocaleDateString();
    },

    formatDuration: (milliseconds: number): string => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        if (seconds > 0) {
            return `${seconds}s`;
        }
        return `${milliseconds}ms`;
    },

    // Status formatting
    formatTradeStatus: (status: string): { text: string; emoji: string; color: string } => {
        const statusMap: { [key: string]: { text: string; emoji: string; color: string } } = {
            SUCCESS: { text: 'Success', emoji: '✅', color: 'green' },
            FAILED: { text: 'Failed', emoji: '❌', color: 'red' },
            PENDING: { text: 'Pending', emoji: '⏳', color: 'yellow' },
            REJECTED: { text: 'Rejected', emoji: '🚫', color: 'orange' },
            SKIPPED: { text: 'Skipped', emoji: '⏭️', color: 'gray' },
        };

        return statusMap[status.toUpperCase()] || { text: status, emoji: '❓', color: 'gray' };
    },

    formatRiskLevel: (level: string): { text: string; emoji: string; color: string } => {
        const riskMap: { [key: string]: { text: string; emoji: string; color: string } } = {
            LOW: { text: 'Low Risk', emoji: '🟢', color: 'green' },
            MEDIUM: { text: 'Medium Risk', emoji: '🟡', color: 'yellow' },
            HIGH: { text: 'High Risk', emoji: '🟠', color: 'orange' },
            CRITICAL: { text: 'Critical Risk', emoji: '🔴', color: 'red' },
        };

        return riskMap[level.toUpperCase()] || { text: level, emoji: '❓', color: 'gray' };
    },

    // Transaction hash formatting
    formatTxHash: (hash: string, length: number = 8): string => {
        if (!hash) return 'N/A';
        return `${hash.slice(0, length)}...`;
    },

    formatTxHashWithLink: (hash: string, explorer: 'solscan' | 'solana-explorer' = 'solscan'): string => {
        if (!hash) return 'N/A';

        const baseUrls = {
            'solscan': 'https://solscan.io/tx/',
            'solana-explorer': 'https://explorer.solana.com/tx/',
        };

        const url = `${baseUrls[explorer]}${hash}`;
        const shortHash = formatters.formatTxHash(hash);

        return `[${shortHash}](${url})`;
    },

    // Slippage formatting
    formatSlippage: (slippage: number): string => {
        return `${(slippage * 100).toFixed(2)}%`;
    },

    // Position formatting
    formatPnL: (pnl: number, isPercent: boolean = false): {
        text: string;
        emoji: string;
        color: 'green' | 'red' | 'gray'
    } => {
        const value = isPercent ? pnl : pnl;
        const text = isPercent ? formatters.formatPercent(value) : formatters.formatUSD(value);

        let emoji = '📊';
        let color: 'green' | 'red' | 'gray' = 'gray';

        if (value > 0) {
            emoji = '📈';
            color = 'green';
        } else if (value < 0) {
            emoji = '📉';
            color = 'red';
        }

        return { text, emoji, color };
    },

    // Table formatting helpers
    formatTableValue: (value: any, type: 'currency' | 'percent' | 'number' | 'address' | 'timestamp' | 'duration'): string => {
        if (value === null || value === undefined) return 'N/A';

        switch (type) {
            case 'currency':
                return formatters.formatUSD(Number(value));
            case 'percent':
                return formatters.formatPercent(Number(value));
            case 'number':
                return formatters.formatLargeNumber(Number(value));
            case 'address':
                return formatters.shortenAddress(String(value));
            case 'timestamp':
                return formatters.formatTimestamp(value);
            case 'duration':
                return formatters.formatDuration(Number(value));
            default:
                return String(value);
        }
    },

    // Console color helpers for terminal output
    colors: {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        gray: '\x1b[90m',
    },

    colorize: (text: string, color: keyof typeof formatters.colors): string => {
        return `${formatters.colors[color]}${text}${formatters.colors.reset}`;
    },

    // Progress indicators
    formatProgress: (current: number, total: number, width: number = 20): string => {
        const percentage = Math.min(current / total, 1);
        const filled = Math.floor(percentage * width);
        const empty = width - filled;

        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const percent = (percentage * 100).toFixed(1);

        return `${bar} ${percent}%`;
    },

    // Error formatting
    formatError: (error: Error | string): string => {
        if (typeof error === 'string') return error;
        return `${error.name}: ${error.message}`;
    },

    // Validation helpers
    isValidSolanaAddress: (address: string): boolean => {
        // Basic Solana address validation (44 characters, base58)
        if (!address || address.length !== 44) return false;

        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        return base58Regex.test(address);
    },

    isValidTransactionHash: (hash: string): boolean => {
        // Basic transaction hash validation (64-88 characters)
        if (!hash || hash.length < 64 || hash.length > 88) return false;

        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        return base58Regex.test(hash);
    },
};

// Export individual formatters for convenience
export const {
    shortenAddress,
    formatUSD,
    formatSOL,
    formatPercent,
    formatTimestamp,
    formatTimeAgo,
    formatLargeNumber,
    formatTxHash,
    colorize,
    colors,
} = formatters;

export default formatters;