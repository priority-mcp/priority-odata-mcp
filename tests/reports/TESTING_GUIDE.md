# Priority MCP Tools - Testing Guide

## Overview

This guide helps you perform comprehensive real-world testing of Priority MCP tools, covering:
- Reading from forms and subforms
- Filtering by dates and statuses
- Reading choice options and schemas
- Writing to forms (create/update/delete)
- Subform operations

## Quick Start

### 1. Verify Basic Read Operations

Test that basic queries work:

```bash
# Using MCP tools directly (if available in your environment)
# Or use the test script:
node test-priority-operations.js
```

### 2. Test Read Operations via MCP

#### Basic Query
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'USERS',
  top: 5
})
```

#### With Field Selection
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  select: ['PARTNAME', 'PARTDES', 'STATDES'],
  top: 5
})
```

#### Filtering by Status
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  filter: "STATDES eq 'פעיל'",
  top: 5
})
```

#### Ordering Results
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  orderby: 'CREATEDDATE desc',
  top: 5
})
```

#### Pagination
```javascript
// Page 1
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  top: 10,
  skip: 0
})

// Page 2
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  top: 10,
  skip: 10
})
```

### 3. Test Schema Discovery

Discover available fields and data types:

```javascript
mcp_Priority_ERP_MCP_entity_schema({
  entity: 'ORDERS',
  sample: true,
  top: 1
})
```

This returns:
- All available fields
- Field types (string, integer, datetime, etc.)
- Sample values
- Field examples

### 4. Test Subform Reading

#### Read Order with Items
```javascript
// First, get an order name
const orders = await mcp_Priority_ERP_MCP_query_run({
  entity: 'ORDERS',
  top: 1
});

// Then get with subform (if entity_get works)
// Or use query with expand:
mcp_Priority_ERP_MCP_query_run({
  entity: 'ORDERS',
  filter: `ORDNAME eq 'SO15000005'`,
  expand: 'ORDERITEMS_SUBFORM',
  select: ['ORDNAME', 'CUSTNAME', 'TOTPRICE']
})
```

## Write Operations Testing

⚠️ **WARNING**: Write operations modify real Priority data. Only test with approval!

### Test Script for Write Operations

Use the interactive test script:

```bash
node test-write-operations.js
```

This script will:
1. Ask for confirmation before each operation
2. Create test records
3. Update test records
4. Delete test records (with cleanup option)
5. Test subform operations

### Manual Write Operation Tests

#### 1. Create a Record

**Example: Create a PART**

```javascript
mcp_Priority_ERP_MCP_entity_create({
  entity: 'PART',
  data: {
    PARTNAME: 'TEST_PART_001',
    PARTDES: 'Test Part Description',
    TYPE: 'R',
    STATDES: 'פעיל',
    PUNITNAME: 'יח\'',
    UNITNAME: 'יח\''
  }
})
```

**Mandatory Fields**: Check schema first to identify required fields.

#### 2. Update a Record

```javascript
mcp_Priority_ERP_MCP_entity_update({
  entity: 'PART',
  key: 'TEST_PART_001',
  data: {
    PARTDES: 'Updated Description'
  }
})
```

#### 3. Delete a Record

```javascript
mcp_Priority_ERP_MCP_entity_delete({
  entity: 'PART',
  key: 'TEST_PART_001'
})
```

#### 4. Create with Subform

**Example: Create ORDER with ORDERITEMS_SUBFORM**

```javascript
mcp_Priority_ERP_MCP_entity_create({
  entity: 'ORDERS',
  data: {
    CUSTNAME: '1002',  // Valid customer
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: '001',
        TQUANT: 1,
        PRICE: 100
      },
      {
        PARTNAME: '002',
        TQUANT: 2,
        PRICE: 50
      }
    ]
  }
})
```

#### 5. Update Subform

