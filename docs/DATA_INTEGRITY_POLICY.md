# Data Integrity Policy - No Mock Data Allowed

## Policy Statement

**The Priority MCP Server enforces a strict policy: NO MOCK, FAKE, SYNTHETIC, OR PLACEHOLDER DATA IS ALLOWED.**

All data returned by the Priority MCP Server must come directly from the Priority ERP system via authenticated API calls. When data cannot be fetched from the Priority ERP system, operations **MUST FAIL** with clear error messages. **NEVER** return empty arrays, empty objects, or placeholder data as fallback.

## Core Principles

1. **All Data Must Come from Priority ERP**
   - Every data point must originate from a real API call to the Priority ERP system
   - No hardcoded data, no mock responses, no synthetic data generation
   - Empty results are only acceptable when the Priority ERP system returns them (real empty data)

2. **Fail Fast, Fail Clearly**
   - When API calls fail, throw errors immediately
   - Error messages must explicitly state: "No mock data allowed"
   - Never silently fall back to empty/mock data structures

3. **Validate at Boundaries**
   - API client validates all responses from Priority ERP
   - Tools validate data before returning results
   - MCP handler performs runtime validation on tool results

4. **Audit Trail**
   - All API calls are logged with timestamps
   - Error logs include full context about failed operations
   - Traceability ensures data provenance

## Implementation Details

### Error Handling

When a Priority API call fails, the system:

1. **Throws a `PriorityApiError`** with:
   - Clear message stating the operation failed
   - Explicit statement: "No mock data allowed"
   - Original error details for debugging
   - Full context (entity, parameters, etc.)

2. **Never Returns:**
   - Empty arrays `[]` as fallback
   - Empty objects `{}` as fallback
   - Placeholder values
   - Mock/synthetic data structures

### Example Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Failed to fetch data from Priority ERP system. No mock data allowed - operation must fail when API call fails. Operation: runQuery(ORDERS)",
    "data": {
      "tool": "query_run",
      "policy": "NO_MOCK_DATA_ALLOWED",
      "originalError": "Request failed with status code 404"
    }
  }
}
```

### Valid Empty Results

Empty results are **ONLY** valid when:

- The Priority ERP API successfully returns an empty result
- Example: `{ "value": [] }` from Priority OData API
- This is **real empty data** from the ERP, not a fallback

### Invalid "Empty" Results

These are **NOT ALLOWED**:

- Returning `[]` when API call fails
- Returning `{}` when API call fails
- Returning `{ "error": "...", "data": [] }` when API call fails
- Any fallback logic that returns data structures when API calls fail

## Configuration

### Environment Variable

```bash
STRICT_DATA_INTEGRITY=true  # Default: true
```

When `STRICT_DATA_INTEGRITY=true` (default):
- All data integrity checks are enforced
- Runtime validation occurs on all tool results
- API responses are validated for structure

When `STRICT_DATA_INTEGRITY=false`:
- Basic error handling still applies (no mock data)
- Runtime validation is disabled (for debugging only)
- **Not recommended for production use**

## Tool Behavior

### All Data-Fetching Tools

Tools that fetch data from Priority ERP:

- `priority_query.run`
- `priority_entity.get`
- `priority_entities.list`
- `priority_api_entities.list`
- `priority_entity_schema.get`

**Behavior:**
- Must call Priority API via `PriorityClient`
- Must throw errors when API calls fail
- Must never return mock/empty data as fallback

### Example: Query Tool

```javascript
// ✅ CORRECT: Throws error when API fails
try {
    return await client.runQuery(entity, options);
} catch (error) {
    throw createPriorityApiError(`runQuery(${entity})`, error, options);
}

// ❌ WRONG: Returns empty array as fallback
try {
    return await client.runQuery(entity, options);
} catch (error) {
    return { value: [] }; // NEVER DO THIS
}
```

## Validation Layers

### Layer 1: Priority Client

- Validates API responses have expected OData structure
- Logs all API calls for audit trail
- Throws `PriorityApiError` on failures

### Layer 2: Tools

- Call Priority Client methods
- Propagate errors (no fallback logic)
- Add context to error messages

### Layer 3: MCP Handler

- Runtime validation of tool results
- Checks for mock data patterns
- Ensures error messages include policy statement

## Testing and Verification

### How to Verify No Mock Data

1. **Disconnect from Priority ERP**
   - All tools should fail with clear errors
   - No tools should return empty/mock data

2. **Check Error Messages**
   - All errors should include "No mock data allowed"
   - Errors should reference the specific operation that failed

3. **Review Logs**
   - API calls should be logged with timestamps
   - Failed operations should have full context

### Example Test Scenario

```bash
# Disconnect Priority ERP or use invalid credentials
export PRIORITY_BASE_URL="https://invalid.example.com/odata/..."

# Run any data-fetching tool
# Expected: Error with "No mock data allowed" message
# NOT Expected: Empty result or mock data
```

## Compliance

### For Developers

- **Never** add fallback logic that returns empty/mock data
- **Always** throw errors when API calls fail
- **Always** include "No mock data allowed" in error messages
- **Always** use `PriorityClient` methods (never bypass API calls)

### For Code Review

Check for:
- ❌ Fallback logic returning `[]` or `{}` on errors
- ❌ Hardcoded data or mock responses
- ❌ Silent error swallowing
- ✅ Proper error propagation
- ✅ Error messages include policy statement
- ✅ API calls are logged

## Consequences of Violations

If mock data is detected or returned:

1. **Runtime Validation** will throw `DataIntegrityError`
2. **Error Logs** will include violation details
3. **Tool Execution** will fail with clear error message
4. **Audit Trail** will record the violation

## Questions?

If you have questions about this policy or need to handle a specific edge case:

1. **Default to throwing errors** - When in doubt, fail with a clear error
2. **Document the case** - If you believe an exception is needed, document why
3. **Get approval** - Policy exceptions require explicit approval

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [Priority REST API Documentation](https://prioritysoftware.github.io/restapi/)
- Error handling utilities: `src/utils/errors.js`
- Data integrity utilities: `src/utils/data-integrity.js`












