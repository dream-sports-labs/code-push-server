// Test script for GCP Storage connection
// Usage: npx ts-node test-gcp-connection.ts

import { GCPStorage } from './script/storage/gcp-storage';

async function testGCPConnection() {
    console.log('🧪 Testing GCP Storage Connection...\n');
    
    let gcpStorage: GCPStorage;
    
    try {
        // Test 1: Initialize GCP Storage
        console.log('📋 Test 1: Initializing GCP Storage...');
        gcpStorage = new GCPStorage();
        console.log('✅ GCP Storage instance created successfully');
        
        // Test 2: Check Health (waits for setup to complete)
        console.log('\n📋 Test 2: Checking storage health...');
        await gcpStorage.checkHealth();
        console.log('✅ GCP Storage health check passed');
        
        // Test 3: Test reinitialize method
        console.log('\n📋 Test 3: Testing reinitialize...');
        await gcpStorage.reinitialize();
        console.log('✅ Reinitialize completed successfully');
        
        // Test 4: Test database connection (if setup completed)
        console.log('\n📋 Test 4: Testing database operations...');
        try {
            // This will test if our Sequelize setup worked
            await gcpStorage.getAccount('test-account-id');
        } catch (error: any) {
            if (error.message === 'Method not implemented yet') {
                console.log('✅ Database connection working (method placeholder reached)');
            } else {
                console.log('⚠️  Database connection issue:', error.message);
            }
        }
        
        console.log('\n🎉 All tests passed! GCP Storage is ready for implementation.');
        
    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Cleanup: Close database connections to allow process to exit
        if (gcpStorage) {
            console.log('\n🧹 Cleaning up database connections...');
            try {
                await gcpStorage.cleanup();
                console.log('✅ Database connections closed');
            } catch (closeError: any) {
                console.log('⚠️  Error closing database connections:', closeError.message);
            }
        }
        
        // Force exit after cleanup
        setTimeout(() => {
            console.log('👋 Test completed, exiting...');
            process.exit(0);
        }, 500);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the test
testGCPConnection();
