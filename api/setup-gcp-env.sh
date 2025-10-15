#!/bin/bash
# GCP Environment Variables Setup Script
# Run: source setup-gcp-env.sh

echo "🔧 Setting up GCP environment variables..."

# GCP Storage Configuration
export STORAGE_TYPE=gcp
export GCP_PROJECT_ID=codepush-local-dev
export GCS_BUCKET_NAME=codepush-local-bucket
export STORAGE_EMULATOR_HOST=http://localhost:4443

# Database Configuration (matching Docker setup)
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=codepushdb
export DB_USER=root
export DB_PASS=root

# Application Configuration
export NODE_ENV=development
export PORT=3000

# Terms and Login Configuration
export CURRENT_TERMS_VERSION=v1.0
export LOGIN_AUTHORIZED_DOMAINS=dream11.com

# Disable authentication for local emulator
export GOOGLE_APPLICATION_CREDENTIALS=
export GCLOUD_PROJECT=codepush-local-dev

echo "✅ Environment variables set!"
echo "🧪 You can now run: npx ts-node test-gcp-connection.ts"
