#!/bin/bash

# CodePush Server Stack Manager
# Usage: ./stack-manager.sh [aws|gcp|down|status]

set -e

COMPOSE_FILE="docker-compose.yml"

show_help() {
    echo "CodePush Server Stack Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  aws       Start with AWS stack (LocalStack S3)"
    echo "  gcp       Start with GCP stack (fake-gcs-server)"
    echo "  down      Stop all services"
    echo "  status    Show running services"
    echo "  logs      Show logs for all services"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 aws        # Start with LocalStack for S3 emulation"
    echo "  $0 gcp        # Start with fake-gcs-server for GCS emulation"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed or not in PATH"
        exit 1
    fi
}

start_aws() {
    echo "🚀 Starting CodePush Server with AWS stack..."
    echo "📦 Services: MySQL, Redis, LocalStack (S3)"
    
    docker-compose --profile aws up -d
    
    echo ""
    echo "✅ AWS Stack started successfully!"
    echo "🔗 Services available at:"
    echo "   📊 MySQL:     localhost:3306"
    echo "   🔴 Redis:     localhost:6379"
    echo "   ☁️  S3 (LocalStack): http://localhost:4566"
    echo ""
    echo "🧪 Test S3 connection:"
    echo "   aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket"
}

start_gcp() {
    echo "🚀 Starting CodePush Server with GCP stack..."
    echo "📦 Services: MySQL, Redis, fake-gcs-server"
    
    docker-compose --profile gcp up -d
    
    echo ""
    echo "✅ GCP Stack started successfully!"
    echo "🔗 Services available at:"
    echo "   📊 MySQL:     localhost:3306"
    echo "   🔴 Redis:     localhost:6379"
    echo "   ☁️  GCS (fake-gcs): http://localhost:4443"
    echo ""
    echo "🧪 Test GCS connection:"
    echo "   curl http://localhost:4443/storage/v1/b"
}

stop_all() {
    echo "🛑 Stopping all CodePush Server services..."
    
    docker-compose --profile aws --profile gcp down
    
    echo "✅ All services stopped!"
}

show_status() {
    echo "📊 CodePush Server Status:"
    echo ""
    
    if docker-compose ps | grep -q "Up"; then
        docker-compose ps
    else
        echo "❌ No services are currently running"
        echo ""
        echo "💡 Start services with:"
        echo "   $0 aws       # For AWS stack"
        echo "   $0 gcp       # For GCP stack"
    fi
}

show_logs() {
    echo "📋 Showing logs for all services..."
    docker-compose --profile aws --profile gcp logs -f
}

# Main script logic
case "${1:-help}" in
    "aws")
        check_docker
        start_aws
        ;;
    "gcp")
        check_docker
        start_gcp
        ;;
    "down"|"stop")
        check_docker
        stop_all
        ;;
    "status")
        check_docker
        show_status
        ;;
    "logs")
        check_docker
        show_logs
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
