# Priority REST API MCP Server

An MCP server that connects AI assistants — Claude and others — directly to a Priority ERP system. Every OData operation (query, create, update, delete, batch, attachments, text fields) is exposed as an MCP tool, so AI agents can read and write live business data without custom integration code.

**Version:** 0.2.0 · **Transport:** Streamable HTTP (SSE optional) · **Runtime:** Node.js 22 (distroless image) · **Tools:** 19

---

## Quick Start

**1. Clone and install**
```bash
git clone https://github.com/priority-mcp/priority-odata-mcp priority-mcp
cd priority-mcp
npm install
```

**2. Create `.env` from the example**
```bash
cp .env.example .env
```

At minimum, set these variables (example with basic auth):
```env
PRIORITY_BASE_URL=https://<host>/odata/Priority/<tabula.ini>/<company>/
PRIORITY_AUTH_TYPE=basic
PRIORITY_USERNAME=myuser
PRIORITY_PASSWORD=mypassword
ODATA_MCP_TOKEN=<strong-random-secret>
```

For Personal Access Token (PAT) auth instead:
```env
PRIORITY_AUTH_TYPE=pat
PRIORITY_PAT=<your-priority-pat>
ODATA_MCP_TOKEN=<strong-random-secret>
```
Priority PAT uses HTTP Basic with `username=<token>` and password literal `PAT` (handled by the server).

**3. Start the server**
```bash
# Development (from source)
node src/index.js

# Production (bundled)
npm run build
node dist/index.js
```

On first run, if `ODATA_MCP_TOKEN` is not set, a random Bearer token is generated and printed to stdout. Copy it for the next step.

**4. Connect from Claude Code**

Add to your MCP config:
```json
{
  "mcpServers": {
    "priority": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <ODATA_MCP_TOKEN>"
      }
    }
  }
}
```

---

## Transport

The server uses **Streamable HTTP** as its primary transport — each `POST /mcp` request is fully stateless. A new `McpServer` and `StreamableHTTPServerTransport` are created per request and torn down after.

| Endpoint | Method | Purpose |
|---|---|---|
| `/mcp` | POST | Primary MCP endpoint (Streamable HTTP) |
| `/sse` | GET | SSE stream — requires `SSE_ENABLED=true` |
| `/sse` | POST | JSON-RPC messages for SSE clients |
| `/health` | GET | Health check — returns version and status |
| `/.well-known/oauth-authorization-server` | GET | OAuth 2.1 discovery (required by Claude Code ≥2.1.92) |
| `/authorize`, `/token`, `/register` | GET/POST | OAuth 2.1 PKCE flow — auto-approves |

> **Note:** The OAuth 2.1 endpoints exist to satisfy Claude Code's Streamable HTTP connection handshake. They auto-approve all requests and are not intended for real access control — that is handled by `ODATA_MCP_TOKEN`.

---

## Authentication

Authentication operates at two independent layers.

**Layer 1 — Protecting this server**

All routes (except `/health` and OAuth endpoints) require:
```
Authorization: Bearer <ODATA_MCP_TOKEN>
```
Set `ODATA_MCP_TOKEN` in `.env`. If absent, a random UUID is generated at startup and printed to stdout.

**Layer 2 — Calling Priority ERP**

Controlled by `PRIORITY_AUTH_TYPE`:

- `basic` — HTTP Basic auth using `PRIORITY_USERNAME` + `PRIORITY_PASSWORD`
- `pat` — Priority Personal Access Token via `PRIORITY_PAT` (sent as Basic `token:PAT`)
- `oauth2` — OAuth2 access token via `PRIORITY_PAT` (sent as `Authorization: Bearer`)
- `none` — no auth header (local testing only)

Write operations (`POST`/`PATCH`/`DELETE`) automatically fetch and retry with an `X-CSRF-Token` header if the initial request is rejected, following Priority's CSRF protection pattern.

Optional per-application license headers are sent with every Priority request when `PRIORITY_APP_ID` and `PRIORITY_APP_KEY` are set (`X-App-Id` / `X-App-Key`).

---

## Configuration

Copy `.env.example` to `.env`. The server searches for `.env` in order: `ENV_FILE_PATH` → `./mcp-servers/Priority-REST-API-MCP-Server/.env` → `./.env`.

### Required

| Variable | Description |
|---|---|
| `PRIORITY_BASE_URL` | OData root URL — format: `https://<host>/odata/Priority/<tabula.ini>/<company>/` |
| `PRIORITY_AUTH_TYPE` | `basic` \| `pat` \| `oauth2` \| `none` |
| `PRIORITY_USERNAME` | Username — required when `AUTH_TYPE=basic` |
| `PRIORITY_PASSWORD` | Password — required when `AUTH_TYPE=basic` |

### Priority Auth (optional)

