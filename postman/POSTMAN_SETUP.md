# Postman Setup Guide for Priority API

This guide will help you set up Postman to work with Priority REST API (OData).

## Prerequisites

- Postman installed (Desktop or Web)
- Access to Priority ERP system with REST API enabled
- Priority API credentials (username/password or PAT token)

## Step 1: Create Environment

1. Open Postman
2. Click on **Environments** in the left sidebar
3. Click **+** to create a new environment
4. Name it: `Priority API - Production` (or your environment name)

### Environment Variables

Add the following variables:

| Variable Name | Initial Value | Current Value | Description |
|--------------|---------------|---------------|-------------|
| `priority_base_url` | `https://your-priority-server.com/odata/Priority/tabula.ini/demo/` | Same | Priority OData service root URL |
| `priority_username` | `your_username` | Same | Username for Basic authentication |
| `priority_password` | `your_password` | Same | Password for Basic authentication |
| `priority_pat` | `your_pat_token` | Same | Personal Access Token (if using PAT auth) |
| `priority_app_id` | `your_app_id` | (Optional) | Application license ID |
| `priority_app_key` | `your_app_key` | (Optional) | Application license key |
| `csrf_token` | (leave empty) | (leave empty) | CSRF token (auto-populated) |
| `session_cookie` | (leave empty) | (leave empty) | Session cookie (auto-populated) |

**Important**: 
- Replace placeholder values with your actual Priority API credentials
- The `priority_base_url` should end with a `/`
- For security, consider using Postman's **Secret** type for passwords

## Step 2: Import Postman Collection

See `Priority_API.postman_collection.json` for a complete collection with examples.

Or manually create requests as described below.

## Step 3: Authentication Setup

Priority API supports three authentication methods:

### Method 1: Basic Authentication (Most Common)

1. In your request, go to **Authorization** tab
2. Select **Basic Auth** from the Type dropdown
3. Username: `{{priority_username}}`
4. Password: `{{priority_password}}`
5. Postman will automatically add the `Authorization: Basic <token>` header

**Manual Header Setup** (Alternative):
```
Authorization: Basic {{base64_encoded_credentials}}
```

To generate base64 manually:
```javascript
// In Postman Pre-request Script:
const username = pm.environment.get("priority_username");
const password = pm.environment.get("priority_password");
const credentials = btoa(username + ":" + password);
pm.environment.set("base64_credentials", credentials);
```

Then use in header:
```
Authorization: Basic {{base64_credentials}}
```

### Method 2: Personal Access Token (PAT)

1. In your request, go to **Authorization** tab
2. Select **Bearer Token** from the Type dropdown
3. Token: `{{priority_pat}}`

**Manual Header Setup**:
```
Authorization: Bearer {{priority_pat}}
```

### Method 3: OAuth2

1. In your request, go to **Authorization** tab
2. Select **OAuth 2.0** from the Type dropdown
3. Configure according to your Priority OAuth2 setup
4. Or use Bearer token: `Authorization: Bearer {{priority_pat}}`

## Step 4: Common Request Examples

### 1. Get Service Document (List All Entities)

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}?$format=json`
- Headers:
  - `Accept: application/json`

**Response:** Returns list of all available entities

### 2. Get Version Information

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}`
- Headers:
  - `Accept: application/json`

**Response:** Returns version headers and service metadata

### 3. List All Customers

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}CUSTOMERS?$format=json`
- Headers:
  - `Accept: application/json`

**Query Parameters:**
- `$top=10` - Limit to 10 records
- `$skip=0` - Skip first 0 records
- `$orderby=CUSTNAME` - Sort by customer name
- `$filter=CUSTNAME eq 'Customer Name'` - Filter by name

### 4. Get Customer by ID

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}CUSTOMERS('100004')?$format=json`
- Headers:
  - `Accept: application/json`

### 5. Query with Filters

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}ORDERS?$filter=ORDSTATUSDES eq 'Open'&$format=json`
- Headers:
  - `Accept: application/json`

**Common OData Query Options:**
- `$filter` - Filter records (e.g., `CUSTNAME eq 'ABC'`)
- `$select` - Select specific fields (e.g., `$select=CUSTNAME,PHONE`)
- `$orderby` - Sort results (e.g., `$orderby=CUSTNAME desc`)
- `$top` - Limit number of results (e.g., `$top=100`)
- `$skip` - Skip records (e.g., `$skip=10`)
- `$expand` - Expand related entities (e.g., `$expand=ORDERITEMS_SUBFORM`)
- `$format=json` - Response format

### 6. Create New Record (POST)

**Request:**
- Method: `POST`
- URL: `{{priority_base_url}}CUSTOMERS`
- Headers:
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `X-CSRF-Token: Fetch` (First request to get token)

**Body (raw JSON):**
```json
{
  "CUSTNAME": "New Customer",
  "CUSTDES": "Customer Description",
  "EMAIL": "customer@example.com"
}
```

**Important**: For write operations (POST, PATCH, DELETE), you need to:
1. First make a GET request with header `X-CSRF-Token: Fetch`
2. Extract the `X-CSRF-Token` from response headers
3. Extract the `Set-Cookie` value from response headers
4. Use both in subsequent write requests

**Pre-request Script for CSRF Token:**
```javascript
// Get CSRF token
pm.sendRequest({
    url: pm.environment.get("priority_base_url"),
    method: 'GET',
    header: {
        'X-CSRF-Token': 'Fetch',
        'Authorization': 'Basic ' + btoa(pm.environment.get("priority_username") + ":" + pm.environment.get("priority_password"))
    }
}, function (err, res) {
    if (!err) {
        const csrfToken = res.headers.get('X-CSRF-Token');
        const cookies = res.headers.get('Set-Cookie');
        if (csrfToken) {
            pm.environment.set("csrf_token", csrfToken);
        }
        if (cookies) {
            pm.environment.set("session_cookie", cookies.split(';')[0]);
        }
    }
});
```

### 7. Update Record (PATCH)

**Request:**
- Method: `PATCH`
- URL: `{{priority_base_url}}CUSTOMERS('100004')`
- Headers:
  - `Content-Type: application/json`
  - `X-CSRF-Token: {{csrf_token}}`
  - `Cookie: {{session_cookie}}`

**Body (raw JSON):**
```json
{
  "CUSTDES": "Updated Description",
  "EMAIL": "newemail@example.com"
}
```

### 8. Delete Record (DELETE)

**Request:**
- Method: `DELETE`
- URL: `{{priority_base_url}}CUSTOMERS('100004')`
- Headers:
  - `X-CSRF-Token: {{csrf_token}}`
  - `Cookie: {{session_cookie}}`

### 9. Get Subform Data

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}ORDERS('SO18000002')/ORDERITEMS_SUBFORM?$format=json`
- Headers:
  - `Accept: application/json`

