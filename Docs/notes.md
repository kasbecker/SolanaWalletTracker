Excellent question! Let's design a clean, scalable directory structure that builds on your existing foundation while adding the copy trading functionality. Here's the recommended directory tree:

## **🏗️ Recommended Directory Structure**

```
SolanaWalletTracker/
├── eslint.config.mjs
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
├── .env.example                    # NEW: Environment template
├── .env                           # NEW: Your actual config (gitignored)
├── docker/                        # NEW: Docker setup
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/                       # NEW: Utility scripts
│   ├── setup-database.sh
│   └── deploy.sh
├── src/
│   ├── config/                    # REFACTORED: Split config
│   │   ├── index.ts              # Main config export
│   │   ├── database.ts           # Database configuration
│   │   ├── trading.ts            # Trading parameters
│   │   └── wallets.ts            # Wallet addresses to track
│   ├── core/                     # RENAMED: Your existing core logic
│   │   ├── walletTracker.ts      # Your existing file (enhanced)
│   │   ├── types.ts              # Your existing types (enhanced)
│   │   └── index.ts              # Main entry point (your current index.ts)
│   ├── database/                 # ENHANCED: Database layer
│   │   ├── models/
│   │   │   ├── Holdings.ts       # Holdings model
│   │   │   ├── Positions.ts      # NEW: Trading positions
│   │   │   ├── Trades.ts         # NEW: Trade history
│   │   │   └── RiskMetrics.ts    # NEW: Risk tracking
│   │   ├── migrations/           # NEW: Database migrations
│   │   │   ├── 001_initial.sql
│   │   │   ├── 002_add_positions.sql
│   │   │   └── 003_add_trades.sql
│   │   ├── db.ts                 # Your existing db.ts (enhanced)
│   │   └── index.ts              # Database exports
│   ├── services/                 # NEW: Business logic services
│   │   ├── TradingEngine.ts      # Main copy trading logic
│   │   ├── PositionManager.ts    # Position tracking & management
│   │   ├── RiskManager.ts        # Risk controls & limits
│   │   ├── PriceService.ts       # Price fetching & calculations
│   │   └── index.ts              # Service exports
│   ├── integrations/             # NEW: External API integrations
│   │   ├── gmgn/
│   │   │   ├── GMGNService.ts    # GMGN API client
│   │   │   ├── types.ts          # GMGN specific types
│   │   │   └── index.ts
│   │   ├── jupiter/
│   │   │   ├── JupiterService.ts # Jupiter API client (alternative)
│   │   │   ├── types.ts          # Jupiter specific types
│   │   │   └── index.ts
│   │   └── solana/
│   │       ├── SolanaService.ts  # Enhanced Solana operations
│   │       ├── TransactionBuilder.ts # Transaction construction
│   │       └── index.ts
│   ├── utils/                    # NEW: Utility functions
│   │   ├── logger.ts             # Structured logging
│   │   ├── encryption.ts         # Private key encryption
│   │   ├── formatters.ts         # Display formatting
│   │   ├── validators.ts         # Input validation
│   │   └── index.ts
│   ├── api/                      # NEW: REST API (optional)
│   │   ├── routes/
│   │   │   ├── trading.ts        # Trading endpoints
│   │   │   ├── positions.ts      # Position endpoints
│   │   │   └── health.ts         # Health check
│   │   ├── middleware/
│   │   │   ├── auth.ts           # Authentication
│   │   │   ├── validation.ts     # Request validation
│   │   │   └── rateLimit.ts      # Rate limiting
│   │   └── server.ts             # Express server setup
│   ├── notifications/            # NEW: Alert system
│   │   ├── TelegramBot.ts        # Telegram notifications
│   │   ├── EmailService.ts       # Email alerts
│   │   └── index.ts
│   └── test.ts                   # Your existing test file
├── tests/                        # NEW: Test suite
│   ├── unit/
│   │   ├── services/
│   │   ├── integrations/
│   │   └── utils/
│   ├── integration/
│   │   ├── database.test.ts
│   │   └── trading.test.ts
│   └── setup/
│       ├── testDb.ts
│       └── mocks.ts
└── docs/                         # NEW: Documentation
    ├── API.md
    ├── DEPLOYMENT.md
    ├── CONFIGURATION.md
    └── TRADING_LOGIC.md
```

## **📁 Key Directory Explanations**

### **🔄 Refactored (Your Existing Files)**
```
src/core/
├── walletTracker.ts      # Enhanced with trade detection
├── types.ts              # Enhanced with trading types
└── index.ts              # Your main entry point (enhanced)
```