| Variable | Description |
|---|---|
| `ODATA_MCP_TOKEN` | Bearer token protecting `/mcp`. Random UUID used if not set. |
| `PRIORITY_PAT` | Personal Access Token when `AUTH_TYPE=pat` (Basic `token:PAT`), or OAuth2 bearer when `AUTH_TYPE=oauth2` |
| `PRIORITY_APP_ID` | Application license ID — sent as `X-App-Id` header |
| `PRIORITY_APP_KEY` | Application license key — sent as `X-App-Key` header |
| `PRIORITY_LANGUAGE` | Overrides `Accept-Language` header (e.g. `en`) |

### HTTP Server

| Variable | Default | Description |
|---|---|---|
| `HTTP_HOST` | `0.0.0.0` | Bind address |
| `HTTP_PORT` | `3000` | Listen port |
| `SSE_ENABLED` | `false` | Enable `/sse` endpoint |

### Timeouts & TLS

| Variable | Default | Description |
|---|---|---|
| `PRIORITY_HTTP_TIMEOUT_MS` | `30000` | Read timeout for Priority API calls (ms) |
| `MCP_WRITE_TIMEOUT` | `15000` | Timeout for POST/PATCH/DELETE operations (ms) |
| `MCP_PROC_TIMEOUT` | `45000` | Timeout for batch operations (ms) |
| `TLS_REJECT_UNAUTHORIZED` | `false` | Set `true` in production to reject self-signed certs |

### Debugging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | `DEBUG` logs every request and response |
| `MCP_DEBUG` | `false` | Print full OData URLs, params, result counts |
| `PRIORITY_ENABLE_TRACE` | `false` | Adds `X-App-Trace: 1` to every Priority request |
| `STRICT_DATA_INTEGRITY` | `true` | Throws on empty/mock API responses — disable only for testing |
| `ENV_FILE_PATH` | — | Override path to `.env` file (useful for submodule deployments) |

---

## Tools

All 19 tools are defined in `src/tools/` and registered in `src/tools/priorityTools.js`.

### System & Metadata

| Tool | Description | Parameters |
|---|---|---|
| `version_get` | Fetch the Priority service version and response headers | — |
| `metadata_entities_list` | List all OData entity sets; filter to REST-enabled forms only | `apiOnly?`, `includeMetadata?` |
| `metadata_schema_get` | Get field schema for an entity by fetching a sample record. Auto-redirects subform names to parent + `$expand` | **`entity`**, `sample?`, `top?` |
| `metadata_refresh` | Clear and refresh server-side metadata cache. Always does a full flush (see Known Limitations) | `entity?` |

### Querying

| Tool | Description | Parameters |
|---|---|---|
| `entity_get` | Fetch a single record by key or lookup, with optional `$expand` and `$select` | **`entity`**, `key`, `lookup`, `select?`, `expand?` |
| `query_run` | Run an OData query with full filter/select/top/skip/orderby/expand/count support. Validates date filter results post-fetch | **`entity`**, `filter?`, `select?`, `top?`, `skip?`, `orderby?`, `expand?`, `count?`, `deltaToken?` |
| `safe_query_run` | Like `query_run` but auto-discovers valid fields first and validates `$select` field names before executing — prevents 400 errors from invalid column names | **`entity`**, `filter?`, `select?`, `top?`, `skip?`, `expand?`, `count?` |
| `query_sum` | Sum a numeric field across an entity with an optional filter. Tries `$apply=aggregate` first; falls back to a full paging scan | **`entity`**, `field?`, `filter?` |

### Create / Update / Delete

| Tool | Description | Parameters |
|---|---|---|
| `entity_create` | Create a new record. Supports subform creation via `parentEntity` + `parentKey` + `subform` | **`entity`**, **`data`**, `parentEntity?`, `parentKey?`, `parentLookup?`, `subform?` |
| `entity_update` | Update a record via PATCH with `If-Match: *`. Supports composite keys | **`entity`**, **`key`**, **`data`**, `parentEntity?`, `parentKey?`, `subform?` |
| `entity_delete` | Delete a record via DELETE with `If-Match: *`. Supports subform deletes | **`entity`**, **`key`**, `parentEntity?`, `parentKey?`, `subform?` |
| `batch_operations` | Execute multiple POST/PATCH/DELETE in one `$batch` request with dependency chaining | **`requests[]`** (id, method, url, body?, dependsOn?) |

### Text Fields

| Tool | Description | Parameters |
|---|---|---|
| `entity_text_get` | Fetch the rich-text content of a record's `/Text` subresource | **`entity`**, **`key`** |
| `entity_text_create` | POST new text content to `/Entity(Key)/Text` | **`entity`**, **`key`**, **`textData`** |
| `entity_text_update` | PATCH existing text content on `/Entity(Key)/Text` | **`entity`**, **`key`**, **`textData`** |

