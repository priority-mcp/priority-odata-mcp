# data/retrieved/

This directory is used for **local development only** to store raw JSON responses fetched from a Priority ERP instance during testing and debugging.

**All files in this directory are gitignored** (except this README and `.gitkeep`).

⚠️ **Do not commit files from this directory.** They may contain:
- Live ERP data (customers, orders, suppliers, users)
- Internal hostnames or IP addresses
- Personal data subject to privacy regulations

## Usage

Files are written here by test scripts in `tests/scripts/` and are intended only for local inspection.

To fetch fresh data for your own instance, run:

```bash
node tests/scripts/test-priority-operations.js
```

or use the MCP tools directly against your Priority instance.
