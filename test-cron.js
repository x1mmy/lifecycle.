// test-cron.js - Test cron job endpoints locally

// run = node test-cron.js

import { config } from 'dotenv';

// Load environment variables
config();

// Test configuration
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3001';

const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-key';

/**
 * Test a cron endpoint
 */
async function testCronEndpoint(endpoint, description) {
  console.log(`\n🧪 Testing ${description}...`);
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${description} - SUCCESS`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ${description} - FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error:`, JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.log(`❌ ${description} - ERROR`);
    console.log(`   Error:`, error.message);
  }
}

/**
 * Test email service directly
 */
async function testEmailService() {
  console.log(`\n🧪 Testing Email Service...`);
  
  try {
    // Import the email service (this will only work in Node.js environment)
    const { sendTestEmail } = await import('./src/lib/email-service.ts');
    
    const result = await sendTestEmail('zimraan2012@gmail.com', 'Test Business');
    
    if (result.success) {
      console.log(`✅ Email Service - SUCCESS`);
      console.log(`   Email ID: ${result.emailId}`);
    } else {
      console.log(`❌ Email Service - FAILED`);
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.log(`❌ Email Service - ERROR`);
    console.log(`   Error:`, error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Cron Job Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔑 Using CRON_SECRET: ${CRON_SECRET ? 'Yes' : 'No'}`);
  
  // Check required environment variables
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️  WARNING: RESEND_API_KEY not found in environment');
  }
  
  if (!process.env.CRON_SECRET) {
    console.log('⚠️  WARNING: CRON_SECRET not found in environment');
    console.log('   Using default test secret. Set CRON_SECRET in your environment for production.');
  }

  // Test endpoints (using test versions that target your specific user)
  await testCronEndpoint('/api/cron/test-daily-summary', 'Test Daily Summary Cron Job');
  await testCronEndpoint('/api/cron/test-weekly-report', 'Test Weekly Report Cron Job');
  
  // Test email service if running locally
  if (BASE_URL.includes('localhost')) {
    await testEmailService();
  } else {
    console.log('\n⏭️  Skipping email service test (not running locally)');
  }

  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error);
