# Priority MCP Server - Local Docker Deployment Script
# This script helps deploy the Priority MCP Server to your local PC using Docker

Write-Host "Priority MCP Server - Local Docker Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
try {
    docker ps | Out-Null
    Write-Host "✓ Docker daemon is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker daemon is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠ .env file not found" -ForegroundColor Yellow
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    
    $envContent = @"
# Priority API Configuration
PRIORITY_BASE_URL=https://priority.example.com/odata/Priority/tabula.ini/demo/
PRIORITY_AUTH_TYPE=basic
PRIORITY_USERNAME=api_user
PRIORITY_PASSWORD=secure_password

# Server Configuration
HTTP_PORT=3000
SSE_ENABLED=false

# Priority API Advanced Settings
PRIORITY_HTTP_TIMEOUT_MS=30000
TLS_REJECT_UNAUTHORIZED=false
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✓ Created .env file. Please edit it with your Priority API credentials." -ForegroundColor Green
    Write-Host ""
    Write-Host "Press any key to continue after editing .env file..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Get script directory and docker directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))
$DockerDir = Join-Path $ScriptDir "..\docker"

# Check if docker-compose.yml exists
if (-not (Test-Path (Join-Path $DockerDir "docker-compose.yml"))) {
    Write-Host "✗ docker-compose.yml not found at $DockerDir\docker-compose.yml" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Yellow
Write-Host ""

# Navigate to docker directory for docker-compose commands
Set-Location $DockerDir
if (-not $?) {
    Write-Host "✗ Failed to navigate to docker directory" -ForegroundColor Red
    exit 1
}

# Stop existing containers if any
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null

# Build and start
Write-Host "Building Docker image..." -ForegroundColor Yellow
docker-compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

Write-Host "Starting container..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start container" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Container started successfully" -ForegroundColor Green
Write-Host ""

# Wait a moment for the server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check health
Write-Host "Checking server health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Server is healthy and responding" -ForegroundColor Green
    } else {
        Write-Host "⚠ Server responded with status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not reach health endpoint (server may still be starting)" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Server is running at:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:     docker-compose logs -f priority-rest-api-mcp" -ForegroundColor White
Write-Host "  Stop server:   docker-compose down" -ForegroundColor White
Write-Host "  Restart:       docker-compose restart priority-rest-api-mcp" -ForegroundColor White
Write-Host "  Check status:  docker-compose ps" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see docker-deploy-local.md" -ForegroundColor Yellow
Write-Host ""

