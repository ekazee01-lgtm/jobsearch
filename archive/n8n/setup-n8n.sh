#!/bin/bash

# n8n Setup Script for Job Search Automation
# This script sets up n8n with Docker and creates initial workflows

echo "🚀 Setting up n8n for Job Search Automation..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"

# Create .env.n8n.local if it doesn't exist
if [ ! -f .env.n8n.local ]; then
    echo "📝 Creating local environment file..."
    cp .env.n8n .env.n8n.local
    echo "⚠️  Please edit .env.n8n.local with your API keys before starting n8n"
fi

# Create necessary directories
mkdir -p workflows
mkdir -p n8n-data

# Start n8n with Docker Compose
echo "🐳 Starting n8n container..."
docker-compose -f docker-compose.n8n.yml --env-file .env.n8n.local up -d

# Wait for n8n to start
echo "⏳ Waiting for n8n to start..."
sleep 10

# Check if n8n is running
if curl -f http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "✅ n8n is running successfully!"
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "📊 Access n8n at: http://localhost:5678"
    echo "👤 Username: admin (or your custom username)"
    echo "🔑 Password: Check your .env.n8n.local file"
    echo ""
    echo "📋 Next steps:"
    echo "1. Open http://localhost:5678 in your browser"
    echo "2. Log in with your credentials"
    echo "3. Import the job search workflow templates"
    echo "4. Configure your API credentials in n8n settings"
    echo ""
    echo "🔧 To stop n8n: docker-compose -f docker-compose.n8n.yml down"
    echo "🔄 To restart: docker-compose -f docker-compose.n8n.yml restart"
else
    echo "❌ n8n failed to start. Check the logs:"
    echo "docker logs jobsearch-n8n"
fi