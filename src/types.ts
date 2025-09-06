// src/types.ts - Fixed with correct names and exports

// Wallet Configuration
export interface WalletConfig {
    name: string;
    address: string;
    emoji: string;
    tags: string[];
    // Copy trading properties (optional)
    copyEnabled?: boolean;
    copyMultiplier?: number;
    maxCopyAmount?: number;
}

// Holdings Types
export interface SplTokenHolding {
    address: string;
    mint: string;
    owner: string;
    amount: number;
    delegated_amount: number;
    frozen: boolean;
}

export interface GetTokenAccountsResponse {
    total: number;
    limit: number;
    cursor: string;
    token_accounts: SplTokenHolding[];
}

export interface GetWalletTokenHoldingsResponse {
    data: SplTokenHolding[];
    success: boolean;
    msg: string;
}

// Fixed typo: SplTokenStoreReponse -> SplTokenStoreResponse
export interface SplTokenStoreResponse {
    success: boolean;
    added: SplTokenHolding[];
    removed: string[];
    msg: string;
}

// WebSocket Types
export interface getAccountInfoStreamReponse {
    jsonrpc: string;
    method: "accountNotification";
    params: {
        result: {
            context: { slot: number };
            value: {
                data: any;
                executable: boolean;
                lamports: number;
                owner: string;
                rentEpoch: number;
                space: number;
            };
        };
        subscription: number;
    };
}

// Fixed name for consistency
export interface getAccountInfoStreamReponseWithConfirmation extends getAccountInfoStreamReponse {
    id?: string;
    result?: number | null;
}

// Alternative export with better naming
export interface AccountInfoStreamResponseWithConfirmation extends getAccountInfoStreamReponse {
    id?: string;
    result?: number | null;
}

// Duplicate Holdings
export interface DuplicateOwnerMintRecord {
    mint: string;
    owner: string;
}

export interface MintWithOwners {
    mint: string;
    owners: string[];
}

export interface MintWithOwnersResponse {
    success: boolean;
    duplicates: MintWithOwners[];
    msg: string;
}

// Trading Types (for copy trading functionality)
export interface WalletTransaction {
    wallet: string;
    token: string;
    action: 'BUY' | 'SELL';
    amount: string;
    price: number;
    timestamp: number;
    txHash?: string;
}

export interface CopyTradeSettings {
    enabled: boolean;
    followPercentage: number;
    maxCopyAmount: number;
    minCopyAmount: number;
    stopLoss?: number;
    takeProfit?: number;
    blacklistedTokens: string[];
    delayMs?: number;
}

export interface TradeResult {
    status: 'success' | 'error' | 'rejected';
    txHash?: string;
    reason?: string;
    error?: string;
    timestamp: number;
    inputAmount?: number;
    outputAmount?: number;
    actualSlippage?: number;
}

export interface Position {
    token: string;
    amount: number;
    averagePrice: number;
    unrealizedPnL: number;
    timestamp: number;
    txHashes: string[];
}

export interface SwapRoute {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    outputAmount: string;
    priceImpact: number;
    swapTransaction: string;
    lastValidBlockHeight: number;
    slippage?: number;
}

// Wallet Configuration (ADD THIS)
export interface WalletConfig {
    name: string;
    address: string;
    emoji: string;
    tags: string[];
    copyEnabled?: boolean;        // For copy trading
    copyMultiplier?: number;      // Percentage to copy (0.1 = 10%)
    maxCopyAmount?: number;       // Max USD per copy trade
}

// Holdings - EXISTING, keep as is
export interface GetTokenAccountsResponse {
    total: number;
    limit: number;
    cursor: string;
    token_accounts: {
        address: string;
        mint: string;
        owner: string;
        amount: number;
        delegated_amount: number;
        frozen: boolean;
    }[];
}

export interface SplTokenHolding {
    address: string;
    mint: string;
    owner: string;
    amount: number;
    delegated_amount: number;
    frozen: boolean;
}

export interface GetWalletTokenHoldingsResponse {
    data: SplTokenHolding[];
    success: boolean;
    msg: string;
}

export interface SplTokenStoreReponse {
    success: boolean;
    added: SplTokenHolding[];
    removed: string[];
    msg: string;
}

export interface getAccountInfoStreamReponse {
    jsonrpc: string;
    method: "accountNotification";
    params: {
        result: {
            context: {
                slot: number;
            };
            value: {
                data: {
                    program: string;
                    parsed: {
                        type: string;
                        info: {
                            authority: string;
                            blockhash: string;
                            feeCalculator: {
                                lamportsPerSignature: number;
                            };
                        };
                    };
                };
                executable: boolean;
                lamports: number;
                owner: string;
                rentEpoch: number;
                space: number;
            };
        };
        subscription: number;
    };
}

export interface getAccountInfoStreamReponseWithConfirmation extends getAccountInfoStreamReponse {
    id?: string; // Confirmation ID
    result?: null; // Confirmation result
}

export interface DuplicateOwnerMintRecord {
    mint: string;
    owner: string;
}

export interface MintWithOwners {
    mint: string;
    owners: string[];
}

export interface MintWithOwnersResponse {
    success: boolean;
    duplicates: MintWithOwners[];
    msg: string;
}

// Copy Trading Types (ADD THESE)
export interface TradeDetection {
    type: 'BUY' | 'SELL';
    tokenMint: string;
    amountChange: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    previousAmount: number;
    currentAmount: number;
}

export interface BotTrade {
    id: string;
    timestamp: number;
    source_wallet: string;
    token_mint: string;
    action: 'BUY' | 'SELL';
    amount_tokens: number;
    amount_sol?: number;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    txn_hash?: string;
    error_message?: string;
}