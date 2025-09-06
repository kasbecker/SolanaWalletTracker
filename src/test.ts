// src/test.ts - Simple test file
import { checkMultipleOwnersForMint } from "./db";
import { getDoubleHoldings } from "./walletTracker";

async function runTests(): Promise<void> {
    console.log('🧪 Running basic tests...');

    try {
        // Test database connection
        console.log('Testing database...');
        const dups = await checkMultipleOwnersForMint();
        console.log(`✅ Database test passed - found ${dups.length} duplicate records`);

        // Test duplicate holdings
        console.log('Testing duplicate holdings...');
        const duplicates = await getDoubleHoldings();
        console.log(`✅ Duplicate holdings test passed - ${duplicates.duplicates.length} duplicates found`);

        console.log('✅ All tests passed!');
    } catch (error) {
        console.error('❌ Tests failed:', error);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}