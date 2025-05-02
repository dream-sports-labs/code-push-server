#!/bin/bash

# Function to handle cleanup on exit
cleanup() {
  echo "Cleaning up..."
  
  # Kill Azurite if it was started by this script
  if [ -n "$AZURITE_PID" ]; then
    echo "Stopping Azurite (PID: $AZURITE_PID)..."
    kill $AZURITE_PID 2>/dev/null || true
  fi
  
  # Find and kill any process using port 3010
  lsof -ti:3010 | xargs kill -9 2>/dev/null || true
  echo "Port 3010 has been released."
  exit 0
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT SIGTERM EXIT

# Start Azurite in the background only if it's not already running
if ! pgrep -f "azurite" > /dev/null; then
  echo "Starting Azurite..."
  npx azurite --silent &
  AZURITE_PID=$!
  # Give Azurite time to start
  sleep 2
  echo "Azurite started."
else
  echo "Azurite is already running."
  AZURITE_PID=""
fi

# Database Configuration
export DB_HOST=localhost
export DB_USER=root
export DB_PASS=root
export DB_NAME=codepushdb

# Azure Storage Configuration
export STORAGE_PROVIDER=azure
export AZURE_STORAGE_CONNECTION_STRING=
export AZURE_STORAGE_TABLE_HOST="127.0.0.1:10002"
export EMULATED=true

export AZURE_STORAGE_ACCOUNT=devstoreaccount1
export AZURE_STORAGE_ACCESS_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;\
AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFTIazVE1UvGzGmZVOFIfuSRGNbr5mAZ1G21hZqGRZELWZ2Evwg==;\
TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
# Server Configuration
export PORT=3010
export NODE_ENV=development

# Check if port 3010 is already in use and release it
if lsof -ti:3010 >/dev/null; then
  echo "Port 3010 is already in use. Attempting to release it..."
  lsof -ti:3010 | xargs kill -9
  sleep 1
  echo "Port released."
fi

# Seed Azurite storage with sample data
echo "→ Seeding Azurite storage with sample data"
echo "# Seed Azurite storage with sample data"
echo "# This will populate the following:"
echo "# - Accounts, apps, deployments, and packages"
echo "# - Deployment keys that match API requests"
npx ts-node script/storage/seedDataAzure.ts

# Build TypeScript before starting server
echo "Building TypeScript files..."
npm run build

echo "Starting Code Push Server with Azure storage..."
echo "Press Ctrl+C to stop and cleanup"
npm start azure:env 