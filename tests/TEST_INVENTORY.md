# Test Script Inventory & Organization Plan

## Current Test Files

### 1. Health & Basic Connectivity
- **File:** `tests/simple-test.spec.ts`
- **Purpose:** Basic page loads and navigation
- **Tests:** ~5 tests
- **Dependencies:** None (no auth required)
- **Group:** `health`

### 2. API Tests
- **File:** `tests/api/auth.spec.ts`
- **Purpose:** Backend API authentication endpoints
- **Tests:** ~9 tests
- **Dependencies:** None (direct API calls)
- **Group:** `api`

### 3. Account Creation (E2E)
- **File:** `tests/e2e/account-creation.spec.ts`
- **Purpose:** End-to-end account creation flow
- **Tests:** ~7 tests
- **Dependencies:** None (creates users)
- **Group:** `account`

### 4. Account Validation (E2E)
- **File:** `tests/e2e/account-validation.spec.ts`
- **Purpose:** Form validation for account creation
- **Tests:** ~8 tests
- **Dependencies:** None
- **Group:** `account`

### 5. User Confirmation (E2E)
- **File:** `tests/e2e/user-creation-confirmation.spec.ts`
- **Purpose:** Email confirmation flow
- **Tests:** ~6 tests
- **Dependencies:** None
- **Group:** `account`

### 6. Authentication (E2E)
- **File:** `tests/e2e/authentication.spec.ts`
- **Purpose:** Sign in, logout, session management
- **Tests:** ~14 tests (across 2 browsers)
- **Dependencies:** Requires test user account
- **Group:** `auth`

### 7. Bracket Creation (E2E)
- **File:** `tests/e2e/bracket-creation.spec.ts`
- **Purpose:** Creating new brackets
- **Tests:** ~3 tests
- **Dependencies:** Requires authenticated user
- **Group:** `bracket`

## Test Groups

### Group 1: Health Checks (`health`)
**Purpose:** Basic connectivity and page loads  
**Files:**
- `tests/simple-test.spec.ts`

**Use Cases:**
- Quick health check
- Verify deployment is working
- Scheduled monitoring

### Group 2: API Tests (`api`)
**Purpose:** Backend API validation  
**Files:**
- `tests/api/auth.spec.ts`

**Use Cases:**
- Test API endpoints directly
- Fast validation of backend logic
- CI/CD pipeline checks

### Group 3: Account Management (`account`)
**Purpose:** User account creation and validation  
**Files:**
- `tests/e2e/account-creation.spec.ts`
- `tests/e2e/account-validation.spec.ts`
- `tests/e2e/user-creation-confirmation.spec.ts`

**Use Cases:**
- Test signup flow
- Validate form validation
- Test email confirmation

### Group 4: Authentication (`auth`)
**Purpose:** Sign in, logout, session  
**Files:**
- `tests/e2e/authentication.spec.ts`

**Use Cases:**
- Test login functionality
- Session management
- Protected routes

### Group 5: Bracket Features (`bracket`)
**Purpose:** Bracket creation and management  
**Files:**
- `tests/e2e/bracket-creation.spec.ts`
- (Future: bracket-management, bracket-submission, bracket-viewing)

**Use Cases:**
- Test core bracket functionality
- Validate bracket workflows
- Test logged-in user features

### Group 6: Smoke Tests (`smoke`)
**Purpose:** Critical path validation  
**Files:**
- `tests/e2e/authentication.spec.ts` (sign in)
- `tests/e2e/bracket-creation.spec.ts` (create bracket)

**Use Cases:**
- Quick validation after deployment
- Pre-merge checks
- CI/CD smoke tests

### Group 7: Full Regression (`all`)
**Purpose:** All tests  
**Files:**
- All test files

**Use Cases:**
- Complete validation
- Pre-production deployment
- Major release testing

## Recommended NPM Script Organization

### Pattern: `test:<group>:<env>`
- `<group>`: health, api, account, auth, bracket, smoke, all
- `<env>`: (default=staging), staging, prod

### Pattern: `test:<file>:<env>`
- Run a specific test file
- Example: `test:auth-spec:staging`

### Pattern: `test:single:<name>:<env>`
- Run a single test by name
- Example: `test:single:sign-in:staging`

## Proposed Script Structure

