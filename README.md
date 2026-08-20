# Priority MCP Server

A Model Context Protocol (MCP) server that provides programmatic access to Priority ERP system data via the Priority REST API (OData).

## ⚠️ Data Integrity Policy: NO MOCK DATA ALLOWED

**CRITICAL**: This server enforces a strict **NO MOCK DATA** policy. All data must come directly from the Priority ERP system via authenticated API calls. When data cannot be fetched, operations **MUST FAIL** with clear error messages. **NEVER** returns empty arrays, empty objects, or placeholder data as fallback.

See [Data Integrity Policy](docs/DATA_INTEGRITY_POLICY.md) for complete details.

## Project Structure

```
priority-mcp-server/
├── dist/                    # Compiled JavaScript
│   ├── config.js           # Configuration loader
│   ├── index.js             # Main entry point
│   ├── server.js            # Express HTTP server
│   ├── sseServer.js         # SSE transport support
│   ├── mcp/                 # MCP protocol handlers
│   ├── priority/             # Priority API client
│   └── tools/                # MCP tool definitions
├── deploy/                  # Deployment scripts
│   └── systemd/             # Systemd service files
├── package.json            # Node.js dependencies
└── README.md                # This file
```

## Overview

The Priority MCP Server exposes Priority ERP data through the Model Context Protocol, enabling AI assistants and other MCP clients to interact with Priority systems using standard JSON-RPC 2.0 calls.

The server communicates with Priority via its OData-based REST API, supporting:
- **Read operations**: Query entities, fetch individual records, list available entity sets
- **Write operations**: Create, update, and delete records
- **Authentication**: Basic auth, Personal Access Tokens (PAT), or OAuth2
- **Transport**: HTTP POST/GET endpoints and optional Server-Sent Events (SSE)

## Prerequisites

- Node.js 18+
- Access to a Priority ERP system with REST API enabled
- Network connectivity to the Priority OData service endpoint

## Installation

The server is distributed as compiled JavaScript. No build step is required.

```bash
# Ensure Node.js 18+ is installed
node --version

# The server runs from the dist/ directory
cd priority-mcp-server
```

## Configuration

The server is configured via environment variables:

### Priority API Connection

- `PRIORITY_BASE_URL` - Priority OData service root URL (required)
  - Example: `https://priority.example.com/odata/Priority/tabula.ini/demo/`
- `PRIORITY_AUTH_TYPE` - Authentication method: `basic`, `pat`, `oauth2`, or `none` (default: `none`)
- `PRIORITY_USERNAME` - Username for Basic auth
- `PRIORITY_PASSWORD` - Password for Basic auth
- `PRIORITY_PAT` - Personal Access Token or OAuth2 bearer token
- `PRIORITY_APP_ID` - Application license ID (optional, for per-app licensing)
- `PRIORITY_APP_KEY` - Application license key (optional, for per-app licensing)
- `TLS_REJECT_UNAUTHORIZED` - Set to `true` to reject invalid TLS certificates (default: `false`)
- `PRIORITY_HTTP_TIMEOUT_MS` - HTTP request timeout in milliseconds (default: `30000`)

### Server Configuration

- `HTTP_HOST` - Server bind address (default: `0.0.0.0`)
- `HTTP_PORT` - Server port (default: `3000`)
- `SSE_ENABLED` - Enable Server-Sent Events transport (default: `false`)

### Data Integrity Configuration

- `STRICT_DATA_INTEGRITY` - Enable strict data integrity checks (default: `true`)
  - When `true`: All data integrity validations are enforced, runtime checks occur on all tool results
  - When `false`: Basic error handling still applies (no mock data), but runtime validation is disabled (for debugging only)
  - **Note**: Setting to `false` is not recommended for production use

### Example Configuration

```bash
export PRIORITY_BASE_URL="https://priority.example.com/odata/Priority/tabula.ini/demo/"
export PRIORITY_AUTH_TYPE="basic"
export PRIORITY_USERNAME="api_user"
export PRIORITY_PASSWORD="secure_password"
export HTTP_PORT=3000
export SSE_ENABLED="true"
```

## Running the Server

### Direct Execution

```bash
node dist/index.js
```

The server will start and listen on the configured host and port:

