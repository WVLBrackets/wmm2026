import { NextRequest, NextResponse } from 'next/server';
import { sendAutoReplyEmail } from '@/lib/autoReplyService';
import crypto from 'crypto';

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
        from?: { email?: string } | string;
        sender?: { email?: string };
        subject?: string;
        to?: string;
        recipient?: string;
      };
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
    } else if (process.env.NODE_ENV === 'production') {
      // In production, warn if signature verification is not configured
      console.warn('[InboundEmail] WARNING: Webhook signature verification not configured');
    }
    
    // Resend webhook format (adjust based on actual Resend webhook structure)
    // Expected format: { type: 'email.received', data: { from: string, subject: string, ... } }
    const eventType = body.type || body.event;
    const emailData = body.data || body;

    // Only process email.received events (inbound emails)
    if (eventType !== 'email.received' && eventType !== 'email.replied') {
      console.log(`[InboundEmail] Ignoring event type: ${eventType}`);
      return NextResponse.json({ received: true });
    }

    // Extract email information
    // Handle from field which can be string or object
    let fromEmail: string | undefined;
    
    // Check data object first (Resend webhook format)
    if (emailData.data) {
      if (typeof emailData.data.from === 'string') {
        fromEmail = emailData.data.from;
      } else if (emailData.data.from && typeof emailData.data.from === 'object' && 'email' in emailData.data.from) {
        fromEmail = emailData.data.from.email;
      } else if (emailData.data.sender && typeof emailData.data.sender === 'object' && 'email' in emailData.data.sender) {
        fromEmail = emailData.data.sender.email;
      }
    }
    
    // Fallback to top-level fields
    if (!fromEmail) {
      if (typeof emailData.from === 'string') {
        fromEmail = emailData.from;
      } else if (emailData.from && typeof emailData.from === 'object' && 'email' in emailData.from) {
        fromEmail = emailData.from.email;
      } else if (emailData.sender && typeof emailData.sender === 'object' && 'email' in emailData.sender) {
        fromEmail = emailData.sender.email;
      }
    }
    
    const subject = emailData.subject || emailData.data?.subject || '';
    const toEmail = emailData.to || emailData.recipient || emailData.data?.to || emailData.data?.recipient;

    if (!fromEmail) {
      console.error('[InboundEmail] Missing sender email address');
      return NextResponse.json(
        { error: 'Missing sender email' },
        { status: 400 }
      );
    }

    // Check if this is a reply to a do-not-reply address
    const doNotReplyAddresses = [
      'donotreply@warrensmm.com',
      'donotreply-staging@warrensmm.com',
      'donotreply.wmm.stage@gmail.com',
      'ncaatourney@gmail.com',
    ];

    const isDoNotReply = doNotReplyAddresses.some(addr => 
      toEmail?.toLowerCase().includes(addr.toLowerCase()) ||
      emailData.to?.toLowerCase().includes(addr.toLowerCase())
    );

    if (!isDoNotReply) {
      console.log(`[InboundEmail] Email not to do-not-reply address, ignoring`);
      return NextResponse.json({ received: true });
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

