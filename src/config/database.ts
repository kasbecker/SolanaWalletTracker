// src/config/database.ts - Database configuration
export interface DatabaseConfig {
    type: 'sqlite' | 'postgresql';
    sqlite?: {
        filename: string;
        maxConnections: number;
    };
    postgresql?: {
        connectionString: string;
        maxConnections: number;
        ssl: boolean;
    };
}

export const databaseConfig: DatabaseConfig = {
    // Use SQLite for development, PostgreSQL for production
    type: (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) ? 'postgresql' : 'sqlite',

    sqlite: {
        filename: process.env.SQLITE_DB_PATH || 'src/database/copy_trading.db',
        maxConnections: 10,
    },

    postgresql: {
        connectionString: process.env.DATABASE_URL || '',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        ssl: process.env.NODE_ENV === 'production',
    },
};

// Database table names
export const tables = {
    holdings: 'holdings',
    positions: 'positions',
    trades: 'trades',
    risk_metrics: 'risk_metrics',
    wallet_snapshots: 'wallet_snapshots',
} as const;

// Migration settings
export const migrationConfig = {
    migrationsPath: 'src/database/migrations',
    tableName: 'migrations',
};