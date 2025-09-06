import axios, { AxiosError } from "axios";
import { config } from "../config";
import {
    GetTokenAccountsResponse,
    GetWalletTokenHoldingsResponse,
    SplTokenHolding,
    MintWithOwnersResponse,
    DuplicateOwnerMintRecord,
    MintWithOwners,
    ApiResponse,
} from "../types";
import { database } from "../database";

export class WalletTrackerService {
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000; // 1 second

    static async getWalletTokenHoldings(
        walletAddress: string
    ): Promise<GetWalletTokenHoldingsResponse> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const response = await axios.post<any>(
                    config.api.helius.httpsUri,
                    {
                        jsonrpc: "2.0",
                        id: `wallet-holdings-${Date.now()}`,
                        method: "getTokenAccounts",
                        params: {
                            owner: walletAddress,
                        },
                    },
                    {
                        timeout: 10000,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (!response.data?.result) {
                    throw new Error("No valid response received from Helius API");
                }

                const tokenAccounts: GetTokenAccountsResponse = response.data.result;

                // Filter and validate holdings
                const validHoldings: SplTokenHolding[] = tokenAccounts.token_accounts
                    .filter((account) =>
                        account.owner === walletAddress &&
                        account.amount > 0
                    )
                    .map((account) => ({
                        address: account.address,
                        mint: account.mint,
                        owner: account.owner,
                        amount: account.amount,
                        delegated_amount: account.delegated_amount || 0,
                        frozen: account.frozen || false,
                    }));

                return {
                    data: validHoldings,
                    success: true,
                    msg: `Successfully fetched ${validHoldings.length} token holdings`,
                };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.MAX_RETRIES) {
                    console.warn(
                        `⚠️ Attempt ${attempt} failed for wallet ${walletAddress.slice(0, 8)}..., retrying in ${this.RETRY_DELAY}ms`
                    );
                    await this.delay(this.RETRY_DELAY * attempt);
                }
            }
        }

        const errorMessage = lastError instanceof AxiosError
            ? `API Error: ${lastError.message} (${lastError.response?.status})`
            : `Error: ${lastError?.message || 'Unknown error'}`;

        return {
            data: [],
            success: false,
            msg: `🚫 Failed to fetch wallet holdings after ${this.MAX_RETRIES} attempts: ${errorMessage}`,
        };
    }

    static async getDoubleHoldings(): Promise<MintWithOwnersResponse> {
        try {
            const duplicates: DuplicateOwnerMintRecord[] = await database.checkMultipleOwnersForMint();

            if (duplicates.length === 0) {
                return {
                    success: true,
                    duplicates: [],
                    msg: "No duplicate holdings found",
                };
            }

            // Group by mint to create MintWithOwners structure
            const mintOwnersMap = new Map<string, Set<string>>();

            for (const record of duplicates) {
                if (!mintOwnersMap.has(record.mint)) {
                    mintOwnersMap.set(record.mint, new Set());
                }
                mintOwnersMap.get(record.mint)!.add(record.owner);
            }

            // Convert to array format
            const mintWithOwnersArray: MintWithOwners[] = Array.from(mintOwnersMap.entries())
                .map(([mint, ownersSet]) => ({
                    mint,
                    owners: Array.from(ownersSet),
                }))
                .filter(item => item.owners.length >= config.settings.showDuplicateMinHolders)
                .slice(0, config.settings.showMaxDuplicates);

            return {
                success: true,
                duplicates: mintWithOwnersArray,
                msg: `Found ${mintWithOwnersArray.length} tokens with multiple holders`,
            };

        } catch (error) {
            console.error("Error fetching duplicate holdings:", error);
            return {
                success: false,
                duplicates: [],
                msg: `Error fetching duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}