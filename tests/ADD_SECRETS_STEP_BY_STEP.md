# Step-by-Step: Adding GitHub Secrets

## Quick Steps

### 1. Open GitHub Secrets Page

Go to your repository on GitHub, then:
- Click **Settings** (top menu)
- Click **Secrets and variables** → **Actions** (left sidebar)
- Click **New repository secret** button

### 2. Add Secret #1: TEST_USER_EMAIL

1. **Name:** Type exactly: `TEST_USER_EMAIL`
2. **Secret:** Type: `thewarren@gmail.com`
3. Click **Add secret**

### 3. Add Secret #2: TEST_USER_PASSWORD_STAGING

1. Click **New repository secret** again
2. **Name:** Type exactly: `TEST_USER_PASSWORD_STAGING`
3. **Secret:** Get the value from one of these places:

   **Option A: From .env.test file (easiest)**
   - Open `.env.test` file in a text editor
   - Find the line: `TEST_USER_PASSWORD_STAGING="..."`
   - Copy the value between the quotes (without the quotes)
   - Paste into GitHub Secret

   **Option B: From Vercel Dashboard**
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Find `TEST_USER_PASSWORD_STAGING` in Preview environment
   - Click the eye icon to reveal
   - Copy the value
   - Paste into GitHub Secret

4. Click **Add secret**

### 4. Add Secret #3: TEST_USER_PASSWORD_PRODUCTION

1. Click **New repository secret** again
2. **Name:** Type exactly: `TEST_USER_PASSWORD_PRODUCTION`
3. **Secret:** Get the value from one of these places:

   **Option A: From .env.test file**
   - Open `.env.test` file
   - Find the line: `TEST_USER_PASSWORD_PRODUCTION="..."`
   - Copy the value between the quotes
   - Paste into GitHub Secret

   **Option B: From Vercel Dashboard**
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Find `TEST_USER_PASSWORD_PRODUCTION` in Production environment
   - Click the eye icon to reveal
   - Copy the value
   - Paste into GitHub Secret

4. Click **Add secret**

### 5. Verify All Secrets Are Added

You should see 3 secrets in the list:
- ✅ TEST_USER_EMAIL
- ✅ TEST_USER_PASSWORD_STAGING
- ✅ TEST_USER_PASSWORD_PRODUCTION

## Getting Password Values from .env.test

If you need to see the passwords from your local file:

**Method 1: Open in Text Editor**
- Open `.env.test` in Notepad, VS Code, or any text editor
- Find the lines with `TEST_USER_PASSWORD_STAGING` and `TEST_USER_PASSWORD_PRODUCTION`
- Copy the values (between the quotes)

**Method 2: PowerShell (if you prefer)**
```powershell
# This will show you the values (be careful - passwords will be visible)
Get-Content .env.test | Select-String "TEST_USER_PASSWORD"
```

## Test Your Setup

After adding all 3 secrets:

1. Go to GitHub → **Actions** tab
2. Click **Smoke Tests** workflow
3. Click **Run workflow** button (top right)
4. Click **Run workflow** (green button)
5. Watch it run - should complete successfully!

## Troubleshooting

### Can't Find .env.test File

If you don't have `.env.test`:
```powershell
vercel env pull .env.test --environment=preview
```

### Passwords Not Working

- Make sure you copied the entire password (no extra spaces)
- Check that the password matches what's in Vercel
- Verify the secret name is exactly correct (case-sensitive)

### Workflow Fails with "Secret not found"

- Double-check secret names are exactly:
  - `TEST_USER_EMAIL` (not `test_user_email`)
  - `TEST_USER_PASSWORD_STAGING` (exact case)
  - `TEST_USER_PASSWORD_PRODUCTION` (exact case)

## That's It!

Once these 3 secrets are added, your automated tests will run automatically on deployments!




