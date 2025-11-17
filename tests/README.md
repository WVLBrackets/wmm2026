# Playwright Test Suite

This directory contains automated tests for the WMM2026 application using Playwright.

## Test Structure

- **`tests/api/`** - API tests that use Playwright's request API to test backend endpoints without the browser
- **`tests/e2e/`** - End-to-end tests that interact with the UI
- **`tests/fixtures/`** - Test data helpers and fixtures

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with UI mode (interactive)
```bash
npm run test:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Run only API tests
```bash
npm run test:api
```

### Run only E2E tests
```bash
npm run test:e2e
```

### View test report
```bash
npm run test:report
```

## Test Coverage

### Account Creation
- ✅ Form display and field visibility
- ✅ Password validation (length, matching)
- ✅ Duplicate email handling
- ✅ Success flow
- ✅ Password visibility toggle
- ✅ Navigation between signup and signin

### Account Validation
- ✅ Required field validation
- ✅ Email format validation
- ✅ Password minimum length
- ✅ Password confirmation matching
- ✅ Special characters in names
- ✅ Loading states

### API Tests
- ✅ Successful account creation
- ✅ Missing field validation
- ✅ Password length validation
- ✅ Duplicate email rejection
- ✅ Invalid email format handling

## Test Data

The test suite uses unique email addresses generated with timestamps to avoid conflicts. Test data helpers are available in `tests/fixtures/test-data.ts`.

## Configuration

Test configuration is in `playwright.config.ts`. The default base URL is `http://localhost:3000`, but can be overridden with the `PLAYWRIGHT_TEST_BASE_URL` environment variable.

## Best Practices

1. **Stable Locators**: Tests use `data-testid` attributes for reliable element selection
2. **Isolation**: API tests are separated from UI tests
3. **Cleanup**: Tests generate unique data to avoid conflicts
4. **Assertions**: Use Playwright's web-first assertions (auto-waiting)
5. **No Manual Waits**: Leverage Playwright's built-in auto-wait mechanisms

## Adding New Tests

When adding new tests:
1. Use `data-testid` attributes for element selection
2. Follow the existing test structure (describe/test blocks)
3. Use fixtures for test data generation
4. Add proper cleanup in `afterEach`/`afterAll` hooks if needed
5. Keep API tests separate from E2E tests

