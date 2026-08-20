# Postman CLI Setup Script for Priority API
# This script helps set up Priority API connection using Postman CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Postman CLI - Priority API Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Postman CLI is installed
Write-Host "Checking Postman CLI..." -ForegroundColor Yellow
try {
    $postmanVersion = postman --version
    Write-Host "✓ Postman CLI found: $postmanVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Postman CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Postman CLI from: https://www.postman.com/downloads/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
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

# Check if user is logged in to Postman
Write-Host "Checking Postman authentication..." -ForegroundColor Yellow
try {
    $loginCheck = postman login --help 2>&1
    Write-Host "✓ Postman CLI is ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: If you haven't logged in, run: postman login" -ForegroundColor Yellow
} catch {
    Write-Host "⚠ Could not verify login status" -ForegroundColor Yellow
}

Write-Host ""

# Display current environment settings
Write-Host "Current Environment Settings:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
$envContent = Get-Content $EnvironmentFile | ConvertFrom-Json
foreach ($value in $envContent.values) {
    if ($value.key -eq "priority_password" -or $value.key -eq "priority_pat" -or $value.key -eq "priority_app_key") {
        Write-Host "  $($value.key): *** (hidden)" -ForegroundColor White
    } else {
        Write-Host "  $($value.key): $($value.value)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Options" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Import Collection and Environment to Postman Desktop:" -ForegroundColor Yellow
Write-Host "   - Open Postman Desktop" -ForegroundColor White
Write-Host "   - Click Import button" -ForegroundColor White
Write-Host "   - Select both files:" -ForegroundColor White
Write-Host "     * $CollectionFile" -ForegroundColor Gray
Write-Host "     * $EnvironmentFile" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Run Collection with Postman CLI:" -ForegroundColor Yellow
Write-Host "   postman collection run `"$CollectionFile`" -e `"$EnvironmentFile`"" -ForegroundColor White
Write-Host ""

Write-Host "3. Test Connection:" -ForegroundColor Yellow
Write-Host "   postman request GET `"{{priority_base_url}}?`$format=json`" -e `"$EnvironmentFile`"" -ForegroundColor White
Write-Host ""

Write-Host "4. Push to Postman Workspace (if logged in):" -ForegroundColor Yellow
Write-Host "   postman workspace push" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Test Command" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test the connection, run:" -ForegroundColor Yellow
Write-Host ""
$testCommand = "postman request GET `"$env:PRIORITY_BASE_URL`$format=json`" --auth-type basic --auth-username `$env:PRIORITY_USERNAME --auth-password `$env:PRIORITY_PASSWORD --insecure"
Write-Host $testCommand -ForegroundColor Green
Write-Host ""
Write-Host "Or use the test script:" -ForegroundColor Yellow
Write-Host "node postman/test-connection.js" -ForegroundColor Green
Write-Host ""