### 10. Query with Expand (Related Entities)

**Request:**
- Method: `GET`
- URL: `{{priority_base_url}}ORDERS('SO18000002')?$expand=ORDERITEMS_SUBFORM&$format=json`
- Headers:
  - `Accept: application/json`

## Step 5: Additional Headers

### Application License Headers (Optional)

If your Priority system requires application licensing:

```
X-App-Id: {{priority_app_id}}
X-App-Key: {{priority_app_key}}
```

### Language Support

```
Accept-Language: en-US
```

### Trace Debugging

```
X-App-Trace: 1
```

## Step 6: SSL Certificate Handling

### For Self-Signed Certificates (Current Setup)

Your Priority server uses self-signed certificates. To configure Postman:

1. **Disable SSL Verification in Postman Settings:**
   - Go to **Settings** (gear icon) → **General** tab
   - Scroll down to **SSL certificate verification**
   - **Turn OFF** SSL certificate verification
   - This allows Postman to accept self-signed certificates

2. **Alternative: Import Certificate (Recommended for Production):**
   - Go to **Settings** → **Certificates** tab
   - Click **Add Certificate**
   - Enter your Priority server domain
   - Import your self-signed certificate file (.crt or .pem)
   - This is more secure than disabling verification

3. **Verify SSL Settings:**
   - The environment variable `ssl_verify` is set to `false` to indicate self-signed cert usage
   - In production, consider using proper SSL certificates

**Note**: 
- Disabling SSL verification is acceptable for development/testing
- For production, always use valid SSL certificates or import your self-signed certificate
- The test script (`test-connection.js`) is configured to accept self-signed certificates

## Step 7: Testing Your Setup

### Test 1: Service Document

1. Create a new GET request
2. URL: `{{priority_base_url}}?$format=json`
3. Set Authorization (Basic Auth or Bearer Token)
4. Send request
5. Expected: 200 OK with JSON list of entities

### Test 2: Get Entity

1. Create a new GET request
2. URL: `{{priority_base_url}}CUSTOMERS?$top=1&$format=json`
3. Set Authorization
4. Send request
5. Expected: 200 OK with customer data

## Troubleshooting

### Error: 401 Unauthorized
- Check username/password or PAT token
- Verify authentication method matches your Priority setup
- Ensure credentials are correct in environment variables

### Error: 400 Bad Request
- Check URL format (should end with `/`)
- Verify entity name is correct
- Check OData query syntax
- Verify JSON body format for POST/PATCH

### Error: 404 Not Found
- Entity may not be accessible via REST API
- Check if `RESTFLAG=Y` in FORMLIMITED for the entity
- Verify entity name spelling

### Error: CSRF Token Required
- Make initial GET request with `X-CSRF-Token: Fetch` header
- Extract token from response headers
- Include token in write operations (POST, PATCH, DELETE)

### Error: SSL Certificate
- Disable SSL verification in Postman settings (testing only)
- Or import valid certificate

## Best Practices

1. **Use Environments**: Store credentials in environment variables, not hardcoded
2. **Use Collections**: Organize requests in folders by entity type
3. **Use Variables**: Use `{{variable}}` syntax for reusable values
4. **Test Authentication First**: Always test with a simple GET request first
5. **Handle CSRF Tokens**: Automate CSRF token retrieval with Pre-request Scripts
6. **Document Requests**: Add descriptions to requests for team members
7. **Use Tests**: Add Postman tests to validate responses

## Example Collection Structure

```
Priority API Collection
├── Authentication
│   ├── Get CSRF Token
│   └── Test Connection
├── System
│   ├── Get Service Document
│   └── Get Version Info
├── Customers
│   ├── List Customers
│   ├── Get Customer by ID
│   ├── Create Customer
│   ├── Update Customer
│   └── Delete Customer
├── Orders
│   ├── List Orders
│   ├── Get Order with Items
│   └── Create Order
└── Suppliers
    ├── List Suppliers
    └── Get Supplier Details
```

## Next Steps

1. Import the provided Postman collection JSON file
2. Update environment variables with your credentials
3. Test with a simple GET request
4. Explore available entities using the service document
5. Build your own requests based on your needs

## Resources

- [Priority REST API Documentation](https://prioritysoftware.github.io/api/)
- [OData Query Syntax](https://www.odata.org/documentation/)
- [Postman Documentation](https://learning.postman.com/docs/)