### Attachments

| Tool | Description | Parameters |
|---|---|---|
| `entity_attachments_get` | List attachments on a record | **`entity`**, **`key`** |
| `entity_attachments_upload` | Upload a file to a record's `/Attachments` subresource as multipart/form-data. `fileData` must be base64-encoded | **`entity`**, **`key`**, **`fileData`**, **`fileName`**, `contentType?` |

### Configuration & Help

| Tool | Description | Parameters |
|---|---|---|
| `instructions_get` | Returns the full operational guide: OData syntax, subform patterns, throttle limits, date handling rules, known failure patterns, and architecture examples. Call this first when exploring an unfamiliar entity | — |
| `config_restflag_update` | Set `RESTFLAG=Y` or `N` in the `FORMLIMITED` table to enable or disable REST API access for a Priority form | **`formName`**, **`restFlag`**, `formType?` |

---

## Prompts & Resources

The server registers MCP **prompts** (reusable instruction templates) and **resources** (live data endpoints).

### Prompts (`src/prompts/`)

| Name | Purpose |
|---|---|
| `query_priority_entity` | Guide for constructing OData queries against an entity |
| `explore_entity_relationships` | Explains the subform hierarchy for a given entity |
| `modify_priority_data` | Guides create, update, and delete operations |
| `date_handling_guide` | Critical rules for date filters — ISO format, operator validation |
| `known_failure_patterns` | Documented 404/501/400 patterns and their workarounds |
| `pagination_guide` | Explains `$top`/`$skip` and count patterns |

### Resources (`src/resources/`)

| URI | Purpose |
|---|---|
| `priority://entities/list` | Live list of all REST-enabled entities (`RESTFLAG=Y`) |
| `priority://entity-schema/{entity}` | Schema for a specific entity (template URI) |
| `priority://queries/common` | Library of ready-to-use query examples |
| `priority://subforms/reference` | Reference guide for subform patterns and operations |

---

## Example Tool Call

Query the three most recent sales orders for customer `1011` — sent as JSON-RPC 2.0 to `POST /mcp`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query_run",
    "arguments": {
      "entity":  "ORDERS",
      "filter":  "CUSTNAME eq '1011'",
      "select":  ["ORDNAME", "CUSTNAME", "CURDATE", "TOTPRICE"],
      "top":     3,
      "orderby": "CURDATE desc"
    }
  }
}
```

The server issues:
```
GET /odata/Priority/.../ORDERS?$format=json&$filter=CUSTNAME+eq+'1011'
  &$select=ORDNAME,CUSTNAME,CURDATE,TOTPRICE&$top=3&$orderby=CURDATE+desc
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"value\":[{\"ORDNAME\":\"SO25000001\",\"CUSTNAME\":\"1011\",\"CURDATE\":\"2025-07-15T00:00:00+03:00\",\"TOTPRICE\":15000.0},...],\"_mcp_metadata\":{\"entity\":\"ORDERS\",\"resultCount\":2,\"filterApplied\":true}}"
    }],
    "isError": false
  }
}
```

> **Date format:** Priority returns dates as ISO 8601 with a timezone offset (e.g. `2025-07-15T00:00:00+03:00`), not UTC `Z`. Use `CURDATE ge 2025-01-01` syntax in date filters — not ISO-Z format.

---

## Deployment

### Docker

```bash
# Build
docker build -t priority-mcp .

