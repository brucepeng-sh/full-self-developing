---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code for TheOMS (ThinkPHP 5.0). Enforces test-driven development with 80%+ coverage using PHPUnit.
origin: ECC (Adapted for ThinkPHP)
---

# Test-Driven Development Workflow (PHP/ThinkPHP)

This skill ensures all code development follows TDD principles with comprehensive test coverage using PHPUnit.

## When to Activate

- Writing new features or functionality in `application/`
- Fixing bugs in controllers, models, or logic
- Refactoring existing ThinkPHP code
- Adding new API endpoints in `application/api/`

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first in `tests/`, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 80% coverage (unit + integration)
- All edge cases and error scenarios tested
- Boundary conditions verified

### 3. Test Types

#### Unit Tests
- Business logic in `application/common/`
- Helper functions and utility classes
- Controllers (mocking dependencies)

#### Integration Tests
- API endpoints and routing
- Database operations using `think\Db`
- Service interactions

## TDD Workflow Steps

### Step 1: Write User Journeys
Identify the goal of the change.

### Step 2: Generate Test Cases
Create a new test file in `tests/Unit/` or `tests/Feature/`.

```php
<?php
namespace tests\Unit;

use tests\TestCase;

class OrderTest extends TestCase
{
    /** @test */
    public function it_calculates_total_price_correctly()
    {
        // Test logic
    }
}
```

### Step 3: Run Tests (Verify FAIL - RED)
```bash
php vendor/bin/phpunit tests/Unit/OrderTest.php
```
This step is mandatory. Confirm the test fails as expected.

### Step 4: Implement Minimal Code
Write just enough code in `application/` to pass the test.

### Step 5: Run Tests Again (Verify PASS - GREEN)
```bash
php vendor/bin/phpunit tests/Unit/OrderTest.php
```
Confirm the test is now GREEN.

### Step 6: Refactor (IMPROVE)
Clean up the implementation while keeping tests green.

### Step 7: Verify Coverage
```bash
php vendor/bin/phpunit --coverage-text
```

## Success Metrics
- 80%+ code coverage
- All tests passing
- Clean, refactored implementation
