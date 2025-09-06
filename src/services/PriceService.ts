// src/services/PriceService.ts - Real-time price fetching and caching
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface TokenPrice {
    mint: string;
    priceUsd: number;
    change24h?: number;
    volume24h?: number;
    marketCap?: number;
    lastUpdated: Date;
}

export interface PriceCache {
    [mint: string]: {
        price: TokenPrice;
        expiry: number;
    };
}

export class PriceService {
    private cache: PriceCache = {};
    private client: AxiosInstance;
    private readonly CACHE_DURATION = 30000; // 30 seconds
    private readonly RATE_LIMIT_DELAY = 100; // 100ms between requests
    private lastRequestTime = 0;

    constructor() {
        this.client = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'SolanaWalletTracker/1.0.0',
            },
        });

        this.setupInterceptors();
    }

    async initialize(): Promise<void> {
        try {
            logger.info('💰 Initializing Price Service...');

            // Test connection with SOL price
            const solPrice = await this.getTokenPrice('So11111111111111111111111111111111111111112');
            logger.info(`✅ Price Service initialized - SOL: $${solPrice?.toFixed(2)}`);

        } catch (error) {
            logger.error('❌ Failed to initialize Price Service:', error);
            throw error;
        }
    }

    async getTokenPrice(mint: string): Promise<number | null> {
        try {
            // Check cache first
            const cached = this.getCachedPrice(mint);
            if (cached) {
                return cached.priceUsd;
            }

            // Rate limiting
            await this.respectRateLimit();

            // Fetch from multiple sources with fallback
            let price = await this.fetchFromJupiter(mint);

            if (!price) {
                price = await this.fetchFromGMGN(mint);
            }

            if (!price) {
                price = await this.fetchFromCoinGecko(mint);
            }

            if (price) {
                this.cachePrice(mint, price);
                return price.priceUsd;
            }

            logger.warn(`⚠️ Unable to fetch price for token: ${mint}`);
            return null;

        } catch (error) {
            logger.error(`❌ Error fetching price for ${mint}:`, error);
            return null;
        }
    }

    async getMultipleTokenPrices(mints: string[]): Promise<Map<string, number>> {
        const prices = new Map<string, number>();

        // Process in batches to respect rate limits
        const batchSize = 5;
        for (let i = 0; i < mints.length; i += batchSize) {
            const batch = mints.slice(i, i + batchSize);

            const batchPromises = batch.map(async (mint) => {
                const price = await this.getTokenPrice(mint);
                if (price) {
                    prices.set(mint, price);
                }
            });

            await Promise.all(batchPromises);

            // Small delay between batches
            if (i + batchSize < mints.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return prices;
    }

    async getSolPrice(): Promise<number> {
        const solMint = 'So11111111111111111111111111111111111111112';
        return (await this.getTokenPrice(solMint)) || 100; // Fallback to $100
    }

    async getTokenInfo(mint: string): Promise<TokenPrice | null> {
        try {
            const cached = this.getCachedPrice(mint);
            if (cached) {
                return cached;
            }

            await this.respectRateLimit();

            // Try GMGN first for comprehensive token info
            const gmgnInfo = await this.fetchDetailedInfoFromGMGN(mint);
            if (gmgnInfo) {
                this.cachePrice(mint, gmgnInfo);
                return gmgnInfo;
            }

            // Fallback to basic price
            const price = await this.getTokenPrice(mint);
            if (price) {
                const basicInfo: TokenPrice = {
                    mint,
                    priceUsd: price,
                    lastUpdated: new Date(),
                };
                return basicInfo;
            }

            return null;

        } catch (error) {
            logger.error(`❌ Error fetching token info for ${mint}:`, error);
            return null;
        }
    }

    private async fetchFromJupiter(mint: string): Promise<TokenPrice | null> {
        try {
            const response = await this.client.get(
                `https://price.jup.ag/v4/price?ids=${mint}`
            );

            if (response.data?.data?.[mint]) {
                const data = response.data.data[mint];
                return {
                    mint,
                    priceUsd: data.price,
                    lastUpdated: new Date(),
                };
            }

            return null;
        } catch (error) {
            logger.debug(`Jupiter price fetch failed for ${mint}:`, error);
            return null;
        }
    }

    private async fetchFromGMGN(mint: string): Promise<TokenPrice | null> {
        try {
            const response = await this.client.get(
                `https://gmgn.ai/defi/quotation/v1/tokens/sol/${mint}`
            );

            if (response.data?.data) {
                const data = response.data.data;
                return {
                    mint,
                    priceUsd: parseFloat(data.price),
                    change24h: parseFloat(data.price_change_percent_24h),
                    volume24h: parseFloat(data.volume_24h),
                    marketCap: parseFloat(data.market_cap),
                    lastUpdated: new Date(),
                };
            }

            return null;
        } catch (error) {
            logger.debug(`GMGN price fetch failed for ${mint}:`, error);
            return null;
        }
    }

    private async fetchFromCoinGecko(mint: string): Promise<TokenPrice | null> {
        try {
            // CoinGecko requires token IDs, not mints
            // This is a fallback for well-known tokens
            const knownTokens: { [mint: string]: string } = {
                'So11111111111111111111111111111111111111112': 'solana',
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
            };

            const coinId = knownTokens[mint];
            if (!coinId) return null;

            const response = await this.client.get(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
            );

            if (response.data?.[coinId]) {
                const data = response.data[coinId];
                return {
                    mint,
                    priceUsd: data.usd,
                    change24h: data.usd_24h_change,
                    volume24h: data.usd_24h_vol,
                    marketCap: data.usd_market_cap,
                    lastUpdated: new Date(),
                };
            }

            return null;
        } catch (error) {
            logger.debug(`CoinGecko price fetch failed for ${mint}:`, error);
            return null;
        }
    }

    private async fetchDetailedInfoFromGMGN(mint: string): Promise<TokenPrice | null> {
        try {
            const response = await this.client.get(
                `https://gmgn.ai/defi/quotation_v4?token=${mint}`
            );

            if (response.data?.data) {
                const data = response.data.data;
                return {
                    mint,
                    priceUsd: parseFloat(data.price),
                    change24h: parseFloat(data.price_change_percent_24h || '0'),
                    volume24h: parseFloat(data.volume_24h || '0'),
                    marketCap: parseFloat(data.market_cap || '0'),
                    lastUpdated: new Date(),
                };
            }

            return null;
        } catch (error) {
            logger.debug(`GMGN detailed info fetch failed for ${mint}:`, error);
            return null;
        }
    }

    private getCachedPrice(mint: string): TokenPrice | null {
        const cached = this.cache[mint];
        if (cached && Date.now() < cached.expiry) {
            return cached.price;
        }

        // Clean up expired cache entry
        if (cached) {
            delete this.cache[mint];
        }

        return null;
    }

    private cachePrice(mint: string, price: TokenPrice): void {
        this.cache[mint] = {
            price,
            expiry: Date.now() + this.CACHE_DURATION,
        };
    }

    private async respectRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
            const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    private setupInterceptors(): void {
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 429) {
                    logger.warn('⚠️ Rate limited by price API');
                }
                return Promise.reject(error);
            }
        );
    }

    getCacheStats(): { entries: number; hitRate: number } {
        const entries = Object.keys(this.cache).length;
        // Simple cache stats - could be enhanced with hit/miss tracking
        return { entries, hitRate: 0 };
    }

    clearCache(): void {
        this.cache = {};
        logger.info('🗑️ Price cache cleared');
    }

    async shutdown(): Promise<void> {
        logger.info('💰 Shutting down Price Service...');
        this.clearCache();
        logger.info('✅ Price Service shutdown complete');
    }
}