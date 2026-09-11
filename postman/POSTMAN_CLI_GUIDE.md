# Postman CLI Guide for Priority API

This guide explains how to use Postman CLI to interact with Priority API.

## Prerequisites

- Postman CLI installed (version 1.26.0+)
- Priority API collection and environment files in `postman/` directory

## Quick Start

### 1. Test Connection

Test the Priority API connection:

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/?`$format=json" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure `
    --verbose
```

### 2. Run Collection with Environment

Run the entire Priority API collection:

```powershell
cd postman
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    --insecure
```

### 3. Run Specific Request from Collection

Run only the "Test Connection" request:

```powershell
cd postman
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    -i "Test Connection" `
    --insecure
```

## Using Environment Variables

### Load Environment File

```powershell
postman request GET "{{priority_base_url}}?`$format=json" `
    -e postman/Priority_API.postman_environment.json `
    --auth-basic-username "{{priority_username}}" `
    --auth-basic-password "{{priority_password}}" `
    --insecure
```

**Note**: Environment variables in URLs and headers are automatically resolved when using `-e` flag.

### Override Environment Variables

Override specific environment variables:

```powershell
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    --env-var "priority_base_url=https://other-server.com/odata/Priority/tabula.ini/demo/" `
    --insecure
```

## Authentication Methods

### Basic Authentication

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/CUSTOMERS" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure
```

### Personal Access Token (PAT)

Priority PATs use Basic auth: username = the token, password = the literal string `PAT`.

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/CUSTOMERS" `
    --auth-basic-username "your_pat_token" `
    --auth-basic-password "PAT" `
    --insecure
```

## SSL Certificate Handling

For self-signed certificates, use the `--insecure` flag:

```powershell
postman request GET "https://host.docker.internal/..." --insecure
```

Or in collection runs:

```powershell
postman collection run collection.json -e environment.json --insecure
```

## Common Commands

### Get Service Document

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/?`$format=json" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure `
    --response-only
```

### Get Customer by ID

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/CUSTOMERS('100004')" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure
```

### Query with Filters

```powershell
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/CUSTOMERS?`$filter=CUSTNAME eq 'Customer Name'&`$format=json" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure
```

## Scripts

### Setup Script

Run the setup script to check configuration:

```powershell
.\postman\setup-postman-cli.ps1
```

### Run Collection Script

Run the collection with a helper script:

```powershell
.\postman\run-collection.ps1
```

Or test only:

```powershell
.\postman\run-collection.ps1 -TestOnly
```

## Output Options

### Save Response to File

```powershell
postman request GET "https://..." --output response.json --insecure
```

### Response Only (for piping)

```powershell
postman request GET "https://..." --response-only | ConvertFrom-Json
```

### Verbose Output

```powershell
postman request GET "https://..." --verbose --insecure
```

### Debug Mode

```powershell
postman request GET "https://..." --debug --insecure
```

## Collection Run Options

### Run with Reporters

```powershell
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    -r cli,json,html `
    --reporter-json-export reports/test-results.json `
    --reporter-html-export reports/test-results.html `
    --insecure
```

### Run Specific Iterations

```powershell
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    -n 5 `
    --insecure
```

### Run with Data File

```powershell
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    -d test-data.json `
    --insecure
```

## Integration with Postman Workspace

### Push to Workspace

If logged in to Postman:

```powershell
postman workspace push
```

### Prepare for Push

Validate and prepare files:

```powershell
postman workspace prepare
```

## Troubleshooting

### Error: "self-signed certificate"

**Solution**: Add `--insecure` flag to disable SSL verification

### Error: "authentication failed"

**Solution**: Check username and password, or verify PAT token

### Error: "environment file not found"

**Solution**: Use full path or ensure you're in the correct directory

### Variables Not Resolving

**Solution**: Ensure environment file is loaded with `-e` flag

## Examples

### Complete Test Flow

```powershell
# 1. Test connection
postman request GET "https://host.docker.internal/odata/Priority/tabula.ini/demo/?`$format=json" `
    --auth-basic-username your_username `
    --auth-basic-password your_password `
    --insecure `
    --verbose

# 2. Run authentication tests
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    -i "Get CSRF Token" `
    -i "Test Connection" `
    --insecure

# 3. Run full collection
postman collection run Priority_API.postman_collection.json `
    -e Priority_API.postman_environment.json `
    --insecure `
    -r cli,json
```

## See Also

- `postman/SSL_SETUP.md` - SSL certificate configuration
- `postman/POSTMAN_SETUP.md` - Complete Postman setup guide
- `postman/test-connection.js` - Node.js test script