```javascript
mcp_Priority_ERP_MCP_entity_update({
  entity: 'ORDERITEMS_SUBFORM',
  key: '1',  // Line number
  parentEntity: 'ORDERS',
  parentKey: 'SO15000005',
  data: {
    TQUANT: 5,
    PRICE: 150
  }
})
```

#### 6. Delete Subform Record

```javascript
mcp_Priority_ERP_MCP_entity_delete({
  entity: 'ORDERITEMS_SUBFORM',
  key: '1',  // Line number
  parentEntity: 'ORDERS',
  parentKey: 'SO15000005'
})
```

## Date Filtering

Date filters may require specific formats. Test different approaches:

### Option 1: ISO 8601 Format
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'DOCUMENTS_D',
  filter: "CURDATE ge 2024-01-01T00:00:00",
  top: 5
})
```

### Option 2: Priority Date Format
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'DOCUMENTS_D',
  filter: "CURDATE ge datetime'2024-01-01T00:00:00'",
  top: 5
})
```

### Option 3: Date Function
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'DOCUMENTS_D',
  filter: "year(CURDATE) eq 2024",
  top: 5
})
```

## Choice Options / Lookup Values

To discover choice options for a field:

1. **Query existing records** to see what values are used:
```javascript
mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  select: ['STATDES'],
  top: 100
})
```

2. **Check schema** for field examples:
```javascript
mcp_Priority_ERP_MCP_entity_schema({
  entity: 'PART',
  sample: true,
  top: 10
})
```

3. **Query distinct values** (if supported):
```javascript
// May need to query and process in application
const parts = await mcp_Priority_ERP_MCP_query_run({
  entity: 'PART',
  select: ['STATDES'],
  top: 1000
});
const statuses = [...new Set(parts.value.map(p => p.STATDES))];
```

## Testing Checklist

### Read Operations ✅
- [x] Basic queries (no filters)
- [x] Field selection ($select)
- [x] Status filtering
- [x] Ordering ($orderby)
- [x] Pagination (skip/top)
- [x] Schema discovery
- [ ] Date filtering (needs format verification)
- [ ] Subform expansion (needs verification)

### Write Operations ⚠️
- [ ] Create simple record (PART)
- [ ] Create record with mandatory fields
- [ ] Update record
- [ ] Delete record
- [ ] Create with subform (ORDER with ORDERITEMS)
- [ ] Update subform record
- [ ] Delete subform record
- [ ] Batch operations

### Advanced Operations
- [ ] Complex filters (AND/OR)
- [ ] Multiple subform expansion
- [ ] Nested subform expansion
- [ ] Choice option discovery
- [ ] Error handling (invalid data, missing fields)

## Common Issues and Solutions

### Issue: 400 Bad Request on Queries
**Solution**: 
- Check field names in schema
- Verify filter syntax
- Try without filters first

### Issue: 404 Not Found on entity_get
**Solution**:
- Verify key format (may need string vs number)
- Check if entity uses composite keys
- Use query_run instead

### Issue: Date Filter Not Working
**Solution**:
- Try different date formats
- Use CURDATE instead of specific date fields
- Check date field names in schema

### Issue: Subform Expansion Fails
**Solution**:
- Verify subform name (usually ends with _SUBFORM)
- Use query_run with expand instead of entity_get
- Check if parent entity key is correct

## Test Data Recommendations

For safe testing:

1. **Use Test Prefix**: Prefix test records (e.g., `TEST_`, `MCP_TEST_`)
2. **Test Entities**: Start with entities that have minimal mandatory fields
3. **Cleanup**: Always clean up test data after testing
4. **Backup**: Consider backing up before write operations

## Next Steps

1. ✅ Review TEST_REPORT.md for current test results
2. ⚠️ Run test-write-operations.js for write operation testing
3. 📝 Document any issues found
4. 🔧 Fix any identified problems
5. ✅ Re-test after fixes

## Support

For issues or questions:
- Check TEST_REPORT.md for known issues
- Review Priority REST API documentation
- Test with simpler operations first
- Verify entity API access (RESTFLAG=Y)

