// src/integrations/gmgn/GMGNService.ts - GMGN.AI API integration
import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { SwapRoute, GMGNApiResponse, TokenInfo } from './types';

export class GMGNService {
    private client: AxiosInstance;
    private isInitialized: boolean = false;

    constructor() {
        this.client = axios.create({
            baseURL: 'https://gmgn.ai',
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SolanaWalletTracker-CopyBot/1.0.0',
                'Accept': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    async initialize(): Promise<void> {
        try {
            logger.info('🌐 Initializing GMGN Service...');

            // Test API connectivity
            const testResponse = await this.getTokenInfo('So11111111111111111111111111111111111111112');
            if (testResponse) {
                logger.info('✅ GMGN Service initialized successfully');
                this.isInitialized = true;
            } else {
                throw new Error('GMGN API test failed');
            }

        } catch (error) {
            logger.error('❌ Failed to initialize GMGN Service:', error);
            throw error;
        }
    }

    async getSwapRoute(
        inputToken: string,
        outputToken: string,
        inputAmount: string,
        fromAddress: string,
        slippage: number = config.trading.defaultSlippage,
        priorityFee: number = config.trading.priorityFeeSol,
        antiMev: boolean = config.trading.antiMevEnabled
    ): Promise<SwapRoute> {
        try {
            if (!this.isInitialized) {
                throw new Error('GMGN Service not initialized');
            }

            logger.debug(`🔄 Getting swap route: ${inputAmount} ${inputToken} -> ${outputToken}`);

            const params = new URLSearchParams({
                token_in_address: inputToken,
                token_out_address: outputToken,
                in_amount: inputAmount,
                from_address: fromAddress,
                slippage: (slippage * 100).toString(), // Convert to percentage
                priority_fee: priorityFee.toString(),
                anti_mev: antiMev.toString(),
            });

            const response = await this.client.get<GMGNApiResponse<SwapRoute>>(
                `/defi/router/v1/sol/tx/get_swap_route?${params}`
            );

            if (!response.data.success) {
                throw new Error(`GMGN API Error: ${response.data.msg || 'Unknown error'}`);
            }

            const route = response.data.data;

            // Validate route data
            if (!route.swapTransaction) {
                throw new Error('Invalid swap route: missing transaction data');
            }

            logger.debug(`✅ Swap route obtained: ${route.inputAmount} -> ${route.outputAmount}`);

            return route;

        } catch (error) {
            logger.error('❌ Failed to get swap route:', error);
            throw error;
        }
    }

    async sendTransaction(
        signedTransaction: string,
        antiMev: boolean = config.trading.antiMevEnabled
    ): Promise<{ hash: string }> {
        try {
            if (!this.isInitialized) {
                throw new Error('GMGN Service not initialized');
            }

            logger.debug('📤 Sending transaction via GMGN...');

            const response = await this.client.post<GMGNApiResponse<{ hash: string }>>(
                '/defi/router/v1/sol/tx/send_transaction',
                {
                    signedTx: signedTransaction,
                    anti_mev: antiMev,
                }
            );

            if (!response.data.success) {
                throw new Error(`GMGN Transaction Error: ${response.data.msg || 'Unknown error'}`);
            }

            const result = response.data.data;
            logger.info(`✅ Transaction sent successfully: ${result.hash}`);

            return result;

        } catch (error) {
            logger.error('❌ Failed to send transaction:', error);
            throw error;
        }
    }

    async getTransactionStatus(
        hash: string,
        lastValidHeight?: number
    ): Promise<{
        status: 'pending' | 'confirmed' | 'failed';
        confirmations?: number;
        error?: string;
    }> {
        try {
            const params = new URLSearchParams({ hash });
            if (lastValidHeight) {
                params.append('last_valid_height', lastValidHeight.toString());
            }

            const response = await this.client.get<GMGNApiResponse<any>>(
                `/defi/router/v1/sol/tx/get_transaction_status?${params}`
            );

            if (!response.data.success) {
                return { status: 'failed', error: response.data.msg };
            }

            const data = response.data.data;

            // Map GMGN status to our format
            let status: 'pending' | 'confirmed' | 'failed';
            if (data.confirmed) {
                status = 'confirmed';
            } else if (data.failed) {
                status = 'failed';
            } else {
                status = 'pending';
            }

            return {
                status,
                confirmations: data.confirmations,
                error: data.error,
            };

        } catch (error) {
            logger.error('❌ Failed to get transaction status:', error);
            return { status: 'failed', error: 'Status check failed' };
        }
    }

    async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
        try {
            const response = await this.client.get<GMGNApiResponse<TokenInfo>>(
                `/defi/quotation_v4?token=${tokenAddress}`
            );

            if (!response.data.success || !response.data.data) {
                return null;
            }

            return response.data.data;

        } catch (error) {
            logger.debug(`Token info fetch failed for ${tokenAddress}:`, error);
            return null;
        }
    }

    async getWalletPnl(walletAddress: string): Promise<{
        totalPnl: number;
        pnl24h: number;
        winRate: number;
        totalTrades: number;
    } | null> {
        try {
            const response = await this.client.get<GMGNApiResponse<any>>(
                `/defi/quotation/v1/smartmoney/sol/walletNew/${walletAddress}`
            );

            if (!response.data.success || !response.data.data) {
                return null;
            }

            const data = response.data.data;

            return {
                totalPnl: parseFloat(data.pnl || '0'),
                pnl24h: parseFloat(data.pnl_24h || '0'),
                winRate: parseFloat(data.winrate || '0'),
                totalTrades: parseInt(data.trade_count || '0'),
            };

        } catch (error) {
            logger.debug(`Wallet PnL fetch failed for ${walletAddress}:`, error);
            return null;
        }
    }

    async getTrendingTokens(limit: number = 20): Promise<TokenInfo[]> {
        try {
            const response = await this.client.get<GMGNApiResponse<TokenInfo[]>>(
                `/defi/quotation/v1/tokens/sol/trending?limit=${limit}`
            );

            if (!response.data.success || !response.data.data) {
                return [];
            }

            return response.data.data;

        } catch (error) {
            logger.error('❌ Failed to get trending tokens:', error);
            return [];
        }
    }

    async getSmartMoneyTrades(limit: number = 50): Promise<any[]> {
        try {
            const response = await this.client.get<GMGNApiResponse<any[]>>(
                `/defi/quotation/v1/smartmoney/sol/walletNew?limit=${limit}&orderby=pnl_24h`
            );

            if (!response.data.success || !response.data.data) {
                return [];
            }

            return response.data.data;

        } catch (error) {
            logger.error('❌ Failed to get smart money trades:', error);
            return [];
        }
    }

    // Method to check if token is a potential honeypot
    async checkTokenSafety(tokenAddress: string): Promise<{
        isHoneypot: boolean;
        riskScore: number;
        warnings: string[];
    }> {
        try {
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            if (!tokenInfo) {
                return {
                    isHoneypot: true,
                    riskScore: 100,
                    warnings: ['Unable to fetch token info'],
                };
            }

            const warnings: string[] = [];
            let riskScore = 0;

            // Check basic safety indicators
            if (!tokenInfo.liquidity || tokenInfo.liquidity < 10000) {
                warnings.push('Low liquidity');
                riskScore += 30;
            }

            if (!tokenInfo.volume24h || tokenInfo.volume24h < 1000) {
                warnings.push('Low 24h volume');
                riskScore += 20;
            }

            if (!tokenInfo.holderCount || tokenInfo.holderCount < 100) {
                warnings.push('Low holder count');
                riskScore += 25;
            }

            // Check for suspicious price movements
            if (tokenInfo.change24h && Math.abs(tokenInfo.change24h) > 50) {
                warnings.push('High price volatility');
                riskScore += 15;
            }

            const isHoneypot = riskScore >= 70;

            return {
                isHoneypot,
                riskScore,
                warnings,
            };

        } catch (error) {
            logger.error('❌ Token safety check failed:', error);
            return {
                isHoneypot: true,
                riskScore: 100,
                warnings: ['Safety check failed'],
            };
        }
    }

    private setupInterceptors(): void {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                logger.debug(`🌐 GMGN API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('🌐 GMGN API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                logger.debug(`🌐 GMGN API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                if (error.response) {
                    logger.error(`🌐 GMGN API Error ${error.response.status}:`, error.response.data);

                    // Handle specific error cases
                    switch (error.response.status) {
                        case 429:
                            logger.warn('⚠️ GMGN API rate limit exceeded');
                            break;
                        case 500:
                            logger.error('❌ GMGN API server error');
                            break;
                        case 503:
                            logger.warn('⚠️ GMGN API temporarily unavailable');
                            break;
                    }
                } else if (error.request) {
                    logger.error('🌐 GMGN API Network Error:', error.message);
                }

                return Promise.reject(error);
            }
        );
    }

    // Health check method
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.get('/health', { timeout: 5000 });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    getStatus(): {
        initialized: boolean;
        baseURL: string;
        lastError?: string;
    } {
        return {
            initialized: this.isInitialized,
            baseURL: this.client.defaults.baseURL || '',
        };
    }

    async shutdown(): Promise<void> {
        logger.info('🌐 Shutting down GMGN Service...');
        this.isInitialized = false;
        logger.info('✅ GMGN Service shutdown complete');
    }
}