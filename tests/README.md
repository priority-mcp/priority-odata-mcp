# Priority MCP Tools - Test Suite

This directory contains all test scripts, results, and reports for the Priority MCP Tools.

## Directory Structure

```
tests/
├── scripts/          # Test execution scripts
├── results/          # Test result files (JSON, MD)
└── reports/          # Test reports and documentation
```

## Test Scripts

### Read Operations Tests

**`scripts/test-priority-operations.js`**
- Comprehensive read operations test suite
- Tests: queries, filters, subforms, pagination, schema discovery
- Generates: `results/test-results.json` and `results/test-results.md`

**Usage:**
```bash
node tests/scripts/test-priority-operations.js
```

### Write Operations Tests

**`scripts/test-write-operations.js`**
- Interactive write operations test suite
- Requires user confirmation for each operation
- Tests: create, update, delete, subform operations

**Usage:**
```bash
node tests/scripts/test-write-operations.js
```

**`scripts/test-write-operations-auto.js`**
- Automated write operations test suite
- Runs all tests without prompts
- Automatically cleans up test records

**Usage:**
```bash
node tests/scripts/test-write-operations-auto.js
```

## Test Results

Test results are automatically saved to `results/` directory:

- `test-results.json` - Read operations results (JSON)
- `test-results.md` - Read operations results (Markdown)
- `test-write-results.json` - Write operations results (JSON)

## Test Reports

Comprehensive test reports are available in `reports/`:

- **FINAL_TEST_REPORT.md** - Complete final test report
- **TEST_SUMMARY.md** - Quick reference summary
- **TEST_EXECUTION_REPORT.md** - Detailed execution report
- **TEST_REPORT.md** - Original test report
- **TESTING_GUIDE.md** - Testing guide and examples

## Running Tests

### From Project Root

```bash
# Read operations tests
node tests/scripts/test-priority-operations.js

# Write operations tests (interactive)
node tests/scripts/test-write-operations.js

# Write operations tests (automated)
node tests/scripts/test-write-operations-auto.js
```

### From tests/scripts Directory

```bash
cd tests/scripts

# Read operations tests
node test-priority-operations.js

# Write operations tests
node test-write-operations.js
node test-write-operations-auto.js
```

## Test Coverage

### Read Operations: ✅ 100% (10/10 tests passed)
- Basic queries
- Field selection
- Status filtering
- Ordering
- Pagination
- Schema discovery
- Subform expansion

### Write Operations: ⚠️ 33.3% (1/3 tests passed)
- Create records: ✅ Working
- Update records: ❌ Needs investigation
- Subform creation: ❌ Needs investigation

## Notes

- All tests use real Priority ERP data (no mocks)
- Data integrity is enforced (strictDataIntegrity: true)
- Test results are automatically saved after each run
- Write operations require approval and test data setup

## See Also

- [Testing Guide](reports/TESTING_GUIDE.md) - Complete testing guide
- [Final Report](reports/FINAL_TEST_REPORT.md) - Comprehensive test report
- [Test Summary](reports/TEST_SUMMARY.md) - Quick reference

