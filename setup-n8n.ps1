# n8n Setup Script for Job Search Automation (Windows PowerShell)
# This script sets up n8n with Docker and creates initial workflows

Write-Host "🚀 Setting up n8n for Job Search Automation..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Create .env.n8n.local if it doesn't exist
if (!(Test-Path ".env.n8n.local")) {
    Write-Host "📝 Creating local environment file..." -ForegroundColor Yellow
    Copy-Item ".env.n8n" ".env.n8n.local"
    Write-Host "⚠️  Please edit .env.n8n.local with your API keys before starting n8n" -ForegroundColor Yellow
}

# Create necessary directories
New-Item -ItemType Directory -Force -Path "workflows" | Out-Null
New-Item -ItemType Directory -Force -Path "n8n-data" | Out-Null

# Start n8n with Docker Compose
Write-Host "🐳 Starting n8n container..." -ForegroundColor Cyan
docker-compose -f docker-compose.n8n.yml --env-file .env.n8n.local up -d

# Wait for n8n to start
Write-Host "⏳ Waiting for n8n to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check if n8n is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5678" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ n8n is running successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Access n8n at: http://localhost:5678" -ForegroundColor Cyan
    Write-Host "👤 Username: admin (or your custom username)" -ForegroundColor Cyan
    Write-Host "🔑 Password: Check your .env.n8n.local file" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Open http://localhost:5678 in your browser"
    Write-Host "2. Log in with your credentials"
    Write-Host "3. Import the job search workflow templates"
    Write-Host "4. Configure your API credentials in n8n settings"
    Write-Host ""
    Write-Host "🔧 To stop n8n: docker-compose -f docker-compose.n8n.yml down" -ForegroundColor Magenta
    Write-Host "🔄 To restart: docker-compose -f docker-compose.n8n.yml restart" -ForegroundColor Magenta

    # Open browser automatically
    Start-Process "http://localhost:5678"

} catch {
    Write-Host "❌ n8n failed to start. Check the logs:" -ForegroundColor Red
    Write-Host "docker logs jobsearch-n8n" -ForegroundColor Red
}