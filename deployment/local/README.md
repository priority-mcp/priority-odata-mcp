# Local Deployment

This directory contains all files needed for local Docker deployment of the Priority MCP Server.

## Directory Structure

```
local/
├── docker/          # Docker configuration files
├── scripts/         # Local deployment scripts
└── docs/            # Local deployment documentation
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# From project root
cd deployment/local/docker
docker-compose up -d --build
```

### Using Deployment Scripts

**Linux/Mac:**
```bash
./deployment/local/scripts/deploy-local.sh
```

**Windows PowerShell:**
```powershell
.\deployment\local\scripts\deploy-local.ps1
```

## Docker Files

The image is built from the repository-root `Dockerfile` (Node 22 multi-stage build → distroless nonroot runtime).

**`docker/docker-compose.yml`**
- Docker Compose configuration
- Service definition with environment variables
- Health checks and restart policies

## Scripts

**`scripts/deploy-local.sh`** (Linux/Mac)
- Automated local deployment script
- Checks Docker installation
- Builds and starts container
- Verifies health endpoint

**`scripts/deploy-local.ps1`** (Windows)
- Windows PowerShell version
- Same functionality as shell script

## Documentation

**`docs/docker-deploy-local.md`**
- Complete local deployment guide
- Prerequisites and setup
- Common commands
- Troubleshooting

## Environment Variables

Create a `.env` file in the project root with:

```env
PRIORITY_BASE_URL=https://priority.example.com/odata/Priority/tabula.ini/demo/
PRIORITY_AUTH_TYPE=basic
PRIORITY_USERNAME=api_user
PRIORITY_PASSWORD=secure_password
HTTP_PORT=3000
SSE_ENABLED=false
TLS_REJECT_UNAUTHORIZED=false
```

## Common Commands

```bash
# Start services
cd deployment/local/docker
docker-compose up -d

# View logs
docker-compose logs -f priority-mcp

# Stop services
docker-compose down

# Restart
docker-compose restart priority-mcp

# Check status
docker-compose ps

# Rebuild
docker-compose up -d --build
```

## Health Check

After deployment, verify the server is running:

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","time":"2025-11-29T..."}
```

## See Also

- [Local Deployment Guide](docs/docker-deploy-local.md) - Detailed guide
- [Main Deployment README](../README.md) - Overview

