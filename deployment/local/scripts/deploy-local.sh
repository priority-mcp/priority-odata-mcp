#!/bin/bash
# Priority MCP Server - Local Docker Deployment Script
# This script helps deploy the Priority MCP Server to your local PC using Docker

set -e

echo "Priority MCP Server - Local Docker Deployment"
echo "============================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "✗ Docker is not installed or not in PATH"
    echo "Please install Docker from https://www.docker.com/get-started"
    exit 1
fi

echo "✓ Docker found: $(docker --version)"

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo "✗ Docker daemon is not running"
    echo "Please start Docker Desktop or Docker daemon"
    exit 1
fi

echo "✓ Docker daemon is running"

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "✗ docker-compose is not available"
    echo "Please install docker-compose"
    exit 1
fi

echo "✓ Docker Compose found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠ .env file not found"
    echo "Creating .env file from template..."
    
    cat > .env << 'EOF'
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
EOF
    
    echo "✓ Created .env file. Please edit it with your Priority API credentials."
    echo ""
    read -p "Press Enter to continue after editing .env file..."
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DOCKER_DIR="$SCRIPT_DIR/../docker"

# Check if docker-compose.yml exists
if [ ! -f "$DOCKER_DIR/docker-compose.yml" ]; then
    echo "✗ docker-compose.yml not found at $DOCKER_DIR/docker-compose.yml"
    exit 1
fi

echo ""
echo "Starting deployment..."
echo ""

# Navigate to docker directory for docker-compose commands
cd "$DOCKER_DIR" || exit 1

# Stop existing containers if any
echo "Stopping existing containers..."
$COMPOSE_CMD down 2>/dev/null || true

# Build and start
echo "Building Docker image..."
$COMPOSE_CMD build

echo "✓ Build successful"
echo ""

echo "Starting container..."
$COMPOSE_CMD up -d

echo "✓ Container started successfully"
echo ""

# Wait a moment for the server to start
echo "Waiting for server to start..."
sleep 5

# Check health
echo "Checking server health..."
if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Server is healthy and responding"
else
    echo "⚠ Could not reach health endpoint (server may still be starting)"
fi

echo ""
echo "============================================="
echo "Deployment Complete!"
echo ""
echo "Server is running at:"
echo "  http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  View logs:     $COMPOSE_CMD logs -f priority-rest-api-mcp"
echo "  Stop server:   $COMPOSE_CMD down"
echo "  Restart:       $COMPOSE_CMD restart priority-rest-api-mcp"
echo "  Check status:  $COMPOSE_CMD ps"
echo ""
echo "For more information, see docker-deploy-local.md"
echo ""

