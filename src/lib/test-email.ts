import { sendEmail } from './emailService';

// Test function to verify email configuration
export async function testEmailConfiguration() {
  console.log('Testing email configuration...');
  
  // Check if environment variables are set
  if (!process.env.EMAIL_USER) {
    console.error('❌ EMAIL_USER not set in environment variables');
    return false;
  }
  
  if (!process.env.EMAIL_PASS) {
    console.error('❌ EMAIL_PASS not set in environment variables');
    return false;
  }
  
  console.log('✅ Environment variables found');
  console.log(`📧 Email User: ${process.env.EMAIL_USER}`);
  console.log(`🔑 Email Pass: ${process.env.EMAIL_PASS ? 'Set' : 'Not set'}`);
  
  // Test sending a simple email
  try {
    const success = await sendEmail({
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: 'Warren\'s March Madness - Email Test',
      html: `
        <h2>🎉 Email Configuration Test</h2>
        <p>If you're reading this, your Gmail SMTP setup is working correctly!</p>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li>✅ Gmail SMTP connection successful</li>
          <li>✅ Email authentication working</li>
          <li>✅ Email sending functional</li>
        </ul>
        <p>Your Warren's March Madness email system is ready to go!</p>
      `,
      text: 'Email configuration test - Gmail SMTP is working correctly!'
    });
    
    if (success) {
      console.log('✅ Test email sent successfully!');
      return true;
    } else {
      console.error('❌ Failed to send test email');
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return false;
  }
}

