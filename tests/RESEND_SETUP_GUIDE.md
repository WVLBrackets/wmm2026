# Resend Email Setup Guide

## Overview

This guide walks you through setting up Resend as the primary email provider with Gmail as automatic fallback for both staging and production environments.

## Email Provider Strategy

- **Primary**: Resend (with custom domain `warrensmm.com`)
- **Fallback**: Gmail (automatic if Resend fails)
- **Staging**: `donotreply-staging@warrensmm.com` (Resend) → `donotreply.wmm.stage@gmail.com` (Gmail fallback)
- **Production**: `donotreply@warrensmm.com` (Resend) → `ncaatourney@gmail.com` (Gmail fallback)

## Step 1: Set Up Resend Account

1. **Sign up for Resend** (if not already done):
   - Go to https://resend.com/signup
   - Create a free account (3,000 emails/month free tier)

2. **Get your API Key**:
   - Go to Resend Dashboard → API Keys
   - Click "Create API Key"
   - Name it (e.g., "WMM2026 Production")
   - Copy the API key (you'll need it in Step 3)

## Step 2: Add Domain to Resend

1. **Add your domain**:
   - Go to Resend Dashboard → Domains
   - Click "Add Domain"
   - Enter: `warrensmm.com`
   - Click "Add"

2. **Set up DNS records**:
   - Resend will provide DNS records to add:
     - **TXT record** (for domain verification)
     - **SPF record** (for email authentication)
     - **DKIM records** (for email signing)
   
3. **Add DNS records to your domain**:
   - Go to your domain registrar (where you manage `warrensmm.com`)
   - Add the DNS records provided by Resend
   - Wait for DNS propagation (usually 5-30 minutes)

4. **Verify domain in Resend**:
   - Go back to Resend Dashboard → Domains
   - Click "Verify" on `warrensmm.com`
   - Wait for verification (may take a few minutes)

## Step 3: Set Up Vercel Environment Variables

### For Preview/Staging Environment:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Select **Preview** environment
3. Add/Update the following variables:

#### Required Variables:
- **`RESEND_API_KEY`**
  - Value: Your Resend API key (from Step 1)
  - Environment: Preview ✅

- **`FROM_EMAIL_STAGING`**
  - Value: `donotreply-staging@warrensmm.com`
  - Environment: Preview ✅

- **`EMAIL_USER_STAGING`** (Gmail fallback)
  - Value: `donotreply.wmm.stage@gmail.com`
  - Environment: Preview ✅

- **`EMAIL_PASS_STAGING`** (Gmail fallback)
  - Value: App password for `donotreply.wmm.stage@gmail.com`
  - Environment: Preview ✅
  - Note: Use Gmail App Password, not regular password

### For Production Environment:

1. Select **Production** environment
2. Add/Update the following variables:

#### Required Variables:
- **`RESEND_API_KEY`**
  - Value: Your Resend API key (same as staging)
  - Environment: Production ✅

- **`FROM_EMAIL_PRODUCTION`**
  - Value: `donotreply@warrensmm.com`
  - Environment: Production ✅

- **`EMAIL_USER_PRODUCTION`** (Gmail fallback)
  - Value: `ncaatourney@gmail.com`
  - Environment: Production ✅

- **`EMAIL_PASS_PRODUCTION`** (Gmail fallback)
  - Value: App password for `ncaatourney@gmail.com`
  - Environment: Production ✅
  - Note: Use Gmail App Password, not regular password

## Step 4: Environment Variables Summary

### Preview/Staging Environment Variables:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL_STAGING=donotreply-staging@warrensmm.com
EMAIL_USER_STAGING=donotreply.wmm.stage@gmail.com
EMAIL_PASS_STAGING=your-app-password-here
```

### Production Environment Variables:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL_PRODUCTION=donotreply@warrensmm.com
EMAIL_USER_PRODUCTION=ncaatourney@gmail.com
EMAIL_PASS_PRODUCTION=your-app-password-here
```

## Step 5: Variables to Remove/Update

### Variables You Can Remove (if they exist):
- ❌ `EMAIL_USER` (replaced by `EMAIL_USER_STAGING`/`EMAIL_USER_PRODUCTION`)
- ❌ `EMAIL_PASS` (replaced by `EMAIL_PASS_STAGING`/`EMAIL_PASS_PRODUCTION`)
- ❌ `FROM_EMAIL` (replaced by `FROM_EMAIL_STAGING`/`FROM_EMAIL_PRODUCTION`)

**Note**: Keep `EMAIL_USER` and `EMAIL_PASS` if you want a global fallback, but it's better to use environment-specific variables.

### Variables to Keep:
- ✅ `TEST_USER_EMAIL` (for test authentication)
- ✅ `TEST_USER_PASSWORD_STAGING` (for test authentication)
- ✅ `TEST_USER_PASSWORD_PRODUCTION` (for test authentication)
- ✅ All other existing variables

## Step 6: Get Gmail App Passwords

For the Gmail fallback accounts, you need to generate App Passwords:

### For `donotreply.wmm.stage@gmail.com`:
1. Go to Google Account → Security
2. Enable 2-Step Verification (if not already enabled)
3. Go to App Passwords
4. Generate a new app password for "Mail"
5. Copy the 16-character password
6. Use this as `EMAIL_PASS_STAGING`

### For `ncaatourney@gmail.com`:
1. Same steps as above
2. Generate app password
3. Use this as `EMAIL_PASS_PRODUCTION`

## Step 7: Redeploy Both Environments

After adding environment variables:

1. **Redeploy Staging**:
   - Go to Vercel Dashboard → Deployments
   - Find latest staging deployment
   - Click "Redeploy" (or push to `staging` branch)

2. **Redeploy Production**:
   - Go to Vercel Dashboard → Deployments
   - Find latest production deployment
   - Click "Redeploy" (or push to `main` branch)

## Step 8: Test the Setup

### Test Staging:
1. Trigger an email in staging (e.g., create a test account)
2. Check Vercel deployment logs for:
   ```
   [EmailService] Environment: preview (staging/preview)
   [EmailService] Attempting to send via Resend from: donotreply-staging@warrensmm.com
   [EmailService] ✅ Email sent successfully via Resend: [id]
   ```
3. Verify email is received from `donotreply-staging@warrensmm.com`

### Test Production:
1. Trigger an email in production (e.g., create a test account)
2. Check Vercel deployment logs for:
   ```
   [EmailService] Environment: production (production)
   [EmailService] Attempting to send via Resend from: donotreply@warrensmm.com
   [EmailService] ✅ Email sent successfully via Resend: [id]
   ```
3. Verify email is received from `donotreply@warrensmm.com`

### Test Fallback (Optional):
To test Gmail fallback, temporarily break Resend (e.g., wrong API key) and verify Gmail is used:
```
[EmailService] Resend failed, attempting Gmail fallback: [error]
[EmailService] Attempting Gmail fallback using: donotreply.wmm.stage@...
[EmailService] ✅ Email sent successfully via Gmail (fallback): [id]
```

## Troubleshooting

### Resend Domain Not Verified:
- Check DNS records are correctly added
- Wait for DNS propagation (can take up to 48 hours)
- Verify records in Resend dashboard

### Emails Not Sending:
- Check Vercel deployment logs for error messages
- Verify all environment variables are set correctly
- Check Resend dashboard for API key validity
- Verify Gmail app passwords are correct

### Wrong Email Address Used:
- Check `FROM_EMAIL_STAGING` vs `FROM_EMAIL_PRODUCTION` are set correctly
- Verify environment detection (`VERCEL_ENV` should be `preview` for staging, `production` for production)

## Summary Checklist

- [ ] Resend account created
- [ ] Resend API key generated
- [ ] Domain `warrensmm.com` added to Resend
- [ ] DNS records added to domain registrar
- [ ] Domain verified in Resend
- [ ] `RESEND_API_KEY` added to Vercel (Preview + Production)
- [ ] `FROM_EMAIL_STAGING` added to Vercel (Preview)
- [ ] `FROM_EMAIL_PRODUCTION` added to Vercel (Production)
- [ ] `EMAIL_USER_STAGING` added to Vercel (Preview)
- [ ] `EMAIL_PASS_STAGING` added to Vercel (Preview)
- [ ] `EMAIL_USER_PRODUCTION` added to Vercel (Production)
- [ ] `EMAIL_PASS_PRODUCTION` added to Vercel (Production)
- [ ] Gmail app passwords generated for both accounts
- [ ] Staging redeployed
- [ ] Production redeployed
- [ ] Staging email test successful
- [ ] Production email test successful

## Support

If you encounter issues:
1. Check Vercel deployment logs for detailed error messages
2. Verify all environment variables are set correctly
3. Check Resend dashboard for domain status
4. Verify Gmail app passwords are correct

