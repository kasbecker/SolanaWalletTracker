// src/integrations/gmgn/types.ts - GMGN API type definitions

export interface GMGNApiResponse<T> {
    success: boolean;
    data: T;
    msg?: string;
    code?: number;
}

export interface SwapRoute {
    inputAmount: string;           // Input amount in raw units
    outputAmount: string;          // Expected output amount in raw units
    inputAmountUi: number;         // Input amount in UI units
    outputAmountUi: number;        // Expected output amount in UI units
    swapTransaction: string;       // Base64 encoded transaction
    priceImpact: number;          // Price impact percentage (0-1)
    slippage: number;             // Slippage percentage (0-1)
    fee: number;                  // Fee amount
    route: RouteStep[];           // Swap route details
    marketPrice: number;          // Current market price
    executionPrice: number;       // Execution price after slippage
    minimumReceived: number;      // Minimum tokens to receive
    lastValidBlockHeight?: number; // Block height for transaction validity
}

export interface RouteStep {
    swapInfo: {
        ammKey: string;             // AMM program key
        label: string;              // AMM name (e.g., "Raydium", "Orca")
        inputMint: string;          // Input token mint
        outputMint: string;         // Output token mint
        inAmount: string;           // Input amount for this step
        outAmount: string;          // Output amount for this step
        feeAmount: string;          // Fee for this step
        feeMint: string;            // Fee token mint
    };
    percent: number;              // Percentage of total trade through this route
}

export interface TokenInfo {
    address: string;              // Token mint address
    symbol: string;               // Token symbol
    name: string;                 // Token name
    decimals: number;             // Token decimals

    // Price information
    price: number;                // Current price in USD
    priceChange1h?: number;       // 1h price change percentage
    priceChange24h?: number;      // 24h price change percentage
    priceChange7d?: number;       // 7d price change percentage

    // Market data
    marketCap?: number;           // Market capitalization
    volume24h?: number;           // 24h trading volume
    liquidity?: number;           // Available liquidity

    // Trading metrics
    holderCount?: number;         // Number of token holders
    createdTime?: number;         // Token creation timestamp

    // Risk indicators
    isVerified?: boolean;         // Is token verified
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'; // Risk assessment

    // Social/metadata
    logo?: string;                // Token logo URL
    description?: string;         // Token description
    website?: string;             // Official website
    twitter?: string;             // Twitter handle
    telegram?: string;            // Telegram group

    // Additional GMGN specific data
    change24h?: number;           // 24h change percentage
    fdv?: number;                 // Fully diluted valuation
    pools?: PoolInfo[];           // Associated liquidity pools
}

export interface PoolInfo {
    address: string;              // Pool address
    dex: string;                  // DEX name (e.g., "Raydium", "Orca")
    baseToken: string;            // Base token mint
    quoteToken: string;           // Quote token mint
    liquidity: number;            // Pool liquidity in USD
    volume24h: number;            // 24h volume
    fee: number;                  // Pool fee percentage
    apy?: number;                 // Annual percentage yield
}

export interface WalletAnalysis {
    address: string;              // Wallet address
    totalPnl: number;            // Total profit/loss
    pnl24h: number;              // 24h profit/loss
    pnl7d: number;               // 7d profit/loss
    pnl30d: number;              // 30d profit/loss

    // Trading metrics
    totalTrades: number;          // Total number of trades
    trades24h: number;            // 24h trades
    winRate: number;              // Win rate percentage (0-100)
    avgPositionSize: number;      // Average position size in USD

    // Risk metrics
    sharpeRatio?: number;         // Risk-adjusted returns
    maxDrawdown?: number;         // Maximum drawdown percentage
    volatility?: number;          // Portfolio volatility

    // Token diversity
    tokensTraded: number;         // Number of different tokens traded
    topTokens: TopToken[];        // Most traded tokens

    // Timing analysis
    avgHoldTime: number;          // Average holding time in hours
    quickTrades: number;          // Trades held < 1 hour
    longHolds: number;            // Trades held > 24 hours

    // Social metrics (if available)
    followers?: number;           // Number of followers
    copiers?: number;             // Number of copy traders
    reputation?: number;          // Reputation score (0-100)
}

export interface TopToken {
    mint: string;                 // Token mint address
    symbol: string;               // Token symbol
    tradesCount: number;          // Number of trades
    totalVolume: number;          // Total volume traded
    pnl: number;                  // P&L on this token
    winRate: number;              // Win rate on this token
}

export interface TransactionResult {
    hash: string;                 // Transaction hash
    status: 'pending' | 'confirmed' | 'failed';
    blockHeight?: number;         // Block height when confirmed
    confirmations?: number;       // Number of confirmations
    fee?: number;                 // Transaction fee
    error?: string;               // Error message if failed
    timestamp: Date;              // Transaction timestamp
}

export interface SmartMoneyTrade {
    wallet: string;               // Trader wallet address
    token: string;                // Token being traded
    action: 'BUY' | 'SELL';      // Trade action
    amount: number;               // Trade amount
    price: number;                // Trade price
    value: number;                // USD value
    timestamp: Date;              // Trade timestamp
    txHash: string;               // Transaction hash

