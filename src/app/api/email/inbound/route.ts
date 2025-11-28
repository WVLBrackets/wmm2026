import { NextRequest, NextResponse } from 'next/server';
import { sendAutoReplyEmail } from '@/lib/autoReplyService';
import crypto from 'crypto';

// In-memory cache to track processed email IDs for idempotency
// Prevents duplicate auto-replies when Resend retries webhooks
// Note: In a distributed system, consider using Redis or a database
const processedEmailIds = new Map<string, number>();

// Clean up old entries every 24 hours to prevent memory leaks
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // Keep entries for 24 hours

// Run cleanup periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [emailId, timestamp] of processedEmailIds.entries()) {
      if (now - timestamp > MAX_AGE_MS) {
        processedEmailIds.delete(emailId);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * POST /api/email/inbound
 * 
 * Webhook endpoint for receiving inbound emails from Resend
 * This handles replies to do-not-reply addresses and sends auto-replies
 * 
 * Resend webhook documentation: https://resend.com/docs/dashboard/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification (if needed)
    const rawBody = await request.text();
    
    // Define webhook payload type
    interface ResendWebhookPayload {
      type?: string;
      event?: string;
      data?: {
        email_id?: string;
        from?: { email?: string } | string;
        sender?: { email?: string };
        subject?: string;
        to?: string;
        recipient?: string;
      };
      email_id?: string;
      from?: { email?: string } | string;
      sender?: { email?: string };
      subject?: string;
      to?: string;
      recipient?: string;
    }
    
    let body: ResendWebhookPayload;
    
    try {
      body = JSON.parse(rawBody) as ResendWebhookPayload;
    } catch {
      console.error('[InboundEmail] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Verify webhook signature (if configured)
    const signature = request.headers.get('resend-signature') || 
                     request.headers.get('x-resend-signature') ||
                     request.headers.get('signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const vercelEnv = process.env.VERCEL_ENV || 'production';
    const isProduction = vercelEnv === 'production';
    
    // Log signature verification status for debugging
    console.log('[InboundEmail] Signature verification status:', {
      hasSecret: !!webhookSecret,
      hasSignature: !!signature,
      signatureHeader: signature ? 'present' : 'missing',
      environment: vercelEnv,
      isProduction,
    });
    
    if (webhookSecret && signature) {
      // Create a new request with the raw body for signature verification
      const requestForVerification = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: rawBody,
      });
      
      const isValid = await verifyResendSignature(requestForVerification, signature, webhookSecret);
      if (!isValid) {
        console.error('[InboundEmail] Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
      console.log('[InboundEmail] Webhook signature verified successfully');
    } else if (isProduction) {
      // In production, warn if signature verification is not configured
      if (!webhookSecret) {
        console.warn('[InboundEmail] WARNING: RESEND_WEBHOOK_SECRET not set in environment variables');
      }
      if (!signature) {
        console.warn('[InboundEmail] WARNING: Resend webhook signature header not present in request');
      }
    }
    
    // Resend webhook format (adjust based on actual Resend webhook structure)
    // Expected format: { type: 'email.received', data: { from: string, subject: string, ... } }
    const eventType = body.type || body.event;
    
    // Get email data - could be in body.data or directly in body
    const emailData = body.data || body;
    
    // Get email_id for idempotency (prevent duplicate processing on webhook retries)
    const emailId = emailData.email_id || body.email_id;

    // Log webhook payload for debugging (first few webhooks)
    console.log('[InboundEmail] Webhook payload:', JSON.stringify(body, null, 2));
    console.log('[InboundEmail] Event type:', eventType);
    console.log('[InboundEmail] Email ID:', emailId);
    console.log('[InboundEmail] Email data:', JSON.stringify(emailData, null, 2));

    // Only process email.received events (inbound emails)
    if (eventType !== 'email.received' && eventType !== 'email.replied') {
      console.log(`[InboundEmail] Ignoring event type: ${eventType}`);
      return NextResponse.json({ received: true });
    }

    // Extract email information
    // Handle from field which can be string or object
    let fromEmail: string | undefined;
    
    // Check if from is a string
    if (typeof emailData.from === 'string') {
      fromEmail = emailData.from;
    } 
    // Check if from is an object with email property
    else if (emailData.from && typeof emailData.from === 'object' && 'email' in emailData.from) {
      fromEmail = emailData.from.email;
    } 
    // Check sender object
    else if (emailData.sender && typeof emailData.sender === 'object' && 'email' in emailData.sender) {
      fromEmail = emailData.sender.email;
    }
    
    const subject = emailData.subject || '';
    // toEmail could be string, array, or object - normalize to string
    let toEmail: string | undefined;
    if (typeof emailData.to === 'string') {
      toEmail = emailData.to;
    } else if (Array.isArray(emailData.to)) {
      toEmail = emailData.to[0]; // Take first email if array
    } else if (emailData.recipient) {
      toEmail = typeof emailData.recipient === 'string' ? emailData.recipient : undefined;
    }

    if (!fromEmail) {
      console.error('[InboundEmail] Missing sender email address');
      return NextResponse.json(
        { error: 'Missing sender email' },
        { status: 400 }
      );
    }

    // EARLY CROSS-ENVIRONMENT CHECK - Do this immediately after extracting toEmail
    // This prevents production from processing staging emails and vice versa
    if (toEmail && typeof toEmail === 'string') {
      // Extract just the email address if it's in angle brackets or has a name
      let cleanToEmail = toEmail.toLowerCase().trim();
      // Extract email from "Name <email@domain.com>" format
      const angleBracketMatch = cleanToEmail.match(/<([^>]+)>/);
      if (angleBracketMatch) {
        cleanToEmail = angleBracketMatch[1].trim();
      }
      // Remove any leading/trailing whitespace or quotes
      cleanToEmail = cleanToEmail.replace(/^["']|["']$/g, '').trim();

      // Check if this is a staging email but we're in production, or vice versa
      const isStagingEmail = cleanToEmail === 'donotreply-staging@warrensmm.com' || 
                            cleanToEmail === 'donotreply.wmm.stage@gmail.com';
      const isProductionEmail = cleanToEmail === 'donotreply@warrensmm.com' || 
                                cleanToEmail === 'ncaatourney@gmail.com';
      
      if (isProduction && isStagingEmail) {
        console.log(`[InboundEmail] 🚫 BLOCKED: Production environment received staging email (${cleanToEmail}), ignoring immediately`);
        return NextResponse.json({ received: true, blocked: 'cross-environment', reason: 'production-received-staging-email' });
      }
      
      if (!isProduction && isProductionEmail) {
        console.log(`[InboundEmail] 🚫 BLOCKED: Staging environment received production email (${cleanToEmail}), ignoring immediately`);
        return NextResponse.json({ received: true, blocked: 'cross-environment', reason: 'staging-received-production-email' });
      }
      
      console.log(`[InboundEmail] ✓ Email (${cleanToEmail}) passed cross-environment check for ${isProduction ? 'production' : 'staging'} environment`);
    }

    // Check if this is a reply to a do-not-reply address
    // Only check addresses for the current environment to prevent duplicate replies
    // (vercelEnv and isProduction are already defined above)
    
    // Environment-specific do-not-reply addresses
    // Production should only respond to production addresses
    // Staging/preview should only respond to staging addresses
    const doNotReplyAddresses = isProduction
      ? [
          'donotreply@warrensmm.com',
          'ncaatourney@gmail.com', // Legacy production address
        ]
      : [
          'donotreply-staging@warrensmm.com',
          'donotreply.wmm.stage@gmail.com',
        ];

    console.log(`[InboundEmail] Environment: ${vercelEnv} (${isProduction ? 'production' : 'staging/preview'})`);
    console.log(`[InboundEmail] Checking against addresses: ${doNotReplyAddresses.join(', ')}`);
    console.log(`[InboundEmail] Email sent to: ${toEmail}`);
    console.log(`[InboundEmail] Raw toEmail type: ${typeof toEmail}, value: ${JSON.stringify(toEmail)}`);

    // Early return if toEmail is missing
    if (!toEmail || typeof toEmail !== 'string') {
      console.log(`[InboundEmail] Missing or invalid toEmail, ignoring`);
      return NextResponse.json({ received: true });
    }

    // Extract just the email address if it's in angle brackets or has a name
    let cleanToEmail = toEmail.toLowerCase().trim();
    // Extract email from "Name <email@domain.com>" format
    const angleBracketMatch = cleanToEmail.match(/<([^>]+)>/);
    if (angleBracketMatch) {
      cleanToEmail = angleBracketMatch[1].trim();
    }
    // Remove any leading/trailing whitespace or quotes
    cleanToEmail = cleanToEmail.replace(/^["']|["']$/g, '').trim();

    console.log(`[InboundEmail] Cleaned toEmail: ${cleanToEmail}`);

    // Use exact matching to prevent false positives (e.g., donotreply-staging matching donotreply)
    // Note: Cross-environment blocking already happened above, so we can proceed with matching
    const isDoNotReply = doNotReplyAddresses.some(addr => {
      const normalizedAddr = addr.toLowerCase().trim();
      
      // Exact match only
      if (cleanToEmail === normalizedAddr) {
        console.log(`[InboundEmail] ✓ Exact match found: ${cleanToEmail} === ${normalizedAddr}`);
        return true;
      }
      
      console.log(`[InboundEmail] ✗ No match: ${cleanToEmail} !== ${normalizedAddr}`);
      return false;
    });

    if (!isDoNotReply) {
      console.log(`[InboundEmail] Email not to a do-not-reply address for this environment, ignoring`);
      return NextResponse.json({ received: true });
    }

    console.log(`[InboundEmail] ✓ Email matches do-not-reply address for this environment, proceeding with auto-reply`);

    // Check idempotency: prevent duplicate processing if Resend retries the webhook
    if (emailId) {
      const now = Date.now();
      const lastProcessed = processedEmailIds.get(emailId);
      
      if (lastProcessed && (now - lastProcessed) < MAX_AGE_MS) {
        console.log(`[InboundEmail] ⚠️ Email ID ${emailId} already processed ${Math.round((now - lastProcessed) / 1000)}s ago. Skipping to prevent duplicate auto-reply.`);
        return NextResponse.json({
          received: true,
          autoReplySent: false,
          message: 'Email already processed (idempotency check)',
          duplicate: true,
        });
      }
      
      // Mark as processed
      processedEmailIds.set(emailId, now);
      console.log(`[InboundEmail] ✓ Email ID ${emailId} marked as processed`);
    }

    // Send auto-reply
    console.log(`[InboundEmail] Processing reply from ${fromEmail} to do-not-reply address`);
    const autoReplySent = await sendAutoReplyEmail(fromEmail, subject);

    if (autoReplySent) {
      console.log(`[InboundEmail] Auto-reply sent successfully to ${fromEmail}`);
    } else {
      console.error(`[InboundEmail] Failed to send auto-reply to ${fromEmail}`);
    }

    return NextResponse.json({
      received: true,
      autoReplySent,
      message: 'Email processed successfully',
    });

  } catch (error) {
    console.error('[InboundEmail] Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Verify Resend webhook signature
 * 
 * Resend webhook signatures use HMAC SHA256
 * Format: The signature header contains the HMAC hash of the request body
 * 
 * Note: This implementation may need adjustment based on Resend's actual format
 * Check Resend documentation for the exact signature format
 */
async function verifyResendSignature(
  request: NextRequest,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Get the raw request body for signature verification
    // Note: Next.js request body can only be read once, so we need to clone
    const clonedRequest = request.clone();
    const bodyText = await clonedRequest.text();
    
    // Resend typically uses HMAC SHA256 with the secret
    // Signature format may be: "sha256=<hash>" or just the hash
    const signatureHash = signature.replace('sha256=', '');
    
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyText)
      .digest('hex');
    
    // Compare signatures using constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    return isValid;
  } catch (error) {
    console.error('[InboundEmail] Signature verification error:', error);
    // If verification fails, log but don't block (for development/testing)
    // In production, you may want to return false to block unverified requests
    return process.env.NODE_ENV === 'production' ? false : true;
  }
}

/**
 * GET /api/email/inbound
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Inbound email webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

