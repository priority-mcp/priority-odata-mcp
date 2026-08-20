# Import Priority API Collection to Postman via CLI
# This script pushes the collection and environment to Postman Cloud workspace

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Priority API - Import to Postman via CLI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Postman CLI is installed
Write-Host "Checking Postman CLI..." -ForegroundColor Yellow
$postmanVersion = postman --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Postman CLI found: $postmanVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Postman CLI is not installed" -ForegroundColor Red
    Write-Host "Please install from: https://www.postman.com/downloads/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

Write-Host "IMPORTANT: This script will push to Postman Cloud workspace." -ForegroundColor Yellow
Write-Host "You need to be logged in to Postman Cloud." -ForegroundColor Yellow
Write-Host ""

# Check if user wants to continue
$response = Read-Host "Do you want to push to Postman Cloud? (y/n)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CollectionFile = Join-Path $ScriptDir "Priority_API.postman_collection.json"
$EnvironmentFile = Join-Path $ScriptDir "Priority_API.postman_environment.json"

# Check if files exist
Write-Host "Checking files..." -ForegroundColor Yellow
if (-not (Test-Path $CollectionFile)) {
    Write-Host "✗ Collection file not found: $CollectionFile" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Collection file found" -ForegroundColor Green

if (-not (Test-Path $EnvironmentFile)) {
    Write-Host "✗ Environment file not found: $EnvironmentFile" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Environment file found" -ForegroundColor Green

Write-Host ""

# Create directories for workspace push (if needed)
$CollectionsDir = Join-Path $ScriptDir "collections"
$EnvironmentsDir = Join-Path $ScriptDir "environments"

if (-not (Test-Path $CollectionsDir)) {
    New-Item -ItemType Directory -Path $CollectionsDir -Force | Out-Null
    Write-Host "✓ Created collections directory" -ForegroundColor Green
}

if (-not (Test-Path $EnvironmentsDir)) {
    New-Item -ItemType Directory -Path $EnvironmentsDir -Force | Out-Null
    Write-Host "✓ Created environments directory" -ForegroundColor Green
}

# Copy files to workspace directories
Copy-Item $CollectionFile (Join-Path $CollectionsDir "Priority_API.postman_collection.json") -Force
Copy-Item $EnvironmentFile (Join-Path $EnvironmentsDir "Priority_API.postman_environment.json") -Force
Write-Host "✓ Copied files to workspace directories" -ForegroundColor Green

Write-Host ""

# Prepare workspace
Write-Host "Preparing workspace..." -ForegroundColor Yellow
postman workspace prepare --collections-dir $CollectionsDir --environments-dir $EnvironmentsDir 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Workspace prepared" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning: Prepare step had issues, continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""

# Push to workspace
Write-Host "Pushing to Postman Cloud workspace..." -ForegroundColor Yellow
Write-Host "This may take a moment..." -ForegroundColor Gray
Write-Host ""

postman workspace push --collections-dir $CollectionsDir --environments-dir $EnvironmentsDir -y

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Successfully pushed to Postman Cloud!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your collection and environment are now available in Postman Cloud." -ForegroundColor Cyan
    Write-Host "You can access them at: https://app.postman.com" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Failed to push to workspace" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure you're logged in: postman login" -ForegroundColor White
    Write-Host "2. Check your internet connection" -ForegroundColor White
    Write-Host "3. Verify you have access to a Postman workspace" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Import Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
