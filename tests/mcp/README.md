# MCP read-only test suite

82 checks against a running server: HTTP surface and auth guard, MCP protocol handshake,
tool/prompt/resource discovery, every read-only tool, validation paths of the write tools
(which never reach Priority), all prompts and all resources.

Nothing in here creates, updates or deletes ERP data.

## Run

```bash
# 1. start the server (any port), e.g.
ODATA_MCP_TOKEN=dev-token HTTP_PORT=3011 node src/index.js

# 2. run the suite against it
TEST_MCP_TOKEN=dev-token npm run test:mcp -- http://127.0.0.1:3011
```

The suite exits non-zero if any check fails and writes `results.json` next to itself.

Requires a reachable Priority instance (`PRIORITY_BASE_URL`, `PRIORITY_AUTH_TYPE`,
credentials) — the read-only tool checks query real entities (CUSTOMERS, ORDERS).
The first call to an entity can be slow while Priority builds its metadata cache;
raise `PRIORITY_HTTP_TIMEOUT_MS` (default 30000) if cold calls time out.
