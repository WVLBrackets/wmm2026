# Quick Secret Setup Checklist

## Required Secrets (Minimum)

Copy these values from your Vercel environment variables or `.env.test` file:

1. **TEST_USER_EMAIL**
   - Value: `thewarren@gmail.com`

2. **TEST_USER_PASSWORD_STAGING**
   - Get from: Vercel Dashboard → Project → Settings → Environment Variables → Preview
   - Or from: `.env.test` file (line with `TEST_USER_PASSWORD_STAGING`)

3. **TEST_USER_PASSWORD_PRODUCTION**
   - Get from: Vercel Dashboard → Project → Settings → Environment Variables → Production
   - Or from: `.env.test` file (line with `TEST_USER_PASSWORD_PRODUCTION`)

## Where to Add Secrets

1. GitHub → Your Repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret one at a time

## Quick Password Lookup

If you need to see the passwords from your local `.env.test` file:

```powershell
# View the password values (they're in your .env.test file)
Get-Content .env.test | Select-String "TEST_USER_PASSWORD"
```

## Test It

After adding secrets:
1. Go to GitHub → **Actions** tab
2. Click **Smoke Tests**
3. Click **Run workflow** → **Run workflow**
4. Watch it run - should complete successfully!

## That's It!

Once these 3 secrets are added, your automated tests will run. Alerts are optional but recommended.




