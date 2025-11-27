# Production Testing Guide

## After Deployment

Once your production deployment completes with the updated environment variables:

### Quick Verification

1. **Verify NEXTAUTH_URL is working:**
   - Create a test account in production
   - Check the confirmation email
   - The link should use `https://warrensmm.com` (not `wmm2026.vercel.app`)

2. **Verify PRODUCTION_URL is set:**
   - Run a simple test to confirm it's using the correct URL

### Run Full Test Suite

**Command:**
```powershell
npx cross-env TEST_ENV=prod npx playwright test
```

**Or PowerShell:**
```powershell
$env:TEST_ENV='prod'; npx playwright test
```

**What it runs:**
- All 5 test groups
- Both browsers (Chromium + Firefox)
- 90 total test runs (44 tests × 2 browsers + 2 skipped)

**Expected results:**
- ✅ 86 passed
- ⏭️ 4 skipped (password toggle + full confirmation flow)
- ❌ 0 failed

### If Tests Fail

1. **Check which URL is being used:**
   - Look at test output for base URL
   - Verify `PRODUCTION_URL` is set correctly in Vercel

2. **Verify NEXTAUTH_URL:**
   - Check confirmation emails still use correct domain
   - May need to wait a few minutes for deployment to fully propagate

3. **Check environment variables:**
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure both are set for **Production** environment

### Environment Variable Checklist

Before running production tests, verify:

- ✅ `NEXTAUTH_URL` = `https://warrensmm.com` (Production)
- ✅ `PRODUCTION_URL` = `https://warrensmm.com` (Production)
- ✅ `TEST_USER_EMAIL` = `thewarren@gmail.com` (Production)
- ✅ `TEST_USER_PASSWORD_PRODUCTION` = (your production password) (Production)

### Running Individual Groups

If you want to run groups separately:

```powershell
$env:TEST_ENV='prod'; node scripts/run-test-by-id.js 1
$env:TEST_ENV='prod'; node scripts/run-test-by-id.js 2
$env:TEST_ENV='prod'; node scripts/run-test-by-id.js 3
$env:TEST_ENV='prod'; node scripts/run-test-by-id.js 4
$env:TEST_ENV='prod'; node scripts/run-test-by-id.js 5
```

### Troubleshooting

**If tests use wrong URL:**
- Check `PRODUCTION_URL` in Vercel
- Verify `.env.test` file if running locally
- Use `PLAYWRIGHT_TEST_BASE_URL` to override: `$env:PLAYWRIGHT_TEST_BASE_URL='https://warrensmm.com'`

**If confirmation emails use wrong URL:**
- Check `NEXTAUTH_URL` in Vercel (Production)
- Wait a few minutes for deployment to propagate
- May need to trigger a new deployment after setting variable


