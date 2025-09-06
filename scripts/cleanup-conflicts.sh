#!/bin/bash

echo "🧹 Cleaning up conflicting files..."

# Create backup directory
mkdir -p backup/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backup/$(date +%Y%m%d_%H%M%S)"

# Move conflicting advanced files to backup
if [ -d "src/core" ]; then
    echo "Moving src/core to backup..."
    mv src/core "$BACKUP_DIR/"
fi

if [ -d "src/services" ] && [ -f "src/services/TradingEngine.ts" ]; then
    echo "Moving advanced services to backup..."
    mv src/services "$BACKUP_DIR/"
fi

if [ -d "src/integrations" ]; then
    echo "Moving src/integrations to backup..."
    mv src/integrations "$BACKUP_DIR/"
fi

if [ -f "src/config/index.ts" ]; then
    echo "Moving complex config to backup..."
    mv src/config "$BACKUP_DIR/"
fi

# Remove src/src directory if it exists
if [ -d "src/src" ]; then
    echo "Removing duplicate src/src directory..."
    rm -rf src/src
fi

# Keep only the simple files we need
echo "✅ Cleanup completed. Advanced files backed up to $BACKUP_DIR"
echo "📁 Remaining structure:"
find src -type f -name "*.ts" | sort