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

# AWS Storage Configuration
export STORAGE_PROVIDER=aws
export AWS_ACCESS_KEY_ID=localstack
export AWS_SECRET_ACCESS_KEY=localstack
export S3_ENDPOINT=http://localhost:4566

# Other settings
export PORT=3010
export EMULATED=true
export NODE_ENV=development
export LOCAL_GOOGLE_TOKEN="mock-google-token"

# Check if LocalStack is running
if ! curl -s http://localhost:4566 > /dev/null; then
  echo "LocalStack is not running. Please start it with:"
  echo "docker run --rm -p 4566:4566 -p 4571:4571 localstack/localstack"
  exit 1
else
  echo "LocalStack detected at http://localhost:4566"
fi

# Check if port 3010 is already in use and release it
if lsof -ti:3010 >/dev/null; then
  echo "Port 3010 is already in use. Attempting to release it..."
  lsof -ti:3010 | xargs kill -9
  sleep 1
  echo "Port released."
fi

# Check if seed data script for AWS exists and run it
if [ -f "script/storage/seedDataAws.ts" ]; then
  echo "→ Seeding AWS storage with sample data"
  echo "# Seed AWS storage with sample data"
  echo "# This will populate the following:"
  echo "# - Accounts, apps, deployments, and packages"
  echo "# - Deployment keys that match API requests"
  npx ts-node script/storage/seedDataAws.ts
else
  echo "Warning: No AWS seed data script found at script/storage/seedDataAws.ts"
  echo "You may need to create this script or manually seed the data"
fi

# Build TypeScript before starting server
echo "Building TypeScript files..."
npm run build

# Start server with AWS configuration
echo "Starting Code Push Server with AWS storage..."
echo "Press Ctrl+C to stop and cleanup"
npm start aws:env 