// src/database/db.ts - Enhanced database operations
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { config } from "../config";
import {
    SplTokenHolding,
    WalletSnapshot,
    HoldingChange,
    HoldingsRepository
} from "./models/Holdings";
import {
    Position,
    PositionSummary,
    PositionRepository
} from "./models/Positions";
import {
    Trade,
    TradeStats,
    DailyTradeStats,
    TradeRepository
} from "./models/Trades";
import {
    RiskMetrics,
    RiskAlert,
    RiskRepository
} from "./models/RiskMetrics";

// Database connection singleton
let dbInstance: Database | null = null;

export const getDatabase = async (): Promise<Database> => {
    if (!dbInstance) {
        dbInstance = await open({
            filename: config.database.sqlite!.filename,
            driver: sqlite3.Database,
        });

        // Enable foreign keys and WAL mode for better performance
        await dbInstance.exec('PRAGMA foreign_keys = ON');
        await dbInstance.exec('PRAGMA journal_mode = WAL');
        await dbInstance.exec('PRAGMA synchronous = NORMAL');
        await dbInstance.exec('PRAGMA cache_size = 1000');

        // Initialize all tables
        await initializeTables(dbInstance);
    }

    return dbInstance;
};

// Initialize all database tables
const initializeTables = async (db: Database): Promise<void> => {
    // Holdings table (enhanced version of your existing table)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS holdings (
      address TEXT NOT NULL PRIMARY KEY UNIQUE,
      mint TEXT NOT NULL,
      owner TEXT NOT NULL,
      amount INTEGER NOT NULL,
      decimals INTEGER DEFAULT 9,
      ui_amount REAL,
      delegated_amount INTEGER DEFAULT 0,
      frozen INTEGER DEFAULT 0,
      price_usd REAL,
      value_usd REAL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_amount INTEGER DEFAULT 0,
      change_value_usd REAL DEFAULT 0
    );
  `);

    // Wallet snapshots table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      snapshot_date DATETIME NOT NULL,
      total_tokens INTEGER NOT NULL,
      total_value_usd REAL NOT NULL,
      sol_balance REAL NOT NULL,
      holdings TEXT NOT NULL, -- JSON
      portfolio_change_24h REAL,
      new_tokens_count INTEGER DEFAULT 0,
      sold_tokens_count INTEGER DEFAULT 0,
      UNIQUE(wallet_address, snapshot_date)
    );
  `);

    // Holding changes table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS holding_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')),
      amount_change INTEGER NOT NULL,
      value_usd_change REAL,
      price_usd REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      transaction_hash TEXT,
      is_copyable INTEGER DEFAULT 0,
      copy_trigger_reason TEXT
    );
  `);

    // Positions table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_mint TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      source_wallet TEXT NOT NULL,
      side TEXT NOT NULL DEFAULT 'LONG',
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED', 'PARTIAL', 'FAILED')),
      
      entry_price REAL NOT NULL,
      entry_amount REAL NOT NULL,
      entry_value REAL NOT NULL,
      entry_timestamp DATETIME NOT NULL,
      entry_tx_hash TEXT,
      
      current_price REAL,
      current_value REAL,
      unrealized_pnl REAL,
      unrealized_pnl_percent REAL,
      
      exit_price REAL,
      exit_amount REAL,
      exit_value REAL,
      exit_timestamp DATETIME,
      exit_tx_hash TEXT,
      realized_pnl REAL,
      realized_pnl_percent REAL,
      
      stop_loss_price REAL,
      take_profit_price REAL,
      max_loss_usd REAL,
      
      copy_trade_id TEXT,
      notes TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Trades table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id TEXT UNIQUE NOT NULL,
      copy_trade_id TEXT,
      source_wallet TEXT NOT NULL,
      
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
      token_mint TEXT NOT NULL,
      input_token TEXT NOT NULL,
      output_token TEXT NOT NULL,
      
      input_amount INTEGER NOT NULL,
      output_amount INTEGER NOT NULL,
      input_amount_ui REAL NOT NULL,
      output_amount_ui REAL NOT NULL,
      
      price_usd REAL NOT NULL,
      total_value_usd REAL NOT NULL,
      slippage REAL NOT NULL,
      price_impact REAL NOT NULL,
      
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
      tx_hash TEXT,
      block_number INTEGER,
      timestamp DATETIME NOT NULL,
      execution_time_ms INTEGER,
      
      priority_fee REAL NOT NULL,
      network_fee REAL NOT NULL,
      total_fees_usd REAL NOT NULL,
      
      source_trade_data TEXT, -- JSON
      liquidity_usd REAL,
      volume_usd_24h REAL,
      holder_count INTEGER,
      is_honeypot INTEGER,
      risk_score INTEGER,
      
      error_message TEXT,
      error_code TEXT,
      retry_count INTEGER DEFAULT 0,
      
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Risk metrics table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS risk_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      
      daily_trade_count INTEGER DEFAULT 0,
      daily_volume_usd REAL DEFAULT 0,
      daily_loss_usd REAL DEFAULT 0,
      daily_profit_usd REAL DEFAULT 0,
      daily_net_pnl REAL DEFAULT 0,
      
      open_positions_count INTEGER DEFAULT 0,
      total_exposure_usd REAL DEFAULT 0,
      max_single_position_usd REAL DEFAULT 0,
      
      portfolio_risk_ratio REAL DEFAULT 0,
      concentration_risk REAL DEFAULT 0,
      win_rate REAL DEFAULT 0,
      avg_position_size_usd REAL DEFAULT 0,
      
      daily_limit_violations INTEGER DEFAULT 0,
      risk_limit_violations INTEGER DEFAULT 0,
      stop_loss_triggered INTEGER DEFAULT 0,
      
      sharpe_ratio REAL,
      max_drawdown REAL,
      volatility REAL,
      
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Risk alerts table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS risk_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      message TEXT NOT NULL,
      current_value REAL NOT NULL,
      limit_value REAL NOT NULL,
      token_mint TEXT,
      position_id INTEGER,
      
      is_active INTEGER DEFAULT 1,
      acknowledged_at DATETIME,
      resolved_at DATETIME,
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Create indexes for better performance
    await createIndexes(db);
};

const createIndexes = async (db: Database): Promise<void> => {
    // Holdings indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_holdings_owner ON holdings(owner)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_holdings_mint ON holdings(mint)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_holdings_owner_mint ON holdings(owner, mint)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_holdings_last_updated ON holdings(last_updated)');

    // Wallet snapshots indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_snapshots_wallet_date ON wallet_snapshots(wallet_address, snapshot_date)');

    // Holding changes indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_changes_wallet ON holding_changes(wallet_address)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON holding_changes(timestamp)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_changes_copyable ON holding_changes(is_copyable)');

    // Positions indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_positions_token ON positions(token_mint)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_positions_source ON positions(source_wallet)');

    // Trades indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_mint)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_trades_copy_id ON trades(copy_trade_id)');

    // Risk metrics indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_risk_date ON risk_metrics(date)');

    // Risk alerts indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_active ON risk_alerts(is_active)');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON risk_alerts(severity)');
};

// Your existing functions enhanced
export async function createHoldingsTable(database: Database): Promise<boolean> {
    // This function is now handled in initializeTables
    return true;
}

export async function updateHoldings(
    holdings: SplTokenHolding[],
    walletAddress: string
): Promise<{ success: boolean; added: SplTokenHolding[]; removed: string[]; msg: string }> {
    try {
        const db = await getDatabase();

        // Get current tokens from the database
        const currentTokens = await db.all<{ address: string }[]>(
            `SELECT address FROM holdings WHERE owner = ?`, [walletAddress]
        );
        const currentAddresses = new Set(currentTokens.map((row) => row.address));

        // Extract incoming addresses
        const incomingAddresses = new Set(holdings.map((holding) => holding.address));

        // Find added and removed holdings
        const addedTokens = holdings.filter((holding) => !currentAddresses.has(holding.address));
        const removedTokens = Array.from(currentAddresses).filter((address) => !incomingAddresses.has(address));

        // Remove tokens no longer present
        if (removedTokens.length > 0) {
            const placeholders = removedTokens.map(() => "?").join(",");
            await db.run(
                `DELETE FROM holdings WHERE owner = ? AND address IN (${placeholders})`,
                walletAddress, ...removedTokens
            );
        }

        // Insert or update incoming tokens
        const upsertStatement = `
      INSERT INTO holdings (
        address, mint, owner, amount, decimals, ui_amount, 
        delegated_amount, frozen, price_usd, value_usd, last_updated
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(address) DO UPDATE SET
        amount = excluded.amount,
        ui_amount = excluded.ui_amount,
        delegated_amount = excluded.delegated_amount,
        frozen = excluded.frozen,
        price_usd = excluded.price_usd,
        value_usd = excluded.value_usd,
        last_updated = CURRENT_TIMESTAMP
    `;

        for (const holding of holdings) {
            await db.run(upsertStatement, [
                holding.address,
                holding.mint,
                holding.owner,
                holding.amount,
                holding.decimals || 9,
                holding.uiAmount || (holding.amount / Math.pow(10, holding.decimals || 9)),
                holding.delegated_amount,
                holding.frozen ? 1 : 0,
                holding.priceUsd || null,
                holding.valueUsd || null,
            ]);
        }

        return {
            success: true,
            added: addedTokens,
            removed: removedTokens,
            msg: `Updated holdings: +${addedTokens.length} -${removedTokens.length}`,
        };
    } catch (error: any) {
        return {
            success: false,
            added: [],
            removed: [],
            msg: "Error updating holdings: " + error.message,
        };
    }
}

export async function getDoubleHoldings(): Promise<{ success: boolean; duplicates: any[]; msg: string }> {
    try {
        const db = await getDatabase();

        const duplicates = await db.all(`
      SELECT mint, GROUP_CONCAT(owner) as owners
      FROM holdings 
      GROUP BY mint 
      HAVING COUNT(DISTINCT owner) >= ?
    `, [config.settings.show_duplicate_min_holders]);

        const result = duplicates.map(row => ({
            mint: row.mint,
            owners: row.owners.split(',')
        }));

        return { success: true, duplicates: result, msg: "success" };
    } catch (error: any) {
        return { success: false, duplicates: [], msg: error.message };
    }
}

// New function to clean up old data
export async function cleanupOldData(daysToKeep: number = 30): Promise<void> {
    const db = await getDatabase();
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

    // Clean up old snapshots
    await db.run('DELETE FROM wallet_snapshots WHERE snapshot_date < ?', [cutoffDate]);

    // Clean up old holding changes
    await db.run('DELETE FROM holding_changes WHERE timestamp < ?', [cutoffDate]);

    // Clean up old resolved alerts
    await db.run('DELETE FROM risk_alerts WHERE resolved_at < ? AND is_active = 0', [cutoffDate]);

    // Clean up old risk metrics (keep daily summaries)
    await db.run('DELETE FROM risk_metrics WHERE created_at < ?', [cutoffDate]);

    // Vacuum database to reclaim space
    await db.exec('VACUUM');
}

// Enhanced error handling
export async function closeDatabase(): Promise<void> {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}

// Database health check
export async function checkDatabaseHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    stats: {
        holdingsCount: number;
        positionsCount: number;
        tradesCount: number;
        alertsCount: number;
    };
}> {
    try {
        const db = await getDatabase();
        const issues: string[] = [];

        // Check table integrity
        const integrityCheck = await db.get('PRAGMA integrity_check');
        if (integrityCheck.integrity_check !== 'ok') {
            issues.push('Database integrity check failed');
        }

        // Get stats
        const holdingsCount = await db.get('SELECT COUNT(*) as count FROM holdings');
        const positionsCount = await db.get('SELECT COUNT(*) as count FROM positions');
        const tradesCount = await db.get('SELECT COUNT(*) as count FROM trades');
        const alertsCount = await db.get('SELECT COUNT(*) as count FROM risk_alerts WHERE is_active = 1');

        // Check for orphaned records
        const orphanedHoldings = await db.get(`
      SELECT COUNT(*) as count FROM holdings h 
      WHERE NOT EXISTS (
        SELECT 1 FROM wallet_snapshots w 
        WHERE w.wallet_address = h.owner 
        AND w.snapshot_date >= date('now', '-7 days')
      )
    `);

        if (orphanedHoldings.count > 100) {
            issues.push(`${orphanedHoldings.count} potentially orphaned holdings found`);
        }

        return {
            isHealthy: issues.length === 0,
            issues,
            stats: {
                holdingsCount: holdingsCount.count,
                positionsCount: positionsCount.count,
                tradesCount: tradesCount.count,
                alertsCount: alertsCount.count,
            }
        };
    } catch (error) {
        return {
            isHealthy: false,
            issues: [`Database health check failed: ${error}`],
            stats: { holdingsCount: 0, positionsCount: 0, tradesCount: 0, alertsCount: 0 }
        };
    }
}

/*
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "../config";
import { DuplicateOwnerMintRecord, SplTokenHolding, SplTokenStoreReponse } from "../core/types";

// Holdings
export async function createHoldingsTable(database: any): Promise<boolean> {
  try {
    await database.exec(`
        CREATE TABLE IF NOT EXISTS holdings (
            address TEXT NOT NULL PRIMARY KEY UNIQUE,
            mint TEXT NOT NULL,
            owner TEXT NOT NULL,
            amount INTEGER,
            delegated_amount INTEGER,
            frozen INTEGER DEFAULT 0
        );
      `);

    return true;
  } catch (error: any) {
    console.error("Error creating TokenData table:", error);
    return false;
  }
}
export async function updateHoldings(holdings: SplTokenHolding[], walletAddress: string): Promise<SplTokenStoreReponse> {
  try {
    const db = await open({
      filename: config.db.db_name_tracker_transfers,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const transfersTableExist = await createHoldingsTable(db);
    if (!transfersTableExist) {
      await db.close();
      throw new Error("Could not create transfers table.");
    }

    // Get current tokens from the database
    const currentTokens = await db.all<{ address: string }[]>(`SELECT address FROM holdings WHERE owner="${walletAddress}"`);
    const currentAddresses = new Set(currentTokens.map((row) => row.address));

    // Extract incoming addresses
    const incomingAddresses = new Set(holdings.map((holding) => holding.address));

    // Find added and removed holdings
    const addedTokens = holdings.filter((holding) => !currentAddresses.has(holding.address));
    const removedTokens = Array.from(currentAddresses).filter((address) => !incomingAddresses.has(address));

    // Remove tokens no longer present in the incoming array
    if (removedTokens.length > 0) {
      const placeholders = removedTokens.map(() => "?").join(",");
      await db.run(`DELETE FROM holdings WHERE owner="${walletAddress}" AND address IN (${placeholders})`, ...removedTokens);
    }

    // Insert or update incoming tokens
    const upsertStatement = `
      INSERT INTO holdings (address, mint, owner, amount, delegated_amount, frozen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        mint = excluded.mint,
        owner = excluded.owner,
        amount = excluded.amount,
        delegated_amount = excluded.delegated_amount,
        frozen = excluded.frozen
    `;

    for (const token of holdings) {
      await db.run(upsertStatement, token.address, token.mint, token.owner, token.amount, token.delegated_amount, token.frozen);
    }

    // Close the database connection
    await db.close();

    // Return data
    const returnData: SplTokenStoreReponse = {
      added: addedTokens,
      removed: removedTokens,
      msg: "success",
      success: true,
    };

    return returnData;
  } catch (error: any) {
    // Return data
    const returnData: SplTokenStoreReponse = {
      added: [],
      removed: [],
      msg: "Error: " + error.message,
      success: false,
    };
    return returnData;
  }
}
export async function checkMultipleOwnersForMint(): Promise<DuplicateOwnerMintRecord[]> {
  const db = await open({
    filename: config.db.db_name_tracker_transfers,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const transfersTableExist = await createHoldingsTable(db);
  if (!transfersTableExist) {
    await db.close();
    throw new Error("Could not create transfers table.");
  }

  try {
    const query = `
      SELECT mint, owner
      FROM holdings
      WHERE mint IN (
        SELECT mint
        FROM holdings
        GROUP BY mint
        HAVING COUNT(DISTINCT owner) >= 2
      )
    `;

    const rows = await db.all(query);

    // If there are rows with multiple owners for the same mint, return them
    if (rows.length > 0) {
      return rows; // Rows will contain mint and owner
    }

    return []; // No mints with 2 or more owners
  } catch (error: any) {
    console.error("Error checking multiple owners for mint:", error);
    return [];
  }
}
export async function clearHoldingsTable(): Promise<boolean> {
  try {
    const db = await open({
      filename: config.db.db_name_tracker_transfers,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const transfersTableExist = await createHoldingsTable(db);
    if (!transfersTableExist) {
      await db.close();
      throw new Error("Could not create transfers table.");
    }

    await db.exec(`
        DELETE FROM holdings;
    `);

    return true;
  } catch (error: any) {
    console.error("Error clearing the holdings table:", error);
    return false;
  }
}
*/
