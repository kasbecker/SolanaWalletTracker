import axios from "axios";
import {
  DuplicateOwnerMintRecord,
  GetTokenAccountsResponse,
  GetWalletTokenHoldingsResponse,
  MintWithOwners,
  MintWithOwnersResponse,
  SplTokenHolding,
} from "./types";
import { checkMultipleOwnersForMint } from "../database/db";

export async function getWalletTokenHoldings(walletAddress: string): Promise<GetWalletTokenHoldingsResponse> {
  try {
    const txUrl = process.env.HELIUS_HTTPS_URI || "";

    // Use getTokenAccounts via DAS api to get the current spl-tokens (Alternativly use getTokenAccountsByOwner method)
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

    // Store the response data in a Typescript safe const
    const tokenAccounts: GetTokenAccountsResponse = res.data.result;

    // tokenAccounts=   {
    //     "address": "1rfxSmcYzqzrGTHFfQFWtNHQPAKwUWPuNhLH1mRmZuf",
    //     "mint": "44MdeHeVjApQjNQMvcQUwUZsc2VEjHpjorsu9mdspump",
    //     "owner": "KEN7s6mHAFpqmvppk7L9VaJW3htu3jz6z3dDjiaWdYT",
    //     "amount": 32000000000000,
    //     "delegated_amount": 0,
    //     "frozen": false
    // },

    // Double verify the holdings are for this waller
    const validHoldings: SplTokenHolding[] = tokenAccounts.token_accounts.filter((acc: any) => acc.owner && acc.owner === walletAddress);
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

    // Example:
    // duplicates = [
    //   { "mint": "mint1", "owner": "owner1" },
    //   { "mint": "mint1", "owner": "owner2" },
    //   { "mint": "mint2", "owner": "owner3" },
    //   { "mint": "mint2", "owner": "owner4" }
    // ];

    // Stote duplicates in structured array
    const result: MintWithOwners[] = [];
    duplicates.forEach((record) => {
      // Find existing mint group or create a new one
      let mintGroup = result.find((item) => item.mint === record.mint);

      if (!mintGroup) {
        mintGroup = { mint: record.mint, owners: [] };
        result.push(mintGroup);
      }

      // Add the owner to the mint group if not already added
      if (mintGroup && !mintGroup.owners.includes(record.owner)) {
        mintGroup.owners.push(record.owner);
      }
    });

    // Example:
    // result = [
    //   {
    //     mint: 'mint1',
    //     owners: [
    //       'owner1',
    //       'owner2'
    //     ]
    //   },
    //{
    //     mint: 'mint2',
    //     owners: [
    //       'owner3',
    //       'owner4'
    //     ]
    //   }
    // ]

    return { success: true, duplicates: result, msg: "success" };
  } catch (error: any) {
    return { success: false, duplicates: [], msg: error };
  }
}
