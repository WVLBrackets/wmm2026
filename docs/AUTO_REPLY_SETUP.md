# Auto-Reply Setup Guide

## Overview

This guide explains how to set up automatic replies when users reply to do-not-reply email addresses. The system sends a message directing users to the correct contact email.

Copy comes from **Emails & Account CMS** (`__emailsContent.autoReply` and `doNotReplyNotice`). Contact email comes from published homepage CMS (footer / Key Data). Blank CMS fields are omitted; a blank auto-reply **subject** fails the send. Editor `DEFAULT_*` seeds are not merged on the send path.

## Current Setup

- **Production**: Resend (`donotreply@warrensmm.com`)
- **Staging**: Gmail (`donotreply.wmm.stage@gmail.com`) or Resend (`donotreply-staging@warrensmm.com`)

## Option 1: Resend Inbound Email (Recommended for Production)

Resend supports receiving inbound emails via webhooks. When someone replies to a do-not-reply address, Resend sends a webhook to our API endpoint, which then sends an auto-reply.

### Step 1: Enable Inbound Email in Resend

1. **Go to Resend Dashboard**
   - Navigate to https://resend.com/domains
   - Click on your domain (`warrensmm.com`)

2. **Enable Inbound Email**
   - Look for "Inbound Email" or "Email Receiving" section
   - Enable inbound email for your domain
   - Resend will provide you with an MX record to add to your DNS

3. **Add MX Record to DNS**
   - Go to your domain registrar (where you manage `warrensmm.com`)
   - Add the MX record provided by Resend
   - Wait for DNS propagation (usually 5-30 minutes)

### Step 2: Configure Webhook in Resend

1. **Go to Resend Dashboard → Webhooks**
   - Click "Create Webhook"
   - Name it (e.g., "WMM2026 Inbound Email")

2. **Set Webhook URL**
   - URL: `https://your-domain.com/api/email/inbound`
   - For staging: your staging Vercel URL + `/api/email/inbound`
   - For production: `https://warrensmm.com/api/email/inbound`

3. **Select Events**
   - Select: `email.received` or `email.replied`
   - (Check Resend documentation for exact event names)

4. **Set Webhook Secret (Optional but Recommended)**
   - Generate a secret key
   - Save it as `RESEND_WEBHOOK_SECRET` in Vercel environment variables

### Step 3: Set Environment Variables in Vercel

1. **Go to Vercel Dashboard → Your Project → Settings → Environment Variables**

2. **Add Webhook Secret (if using signature verification)**
   - **Variable**: `RESEND_WEBHOOK_SECRET`
   - **Value**: The secret key from Resend webhook configuration
   - **Environments**: Production ✅, Preview ✅

### Step 4: Test the Webhook

1. **Send a test email** to `donotreply@warrensmm.com`
2. **Check Vercel logs** to see if the webhook was received
3. **Verify auto-reply** was sent to the test email address

## Option 2: Gmail Auto-Reply (For Staging)

Gmail doesn't have a built-in API webhook system like Resend, but you can set up auto-replies manually.

### Method 1: Gmail Auto-Reply (Manual Setup)

1. **Log into Gmail** (`donotreply.wmm.stage@gmail.com`)

2. **Go to Settings → General → Vacation responder**
   - Enable "Vacation responder on"
   - Set subject: "Automatic Reply - Do Not Reply Address"
   - Set message to match Emails & Account CMS (include the published contact email)
   - Set it to reply to all emails (not just contacts)

3. **Limitations**:
   - Gmail auto-reply only sends once per sender per day
   - It's not as customizable as the Resend webhook solution

### Method 2: Gmail Forwarding + API (Advanced)

For more control, you could:
1. Set up Gmail forwarding to forward replies to a monitored address
2. Use Gmail API to check for forwarded emails
3. Send auto-replies programmatically

This is more complex and may not be necessary if Resend is working for production.

## How It Works

1. **User replies** to `donotreply@warrensmm.com`
2. **Resend receives** the inbound email
3. **Resend sends webhook** to `/api/email/inbound`
4. **API endpoint**:
   - Verifies webhook signature (if configured)
   - Extracts sender email and subject
   - Checks if it's a reply to a do-not-reply address
   - Calls `sendAutoReplyEmail()` (`lib/autoReplyService.ts` → `getPublishedCmsBundle()`)
5. **Auto-reply email** is sent with CMS copy and the published contact email

## Auto-Reply Email Content

From Emails & Account CMS:

- `autoReply.subject` — tokens: `{subject}`
- `autoReply.heading`, `greeting`, `mainMessage`, `closing`
- `doNotReplyNotice` — tokens: `{contactEmail}`
- Contact address from homepage CMS (not a Config Sheet)

## Configuration

Update copy in Vintage Admin → Emails & Account and **publish**. Update contact email in homepage Key Data / Footer.

## Troubleshooting

### Webhook Not Receiving Emails

1. **Check DNS MX Record**: Verify the MX record is correctly added and propagated
2. **Check Resend Dashboard**: Verify inbound email is enabled for your domain
3. **Check Webhook URL**: Ensure the webhook URL is correct and accessible
4. **Check Vercel Logs**: Look for webhook requests in Vercel function logs

### Auto-Reply Not Sending

1. **Check Email Service**: Verify Resend/Gmail is configured correctly
2. **Check Logs**: Look for errors in Vercel function logs
3. **Check CMS**: Confirm Emails & Account is published and `autoReply.subject` is not blank
4. **Test Manually**: Call the API endpoint directly to test

### Signature Verification Failing

1. **Check Secret**: Verify `RESEND_WEBHOOK_SECRET` matches Resend webhook secret
2. **Check Format**: Resend signature format may vary - check Resend documentation
3. **Temporarily Disable**: For testing, you can temporarily disable signature verification

## Security Considerations

- **Webhook Signature**: Always verify webhook signatures in production
- **Rate Limiting**: Consider adding rate limiting to prevent abuse
- **Email Validation**: Validate sender email addresses before sending auto-replies
- **Spam Protection**: Consider adding checks to prevent spam/abuse

## Testing

### Test Webhook Endpoint

```bash
# Test the endpoint is accessible
curl https://your-domain.com/api/email/inbound

# Should return: {"status":"ok","message":"Inbound email webhook endpoint is active",...}
```

### Test Auto-Reply Function

You can test the auto-reply function directly by calling the API endpoint with a test payload (in a development environment).

## Next Steps

1. ✅ Set up Resend inbound email for production
2. ✅ Configure webhook in Resend dashboard
3. ✅ Add `RESEND_WEBHOOK_SECRET` to Vercel environment variables
4. ✅ Test with a real email reply
5. ✅ Set up Gmail auto-reply for staging (if needed)
6. ✅ Confirm Emails & Account CMS is published in each environment

## Additional Resources

- [Resend Inbound Email Documentation](https://resend.com/docs)
- [Resend Webhooks Documentation](https://resend.com/docs/dashboard/webhooks)
- [Gmail Auto-Reply Setup](https://support.google.com/mail/answer/25922)
- Step-by-step: `docs/AUTO_REPLY_SETUP_WALKTHROUGH.md`
