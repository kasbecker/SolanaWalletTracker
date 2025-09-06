// src/walletTracker.ts - Fixed wallet tracker
import axios from "axios";
import {
    GetTokenAccountsResponse,
    GetWalletTokenHoldingsResponse,
    SplTokenHolding,
    MintWithOwnersResponse,
    DuplicateOwnerMintRecord,
    MintWithOwners,
} from "./types";
import { checkMultipleOwnersForMint } from "./db";
import { config } from "./config";

export async function getWalletTokenHoldings(walletAddress: string): Promise<GetWalletTokenHoldingsResponse> {
    try {
        const txUrl = process.env.HELIUS_HTTPS_URI || "";

        // Use getTokenAccounts via DAS api to get the current spl-tokens
        const res = await axios.post<any>(txUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenAccounts",
            params: {
                owner: walletAddress,
            },
        });

        // Verify if a response was received
        if (!res.data) {
            throw new Error("No holdings received");
        }

        // Store the response data in a TypeScript safe const
        const tokenAccounts: GetTokenAccountsResponse = res.data.result;

        // Double verify the holdings are for this wallet
        const validHoldings: SplTokenHolding[] = tokenAccounts.token_accounts.filter(
            (acc: any) => acc.owner && acc.owner === walletAddress
        );
        if (!validHoldings) {
            throw new Error("No valid holdings received");
        }

        // Return data
        const returnData: GetWalletTokenHoldingsResponse = {
            data: validHoldings,
            success: true,
            msg: "success",
        };

        return returnData;
    } catch (error: any) {
        const returnData: GetWalletTokenHoldingsResponse = {
            data: [],
            success: false,
            msg: "🚫 Error fetching wallet holdings: " + error.message,
        };

        return returnData;
    }
}

export async function getDoubleHoldings(): Promise<MintWithOwnersResponse> {
    try {
        // Get duplicates
        const duplicates: DuplicateOwnerMintRecord[] = await checkMultipleOwnersForMint();
        if (duplicates.length < 1) {
            return { success: true, duplicates: [], msg: "success" };
        }

        // Group by mint to get owners
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
            .filter(item => item.owners.length >= config.settings.showDuplicateMinHolders);

        return {
            success: true,
            duplicates: mintWithOwnersArray,
            msg: "success",
        };
    } catch (error: any) {
        return {
            success: false,
            duplicates: [],
            msg: "Error: " + error.message,
        };
    }
}