### **🆕 New Core Services**
```
src/services/
├── TradingEngine.ts      # Main copy trading orchestrator
├── PositionManager.ts    # Track open positions & PnL
├── RiskManager.ts        # Position sizing, stop losses, limits
└── PriceService.ts       # Real-time price data
```

### **🔌 External Integrations**
```
src/integrations/
├── gmgn/                 # GMGN.AI API integration
├── jupiter/              # Jupiter aggregator (backup)
└── solana/               # Enhanced Solana operations
```

### **🗄️ Enhanced Database**
```
src/database/
├── models/               # Data models
├── migrations/           # Schema evolution
└── db.ts                 # Your existing db.ts enhanced
```

## **🚀 Migration Strategy (Preserve Your Work)**

### **Step 1: Minimal Restructure (30 minutes)**
```bash
# Create new directories
mkdir -p src/{config,core,services,integrations,utils,database/models}

# Move existing files (preserve your work)
mv src/config.ts src/config/index.ts
mv src/types.ts src/core/types.ts
mv src/walletTracker.ts src/core/walletTracker.ts
mv src/index.ts src/core/index.ts
mv src/db.ts src/database/db.ts
```

### **Step 2: Add New Files Gradually**
```bash
# Week 1: Add core trading services
touch src/services/{TradingEngine,PositionManager,RiskManager}.ts

# Week 2: Add integrations
mkdir -p src/integrations/gmgn
touch src/integrations/gmgn/{GMGNService,types,index}.ts

# Week 3: Add utilities and API
touch src/utils/{logger,encryption,validators}.ts
```

### **Step 3: Enhanced Package.json Scripts**
```json
{
  "scripts": {
    "dev": "tsx watch src/core/index.ts",
    "build": "tsc",
    "start": "node dist/core/index.js",
    "start:api": "node dist/api/server.js",
    "test": "jest",
    "db:migrate": "node dist/database/migrations/run.js",
    "copy-trade": "node dist/services/TradingEngine.js"
  }
}
```

## **🎯 Immediate Next Steps (This Weekend)**

### **1. Quick Restructure (Keep Everything Working)**
```typescript
// src/config/index.ts (enhanced version of your config.ts)
export const config = {
  // Your existing wallet config
  wallets: [...],
  
  // NEW: Trading configuration
  trading: {
    enabled: false,              // Start disabled for safety
    maxCopyAmount: 100,          // Start small
    followPercentage: 0.05,      // 5% of original trade
    slippage: 0.01,             // 1% slippage
    priorityFee: 0.005,         // 0.005 SOL priority fee
  },
  
  // NEW: Risk management
  risk: {
    maxDailyLoss: 500,          // $500 daily loss limit
    maxPositions: 10,           // Max 10 open positions
    blacklistedTokens: [],      // Tokens to never trade
  }
};
```

### **2. Add Basic Trading Engine**
```typescript
// src/services/TradingEngine.ts (new file)
export class TradingEngine {
  async initialize() {
    console.log('🚀 Trading Engine initialized (MOCK MODE)');
  }
  
  async executeCopyTrade(walletTransaction: any) {
    console.log('🔄 Mock copy trade executed:', walletTransaction);
    // Start with console logs, add real execution later
  }
}
```

### **3. Connect to Your Existing WebSocket**
```typescript
// In your existing src/core/index.ts, add:
import { TradingEngine } from '../services/TradingEngine';

const tradingEngine = new TradingEngine();
await tradingEngine.initialize();

// In your existing WebSocket handler, add:
if (config.trading.enabled) {
  await tradingEngine.executeCopyTrade(transactionData);
}
```

## **📈 Benefits of This Structure**

1. **🔄 Preserves Your Work**: All existing functionality stays intact
2. **🏗️ Scalable**: Easy to add features without breaking existing code
3. **🧪 Testable**: Clear separation makes testing easy
4. **🔧 Maintainable**: Each service has a single responsibility
5. **🚀 Deployable**: Clean structure for Docker/production deployment

## **❓ Questions Before We Proceed**

1. **Database Preference**: Stick with SQLite or upgrade to PostgreSQL for production?
2. **API Preference**: Start with GMGN or Jupiter for swap execution?
3. **Notification Preference**: Telegram, email, or console logs initially?
4. **Safety Level**: Start with mock trades or real small amounts?

This structure will let you build incrementally while keeping your proven wallet tracking system running! What do you think about this approach?