# Run
docker run --env-file .env -p 3000:3000 priority-mcp
```

The production Dockerfile is a multi-stage build: `node:22-bookworm-slim` builder → `gcr.io/distroless/nodejs22-debian12:nonroot` runtime. A Docker Compose setup and local TLS certificate generator are in `deployment/local/`. CI runs Trivy image + filesystem scans on pull requests.

### Production checklist

- Set `ODATA_MCP_TOKEN` explicitly — do not rely on the auto-generated one
- Set `TLS_REJECT_UNAUTHORIZED=true`
- Set `STRICT_DATA_INTEGRITY=true` (default)
- Set `LOG_LEVEL=INFO` (default — suppresses housekeeping noise)
- Pin `HTTP_HOST` to a specific interface if not exposing publicly

---

## Known Limitations

Priority ERP-specific behaviors worth knowing before you build.

**Rate limiting — 100 calls/minute per user**
Priority Cloud throttles to 100 API calls/minute per user, maximum 10 parallel requests, 3-minute timeout per call. Design agents to batch operations where possible.

**Response cap — `MAXFORMLINES`**
Priority silently truncates responses at the `MAXFORMLINES` system constant regardless of `$top`. Use `$skip`-based pagination if you need all records.

**Subforms are not standalone entities**
Querying `PORDERITEMS_SUBFORM` directly returns HTTP 404. Subforms must be accessed via the parent entity with `$expand=PORDERITEMS_SUBFORM`. `metadata_schema_get` auto-detects this and redirects.

**`$apply=aggregate` not supported**
`query_sum` always falls back to a full paging scan because `$apply=aggregate(...)` is not supported on this Priority version.

**`GET /ENTITY/$count` returns 500**
Use `?$top=0&$count=true` instead. Internally, `tryEstimateCount()` tries `/$count` first then pages in 500-record batches (capped at 10,000).

**`contains()`/`startswith()` unsupported on some fields**
`EPROG.ENAME` and `EREP.ENAME` only support `eq` exact match — string functions return HTTP 501.

**Entity-level metadata refresh returns 400**
`metadata_refresh` ignores the `entity` argument and always does a full cache flush, because Priority rejects entity-scoped cache-clear requests.

**Batch URL encoding**
URLs inside `batch_operations` requests are never auto-encoded. Spaces and special characters must be manually percent-encoded (spaces → `%20`).

**Composite keys**
Some entities use composite keys, e.g. `FORMLIMITED`: `ENAME='X',TYPE='F'`; `AINVOICES`: `IVNUM='T9696',IVTYPE='A',DEBIT='D'`. Pass the full composite key string to `entity_update` and `entity_delete`.

---

## Project Structure

```
/
├── src/
│   ├── index.js                    Entry point — creates and starts PriorityMCPServer
│   ├── server.js                   Express app, all routes, auth guard, OAuth 2.1 PKCE
│   ├── sseServer.js                SSE connection manager
│   ├── config.js                   Reads all env vars, resolves .env path
│   ├── version.js                  SERVER_VERSION, KNOWN_ISSUES list
│   │
│   ├── priority/
│   │   └── client.js               PriorityClient — axios instance, auth headers,
│   │                               all API methods (runQuery, createEntity, …)
│   │
│   ├── mcp/
│   │   ├── handler.js              JSON-RPC 2.0 dispatcher (SSE path)
│   │   ├── registry.js             ToolRegistry — registerTool, callTool, listTools
│   │   ├── prompt-registry.js
│   │   ├── resource-registry.js
│   │   ├── priority-mcp-sdk-server.js   Wires registries into McpServer (SDK path)
│   │   ├── tool-call-runner.js          Executes tool, wraps result for MCP response
│   │   └── json-schema-to-zod.js        JSON Schema → Zod conversion
│   │
│   ├── tools/                      One file per tool + priorityTools.js (registration)
│   ├── prompts/                    One file per prompt + priorityPrompts.js
│   ├── resources/                  One file per resource + priorityResources.js
│   └── utils/
│       ├── data-integrity.js       ensureNoMockData(), validateApiResponse()
│       ├── date-handling.js        Date parsing and validation helpers
│       ├── errors.js               createPriorityApiError(), FilterNotAppliedError
│       ├── filter-resolver.js      OData filter string building
│       ├── expand-resolver.js      $expand normalization
│       ├── entity-resolver.js      Entity name / subform name resolution
│       ├── resolve-query-args.js
│       └── subform-query-resolver.js
│
├── data/
│   └── entity-relationships.json   Hardcoded subform map (PORDERS, ORDERS, …)
│
├── tests/
│   ├── scripts/                    Manual test scripts
│   └── results/                    Saved JSON/Markdown test output
│
├── docs/                           Design docs (DATA_INTEGRITY_POLICY, DATE_HANDLING_RULES, …)
├── postman/                        Postman collection for manual API testing
├── deployment/local/               Docker Compose + TLS cert generator
├── build.js                        esbuild bundler: src/ → dist/
└── .env.example                    All env vars documented with descriptions
```

---

## Tests

There is no automated test runner. Tests are manual scripts that require a live Priority connection:

```bash
# Read operations
node tests/scripts/test-priority-operations.js

# Write operations (interactive — asks for confirmation)
node tests/scripts/test-write-operations.js

# Test all 19 MCP tools via the running server
node tests/scripts/test-all-mcp-tools-via-server.js

# Standalone resolver smoke tests
node test-keyresolver.js
node test-resolver.js
```

> **Warning:** Write tests will create, update, and delete real records. Run against a development company only.

---

## Tech Stack

- **Runtime:** Node.js 22, ES Modules (`"type": "module"`); production image is distroless nonroot
- **MCP SDK:** `@modelcontextprotocol/sdk ^1.29.0`
- **HTTP server:** `express ^4.21.1`
- **HTTP client:** `axios ^1.7.7`
- **Schema validation:** `zod ^4.3.6`
- **Bundler:** `esbuild ^0.25.0` (via `npm run build`)
- **Other:** `cors`, `dotenv`, `form-data`, `uuid`, `http-errors`
