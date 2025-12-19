# Task 4.1 – Test Execution Guide

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Unit Tests

```bash
npm run test:db
```

### Run Integration Tests

```bash
npm run test:db:integration
```

### Run Both Test Suites

```bash
npm run test:db && npm run test:db:integration
```

## Test Files Overview

### 1. `test/dbService.test.ts` - Unit Tests

**Purpose**: Verify individual CRUD operations and edge cases  
**Duration**: ~5 seconds  
**Coverage**: 28 test cases

**Tests Include:**

- Empty collection handling
- Auto-ID generation (numeric and UUID)
- ID 0 handling (falsy but valid)
- Loose comparison (string vs number)
- Data persistence
- Concurrency safety
- No duplicates verification

**Example Output:**

```
✅ PASS: getCollection returns empty array for non-existent collection
✅ PASS: insert generates numeric ID with empty collection
✅ PASS: find with loose comparison (string vs number ID)
✅ PASS: update modifies existing item
✅ PASS: delete removes existing item
✅ PASS: CRUD workflow: insert → read → update → delete
...
📊 Test Results: 28 passed, 0 failed
```

### 2. `test/dbService.integration.test.ts` - Integration Tests

**Purpose**: Test real-world CRUD workflows  
**Duration**: ~5 seconds  
**Coverage**: 7 scenarios

**Scenarios Include:**

1. **User Management** – Numeric auto-increment IDs
2. **Product Catalog** – UUID string IDs
3. **Loose ID Comparison** – String/number mismatch
4. **Falsy IDs** – Handling ID = 0
5. **Multi-Collection** – E-commerce CRUD scenario
6. **Performance** – 100+ rapid operations
7. **Collection Stats** – Diagnostics and monitoring

**Example Output:**

```
✅ PASS: Scenario 1: User Management (Numeric Auto-Increment IDs)
✅ PASS: Scenario 2: Product Catalog (UUID String IDs)
✅ PASS: Scenario 3: Loose ID Comparison (String/Number Mismatch)
✅ PASS: Scenario 4: Handling Falsy IDs (ID = 0)
✅ PASS: Scenario 5: Complex Multi-Collection Operations
✅ PASS: Scenario 6: No Data Corruption on Rapid Operations
✅ PASS: Scenario 7: Collection Stats and Diagnostics
📊 Results: 7 passed, 0 failed
```

## What Gets Tested

### ✅ CRUD Operations

- **CREATE (insert)**: Adding items with auto-ID generation
- **READ (find)**: Retrieving items by ID
- **UPDATE (update)**: Modifying existing items
- **DELETE (delete)**: Removing items

### ✅ Auto-ID Strategies

- **Numeric Strategy**: Used when all IDs are numbers
- **UUID Strategy**: Used for string/mixed IDs
- **Smart Detection**: Automatically selects strategy
- **ID 0 Handling**: Allows falsy IDs (0, "", etc.)

### ✅ ID Type Handling

- **Loose Comparison**: `123 == "123"` returns true
- **String/Number Mismatch**: Find/Update/Delete work with either type
- **Type Flexibility**: No casting required

### ✅ Data Integrity

- **No Duplicates**: All IDs are unique
- **No Corruption**: 100+ rapid operations pass cleanly
- **Data Persistence**: localStorage properly updated
- **Atomic Operations**: Read-modify-write prevents partial updates

## Troubleshooting

### "Cannot find module 'tsx'"

```bash
npm install
```

### Tests timeout or hang

- Check Node.js version (should be 16+)
- Clear node_modules and reinstall: `npm ci`

### localStorage errors

- Tests mock localStorage automatically
- No browser required to run tests

## Acceptance Criteria Verification

### ✅ CRUD Operations Consistent

- All operations verified in unit tests (28 tests)
- Real-world scenarios tested in integration tests (7 scenarios)
- No failures detected

### ✅ Auto-ID Handling

- Numeric auto-increment: Tested in Scenario 1
- UUID generation: Tested in Scenario 2
- Smart detection: Verified in both
- ID 0 support: Tested in Scenario 4

### ✅ Loose Comparison for ID Types

- String vs number matching: Dedicated unit test
- Real-world scenario: Tested in Scenario 3
- All CRUD ops verified: find, update, delete

### ✅ No Duplicates or Corruption

- Duplicate verification: Unit test included
- Corruption test: 100-item stress test in Scenario 6
- Data persistence: Verified across all scenarios

## Next Steps

After tests pass, the dbService is ready for:

1. **Integration with DatabaseView Component** (Task 4.2)
2. **Stateful Mock Engine** (Task 4.3)
3. **Full Sprint 4 Testing**

See [DBSERVICE_VERIFICATION.md](../DBSERVICE_VERIFICATION.md) for detailed documentation.
