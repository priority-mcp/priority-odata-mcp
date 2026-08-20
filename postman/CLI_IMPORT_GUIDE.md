# Import Priority API to Postman via CLI

This guide explains how to import the Priority API collection and environment to Postman using the command line.

## Prerequisites

- Postman CLI installed (v1.26.0+)
- Postman account (for cloud sync)
- Internet connection

## Method 1: Push to Postman Cloud (Recommended)

This method pushes your collection and environment to Postman Cloud workspace, making them available in both Postman Desktop and Postman Web.

### Step 1: Login to Postman

```powershell
postman login
```

This will open a browser for authentication. Follow the prompts to login.

### Step 2: Run Import Script

```powershell
.\postman\import-via-cli.ps1
```

The script will:
1. Check Postman CLI installation
2. Verify login status
3. Prepare workspace structure
4. Push collection and environment to Postman Cloud

### Step 3: Access in Postman

After successful push:
1. Open Postman Desktop or go to https://app.postman.com
2. Your collection "Priority REST API" will appear in Collections
3. Your environment "Priority API - Production" will appear in Environments
4. Select the environment from the dropdown (top right)

## Method 2: Manual Workspace Push

If you prefer to do it manually:

### Step 1: Create Workspace Directories

```powershell
cd postman
mkdir collections
mkdir environments
```

### Step 2: Copy Files

```powershell
Copy-Item Priority_API.postman_collection.json collections\
Copy-Item Priority_API.postman_environment.json environments\
```

### Step 3: Prepare Workspace

```powershell
postman workspace prepare --collections-dir collections --environments-dir environments
```

### Step 4: Push to Cloud

```powershell
postman workspace push --collections-dir collections --environments-dir environments
```

## Method 3: Direct File Import (Desktop Only)

If you only want to use Postman Desktop (not cloud):

### Option A: Use PowerShell to Open Import Dialog

```powershell
# Open Postman and use Import button manually
# Or use this to open the file location:
explorer postman
```

Then drag and drop the files into Postman.

### Option B: Copy to Postman Default Location

Postman Desktop stores collections in:
- Windows: `%APPDATA%\Postman\collections\`
- Or: `%USERPROFILE%\Postman\`

You can copy files there, but manual import is recommended.

## Verification

After import, verify:

1. **Collection exists:**
   ```powershell
   postman collection run postman/Priority_API.postman_collection.json -e postman/Priority_API.postman_environment.json -k -i "Test Connection"
   ```

2. **Environment variables:**
   - Open Postman Desktop
   - Go to Environments
   - Select "Priority API - Production"
   - Verify all variables are set

3. **Test connection:**
   - Select environment: "Priority API - Production"
   - Run: Authentication → Test Connection
   - Should get 200 OK

## Troubleshooting

### Error: "Not logged in"

**Solution:**
```powershell
postman login
```

### Error: "No workspace found"

**Solution:**
1. Go to https://app.postman.com
2. Create a workspace if needed
3. Try push again

### Error: "Collection already exists"

**Solution:**
- The collection will be updated, not duplicated
- This is normal behavior

### Files not appearing in Postman Desktop

**Solution:**
- If pushed to cloud, sync Postman Desktop:
  - Click "Sync" button in Postman Desktop
  - Or restart Postman Desktop

## Alternative: Use Postman API

You can also use Postman API directly:

```powershell
# Get API key from https://app.postman.com/me/account
$apiKey = "your-api-key"

# Import collection via API
$collection = Get-Content postman/Priority_API.postman_collection.json -Raw
# Use Postman API to import...
```

## Quick Reference

```powershell
# Login
postman login

# Import (using script)
.\postman\import-via-cli.ps1

# Test after import
postman collection run postman/Priority_API.postman_collection.json -e postman/Priority_API.postman_environment.json -k -i "Test Connection"
```

## See Also

- `postman/IMPORT_TO_POSTMAN.md` - Manual import guide
- `postman/POSTMAN_CLI_GUIDE.md` - Complete CLI usage guide
- `postman/setup-postman-cli.ps1` - Setup verification script

