// Wallet Configuration
export interface WalletConfig {
    name: string;
    address: string;
    emoji: string;
    tags: string[];
}

// Holdings
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

export interface SplTokenStoreResponse {
    success: boolean;
    added: SplTokenHolding[];
    removed: string[];
    msg: string;
}

// WebSocket Types
export interface AccountNotificationParams {
    result: {
        context: {
            slot: number;
        };
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
}

export interface AccountInfoStreamResponse {
    jsonrpc: string;
    method: "accountNotification";
    params: AccountNotificationParams;
}

export interface AccountInfoStreamResponseWithConfirmation extends AccountInfoStreamResponse {
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

// Error Types
export interface ApiError {
    success: false;
    error: string;
    details?: any;
}

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;