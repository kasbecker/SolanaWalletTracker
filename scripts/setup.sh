#!/bin/bash

set -e

echo "🚀 Setting up Solana Wallet Tracker..."

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p src/db
mkdir -p logs
mkdir -p dist

# Copy environment template
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
else
    echo "✅ .env file already exists"
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Edit .env file with your Helius API key"
echo "  2. Configure your wallets in .env"
echo "  3. Run: npm run dev"
echo ""