```
[priority-mcp] Priority MCP server listening on http://0.0.0.0:3000
```

### Using Environment Variables

```bash
PRIORITY_BASE_URL="https://priority.example.com/odata/Priority/tabula.ini/demo/" \
PRIORITY_AUTH_TYPE="basic" \
PRIORITY_USERNAME="user" \
PRIORITY_PASSWORD="pass" \
node dist/index.js
```

## MCP Resources

The server provides **4 MCP resources** for accessing Priority ERP information:

1. **Available Entities List** (`priority://entities/list`)
   - Complete list of all Priority entities with RESTFLAG=Y that are accessible via the API
   - Includes entity names, titles, descriptions, and accessibility information
   - Total: 87 entities (as of last update)

2. **Entity Schema** (`priority://entity-schema/{entity}`)
   - Schema information for a specific Priority entity
   - Includes fields, data types, relationships, and sample records
   - Example: `priority://entity-schema/ORDERS` for order entity schema

3. **Common Queries Library** (`priority://queries/common`)
   - Collection of common query patterns and examples for Priority ERP entities
   - Categories: Orders, Customers, Inventory, Parts, Documents, Users
   - Includes example queries with tool call formats

4. **Subform Reference** (`priority://subforms/reference`)
   - Comprehensive reference guide for Priority subforms
   - Structure, operations, and examples for common subforms
   - Includes: ORDERITEMS_SUBFORM, SHIPTO2_SUBFORM, PARTARC_SUBFORM, and more

## Available Tools

The server exposes **17-18 MCP tools** organized into 6 categories:

**Note:** Tool names use underscores (e.g., `version_get`, `query_run`) rather than dots. The MCP client may display them with prefixes like `priority_` for clarity.

### 1. System & Metadata (4 tools)

#### `version_get` (or `priority_version.get` in some clients)
Fetch Priority service version and relevant headers.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "version_get",
    "args": {}
  }
}
```

#### `metadata_entities_list` (or `priority_metadata.entities_list` in some clients)
List OData entity sets exposed by Priority service. Unified tool that replaces the previous `priority_entities.list` and `priority_api_entities.list`. Can return all entities or filter to API-accessible entities (RESTFLAG=Y in FORMLIMITED).

**Parameters:**
- `apiOnly` (boolean, optional) - If true, return only entities available via API (RESTFLAG=Y in FORMLIMITED). If false, return all entities from service document. Default: false
- `includeMetadata` (boolean, optional) - If true and apiOnly is true, include additional metadata from FORMLIMITED like TITLE, EXEC, UDATE. Default: false

**Example - All entities:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "metadata_entities_list",
    "args": {}
  }
}
```

**Example - API-accessible entities only:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "metadata_entities_list",
    "args": {
      "apiOnly": true,
      "includeMetadata": true
    }
  }
}
```

#### `metadata_schema_get` (or `priority_metadata.schema_get` in some clients)
Get metadata and schema information for a Priority entity. Helps understand available fields, data types, and relationships.

**Parameters:**
- `entity` (string, required) - Entity name (e.g., DOCUMENTS_D, ORDERS, CUSTOMERS, PART)
- `sample` (boolean, optional) - If true, fetch a sample record to understand structure. Default: true
- `top` (number, optional) - Number of sample records to fetch. Default: 1

**Example - Get ORDERS entity schema:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "metadata_schema_get",
    "args": {
      "entity": "ORDERS",
      "sample": true,
      "top": 1
    }
  }
}
```

**Note:** You can also access entity schemas via the MCP resource `priority://entity-schema/{entity}` (e.g., `priority://entity-schema/ORDERS`).

#### `metadata_refresh` (or `priority_metadata.refresh` in some clients)
Clear and refresh metadata for an entity (or all entities). Use this when private customizations add fields to a form - new fields will not appear in REST API until metadata is refreshed.

**Parameters:**
- `entity` (string, optional) - Entity name to refresh metadata for (e.g., "ORDERS"). If not provided, metadata for all entities will be cleared.

### 2. Querying (2 tools)

#### `entity_get` (or `priority_entity.get` in some clients)
Fetch a single entity record by key. Supports expanding subforms to include related data.

