// test-email.js - Quick test to verify Resend is working

// run =  node test-email.js

// Import required packages
import { Resend } from 'resend';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Debug: Check if API key is loaded
console.log('RESEND_API_KEY loaded:', process.env.RESEND_API_KEY ? 'Yes' : 'No');

// Initialize with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a test email to verify everything is working
 */
async function sendTestEmail() {
  try {
    // Send a simple test email
    const data = await resend.emails.send({
      from: 'LifeCycle <notifications@lifecycle.cloud>',
      to: ['dylanpham89892@gmail.com'], // Replace with your actual email
      subject: '🎉 LifeCycle Email System is Live! - TEST',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Success!</h1>
          <p>Your LifeCycle email system is now fully operational and ready to send notifications.</p>
          <p style="color: #666;">This is a test email from your verified domain: lifecycle.cloud</p>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('Email ID:', data.data?.id);
    
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }
}

// Run the test
sendTestEmail();