# Email Deliverability Guide

## Overview

This guide covers best practices for ensuring emails reach users' inboxes and avoid spam folders.

## Current Setup

- **Production**: Resend (donotreply@warrensmm.com)
- **Staging**: Gmail SMTP (donotreply.wmm.stage@gmail.com)

## SPF/DKIM/DMARC Configuration

### For Resend (Production)

Resend automatically handles SPF, DKIM, and DMARC when you:
1. Add your domain (`warrensmm.com`) to Resend
2. Add the DNS records Resend provides
3. Verify your domain in the Resend dashboard

#### Steps to Configure:

1. **Add Domain in Resend Dashboard**
   - Go to Resend Dashboard → Domains
   - Click "Add Domain"
   - Enter `warrensmm.com`

2. **Add DNS Records**
   Resend will provide you with DNS records to add:
   - **SPF Record**: Authorizes Resend to send emails on your behalf
   - **DKIM Records**: Cryptographic signatures to verify email authenticity
   - **DMARC Record**: Policy for handling emails that fail SPF/DKIM checks

3. **Add Records to Your Domain Registrar**
   - Log into your domain registrar (where you purchased warrensmm.com)
   - Navigate to DNS management
   - Add the TXT records provided by Resend
   - Wait for DNS propagation (can take up to 48 hours, usually much faster)

4. **Verify Domain in Resend**
   - Once DNS records are added, Resend will automatically verify
   - You'll see a green checkmark when verification is complete

### For Gmail (Staging)

Gmail SMTP uses Google's infrastructure, so SPF/DKIM/DMARC are automatically handled by Google. No additional configuration needed.

## Best Practices for Deliverability

### 1. Email Content

✅ **DO:**
- Use clear, professional subject lines
- Include a clear "From" name (e.g., "Warren's March Madness")
- Keep HTML emails simple and well-formatted
- Include both HTML and plain text versions
- Use proper email structure (headers, body, footer)

❌ **DON'T:**
- Use excessive capitalization (e.g., "URGENT!!!")
- Include too many links or images
- Use spam trigger words excessively
- Send from generic addresses without a clear sender name

### 2. Sender Reputation

- **Warm up new domains**: Start with low volume and gradually increase
- **Monitor bounce rates**: Keep bounce rates below 5%
- **Handle complaints**: Set up feedback loops for spam complaints
- **Maintain consistent sending**: Regular, predictable sending patterns help

### 3. List Hygiene

- Remove invalid email addresses
- Honor unsubscribe requests immediately
- Don't send to users who haven't opted in
- Clean your list regularly

### 4. Technical Setup

- **SPF**: Authorizes which servers can send emails for your domain
- **DKIM**: Adds cryptographic signature to verify email authenticity
- **DMARC**: Policy for handling emails that fail authentication
- **Reverse DNS (rDNS)**: Ensure your sending IP has proper reverse DNS

## Monitoring Deliverability

### Tools to Check Your Setup

1. **MXToolbox** (https://mxtoolbox.com/)
   - Check SPF, DKIM, DMARC records
   - Verify DNS records are correct

2. **Mail-Tester** (https://www.mail-tester.com/)
   - Send a test email to get a spam score
   - Get recommendations for improvement

3. **Resend Dashboard**
   - Monitor delivery rates
   - View bounce and complaint rates
   - Check domain reputation

### What to Monitor

- **Delivery Rate**: Percentage of emails successfully delivered
- **Bounce Rate**: Should be < 5%
- **Spam Complaint Rate**: Should be < 0.1%
- **Open Rate**: Indicates emails are reaching inboxes
- **Domain Reputation**: Check via Resend dashboard or third-party tools

## Troubleshooting

### Emails Going to Spam

1. **Check SPF/DKIM/DMARC**: Use MXToolbox to verify records
2. **Review Email Content**: Use Mail-Tester to check spam score
3. **Check Sender Reputation**: Review bounce/complaint rates
4. **Verify Domain**: Ensure domain is verified in Resend
5. **Test with Different Providers**: Send test emails to Gmail, Outlook, Yahoo

### Common Issues

**Issue**: SPF record not found
- **Solution**: Add SPF TXT record to DNS

**Issue**: DKIM signature invalid
- **Solution**: Verify DKIM keys are correctly added to DNS

**Issue**: DMARC policy too strict
- **Solution**: Start with `p=none` (monitoring only), then move to `p=quarantine` or `p=reject`

**Issue**: High bounce rate
- **Solution**: Clean email list, remove invalid addresses

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Google Postmaster Tools](https://postmaster.google.com/)
- [SPF Record Syntax](https://www.openspf.org/SPF_Record_Syntax)
- [DMARC Guide](https://dmarc.org/wiki/FAQ)