**Parameters:**
- `entity` (string, required) - Entity name (e.g., "USERS", "ORDERS")
- `key` (string, required) - Entity key value
- `select` (array, optional) - Fields to select
- `expand` (string, optional) - OData $expand expression for subforms (e.g., `ORDERITEMS_SUBFORM`, `SHIPTO2_SUBFORM`, or multiple: `ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM`)

#### `query_run` (or `priority_query.run` in some clients)
Run a query against an entity with OData query options. Supports expanding subforms and delta queries for tracking changes.

**Parameters:**
- `entity` (string, required) - Entity name
- `filter` (string, optional) - OData $filter expression
- `select` (array, optional) - Fields to select
- `top` (number, optional) - Maximum records to return
- `skip` (number, optional) - Records to skip (pagination)
- `orderby` (string, optional) - OData $orderby clause
- `expand` (string, optional) - OData $expand expression for subforms
- `deltaToken` (string, optional) - Delta token for retrieving only records with changes since the last query

### 3. CRUD Operations (4 tools)

#### `entity_create` (or `priority_entity.create` in some clients)
Create a new entity record. Supports creating entities with related subforms (e.g., ORDER with ORDERITEMS_SUBFORM).

#### `entity_update` (or `priority_entity.update` in some clients)
Update an existing entity record. Supports updating related entities (subforms).

#### `entity_delete` (or `priority_entity.delete` in some clients)
Delete an entity record. Supports deleting related entities (subforms).

#### `batch_operations` (or `priority_batch.operations` in some clients)
Perform batch operations. Allows executing multiple create/update/delete operations in a single request with dependencies.

### 4. Text Fields (3 tools)

#### `entity_text_get` (or `priority_entity_text.get` in some clients)
Get text for an entity. Retrieves text content associated with an entity record.

**Parameters:**
- `entity` (string, required) - Entity name (e.g. ORDERS, PART)
- `key` (string, required) - Entity key value

#### `entity_text_create` (or `priority_entity_text.create` in some clients)
Add text to an entity. Creates new text content for an entity record.

**Parameters:**
- `entity` (string, required) - Entity name
- `key` (string, required) - Entity key value
- `textData` (object, required) - Text data to add (typically contains fields like TEXT, TEXT2, etc.)

#### `entity_text_update` (or `priority_entity_text.update` in some clients)
Update text for an entity. Modifies existing text content for an entity record.

**Parameters:**
- `entity` (string, required) - Entity name
- `key` (string, required) - Entity key value
- `textData` (object, required) - Text data to update

### 5. Attachments (2 tools)

#### `entity_attachments_get` (or `priority_entity_attachments.get` in some clients)
Get attachments for an entity. Retrieves list of files attached to an entity record.

**Parameters:**
- `entity` (string, required) - Entity name (e.g. ORDERS, PART)
- `key` (string, required) - Entity key value

#### `entity_attachments_upload` (or `priority_entity_attachments.upload` in some clients)
Upload an attachment to an entity. Attaches a file to an entity record.

**Parameters:**
- `entity` (string, required) - Entity name
- `key` (string, required) - Entity key value
- `fileData` (string, required) - File data as base64-encoded string
- `fileName` (string, required) - File name (e.g., "document.pdf", "image.jpg")
- `contentType` (string, optional) - Content type (e.g., "application/pdf", "image/jpeg"). Defaults to "application/octet-stream"

### 6. Configuration & Help (2 tools)

#### `instructions_get` (or `priority_instructions.get` in some clients)
Return comprehensive guidance for interacting with Priority REST API, including standalone app architecture patterns, entity-specific guidance, and best practices.

#### `config_restflag_update` (or `priority_config.restflag_update` in some clients)
Update RESTFLAG in FORMLIMITED to enable or disable REST API access for a specific form. This tool simplifies updating FORMLIMITED by handling the composite key (ENAME + TYPE) automatically.

**Important:** FORMLIMITED uses a composite key consisting of `ENAME` (form name) and `TYPE` (form type, typically 'F'). This tool automatically constructs the correct composite key format.

**Parameters:**
- `formName` (string, required) - Form name (ENAME field in FORMLIMITED, e.g., "WAREHOUSES", "WARHSBAL")
- `restFlag` (string, required) - Set to "Y" to enable API access, "N" to disable. Must be "Y" or "N"
- `formType` (string, optional) - Form type (TYPE field in FORMLIMITED, typically "F" for forms). Default: "F"

