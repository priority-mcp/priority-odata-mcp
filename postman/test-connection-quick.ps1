# Quick Connection Test Script for Priority API
# Tests connection using both Node.js and Postman CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Priority API Connection Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Node.js script
Write-Host "Test 1: Node.js Test Script" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow
node postman/test-connection.js
Write-Host ""

# Test 2: Postman CLI
Write-Host "Test 2: Postman CLI Collection" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow
postman collection run postman/Priority_API.postman_collection.json -e postman/Priority_API.postman_environment.json -k -i "Test Connection" 2>&1 | Select-String -Pattern "200 OK|Status code|assertions|failed" -Context 0,2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

