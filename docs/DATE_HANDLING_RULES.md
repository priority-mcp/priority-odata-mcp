# Date Handling Rules for Priority ERP MCP Agent

## Overview

This document defines the critical date handling rules that the MCP Agent must follow when querying Priority ERP via the Priority OData REST API MCP.

## 🔍 Mandatory Discovery Step (ALWAYS FIRST)

Before executing any query:

1. **Call and review:**
   - `prompts/list` - Check for existing date-handling guidance
   - `resources/list` - Review available resources

2. **Identify:**
   - Existing date-handling guidance
   - Entity-specific date fields
   - Known OData limitations (casts, types, formats)

3. **Only after this step may you construct a query.**

## 📅 Date Handling Rules (Critical)

### Primary Date Field

**For 99% of Priority entities, including ORDERS:**
- **Primary date field: CURDATE**
- Use ORDDATE only if:
  - Explicitly documented in entity schema
  - Or validated via Entity Schema resource

### Year-Based Queries

**You MUST translate them to a full-day time range:**

**Pattern:**
- Start: `YYYY-01-01T00:00:01+TZ`
- End: `YYYY+1-01-01T00:00:00+TZ`

**Example for year 2025:**
```
(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)
```

### ⚠️ Forbidden Formats

**Do NOT use:**
- ❌ `cast(...)` - Not supported
- ❌ `'datetime'...` - Invalid format
- ❌ Date-only strings (e.g., `'2025-01-01'`) - Missing timezone
- ❌ String comparisons against Edm.DateTimeOffset

### ✅ Required Format

- **Always use offset-aware datetimes**: `2025-01-01T00:00:01+02:00`
- **Normalize all comparisons** to the same timezone
- **Never compare** offset-aware with offset-naive datetimes

## 🕒 Timezone Discipline

- Always produce offset-aware datetimes
- Normalize all internal comparisons to the same timezone
- Common timezones: `+00:00` (UTC), `+02:00` (Israel Standard Time)

## 🧪 Post-Query Validation (Mandatory)

After receiving results:

**Validate:**
1. All records fall within requested date range
2. No record violates year constraint

**If mismatch detected:**
- Report via planner_metadata
- Do NOT silently trim results
- Raise `FilterNotAppliedError` if filter was not applied server-side

## 🧠 Fallback Policy

If OData rejects the filter:

1. Retry only with documented formats
2. If still rejected, return a clear MCP error
3. Do NOT fallback to unfiltered $top queries unless explicitly allowed

## 📝 Logging & Transparency

Always include:
- Chosen date field
- Final $filter string
- Timezone used
- Validation summary

## Implementation

### Available Prompts

- **`date_handling_guide`** - Comprehensive date handling guide with examples
- **`query_priority_entity`** - Query builder with date handling rules

### Available Resources

- **`priority://queries/common`** - Common query patterns with proper date handling
- **`priority://entity-schema/{entity}`** - Entity schema to identify correct date fields

### Utility Functions

- **`src/utils/date-handling.js`** - Date handling utilities:
  - `yearToDateRangeFilter()` - Convert year to proper date range
  - `getPrimaryDateField()` - Get primary date field for entity
  - `validateDateFilterFormat()` - Validate filter format
  - `normalizeToOffsetAware()` - Normalize dates with timezone

## Examples

### Year-Based Query (2025)

```json
{
  "entity": "ORDERS",
  "filter": "(CURDATE ge 2025-01-01T00:00:01+00:00) and (CURDATE lt 2026-01-01T00:00:00+00:00)"
}
```

### Date Range Query

```json
{
  "entity": "ORDERS",
  "filter": "(CURDATE ge 2025-01-01T00:00:01+02:00) and (CURDATE le 2025-12-31T23:59:59+02:00)"
}
```

## Validation

The `PriorityClient.runQuery` method includes:
- Pre-request validation: Ensures filter is in params
- Post-request validation: Validates date filters were applied correctly
- Debug logging: Full request URL and parameters (when `DEBUG=true` or `MCP_DEBUG=true`)
- Metadata: Request details stored in `_mcp_metadata` for LangSmith inspection

## Related Files

- `src/prompts/date-handling-prompt.js` - Date handling prompt
- `src/prompts/query-builder-prompt.js` - Query builder with date rules
- `src/resources/common-queries-resource.js` - Updated with proper date examples
- `src/utils/date-handling.js` - Date utility functions
- `src/priority/client.js` - Enhanced with date filter validation