**Example - Enable API access for WAREHOUSES:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "config_restflag_update",
    "args": {
      "formName": "WAREHOUSES",
      "restFlag": "Y"
    }
  }
}
```

**Note:** After updating RESTFLAG to 'Y', the form becomes accessible via the Priority REST API. Use `metadata_entities_list` with `apiOnly=true` to verify the form appears in the API-accessible entities list.

**Automatic API Access Detection:**

The Priority MCP tools (`query_run`, `entity_get`, `entity_create`, `entity_update`, `entity_delete`) automatically detect when an entity is not accessible via the REST API (RESTFLAG != 'Y' in FORMLIMITED). When this occurs, the tools return a helpful error message with:

- Clear explanation that the entity is not API-accessible
- Current RESTFLAG value in FORMLIMITED
- Suggestion to enable API access
- Ready-to-use solution object with the correct tool and arguments

**Example Error Response:**
```json
{
  "error": "Entity \"WAREHOUSES\" is not accessible via Priority REST API",
  "reason": "RESTFLAG is \"null\" in FORMLIMITED (needs to be \"Y\")",
  "suggestion": "Enable API access for \"WAREHOUSES\" using config_restflag_update",
  "solution": {
    "tool": "config_restflag_update",
    "args": {
      "formName": "WAREHOUSES",
      "restFlag": "Y",
      "formType": "F"
    },
    "description": "Use this tool to enable API access for \"WAREHOUSES\""
  }
}
```

This makes it easy to identify and enable API access for entities that need it, without manually checking FORMLIMITED first.

### `query_run`
Run a query against an entity with OData query options.

**Parameters:**
- `entity` (string, required) - Entity name
- `filter` (string, optional) - OData $filter expression
- `select` (array, optional) - Fields to select
- `top` (number, optional) - Maximum records to return
- `skip` (number, optional) - Records to skip (pagination)
- `orderby` (string, optional) - OData $orderby clause
- `expand` (string, optional) - OData $expand expression for subforms (e.g., `ORDERITEMS_SUBFORM`, `SHIPTO2_SUBFORM`)

**Example - Basic Query:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "query_run",
    "args": {
      "entity": "ORDERS",
      "top": 10,
      "select": ["ORDNAME", "CUSTNAME", "CURDATE", "ORDSTATUSDES"],
      "filter": "ORDSTATUSDES eq 'Active'",
      "orderby": "CURDATE desc"
    }
  }
}
```

**Example - Query with Subform Expansion:**
To fetch subform data (e.g., shipping addresses, order items), use the `expand` parameter:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "query_run",
    "args": {
      "entity": "ORDERS",
      "filter": "CUSTNAME eq 'goog'",
      "expand": "SHIPTO2_SUBFORM",
      "select": ["CUSTNAME", "CDES", "ORDNAME"]
    }
  }
}
```

**Note:** The `expand` parameter includes subform data in the response. You can expand multiple subforms by separating them with commas: `"expand": "ORDERITEMS_SUBFORM,SHIPTO2_SUBFORM"`

### `entity_create`
Create a new entity record. Supports creating entities with related subforms (e.g., ORDER with ORDERITEMS_SUBFORM). For composite keys, use comma-separated values.

**Parameters:**
- `entity` (string, required) - Entity name (or subform name when creating related entity)
- `data` (object, required) - Record payload. Can include related subforms as arrays (e.g., `ORDERITEMS_SUBFORM: [...]`)
- `parentEntity` (string, optional) - Parent entity name when creating a related entity
- `parentKey` (string, optional) - Parent entity key (comma-separated for composite keys)
- `subform` (string, optional) - Subform name when creating a related entity

**Example - Simple entity:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "entity_create",
    "args": {
      "entity": "PART",
      "data": {
        "PARTNAME": "TEST001",
        "PARTDES": "Test Part Description"
      }
    }
  }
}
```

