# Environment Variable Pull Guide

## Quick Reference

### Pull from Both Environments (Recommended)

**One command pulls everything you need:**
```powershell
.\scripts\pull-env-all.ps1
```

**Or using npm:**
```powershell
npm run env:pull
```

**What it does:**
1. Pulls from Production → `.env.test`
2. Pulls from Preview (Staging) → `.env.test.preview` (temporary)
3. Merges both files (Production takes precedence for conflicts)
4. Writes merged result to `.env.test`
5. Cleans up temporary file

**Result:** You get all variables from both environments:
- ✅ `TEST_USER_PASSWORD_PRODUCTION` (from Production)
- ✅ `TEST_USER_PASSWORD_STAGING` (from Preview)
- ✅ `TEST_USER_EMAIL` (from Production)
- ✅ `NEXTAUTH_URL` (from Production)
- ✅ `PRODUCTION_URL` (from Production)
- ✅ All other variables from both environments

---

### Pull from Single Environment

**Production only:**
```powershell
vercel env pull .env.test --environment=production
```

**Or using npm:**
```powershell
npm run env:pull:prod
```

**Preview (Staging) only:**
```powershell
vercel env pull .env.test --environment=preview
```

**Or using npm:**
```powershell
npm run env:pull:preview
```

---

## When to Use Each Method

### Use `env:pull` (Both Environments) When:
- ✅ You test against both staging and production
- ✅ You want all test credentials available
- ✅ You're setting up for the first time
- ✅ You want to avoid toggling between pulls

### Use Single Environment Pull When:
- ✅ You only test against one environment
- ✅ You want to avoid conflicts
- ✅ You need to refresh just one environment

---

## Workflow

### Initial Setup
```powershell
# Pull from both environments (one time)
npm run env:pull
```

### Regular Testing
```powershell
# Test against staging (default)
npm run test:all

# Test against production
npm run test:all:prod
```

**No need to pull again** - `.env.test` has everything!

### Refresh Variables (When Updated in Vercel)
```powershell
# Pull fresh variables from both environments
npm run env:pull
```

---

## Troubleshooting

### "Script execution is disabled"
If you get a PowerShell execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Command not found"
Make sure you're in the project root directory.

### Variables Not Loading
1. Check `.env.test` file exists
2. Verify variables are set in Vercel Dashboard
3. Try pulling again: `npm run env:pull`

---

## File Locations

- **`.env.test`** - Merged environment variables (used by tests)
- **`.env.test.preview`** - Temporary file (auto-deleted after merge)
- **`.gitignore`** - `.env.test` is gitignored (never committed)

---

## Summary

**Best Practice:** Use `npm run env:pull` to get all variables from both environments. This way you can test against staging or production without needing to pull again.


