# Run Priority API Collection with Postman CLI
# This script runs the Priority API collection using Postman CLI

param(
    [string]$Environment = "Priority_API.postman_environment.json",
    [switch]$TestOnly = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CollectionFile = Join-Path $ScriptDir "Priority_API.postman_collection.json"
$EnvironmentFile = Join-Path $ScriptDir $Environment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Priority API Collection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
if (-not (Test-Path $CollectionFile)) {
    Write-Host "✗ Collection file not found: $CollectionFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $EnvironmentFile)) {
    Write-Host "✗ Environment file not found: $EnvironmentFile" -ForegroundColor Red
    exit 1
}

Write-Host "Collection: $CollectionFile" -ForegroundColor Yellow
Write-Host "Environment: $EnvironmentFile" -ForegroundColor Yellow
Write-Host ""

if ($TestOnly) {
    Write-Host "Running Test Connection only..." -ForegroundColor Yellow
    Write-Host ""
    
    # Read environment variables
    $envContent = Get-Content $EnvironmentFile | ConvertFrom-Json
    $baseUrl = ($envContent.values | Where-Object { $_.key -eq "priority_base_url" }).value
    $username = ($envContent.values | Where-Object { $_.key -eq "priority_username" }).value
    $password = ($envContent.values | Where-Object { $_.key -eq "priority_password" }).value
    
    $testUrl = "$baseUrl" + "?`$format=json"
    
    Write-Host "Testing connection to: $baseUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Run test request
    postman request GET $testUrl `
        --auth-basic-username $username `
        --auth-basic-password $password `
        -k `
        --verbose
} else {
    Write-Host "Running full collection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Run collection
    postman collection run $CollectionFile -e $EnvironmentFile --insecure
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

