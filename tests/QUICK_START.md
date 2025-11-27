# Quick Start: Running Tests

## 🚀 Most Common Commands

### Health Check (Fastest - No Auth Needed)
```bash
npm run test:health          # Staging
npm run test:health:prod     # Production
```

### Smoke Tests (Critical Path)
```bash
npm run test:smoke           # Staging
npm run test:smoke:prod      # Production
```

### Authentication Tests
```bash
npm run test:auth            # Staging
npm run test:auth:prod       # Production
```

### Bracket Tests
```bash
npm run test:bracket         # Staging
npm run test:bracket:prod    # Production
```

### Interactive Development Mode
```bash
npm run test:ui              # Staging (recommended for development)
npm run test:ui:prod         # Production
```

## 📋 All Available Groups

| Command | Environment | What It Tests |
|---------|-------------|---------------|
| `npm run test:health` | Staging | Basic page loads |
| `npm run test:api` | Staging | Backend API |
| `npm run test:account` | Staging | Account creation/validation |
| `npm run test:auth` | Staging | Sign in/logout/session |
| `npm run test:bracket` | Staging | Bracket features |
| `npm run test:smoke` | Staging | Critical path (auth + bracket) |
| `npm run test:all` | Staging | All tests |

Add `:prod` suffix for production (e.g., `test:health:prod`)

## 🎯 Running Single Tests

### By File
```bash
npx playwright test tests/e2e/authentication.spec.ts
```

### By Test Name
```bash
npx playwright test -g "should sign in with valid credentials"
```

### With Environment
```bash
TEST_ENV=staging npx playwright test -g "should sign in"
TEST_ENV=production npx playwright test -g "should sign in"
```

## 📊 View Results

```bash
npm run test:report    # Opens last test report in browser
```

## 🔧 Development Workflow

1. **Start developing:** `npm run test:ui` (interactive mode)
2. **Test specific feature:** `npm run test:bracket` (or relevant group)
3. **Before commit:** `npm run test:smoke` (verify critical path)
4. **View results:** `npm run test:report`

## 📚 More Information

- **Full inventory:** See `tests/TEST_INVENTORY.md`
- **Organization plan:** See `tests/TEST_ORGANIZATION_PLAN.md`
- **Running tests guide:** See `tests/RUNNING_TESTS.md`