**Example - Entity with related subforms:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "entity_create",
    "args": {
      "entity": "ORDERS",
      "data": {
        "CUSTNAME": "007",
        "ORDERITEMS_SUBFORM": [
          {
            "PARTNAME": "111-001",
            "DUEDATE": "2016-08-01T00:00:00+03:00"
          },
          {
            "PARTNAME": "111-002",
            "DUEDATE": "2016-08-01T00:00:00+03:00"
          }
        ]
      }
    }
  }
}
```

**Example - Creating related entity (subform):**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "entity_create",
    "args": {
      "entity": "ORDERITEMS_SUBFORM",
      "parentEntity": "ORDERS",
      "parentKey": "SO18000002",
      "subform": "ORDERITEMS_SUBFORM",
      "data": {
        "PARTNAME": "TR0001",
        "TQUANT": 5,
        "DUEDATE": "2018-03-15T00:00:00+02:00"
      }
    }
  }
}
```

**Reference:** [Priority REST API - Modifying Data](https://prioritysoftware.github.io/restapi/modify/)

### `entity_update`
Update an existing entity record. Supports updating related entities (subforms). For composite keys, use comma-separated format.

**Parameters:**
- `entity` (string, required) - Entity name (or subform name when updating related entity)
- `key` (string, required) - Entity key value (comma-separated for composite keys like `"IVNUM='T9696',IVTYPE='A',DEBIT='D'"`)
- `data` (object, required) - Update payload
- `parentEntity` (string, optional) - Parent entity name when updating a related entity
- `parentKey` (string, optional) - Parent entity key
- `subform` (string, optional) - Subform name when updating a related entity

**Example - Simple update:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "entity_update",
    "args": {
      "entity": "PART",
      "key": "TEST001",
      "data": {
        "PARTDES": "Updated Description"
      }
    }
  }
}
```

**Example - Update related entity (subform):**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "entity_update",
    "args": {
      "entity": "ORDERITEMS_SUBFORM",
      "key": "1",
      "parentEntity": "ORDERS",
      "parentKey": "SO18000002",
      "subform": "ORDERITEMS_SUBFORM",
      "data": {
        "TQUANT": 10
      }
    }
  }
}
```

**Example - Composite key (AINVOICES):**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "entity_update",
    "args": {
      "entity": "AINVOICES",
      "key": "IVNUM='T9696',IVTYPE='A',DEBIT='D'",
      "data": {
        "STATUS": "Active"
      }
    }
  }
}
```

**Example - Composite key (FORMLIMITED):**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "entity_update",
    "args": {
      "entity": "FORMLIMITED",
      "key": "ENAME='WAREHOUSES',TYPE='F'",
      "data": {
        "RESTFLAG": "Y"
      }
    }
  }
}
```

**Note:** For updating FORMLIMITED RESTFLAG, consider using `config_restflag_update` which handles the composite key automatically.

**Reference:** [Priority REST API - Modifying Data](https://prioritysoftware.github.io/restapi/modify/)

### `entity_text_get`
Get text content for an entity record. Retrieves text fields associated with an entity (e.g., order notes, part descriptions).

**Parameters:**
- `entity` (string, required) - Entity name (e.g., "ORDERS", "PART")
- `key` (string, required) - Entity key value

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "entity_text_get",
    "args": {
      "entity": "ORDERS",
      "key": "SO15000005"
    }
  }
}
```

**Note:** Not all entities have text fields. If an entity doesn't have text, the request will return a 404 error.

**Reference:** [Priority REST API - Requesting Text](https://prioritysoftware.github.io/restapi/request/#requesting-text)

### `entity_text_create`
Add text content to an entity record. Creates new text fields for an entity.

**Parameters:**
- `entity` (string, required) - Entity name (e.g., "ORDERS", "PART")
- `key` (string, required) - Entity key value
- `textData` (object, required) - Text data to add. Typically contains fields like `TEXT`, `TEXT2`, etc. depending on the entity type.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "entity_text_create",
    "args": {
      "entity": "ORDERS",
      "key": "SO15000005",
      "textData": {
        "TEXT": "Order notes and special instructions"
      }
    }
  }
}
```

