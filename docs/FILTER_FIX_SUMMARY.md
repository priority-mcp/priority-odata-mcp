# Query Filter Fix - Summary

## Problem
Tool arguments included a filter for 2025 (e.g., `filter: "year(CURDATE) eq 2025"`), but results contained CURDATE values from 2015, indicating the server-side filter was NOT being applied.

## Root Cause
The `PriorityClient.runQuery` method was correctly mapping the `filter` option to `$filter` in the params object, but there was no validation to ensure:
1. The filter parameter was actually included in the HTTP request
2. The filter was being applied server-side (post-request validation)

## Solution Implemented

### 1. Enhanced Parameter Mapping (`src/priority/client.js`)
- **Fixed**: Ensured all OData query parameters use correct casing with dollar signs:
  - `$filter`, `$select`, `$top`, `$skip`, `$orderby`, `$expand`, `$deltatoken`
- **Improved**: Added explicit string conversion for all parameters
- **Added**: Validation check that throws error if filter is provided but not in params

### 2. Debug Logging
- **Added**: Comprehensive debug logging (guarded by `DEBUG` or `MCP_DEBUG` env vars):
  - Full request URL
  - Query parameters dictionary
  - Whether `$filter` is present and its value
  - Response status and result count
  - Sample dates from results (for date filter validation)

### 3. Post-Request Validation
- **Added**: `FilterNotAppliedError` class in `src/utils/errors.js`
- **Implemented**: Post-check validation for date filters:
  - Detects year-based filters (e.g., `year(CURDATE) eq 2025`)
  - Detects date range filters (e.g., `CURDATE ge 2025-01-01`)
  - Validates that returned results match the filter criteria
  - Raises `FilterNotAppliedError` if violations are detected

### 4. LangSmith Metadata
- **Added**: `_mcp_metadata` object attached to response:
  - `entity`: Entity name queried
  - `requestUrl`: Full request URL with query parameters
  - `queryParams`: All query parameters sent
  - `responseStatus`: HTTP status code
  - `resultCount`: Number of results returned
  - `filterApplied`: Boolean indicating if filter was in request
  - `filterValue`: The filter value that was sent

### 5. Regression Tests
- **Created**: `tests/scripts/test-query-filter-validation.js`
  - Test 1: Verifies `$filter` is included when filter is provided
  - Test 2: Verifies `$filter` is NOT included when filter is absent
  - Test 3: Verifies all OData parameters are mapped correctly
  - Test 4: Verifies metadata is included in response
  - Test 5: Verifies `FilterNotAppliedError` is raised when results violate filter

## Files Modified

1. **src/priority/client.js**
   - Enhanced `runQuery` method with:
     - Improved parameter mapping
     - Debug logging
     - Post-request validation
     - Metadata attachment

2. **src/utils/errors.js**
   - Added `FilterNotAppliedError` class

3. **tests/scripts/test-query-filter-validation.js**
   - New test file for filter validation

## Testing

Run the validation test:
```bash
node tests/scripts/test-query-filter-validation.js
```

Enable debug logging:
```bash
DEBUG=true node dist/index.js
# or
MCP_DEBUG=true node dist/index.js
```

## Expected Behavior After Fix

1. **Filter in Request**: When a filter is provided, `$filter` parameter is guaranteed to be in the HTTP request
2. **Validation**: If filter is provided but not in params, an error is thrown before the request
3. **Post-Check**: If results violate date-based filters, `FilterNotAppliedError` is raised
4. **Debugging**: Full request details are logged when `DEBUG` or `MCP_DEBUG` is enabled
5. **LangSmith**: Request metadata is available in response for inspection

## Verification

To verify the fix works:
1. Enable debug logging: `DEBUG=true`
2. Run a query with a date filter: `filter: "year(CURDATE) eq 2025"`
3. Check logs for:
   - `$filter present: YES`
   - `$filter value: year(CURDATE) eq 2025`
   - Full request URL showing the filter parameter
4. Check response metadata: `result._mcp_metadata.filterApplied === true`
5. Verify all returned dates are from 2025 (or `FilterNotAppliedError` is raised)

## Next Steps

- Monitor LangSmith traces to verify filters are being applied correctly
- Review any `FilterNotAppliedError` instances to identify server-side issues
- Consider expanding post-check validation to other filter types beyond dates

