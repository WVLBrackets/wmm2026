# Test Scripts Reference Table

## Core Test Scripts

| Script Name | Brief Description | Group |
|-------------|-------------------|-------|
| `test:health` | Basic page loads and connectivity checks | health |
| `test:api` | Backend API authentication endpoint tests | api |
| `test:account` | Account creation, validation, and confirmation flow | account |
| `test:auth` | Sign in, logout, and session management | auth |
| `test:bracket` | Bracket creation and management features | bracket |
| `test:smoke` | Critical path tests (authentication + bracket creation) | smoke |
| `test:all` | All tests - full regression suite | all |

## Development Tools

| Script Name | Brief Description | Group |
|-------------|-------------------|-------|
| `test:ui` | Interactive UI mode for test development | dev |
| `test:headed` | Run tests with visible browser window | dev |
| `test:report` | View last test report in browser | dev |

## Environment Variants

All core scripts support environment suffixes:
- **Default:** Scripts without suffix run on **staging**
- **Staging:** Add `:staging` suffix (e.g., `test:health:staging`)
- **Production:** Add `:prod` suffix (e.g., `test:health:prod`)

**Examples:**
- `test:health` → Staging (default)
- `test:health:staging` → Staging (explicit)
- `test:health:prod` → Production

## Quick Reference by Group

### Health Group
- `test:health` - Basic connectivity (fastest, no auth needed)

### API Group
- `test:api` - Backend API validation

### Account Group
- `test:account` - Account creation and validation

### Auth Group
- `test:auth` - Sign in/logout/session

### Bracket Group
- `test:bracket` - Bracket features (requires auth)

### Smoke Group
- `test:smoke` - Critical path (for CI/CD)

### All Group
- `test:all` - Full regression suite

### Development Tools
- `test:ui` - Interactive mode (recommended for development)
- `test:headed` - See browser while testing
- `test:report` - View test results

## Environment Notes

- **Default:** All scripts without `:staging` or `:prod` suffix default to **staging**
- **Staging:** Add `:staging` suffix (or use default)
- **Production:** Add `:prod` suffix

## Usage Examples

```bash
# Quick health check (staging)
npm run test:health

# Health check on production
npm run test:health:prod

# Critical path tests (staging)
npm run test:smoke

# Interactive development mode
npm run test:ui
```