**Reference:** [Priority REST API - Adding or Modifying Text](https://prioritysoftware.github.io/restapi/modify/#adding-or-modifying-text)

### `entity_text_update`
Update text content for an entity record. Modifies existing text fields for an entity.

**Parameters:**
- `entity` (string, required) - Entity name (e.g., "ORDERS", "PART")
- `key` (string, required) - Entity key value
- `textData` (object, required) - Text data to update. Typically contains fields like `TEXT`, `TEXT2`, etc. depending on the entity type.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "entity_text_update",
    "args": {
      "entity": "ORDERS",
      "key": "SO15000005",
      "textData": {
        "TEXT": "Updated order notes"
      }
    }
  }
}
```

**Reference:** [Priority REST API - Adding or Modifying Text](https://prioritysoftware.github.io/restapi/modify/#adding-or-modifying-text)

### `batch_operations`
Perform batch operations. Execute multiple create/update/delete operations in a single request with dependencies. Useful for creating entities with related subforms and getting clear error messages.

**Parameters:**
- `requests` (array, required) - Array of batch request objects

Each request object:
- `id` (string, required) - Unique identifier (e.g., "1", "2")
- `method` (string, required) - HTTP method: "POST", "PATCH", or "DELETE"
- `url` (string, required) - Relative URL (e.g., "ORDERS" or "$1/ORDERITEMS_SUBFORM" to reference previous request)
- `headers` (object, optional) - Request headers
- `body` (object, optional) - Request body (for POST/PATCH)
- `dependsOn` (array, optional) - Array of request IDs this depends on (e.g., ["1"])

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "batch_operations",
    "args": {
      "requests": [
        {
          "id": "1",
          "method": "POST",
          "url": "ORDERS",
          "body": {
            "CUSTNAME": "T000001"
          }
        },
        {
          "id": "2",
          "method": "POST",
          "url": "$1/ORDERITEMS_SUBFORM",
          "dependsOn": ["1"],
          "body": {
            "PARTNAME": "MS0001",
            "DUEDATE": "2022-08-01T00:00:00+03:00"
          }
        }
      ]
    }
  }
}
```

**Reference:** [Priority REST API - Batch Operations](https://prioritysoftware.github.io/restapi/modify/#Performing_Batch_Operations)

### `metadata_refresh`
Clear and refresh metadata for an entity (or all entities). Use this when private customizations add fields to a form - new fields will not appear in REST API until metadata is refreshed.

**Parameters:**
- `entity` (string, optional) - Entity name to refresh metadata for (e.g., "ORDERS"). If not provided, metadata for all entities will be cleared.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "metadata_refresh",
    "args": {
      "entity": "ORDERS"
    }
  }
}
```

**Reference:** [Priority REST API - Refreshing Metadata](https://prioritysoftware.github.io/restapi/modify/#Refreshing_Metadata)

### `entity_delete`
Delete an entity record. Supports deleting related entities (subforms). For composite keys, use comma-separated format.

**Parameters:**
- `entity` (string, required) - Entity name (or subform name when deleting related entity)
- `key` (string, required) - Entity key value (comma-separated for composite keys)
- `parentEntity` (string, optional) - Parent entity name when deleting a related entity
- `parentKey` (string, optional) - Parent entity key
- `subform` (string, optional) - Subform name when deleting a related entity

**Example - Simple delete:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "entity_delete",
    "args": {
      "entity": "PART",
      "key": "TEST001"
    }
  }
}
```

**Example - Delete related entity (subform):**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "entity_delete",
    "args": {
      "entity": "ORDERITEMS_SUBFORM",
      "key": "1",
      "parentEntity": "ORDERS",
      "parentKey": "SO18000002",
      "subform": "ORDERITEMS_SUBFORM"
    }
  }
}
```

**Reference:** [Priority REST API - Modifying Data](https://prioritysoftware.github.io/restapi/modify/)

## API Endpoints

### `GET /`
Server information and available endpoints.

**Response:**
```json
{
  "name": "Priority MCP Server",
  "version": "0.1.0",
  "endpoints": {
    "mcp": "/mcp",
    "health": "/health",
    "capabilities": "/capabilities",
    "sse": "/sse"
  }
}
```

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "time": "2025-11-13T17:00:00.000Z"
}
```

### `GET /capabilities`
Server capabilities and transport information.

**Response:**
```json
{
  "name": "Priority MCP Server",
  "version": "0.1.0",
  "capabilities": {
    "tools": {
      "listChanged": false
    }
  },
  "transport": {
    "type": "http",
    "version": "1.0",
    "sseEnabled": true
  }
}
```

