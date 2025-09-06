// src/services/JupiterService.ts
import axios from 'axios';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export interface SwapParams {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number; // Basis points (100 = 1%)
    userPublicKey: string;
}

export interface SwapResult {
    success: boolean;
    txnHash?: string;
    inputAmount?: number;
    outputAmount?: number;
    slippage?: number;
    error?: string;
    executionTime?: number;
}

export class JupiterService {
    private connection: Connection;
    private wallet: Keypair;

    constructor() {
        this.connection = new Connection(process.env.HELIUS_HTTPS_URI || '');
        const privateKeyString = process.env.PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }
        this.wallet = Keypair.fromSecretKey(bs58.decode(privateKeyString));
    }

    async getSwapRoute(params: SwapParams): Promise<any> {
        try {
            const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
                params: {
                    inputMint: params.inputMint,
                    outputMint: params.outputMint,
                    amount: params.amount,
                    slippageBps: params.slippageBps,
                    restrictIntermediateTokens: true,
                    onlyDirectRoutes: false,
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Jupiter quote error:', error);
            throw error;
        }
    }

    async executeSwap(params: SwapParams): Promise<SwapResult> {
        const startTime = Date.now();

        try {
            console.log(`🔄 Getting Jupiter route for swap...`);

            // Get quote from Jupiter
            const quote = await this.getSwapRoute(params);

            if (!quote) {
                throw new Error('No swap route found');
            }

            console.log(`💱 Route found: ${quote.inAmount} → ${quote.outAmount}`);

            // Get swap transaction
            const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
                quoteResponse: quote,
                userPublicKey: params.userPublicKey,
                wrapAndUnwrapSol: true,
                useSharedAccounts: true,
                feeAccount: undefined,
                prioritizationFeeLamports: Math.floor(parseFloat(process.env.PRIORITY_FEE_SOL || '0.001') * 1e9)
            });

            const { swapTransaction } = swapResponse.data;

            // Deserialize and sign transaction
            const transactionBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = Transaction.from(transactionBuf);

            // Sign transaction
            transaction.sign(this.wallet);

            console.log(`📡 Sending transaction to network...`);

            // Send transaction
            const txnHash = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.wallet],
                {
                    commitment: 'confirmed',
                    maxRetries: 3,
                }
            );

            const executionTime = Date.now() - startTime;

            console.log(`✅ Swap successful: ${txnHash}`);

            return {
                success: true,
                txnHash,
                inputAmount: parseInt(quote.inAmount),
                outputAmount: parseInt(quote.outAmount),
                slippage: parseFloat(quote.priceImpactPct || '0'),
                executionTime
            };

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            console.error(`❌ Swap failed:`, error.message);

            return {
                success: false,
                error: error.message,
                executionTime
            };
        }
    }

    async buyToken(params: {
        tokenMint: string;
        solAmount: number;
        slippageBps: number;
    }): Promise<SwapResult> {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';

        return this.executeSwap({
            inputMint: SOL_MINT,
            outputMint: params.tokenMint,
            amount: Math.floor(params.solAmount * 1e9), // Convert SOL to lamports
            slippageBps: params.slippageBps,
            userPublicKey: this.wallet.publicKey.toString()
        });
    }

    async sellToken(params: {
        tokenMint: string;
        tokenAmount: number;
        slippageBps: number;
    }): Promise<SwapResult> {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';

        return this.executeSwap({
            inputMint: params.tokenMint,
            outputMint: SOL_MINT,
            amount: params.tokenAmount,
            slippageBps: params.slippageBps,
            userPublicKey: this.wallet.publicKey.toString()
        });
    }
}