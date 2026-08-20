# Priority MCP Server - Deployment

This directory contains all deployment-related files for local Docker deployment.

## Directory Structure

```
deployment/
├── local/           # Local Docker deployment
│   ├── docker/      # Docker configuration files
│   ├── scripts/     # Local deployment scripts
│   └── docs/        # Local deployment documentation
└── README.md        # This file
```

## Local Deployment

For deploying to your local machine using Docker:

- **Docker Files**: `local/docker/` - Dockerfile and docker-compose.yml
- **Scripts**: `local/scripts/` - Local deployment scripts
- **Documentation**: `local/docs/` - Local deployment guides

**Quick Start:**
```bash
cd deployment/local/docker
docker-compose up -d --build
```

See [Local Deployment README](local/README.md) for details.

## Quick Start

### Local Deployment

```bash
# Using Docker Compose
cd deployment/local/docker
docker-compose up -d --build

# Or use script
./deployment/local/scripts/deploy-local.sh
```

## Environment Variables

Deployment scripts use environment variables from `.env` file:
- `PRIORITY_BASE_URL` - Priority ERP API URL
- `PRIORITY_AUTH_TYPE` - Authentication type
- `PRIORITY_USERNAME` - Username for Basic auth
- `PRIORITY_PASSWORD` - Password for Basic auth
- `PRIORITY_PAT` - Personal Access Token
- `PRIORITY_APP_ID` - Application license ID
- `PRIORITY_APP_KEY` - Application license key

## See Also

- [Local Deployment](local/README.md) - Local Docker deployment guide
- [Local Deployment Documentation](local/docs/docker-deploy-local.md) - Local deployment guide
- Main [README.md](../README.md) - Project overview

