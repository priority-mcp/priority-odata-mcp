# Generate localhost TLS PEMs for Priority REST MCP HTTPS (Docker bind-mount C:\certs).
# Cursor's streamableHttp client validates TLS; self-signed certs must be trusted in Windows.
# Requires: openssl (e.g. Git for Windows). Optional: mkcert (https://github.com/FiloSottile/mkcert) is simpler.

param(
    [string]$OutDir = "C:\certs"
)

$ErrorActionPreference = "Stop"
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "openssl not found. Install Git for Windows (includes openssl) or add openssl to PATH." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$certPem = Join-Path $OutDir "cert.pem"
$keyPem = Join-Path $OutDir "key.pem"
$certDer = Join-Path $OutDir "cert.cer"

Push-Location $OutDir
try {
    & openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes `
        -keyout $keyPem -out $certPem `
        -subj "/CN=localhost" `
        -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"
    if ($LASTEXITCODE -ne 0) { throw "openssl req failed" }

    & openssl x509 -outform der -in $certPem -out $certDer
    if ($LASTEXITCODE -ne 0) { throw "openssl x509 export failed" }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Wrote: $certPem" -ForegroundColor Green
Write-Host "Wrote: $keyPem" -ForegroundColor Green
Write-Host "Wrote: $certDer (for Windows trust store import)" -ForegroundColor Green
Write-Host ""
Write-Host "Trust this cert for Cursor (pick one):" -ForegroundColor Yellow
Write-Host "  1) Double-click cert.cer -> Install Certificate -> Current User -> Trusted Root Certification Authorities"
Write-Host "  2) PowerShell (Current User):  certutil -user -addstore Root `"$certDer`""
Write-Host ""
Write-Host "Then restart Cursor and use mcp.json URL: https://127.0.0.1:3443/mcp" -ForegroundColor Cyan
Write-Host "Docker compose should mount: C:/certs:/certs:ro" -ForegroundColor Cyan
