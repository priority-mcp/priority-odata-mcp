# How to Import Priority API to Postman Desktop

## Quick Import Steps

### Method 1: Import Collection and Environment

1. **Open Postman Desktop**
2. Click the **"Import"** button (top left, near "New")
3. In the import dialog:
   - Click **"Upload Files"** or drag and drop
   - Select both files:
     - `Priority_API.postman_collection.json`
     - `Priority_API.postman_environment.json`
4. Click **"Import"**
5. Both collection and environment will be added to your workspace

### Method 2: Import from File System

1. **Open Postman Desktop**
2. Click **"Import"** button
3. Click **"File"** tab
4. Navigate to: `path/to/priority-mcp-server/postman/`
5. Select:
   - `Priority_API.postman_collection.json`
   - `Priority_API.postman_environment.json`
6. Click **"Import"**

### Method 3: Drag and Drop

1. Open Windows File Explorer
2. Navigate to: `path/to/priority-mcp-server/postman/`
3. Select both JSON files
4. Drag and drop them into Postman Desktop window
5. Click **"Import"** in the dialog

## After Import

### 1. Select Environment

1. In Postman, look at the top right
2. Click the environment dropdown (currently shows "No environment")
3. Select **"Priority API - Production"**

### 2. Verify Collection

1. In the left sidebar, find **"Priority REST API"** collection
2. Expand it to see all folders:
   - Authentication
   - System
   - Customers
   - Orders
   - Suppliers
   - Parts

### 3. Test Connection

1. Expand **"Authentication"** folder
2. Click on **"Test Connection"** request
3. Click **"Send"** button
4. You should get a **200 OK** response with a list of entities

## Configuration Check

### Environment Variables

The environment is pre-configured with:
- `priority_base_url`: https://host.docker.internal/odata/Priority/tabula.ini/demo/
- `priority_username`: your_username
- `priority_password`: *** (hidden)
- `ssl_verify`: false

### Authentication

The collection is configured with **Basic Authentication** at the collection level:
- Username: `{{priority_username}}`
- Password: `{{priority_password}}`

This means all requests will automatically use the credentials from the environment.

## SSL Certificate Setup

Since you're using self-signed certificates:

1. Go to **Settings** (gear icon, top right)
2. Go to **General** tab
3. Scroll down to **"SSL certificate verification"**
4. **Turn OFF** the toggle
5. Close settings

## Quick Test

After importing, test with:

1. Select environment: **"Priority API - Production"**
2. Open: **Priority REST API** → **Authentication** → **Test Connection**
3. Click **Send**
4. Expected: **200 OK** with JSON response containing entities

## Troubleshooting

### Collection not appearing
- Check if import was successful (look for success message)
- Refresh Postman (Ctrl+R)
- Check Collections sidebar

### Environment not appearing
- Check Environments tab in left sidebar
- Make sure both files were imported

### Authentication errors
- Verify environment is selected (top right dropdown)
- Check that environment variables are set correctly
- Ensure SSL verification is turned OFF in settings

### SSL errors
- Go to Settings → General
- Turn OFF "SSL certificate verification"

## File Locations

- Collection: `postman/Priority_API.postman_collection.json`
- Environment: `postman/Priority_API.postman_environment.json`

## Next Steps

After successful import:
1. Test the connection
2. Explore available entities
3. Try different requests (Customers, Orders, etc.)
4. Use Postman CLI to run collections: `postman collection run ...`

