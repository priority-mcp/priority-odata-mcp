# Local Docker Deployment Guide

This guide will help you deploy the Priority MCP Server to your local PC using Docker.

## Prerequisites

- Docker Desktop installed and running (or Docker Engine on Linux)
- Docker Compose (usually included with Docker Desktop)

## Quick Start

### 1. Create Environment File

Create a `.env` file in the project root with your Priority API configuration:

```env
# Priority API Configuration
PRIORITY_BASE_URL=https://priority.example.com/odata/Priority/tabula.ini/demo/
PRIORITY_AUTH_TYPE=basic
PRIORITY_USERNAME=api_user
PRIORITY_PASSWORD=secure_password

# Server Configuration
HTTP_PORT=3000
SSE_ENABLED=false
```

### 2. Build and Start

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f priority-rest-api-mcp

# Check status
docker-compose ps
```

### 3. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check server info
curl http://localhost:3000/
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PRIORITY_BASE_URL` | Priority OData service root URL | - | Yes |
| `PRIORITY_AUTH_TYPE` | Authentication method: `basic`, `pat`, `oauth2`, or `none` | `none` | No |
| `PRIORITY_USERNAME` | Username for Basic auth | - | If using basic auth |
| `PRIORITY_PASSWORD` | Password for Basic auth | - | If using basic auth |
| `PRIORITY_PAT` | Personal Access Token or OAuth2 token | - | If using PAT/OAuth2 |
| `PRIORITY_APP_ID` | Application license ID | - | No |
| `PRIORITY_APP_KEY` | Application license key | - | No |
| `HTTP_PORT` | Server port | `3000` | No |
| `SSE_ENABLED` | Enable Server-Sent Events | `false` | No |
| `PRIORITY_HTTP_TIMEOUT_MS` | HTTP request timeout | `30000` | No |
| `TLS_REJECT_UNAUTHORIZED` | Reject invalid TLS certificates | `false` | No |

## Common Commands

```bash
# Start the service
docker-compose up -d

# Stop the service
docker-compose down

# View logs
docker-compose logs -f priority-rest-api-mcp

# Restart the service
docker-compose restart priority-rest-api-mcp

# Rebuild the image
docker-compose build --no-cache

# Rebuild and restart
docker-compose up -d --build

# Check container status
docker-compose ps

# Execute command in container
docker-compose exec priority-rest-api-mcp sh

# View environment variables
docker-compose exec priority-rest-api-mcp env | grep PRIORITY
```

## HTTPS MCP (Cursor `streamableHttp`)

Cursor connects with `fetch()`. **`allowInsecure` in `mcp.json` does not disable TLS verification for `https://` URLs**, so a **self-signed certificate is rejected** and logs show `fetch failed`.

Do one of the following:

1. **Trust a dev certificate (recommended for local HTTPS)**  
   From `deployment/local/docker`, run:

   ```powershell
   .\generate-mcp-tls-certs.ps1
   ```

   Import `C:\certs\cert.cer` into **Current user → Trusted Root Certification Authorities** (or run the `certutil` line the script prints). Restart Cursor.

2. **Use mkcert**  
   Install [mkcert](https://github.com/FiloSottile/mkcert), run `mkcert -install`, then `mkcert localhost 127.0.0.1` and copy the resulting PEMs to `C:\certs\` as `cert.pem` and `key.pem` (names must match `SSL_CERT_PATH` / `SSL_KEY_PATH`).

3. **Use HTTP for local MCP**  
   Point Cursor at `http://localhost:3000/mcp` with `allowInsecure: true` (no TLS).

Ensure Docker mounts the certs (`C:/certs:/certs:ro` in compose) and that container logs show **listening on https://...:3443**. Use **`https://127.0.0.1:3443/mcp`** in `mcp.json` to avoid some `localhost` / IPv6 resolution issues.

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTPS_ENABLED` | `true` | Set `false` to skip the HTTPS listener entirely. |
| `HTTPS_PORT` | `3443` | Inbound TLS port. |
| `SSL_CERT_PATH` | `/certs/cert.pem` | PEM certificate inside the container. |
| `SSL_KEY_PATH` | `/certs/key.pem` | PEM private key inside the container. |

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs priority-rest-api-mcp

# Check if port is already in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac
```

### Rebuild from scratch

```bash
# Stop and remove containers
docker-compose down

# Remove the image
docker rmi prioritymcp-priority-rest-api-mcp:latest

# Rebuild
docker-compose build --no-cache

# Start
docker-compose up -d
```

### Test Priority API connection from container

```bash
# Enter the container
docker-compose exec priority-rest-api-mcp sh

# Test connection (inside container)
curl -v $PRIORITY_BASE_URL
```

## Using Docker without Docker Compose

If you prefer to use Docker directly:

```bash
# Build the image
docker build -t priority-rest-api-mcp-server:latest .

# Run the container
docker run -d \
  --name priority-rest-api-mcp \
  -p 3000:3000 \
  -e PRIORITY_BASE_URL="https://priority.example.com/odata/Priority/tabula.ini/demo/" \
  -e PRIORITY_AUTH_TYPE="basic" \
  -e PRIORITY_USERNAME="api_user" \
  -e PRIORITY_PASSWORD="secure_password" \
  priority-rest-api-mcp-server:latest

# View logs
docker logs -f priority-rest-api-mcp

# Stop and remove
docker stop priority-rest-api-mcp
docker rm priority-rest-api-mcp
```

## Next Steps

Once deployed, you can:
- Access the MCP endpoint at `http://localhost:3000/mcp`
- Check health at `http://localhost:3000/health`
- View capabilities at `http://localhost:3000/capabilities`
- Configure your MCP client to connect to the server

For MCP client configuration, see the main [README.md](./README.md).