    // Context
    walletPnl?: number;           // Wallet's total P&L
    walletWinRate?: number;       // Wallet's win rate
    tokenInfo?: Partial<TokenInfo>; // Basic token info
}

export interface TrendingToken extends TokenInfo {
    trendingRank: number;         // Trending position
    trendingScore: number;        // Trending score (0-100)
    volumeChange24h: number;      // Volume change percentage
    holderChange24h: number;      // Holder count change
    socialMentions?: number;      // Social media mentions
    smartMoneyFlow?: number;      // Smart money net flow
}

export interface GMGNError {
    code: string;                 // Error code
    message: string;              // Error message
    details?: any;                // Additional error details
}

// Request/Response interfaces for specific endpoints

export interface GetSwapRouteRequest {
    token_in_address: string;     // Input token mint
    token_out_address: string;    // Output token mint
    in_amount: string;            // Input amount in raw units
    from_address: string;         // User wallet address
    slippage: number;             // Slippage tolerance (0-100)
    priority_fee?: number;        // Priority fee in SOL
    anti_mev?: boolean;           // Enable anti-MEV protection
}

export interface SendTransactionRequest {
    signedTx: string;             // Base64 encoded signed transaction
    anti_mev?: boolean;           // Enable anti-MEV protection
    max_retries?: number;         // Maximum retry attempts
}

export interface GetTransactionStatusRequest {
    hash: string;                 // Transaction hash
    last_valid_height?: number;   // Last valid block height
}

export interface TokenQuotationRequest {
    token: string;                // Token mint address
    vs_currency?: string;         // Base currency (default: USD)
    include_24hr_change?: boolean; // Include 24h change data
    include_volume?: boolean;     // Include volume data
    include_market_cap?: boolean; // Include market cap data
}

export interface WalletAnalysisRequest {
    wallet: string;               // Wallet address
    timeframe?: '24h' | '7d' | '30d' | 'all'; // Analysis timeframe
    include_positions?: boolean;   // Include current positions
    include_pnl?: boolean;        // Include P&L breakdown
    include_tokens?: boolean;     // Include traded tokens
}

export interface SmartMoneyRequest {
    limit?: number;               // Number of results (default: 50)
    orderby?: 'pnl' | 'pnl_24h' | 'pnl_7d' | 'winrate' | 'volume'; // Sort order
    min_pnl?: number;             // Minimum P&L filter
    min_trades?: number;          // Minimum trades filter
    timeframe?: '24h' | '7d' | '30d'; // Timeframe filter
}

export interface TrendingTokensRequest {
    limit?: number;               // Number of results (default: 20)
    timeframe?: '1h' | '24h' | '7d'; // Trending timeframe
    min_volume?: number;          // Minimum volume filter
    min_market_cap?: number;      // Minimum market cap filter
    category?: string;            // Token category filter
}

// Response wrappers for better type safety

export interface SwapRouteResponse extends GMGNApiResponse<SwapRoute> {}

export interface TokenInfoResponse extends GMGNApiResponse<TokenInfo> {}

export interface WalletAnalysisResponse extends GMGNApiResponse<WalletAnalysis> {}

export interface SmartMoneyResponse extends GMGNApiResponse<SmartMoneyTrade[]> {}

export interface TrendingTokensResponse extends GMGNApiResponse<TrendingToken[]> {}

export interface TransactionStatusResponse extends GMGNApiResponse<{
    confirmed: boolean;
    failed: boolean;
    confirmations: number;
    error?: string;
    blockHeight?: number;
    fee?: number;
}> {}

// Utility types for better development experience

export type GMGNEndpoint =
    | '/defi/router/v1/sol/tx/get_swap_route'
    | '/defi/router/v1/sol/tx/send_transaction'
    | '/defi/router/v1/sol/tx/get_transaction_status'
    | '/defi/quotation_v4'
    | '/defi/quotation/v1/smartmoney/sol/walletNew'
    | '/defi/quotation/v1/tokens/sol/trending';

export type TradeAction = 'BUY' | 'SELL';

export type TimeFrame = '1h' | '24h' | '7d' | '30d' | 'all';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type OrderBy = 'pnl' | 'pnl_24h' | 'pnl_7d' | 'winrate' | 'volume' | 'trades';

// Helper interfaces for internal use

export interface GMGNServiceConfig {
    baseURL: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    rateLimit: number;            // Requests per second
}

export interface APIRateLimit {
    limit: number;                // Max requests
    window: number;               // Time window in ms
    remaining: number;            // Remaining requests
    resetTime: number;            // When limit resets
}

// Mock/Testing interfaces

export interface MockGMGNResponse<T> {
    success: boolean;
    data: T;
    delay?: number;               // Simulate network delay
    shouldFail?: boolean;         // Simulate API failure
    errorCode?: string;           // Custom error code
}

export interface GMGNServiceMock {
    getSwapRoute: (params: any) => Promise<MockGMGNResponse<SwapRoute>>;
    sendTransaction: (params: any) => Promise<MockGMGNResponse<{ hash: string }>>;
    getTokenInfo: (address: string) => Promise<MockGMGNResponse<TokenInfo>>;
    getWalletAnalysis: (address: string) => Promise<MockGMGNResponse<WalletAnalysis>>;
}