```json
{
  "scripts": {
    // === Health Checks ===
    "test:health": "playwright test tests/simple-test.spec.ts",
    "test:health:staging": "TEST_ENV=staging playwright test tests/simple-test.spec.ts",
    "test:health:prod": "TEST_ENV=production playwright test tests/simple-test.spec.ts",
    
    // === API Tests ===
    "test:api": "playwright test tests/api",
    "test:api:staging": "TEST_ENV=staging playwright test tests/api",
    "test:api:prod": "TEST_ENV=production playwright test tests/api",
    
    // === Account Management ===
    "test:account": "playwright test tests/e2e/account-*.spec.ts",
    "test:account:staging": "TEST_ENV=staging playwright test tests/e2e/account-*.spec.ts",
    "test:account:prod": "TEST_ENV=production playwright test tests/e2e/account-*.spec.ts",
    
    // === Authentication ===
    "test:auth": "playwright test tests/e2e/authentication.spec.ts",
    "test:auth:staging": "TEST_ENV=staging playwright test tests/e2e/authentication.spec.ts",
    "test:auth:prod": "TEST_ENV=production playwright test tests/e2e/authentication.spec.ts",
    
    // === Bracket Features ===
    "test:bracket": "playwright test tests/e2e/bracket-*.spec.ts",
    "test:bracket:staging": "TEST_ENV=staging playwright test tests/e2e/bracket-*.spec.ts",
    "test:bracket:prod": "TEST_ENV=production playwright test tests/e2e/bracket-*.spec.ts",
    
    // === Smoke Tests ===
    "test:smoke": "playwright test tests/e2e/authentication.spec.ts tests/e2e/bracket-creation.spec.ts",
    "test:smoke:staging": "TEST_ENV=staging playwright test tests/e2e/authentication.spec.ts tests/e2e/bracket-creation.spec.ts",
    "test:smoke:prod": "TEST_ENV=production playwright test tests/e2e/authentication.spec.ts tests/e2e/bracket-creation.spec.ts",
    
    // === Full Regression ===
    "test:all": "playwright test",
    "test:all:staging": "TEST_ENV=staging playwright test",
    "test:all:prod": "TEST_ENV=production playwright test",
    
    // === Individual Files ===
    "test:file:simple": "playwright test tests/simple-test.spec.ts",
    "test:file:auth-api": "playwright test tests/api/auth.spec.ts",
    "test:file:auth-e2e": "playwright test tests/e2e/authentication.spec.ts",
    "test:file:bracket": "playwright test tests/e2e/bracket-creation.spec.ts",
    
    // === Development Helpers ===
    "test:ui": "playwright test --ui",
    "test:ui:staging": "TEST_ENV=staging playwright test --ui",
    "test:ui:prod": "TEST_ENV=production playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:report": "playwright show-report"
  }
}
```

## Usage Examples

### Run Health Checks
```bash
npm run test:health          # Staging (default)
npm run test:health:staging  # Explicit staging
npm run test:health:prod     # Production
```

### Run Authentication Tests
```bash
npm run test:auth            # Staging
npm run test:auth:prod       # Production
```

### Run Single Test File
```bash
npm run test:file:auth-e2e   # Staging
```

### Run Single Test by Name
```bash
npx playwright test -g "should sign in with valid credentials"
```

### Run Smoke Tests (for CI/CD)
```bash
npm run test:smoke:staging    # Staging
npm run test:smoke:prod      # Production
```

## GitHub Actions Integration

### Smoke Tests Workflow
```yaml
run: npm run test:smoke:staging  # or test:smoke:prod based on branch
```

### Health Check Workflow
```yaml
run: npm run test:health:staging
```

### Full Regression Workflow
```yaml
run: npm run test:all:staging  # or test:all:prod
```

## Benefits of This Organization

1. **Clear Grouping** - Easy to find and run related tests
2. **Environment Flexibility** - Simple switching between staging/prod
3. **CI/CD Ready** - Scripts work directly in GitHub Actions
4. **Developer Friendly** - Easy to run during development
5. **Scalable** - Easy to add new groups or files
6. **Consistent Naming** - Predictable script names

## Next Steps

1. ✅ Create inventory (this document)
2. ⏳ Update package.json with new script structure
3. ⏳ Test scripts locally
4. ⏳ Update GitHub Actions workflows
5. ⏳ Document usage in README


