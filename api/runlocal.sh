#!/bin/bash

# Function to handle cleanup on exit
cleanup() {
  echo "Cleaning up..."
  # Find and kill any process using port 3010
  lsof -ti:3010 | xargs kill -9 2>/dev/null || true
  echo "Port 3010 has been released."
  exit 0
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT SIGTERM EXIT

# Database Configuration
export DB_HOST=localhost
export DB_USER=root
export DB_PASS=root
export DB_NAME=codepushdb

# Local Storage Configuration
export STORAGE_PROVIDER=local
export LOCAL_STORAGE_PATH="./JsonStorage.json"

# Other settings
export PORT=3010
export EMULATED=true
export NODE_ENV=development
export LOCAL_GOOGLE_TOKEN="mock-google-token"
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Check if port 3010 is already in use and release it
if lsof -ti:3010 >/dev/null; then
  echo "Port 3010 is already in use. Attempting to release it..."
  lsof -ti:3010 | xargs kill -9
  sleep 1
  echo "Port released."
fi

# Seed the JsonStorage with sample data
echo "→ Seeding JsonStorage with sample data"
echo "# This will populate the following:"
echo "# - Accounts, apps, deployments, and packages"
echo "# - Deployment keys that match API requests"
npx ts-node script/storage/seedDataLocal.ts

echo "Starting Code Push Server with Local JSON storage..."
echo "→ Storage will be saved to ${LOCAL_STORAGE_PATH}"

# Build TypeScript before starting server
echo "Building TypeScript files..."
npm run build

# Start server with local storage configuration
echo "Press Ctrl+C to stop and cleanup"
npm start 