### `POST /mcp`
Main MCP JSON-RPC endpoint. Accepts standard MCP protocol messages.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

### `GET /sse` (if SSE enabled)
Establish Server-Sent Events connection for streaming MCP responses.

### `POST /sse` (if SSE enabled)
Send MCP message over existing SSE connection.

## Priority REST API Reference

The Priority MCP Server communicates with Priority via its OData-based REST API. For complete API documentation, see:

**Official Priority REST API Documentation:** https://prioritysoftware.github.io/restapi/

Key topics:
- **Authentication**: Basic, PAT, or OAuth2
- **Requesting Data**: Service root, metadata, entity collections
- **Querying Data**: Filtering, sorting, pagination, field selection
- **Modifying Data**: Creating, updating, deleting records
- **Error Handling**: HTTP status codes and error formats

## Integration with MCP Clients

### Cursor IDE

Add to `~/.cursor/mcp.json` (Linux/Mac) or `C:\Users\<username>\.cursor\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "priority-mcp": {
      "url": "http://your-server:3000/mcp",
      "allowInsecure": true
    }
  }
}
```

Restart Cursor and the Priority MCP tools will be available.

### Other MCP Clients

Any MCP-compatible client can connect to the server by sending JSON-RPC 2.0 messages to the `/mcp` endpoint.

## Deployment

For containerized deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Troubleshooting

### Connection Issues

- Verify `PRIORITY_BASE_URL` is correct and accessible
- Check network connectivity to Priority server
- Verify authentication credentials
- Review Priority server logs for API access issues

### Timeout Errors

- Increase `PRIORITY_HTTP_TIMEOUT_MS` for slow queries
- Use `$top` to limit result set size
- Implement pagination with `$skip` for large datasets

### Authentication Errors

- Verify `PRIORITY_AUTH_TYPE` matches your Priority configuration
- Check that credentials are correctly set
- For PAT/OAuth2, ensure token is valid and not expired
- For per-app licensing, verify `PRIORITY_APP_ID` and `PRIORITY_APP_KEY`

### CORS Issues

The server includes CORS middleware. If issues persist:
- Verify the client's origin is allowed
- Check that credentials are properly handled
- Review browser console for specific CORS errors

## Docker Deployment

The repository includes a production-ready Dockerfile in the root directory. This enables easy deployment and CI/CD integration.

### Quick Start

**Build the Docker image:**
```bash
docker build -t priority-rest-api-mcp-server:latest .
```

**Run with environment variables:**
```bash
docker run -d \
  --name priority-rest-api-mcp \
  -p 3000:3000 \
  -e PRIORITY_BASE_URL="https://priority.example.com/odata/Priority/tabula.ini/demo/" \
  -e PRIORITY_AUTH_TYPE="basic" \
  -e PRIORITY_USERNAME="api_user" \
  -e PRIORITY_PASSWORD="secure_password" \
  -e HTTP_PORT=3000 \
  priority-rest-api-mcp-server:latest
```

**Run with .env file:**
```bash
docker run -d \
  --name priority-rest-api-mcp \
  -p 3000:3000 \
  --env-file .env \
  priority-rest-api-mcp-server:latest
```

**Note:** Never commit `.env` files with secrets to version control. Use environment variables or secure secret management in production.

### Docker Features

- **Multi-stage build**: Optimizes image size by separating build and runtime dependencies
- **Layer caching**: Package files are copied first for efficient rebuilds
- **Non-root user**: Runs as `nodejs` user for improved security
- **Production optimized**: Only production dependencies included in final image
- **Health check**: Built-in health check endpoint monitoring
- **Small base image**: Uses `node:18-slim` for minimal footprint

### Docker Compose

For local development, you can also use the existing Docker Compose setup in `deployment/local/docker/`. The root Dockerfile is now the recommended approach for production deployments and CI/CD pipelines.

### Viewing Logs

```bash
# View container logs
docker logs -f priority-rest-api-mcp

# Check container status
docker ps

# Stop and remove container
docker stop priority-rest-api-mcp
docker rm priority-rest-api-mcp
```

### Compatibility Note

The existing Docker setup in `deployment/local/docker/` remains available for backward compatibility. The root Dockerfile is the recommended default for new deployments and provides better optimization and security.

## License

MIT






