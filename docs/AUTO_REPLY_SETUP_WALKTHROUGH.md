# Auto-Reply Setup Walkthrough

This is a step-by-step guide to set up the auto-reply system for do-not-reply email addresses.

## Prerequisites

- Access to Resend dashboard (https://resend.com)
- Access to your domain registrar (where you manage `warrensmm.com` DNS)
- Access to Vercel dashboard for your project

---

## Step 1: Enable Inbound Email in Resend

### 1.1 Log into Resend Dashboard

1. Go to https://resend.com
2. Log in to your account
3. Navigate to **Domains** in the left sidebar

### 1.2 Select Your Domain

1. Find `warrensmm.com` in your domains list
2. Click on it to open the domain settings

### 1.3 Enable Inbound Email

1. Look for a section called **"Inbound Email"** or **"Email Receiving"** or **"MX Records"**
2. Click **"Enable Inbound Email"** or similar button
3. Resend will generate an MX record for you
4. **Copy the MX record** - it will look something like:
   ```
   mx.resend.com
   ```
   Or it might be a full MX record like:
   ```
   10 mx.resend.com
   ```

**Note:** If you don't see an "Inbound Email" option, Resend may handle this differently. Check Resend's documentation or contact their support.

---

## Step 2: Add MX Record to Your DNS

### 2.1 Log into Your Domain Registrar

1. Go to where you manage DNS for `warrensmm.com`
   - This could be:
     - Your domain registrar (GoDaddy, Namecheap, etc.)
     - A DNS service (Cloudflare, Route 53, etc.)
     - Your hosting provider

### 2.2 Navigate to DNS Management

1. Find **DNS Settings** or **DNS Management** or **DNS Records**
2. Look for **MX Records** section

### 2.3 Add the MX Record

1. Click **"Add Record"** or **"Create Record"**
2. Select record type: **MX**
3. Enter the following:
   - **Name/Host**: `@` or leave blank (for root domain)
   - **Priority**: `10` (or the priority Resend provided)
   - **Value/Target**: `mx.resend.com` (or what Resend provided)
   - **TTL**: `3600` (or default)

4. **Save** the record

### 2.4 Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Usually takes 15-30 minutes
- You can check propagation at: https://mxtoolbox.com/
- Enter `warrensmm.com` and check if the MX record appears

---

## Step 3: Configure Webhook in Resend

### 3.1 Navigate to Webhooks

1. In Resend dashboard, go to **Webhooks** (usually in left sidebar)
2. Click **"Create Webhook"** or **"Add Webhook"**

### 3.2 Set Webhook Details

1. **Name**: Enter something like `WMM2026 Inbound Email` or `Auto-Reply Webhook`

2. **URL**: Enter your webhook endpoint URL
   - **For Production**: `https://warrensmm.com/api/email/inbound`
   - **For Staging**: `https://wmm2026-git-staging-ncaatourney-gmailcoms-projects.vercel.app/api/email/inbound`
   - Or your actual staging URL from Vercel

3. **Events**: Select the events you want to receive
   - Look for: `email.received` or `email.replied` or `inbound.email`
   - Check Resend's documentation for exact event names
   - If unsure, select all email-related events

### 3.3 Generate Webhook Secret

1. Resend should provide a **Webhook Secret** or **Signing Secret**
2. **Copy this secret** - you'll need it in the next step
3. It will look like: `whsec_xxxxxxxxxxxxx` or similar

### 3.4 Save the Webhook

1. Click **"Create"** or **"Save"**
2. Note the webhook URL - you'll test it later

---

## Step 4: Add Environment Variable to Vercel

### 4.1 Go to Vercel Dashboard

1. Go to https://vercel.com
2. Log in and select your project (`wmm2026`)

### 4.2 Navigate to Environment Variables

1. Click **Settings** (top navigation)
2. Click **Environment Variables** (left sidebar)

### 4.3 Add RESEND_WEBHOOK_SECRET

1. Click **"Add New"** or **"Add"** button
2. Enter:
   - **Key**: `RESEND_WEBHOOK_SECRET`
   - **Value**: Paste the webhook secret from Step 3.3
   - **Environments**: 
     - ✅ Production
     - ✅ Preview (for staging)
     - ✅ Development (optional)

3. Click **"Save"**

### 4.4 Redeploy (if needed)

- Vercel should automatically redeploy when you add environment variables
- If not, go to **Deployments** and click **"Redeploy"** on the latest deployment

---

## Step 5: Test the Setup

### 5.1 Test the Webhook Endpoint

1. Open a browser or use curl:
   ```
   https://warrensmm.com/api/email/inbound
   ```
   Or for staging:
   ```
   https://your-staging-url.vercel.app/api/email/inbound
   ```

2. You should see:
   ```json
   {
     "status": "ok",
     "message": "Inbound email webhook endpoint is active",
     "timestamp": "2026-01-XX..."
   }
   ```

### 5.2 Send a Test Reply

1. **Send an email** to `donotreply@warrensmm.com` (or your staging address)
   - Use a different email address (not the do-not-reply address)
   - Subject: "Test Reply"
   - Body: "This is a test reply"

2. **Check Vercel Logs**:
   - Go to Vercel Dashboard → Your Project → **Deployments**
   - Click on the latest deployment
   - Click **"Functions"** tab
   - Look for `/api/email/inbound` function
   - Check the logs for:
     - `[InboundEmail] Processing reply from...`
     - `[InboundEmail] Auto-reply sent successfully...`

3. **Check Your Test Email**:
   - You should receive an auto-reply email
   - Subject: "Re: Test Reply - Do Not Reply"
   - Contains message about the mailbox not being monitored
   - Includes contact email address

### 5.3 Verify Auto-Reply Content

The auto-reply should:
- ✅ Clearly state the mailbox is not monitored
- ✅ Include the contact email from your site config (`emailContactAddress`)
- ✅ Be professionally formatted
- ✅ Include the "Do Not Reply" notice from your config

---

## Troubleshooting

### Webhook Not Receiving Emails

**Check DNS MX Record:**
1. Go to https://mxtoolbox.com/
2. Enter `warrensmm.com`
3. Verify the MX record points to Resend
4. If not showing, wait longer or check DNS settings

**Check Resend Dashboard:**
1. Go to Resend → Domains → `warrensmm.com`
2. Verify inbound email is enabled
3. Check for any error messages

**Check Webhook URL:**
1. Verify the webhook URL in Resend matches your actual domain
2. Test the endpoint directly (Step 5.1)
3. Check Vercel logs for any errors

### Auto-Reply Not Sending

**Check Vercel Logs:**
1. Look for errors in function logs
2. Check if webhook is being received
3. Look for `[AutoReply]` log messages

**Check Email Service:**
1. Verify Resend API key is set in Vercel
2. Check if regular emails are sending (to verify email service works)
3. Look for email service errors in logs

**Check Site Config:**
1. Verify `emailContactAddress` is set in your Google Sheets config
2. The auto-reply uses this for the contact email

### Signature Verification Failing

**Check Environment Variable:**
1. Verify `RESEND_WEBHOOK_SECRET` is set in Vercel
2. Make sure it matches the secret from Resend
3. Check that it's set for the correct environment (Production/Preview)

**Temporarily Disable (for testing):**
- The code will allow unverified requests in development
- In production, it will block unverified requests
- Make sure the secret is correct before going to production

---

## Verification Checklist

Before considering setup complete, verify:

- [ ] MX record added to DNS and propagated
- [ ] Inbound email enabled in Resend dashboard
- [ ] Webhook created in Resend with correct URL
- [ ] `RESEND_WEBHOOK_SECRET` added to Vercel environment variables
- [ ] Webhook endpoint returns 200 OK when accessed
- [ ] Test reply sent to do-not-reply address
- [ ] Auto-reply email received
- [ ] Auto-reply contains correct contact email
- [ ] Vercel logs show successful webhook processing

---

## Next Steps After Setup

1. **Monitor the System:**
   - Check Vercel logs periodically
   - Monitor for any webhook failures
   - Watch for unusual activity

2. **Customize Auto-Reply:**
   - Update `emailContactAddress` in Google Sheets config
   - Update `emailDoNotReplyNotice` if you want to customize the message

3. **Set Up Gmail Auto-Reply (for staging):**
   - If using Gmail for staging, set up Gmail's vacation responder
   - See `AUTO_REPLY_SETUP.md` for Gmail instructions

---

## Need Help?

If you encounter issues:

1. **Check Vercel Logs**: Most issues will show up in function logs
2. **Check Resend Dashboard**: Look for webhook delivery status
3. **Test Endpoint**: Use the GET endpoint to verify it's accessible
4. **Check DNS**: Use mxtoolbox.com to verify MX record

For Resend-specific issues, check:
- Resend Documentation: https://resend.com/docs
- Resend Support: support@resend.com

