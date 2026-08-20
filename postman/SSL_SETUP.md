# SSL Certificate Setup for Self-Signed Certificates

This guide explains how to configure Postman to work with Priority API that uses self-signed SSL certificates.

## Current Configuration

✅ **Test Script**: Already configured to accept self-signed certificates
✅ **Environment Variable**: `ssl_verify` set to `false` in Postman environment
✅ **Node.js Test**: `test-connection.js` configured with `rejectUnauthorized: false`

## Postman Settings

### Step 1: Disable SSL Certificate Verification

1. Open Postman
2. Click the **Settings** icon (gear icon) in the top right
3. Go to the **General** tab
4. Scroll down to **SSL certificate verification**
5. **Turn OFF** the toggle for SSL certificate verification
6. Close the settings window

**Note**: This setting applies globally to all requests in Postman.

### Step 2: Verify Environment Variables

Make sure your Postman environment has:
- `priority_base_url`: Your Priority API URL
- `priority_username`: Your username
- `priority_password`: Your password
- `ssl_verify`: Set to `false` (indicates self-signed cert usage)

### Step 3: Test Connection

1. Open the **Priority REST API** collection
2. Go to **Authentication** → **Test Connection**
3. Click **Send**
4. You should get a **200 OK** response with a list of entities

## Alternative: Import Certificate (Recommended for Production)

If you have the self-signed certificate file:

1. Go to **Settings** → **Certificates** tab
2. Click **Add Certificate**
3. Enter your Priority server hostname (e.g., `host.docker.internal`)
4. Click **Select File** and choose your certificate file (.crt, .pem, or .cer)
5. Click **Add**

This is more secure than disabling verification globally.

## Test Script

The test script (`test-connection.js`) is already configured:

```javascript
const httpsAgent = new https.Agent({
    rejectUnauthorized: false  // Accept self-signed certificates
});
```

Run the test:
```bash
node postman/test-connection.js
```

Expected output:
```
✓ ALL TESTS PASSED
```

## Troubleshooting

### Error: "self-signed certificate"

**Solution**: Make sure SSL certificate verification is turned OFF in Postman Settings → General

### Error: "certificate has expired"

**Solution**: 
1. Check if your certificate is valid
2. If using self-signed cert, ensure Postman SSL verification is disabled
3. Or import a valid certificate

### Error: "unable to verify the first certificate"

**Solution**: This usually means the certificate chain is incomplete. Try:
1. Disable SSL verification (for testing)
2. Or import the full certificate chain

## Security Notes

⚠️ **Important**:
- Disabling SSL verification is acceptable for **development/testing** only
- For **production**, use valid SSL certificates or import your self-signed certificate
- Never disable SSL verification in production environments without proper certificate management

## Verification

After configuration, test with:

1. **Postman**: Use "Test Connection" request
2. **Test Script**: Run `node postman/test-connection.js`
3. **Manual**: Try any GET request to your Priority API

All should return **200 OK** responses.

