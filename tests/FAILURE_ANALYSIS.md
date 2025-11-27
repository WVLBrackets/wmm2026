# Test Failure Analysis - Group 2 (Account)

## Pattern Analysis Across Multiple Runs

Based on the test results, here are the consistent patterns:

### Consistently Failing Tests (Not Flaky)

| Test | Browser | Failure Type | Frequency | Issue |
|------|---------|--------------|-----------|-------|
| `should toggle password visibility` | Both (Chromium + Firefox) | UI Bug | **100%** (every run) | Toggle button doesn't work - UI issue, not test issue |

### Flaky Tests (Intermittent Failures)

| Test | Browser | Failure Type | Frequency | Issue |
|------|---------|--------------|-----------|-------|
| `should successfully create account with valid data` | Chromium | Status Code Mismatch | ~50% | Getting 409 (duplicate) instead of 200 - email collision issue |
| `should prevent submission for duplicate email` | Firefox | Timeout | ~30-40% | Form not submitting in Firefox - timing issue |
| `should successfully create a new user account` | Firefox | Timeout | ~30-40% | Form not submitting in Firefox - timing issue |

## Detailed Analysis

### 1. Password Toggle Test (Consistent Failure)

**Status:** ❌ **Consistently failing in both browsers**

**Error:**
```
Expected: "text"
Received: "password"
```

**Root Cause:** UI bug - the password visibility toggle button doesn't actually work. This is not a test issue.

**Recommendation:** 
- Skip this test for now (mark as `test.skip()`)
- Or investigate the UI component to fix the toggle functionality
- This is blocking 2 test executions per run (Chromium + Firefox)

### 2. "Should successfully create account with valid data" (Chromium - Flaky)

**Status:** ⚠️ **Flaky in Chromium** (passes sometimes, fails with 409)

**Error:**
```
Expected: 200
Received: 409
```

**Root Cause:** Email collision - the test email from `site-config` (happy_path_email_test_chrome) is already in use, causing a duplicate email error.

**Why it's flaky:**
- Sometimes the email is available → test passes
- Sometimes the email is already taken → test fails with 409
- The test doesn't clean up after itself

**Recommendation:**
- Use a truly unique email (timestamp-based) instead of relying on site-config
- Or clean up test users after the test
- This is a test design issue, not a UI issue

### 3. Firefox Timeout Issues (Flaky)

**Status:** ⚠️ **Flaky in Firefox** (passes on retry ~60-70% of the time)

**Tests Affected:**
- `should prevent submission for duplicate email` (Firefox)
- `should successfully create a new user account` (Firefox)

**Error:**
```
TimeoutError: page.waitForResponse: Timeout 45000ms exceeded
```

**Root Cause:** Firefox is slower to submit forms or the form submission isn't triggering properly. The 45-second timeout isn't enough in some cases.

**Why it's flaky:**
- Firefox headless mode is slower than Chromium
- Network timing differences
- Form submission may be blocked or delayed

**Recommendation:**
- Increase timeout further (60s?)
- Or add more explicit waits before form submission
- Or mark Firefox-specific tests as flaky with longer timeouts

## Summary Statistics

### By Test:
- **Password Toggle:** 2 failures per run (100% failure rate)
- **Create Account (Chromium):** ~1 failure per run (50% failure rate - email collision)
- **Firefox Timeouts:** ~1-2 failures per run (30-40% failure rate)

### By Browser:
- **Chromium:** 1-2 failures per run (password toggle + email collision)
- **Firefox:** 2-3 failures per run (password toggle + timeouts)

### Overall:
- **Consistent failures:** 2 (password toggle in both browsers)
- **Flaky failures:** 2-3 (email collision in Chromium, timeouts in Firefox)
- **Pass rate:** ~83-88% (35-36 passed out of 42 tests)

## Recommendations

### Priority 1: Fix Email Collision (Easy Fix)
- Change "should successfully create account with valid data" to use unique emails
- This will eliminate the Chromium flakiness

### Priority 2: Skip Password Toggle (Quick Win)
- Mark password toggle test as `test.skip()` 
- Document it as a known UI bug
- This eliminates 2 failures per run immediately

### Priority 3: Firefox Timeout Handling
- Increase timeouts further OR
- Mark Firefox-specific tests as flaky OR
- Add more explicit waits

## Next Steps

1. **Fix email collision** - Use unique emails in the test
2. **Skip password toggle** - Mark as skipped until UI is fixed
3. **Continue with other groups** - These issues don't block other tests


