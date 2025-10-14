# CodePush Server - Multi-Cloud Setup

This setup supports both AWS and GCP cloud stacks for local development.

## 🚀 Quick Start

### Using the Stack Manager (Recommended)

```bash
# Make the script executable (one time)
chmod +x stack-manager.sh

# Start with AWS stack (LocalStack)
./stack-manager.sh aws

# Start with GCP stack (fake-gcs-server)
./stack-manager.sh gcp

# Check status
./stack-manager.sh status

# Stop all services
./stack-manager.sh down
```

### Manual Docker Compose

```bash
# AWS Stack
docker-compose --profile aws up -d

# GCP Stack
docker-compose --profile gcp up -d

# Stop all
docker-compose --profile aws --profile gcp down
```

## 📋 Services & Ports

### Shared Services (Always Running)
- **MySQL**: `localhost:3306`
- **Redis**: `localhost:6379`

### AWS Stack (`--profile aws`)
- **LocalStack S3**: `http://localhost:4566`

### GCP Stack (`--profile gcp`)
- **fake-gcs-server**: `http://localhost:4443`

## 🔧 Environment Configuration

### AWS Development
```bash
# Copy AWS environment template
cp env.aws.example .env

# Key variables:
# STORAGE_TYPE=aws
# S3_ENDPOINT=http://localhost:4566
# S3_BUCKETNAME=codepush-local-bucket
```

### GCP Development
```bash
# Copy GCP environment template
cp env.gcp.example .env

# Key variables:
# STORAGE_TYPE=gcp
# STORAGE_EMULATOR_HOST=http://localhost:4443
# GCS_BUCKET_NAME=codepush-local-bucket
```

## 🧪 Testing the Setup

### Test AWS Stack (LocalStack)
```bash
# Install AWS CLI if not already installed
pip install awscli

# Test S3 connection
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket
aws --endpoint-url=http://localhost:4566 s3 ls
```

### Test GCP Stack (fake-gcs-server)
```bash
# Test GCS connection
curl http://localhost:4443/storage/v1/b

# Create a bucket
curl -X POST http://localhost:4443/storage/v1/b \
  -H "Content-Type: application/json" \
  -d '{"name": "test-bucket"}'

# List buckets
curl http://localhost:4443/storage/v1/b?project=codepush-local-dev
```

## 📂 Data Persistence

All services use Docker volumes for data persistence:

- **MySQL data**: `db_data` volume
- **LocalStack data**: `localstack_data` volume  
- **GCS data**: `gcs_data` volume

Data persists between container restarts but is removed when volumes are deleted.

## 🔄 Switching Between Stacks

```bash
# Stop current stack
./stack-manager.sh down

# Switch to different stack
./stack-manager.sh aws    # or gcp

# Update your .env file accordingly
cp env.aws.example .env   # for AWS
# OR
cp env.gcp.example .env   # for GCP
```

## 🐛 Troubleshooting

### Port Conflicts
If you get port binding errors:
```bash
# Check what's using the ports
lsof -i :4566  # LocalStack
lsof -i :4443  # fake-gcs-server
lsof -i :3306  # MySQL
lsof -i :6379  # Redis

# Stop conflicting services or change ports in docker-compose.yml
```

### Container Issues
```bash
# View logs
./stack-manager.sh logs

# Or for specific service
docker-compose logs fake-gcs
docker-compose logs localstack
```

### Reset Everything
```bash
# Stop all services and remove volumes
docker-compose --profile aws --profile gcp down -v

# Remove all images (optional)
docker-compose --profile aws --profile gcp down --rmi all
```

## 📝 Next Steps

1. **Implement GCP Storage Class**: Create `gcp-storage.ts` implementing the Storage interface
2. **Update Application**: Modify your app to use the appropriate storage based on `STORAGE_TYPE` env var
3. **Add Tests**: Create integration tests for both AWS and GCP stacks
4. **Production Config**: Set up real AWS S3 and GCP Cloud Storage for production environments

## 🤝 Contributing

When adding new services:
1. Add them to the appropriate profile in `docker-compose.yml`
2. Update the stack manager script
3. Add environment variables to the example files
4. Update this documentation
