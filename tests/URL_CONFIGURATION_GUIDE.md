# URL Configuration Guide

## Where to Configure NEXTAUTH_URL and PRODUCTION_URL

### 1. NEXTAUTH_URL (Used by Application for Email Links)

**Purpose:** Used by the application to generate confirmation email links  
**Location:** Vercel Dashboard → Environment Variables → **Production** environment

**Steps:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find or add `NEXTAUTH_URL` for **Production** environment
5. Set value to: `https://warrensmm.com` (or your actual production URL)

**Current Status:**
- If not set, falls back to: `https://wmm2026.vercel.app`
- This is why confirmation emails show `wmm2026.vercel.app`

---

### 2. PRODUCTION_URL (Used by Playwright Tests)

**Purpose:** Used by Playwright tests to determine which URL to test against  
**Location:** Two places (choose one):

#### Option A: Vercel Environment Variables (Recommended for CI/CD)

**Steps:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add `PRODUCTION_URL` for **Production** environment
5. Set value to: `https://warrensmm.com` (or your actual production URL)

**Note:** This is automatically available in GitHub Actions workflows.

#### Option B: Local .env.test File (For Local Testing)

**Steps:**
1. Create or edit `.env.test` file in project root (if it doesn't exist)
2. Add this line:
   ```
   PRODUCTION_URL=https://warrensmm.com
   ```
3. The file is gitignored, so it won't be committed

**Or pull from Vercel:**
```powershell
vercel env pull .env.test
```
This will create/update `.env.test` with all environment variables from Vercel.

---

## Quick Setup Commands

### Check Current Values

**In PowerShell:**
```powershell
# Check if NEXTAUTH_URL is set locally (won't show Vercel values)
$env:NEXTAUTH_URL

# Check if PRODUCTION_URL is set locally
$env:PRODUCTION_URL
```

**In Vercel:**
- Go to Settings → Environment Variables
- Look for `NEXTAUTH_URL` and `PRODUCTION_URL` in Production environment

### Set Locally (Temporary - Only for Current Session)

**PowerShell:**
```powershell
$env:NEXTAUTH_URL="https://warrensmm.com"
$env:PRODUCTION_URL="https://warrensmm.com"
```

**Note:** These only last for the current PowerShell session. For permanent setup, use Vercel Dashboard or `.env.test` file.

---

## Summary

| Variable | Used By | Where to Set | Current Fallback |
|----------|---------|--------------|------------------|
| **NEXTAUTH_URL** | Application (email links) | Vercel Dashboard → Production | `https://wmm2026.vercel.app` |
| **PRODUCTION_URL** | Playwright tests | Vercel Dashboard → Production OR `.env.test` | `https://warrensmm.com` |

---

## Recommended Action

1. **Set NEXTAUTH_URL in Vercel:**
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Production environment
   - `NEXTAUTH_URL` = `https://warrensmm.com`

2. **Set PRODUCTION_URL in Vercel:**
   - Same location
   - Production environment
   - `PRODUCTION_URL` = `https://warrensmm.com`

3. **For Local Testing:**
   - Run `vercel env pull .env.test` to sync from Vercel
   - Or manually add `PRODUCTION_URL=https://warrensmm.com` to `.env.test`

---

## Verification

After setting both variables:

1. **Test NEXTAUTH_URL:**
   - Create a new account in production
   - Check confirmation email - link should use `warrensmm.com`

2. **Test PRODUCTION_URL:**
   - Run: `npx cross-env TEST_ENV=prod npx playwright test tests/simple-test.spec.ts`
   - Should test against `warrensmm.com`


