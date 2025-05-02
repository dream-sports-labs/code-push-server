#!/usr/bin/env node

/**
 * Script to determine which storage provider to use and run the appropriate setup script
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the storage provider from environment variables
const provider = process.env.STORAGE_PROVIDER || 'local';

console.log(`🔍 Using storage provider: ${provider}`);

// Run the appropriate setup script
try {
  switch (provider) {
    case 'azure':
      execSync('./runazure.sh', { stdio: 'inherit', cwd: __dirname });
      break;
    case 'aws':
      execSync('./runaws.sh', { stdio: 'inherit', cwd: __dirname });
      break;
    default:
      execSync('./runlocal.sh', { stdio: 'inherit', cwd: __dirname });
      break;
  }
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
}
