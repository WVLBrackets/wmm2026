# Test Data Cleanup

## Overview

Test accounts are created during automated testing. These accounts use email patterns like:
- `test-*@example.com`
- `testuser-*@example.com`

## Option 1: Local Script (No Deployment Required) ⭐ RECOMMENDED

### Prerequisites

You need your `POSTGRES_URL` from Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Find `POSTGRES_URL` and copy its value

### In PowerShell

**Step 1: Set the database connection string**
```powershell
$env:POSTGRES_URL="your-postgres-connection-string-here"
```

**Step 2: Preview what will be deleted**
```powershell
npm run cleanup:test-data
```

**Step 3: Delete test data (after reviewing)**
```powershell
npm run cleanup:test-data:confirm
```

## Option 2: API Endpoint (REMOVED FOR SECURITY)

**SECURITY NOTE:** API endpoints for test cleanup have been removed to avoid security risks.
Use the local cleanup script (Option 1) instead.

## What Gets Deleted

The cleanup deletes:
- Test users (by email pattern)
- Their associated tokens (cascade delete)
- Their brackets (cascade delete)
- Their usage logs (if any)

## Security

- Cleanup is **disabled in production** by default
- Only test email patterns are allowed for token retrieval
- Cleanup endpoints should only be accessible in staging/preview environments

## Confirmation Flow Testing

**SECURITY NOTE:** The full confirmation flow test is skipped because it would require
an API endpoint to retrieve confirmation tokens, which would be a security risk.

The test suite tests:
- Account creation (working)
- Confirmation page with invalid/missing tokens (working)
- Full confirmation flow is tested manually or via admin interface
