import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate HTML for daily expiry alert email
 * This template is optimized for daily operational use - clear, actionable, and focused on immediate decisions.
 * Shows all products expiring within the user's alert threshold with clear status indicators.
 */
function generateExpiryAlertHTML(businessName: string, products: Product[], alertThreshold: number): string {
  const getExpiryStatus = (days: number) => {
    if (days <= 0) return { status: 'Expired', color: '#ef4444', bg: '#fef2f2' };
    if (days <= 3) return { status: 'Urgent', color: '#f59e0b', bg: '#fffbeb' };
    if (days <= 7) return { status: 'Warning', color: '#eab308', bg: '#fefce8' };
    return { status: 'Notice', color: '#6366f1', bg: '#f0f4ff' };
  };

  const productRows = products.map(product => {
    const statusInfo = getExpiryStatus(product.days_until_expiry);
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div>
            <strong>${product.name}</strong>
            ${product.batch_number ? `<div style="font-size: 12px; color: #6b7280;">Batch: ${product.batch_number}</div>` : ''}
          </div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="background-color: #f0f4ff; color: #6366f1; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;">${product.category}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${new Date(product.expiry_date).toLocaleDateString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: uppercase; background-color: ${statusInfo.bg}; color: ${statusInfo.color};">${statusInfo.status}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.quantity}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Product Expiry Alert - LifeCycle</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🚨 Product Expiry Alert</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">Action required for ${businessName}</p>
          </div>
          
          <div style="padding: 32px 24px;">
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
              <h2 style="color: #dc2626; margin: 0 0 8px 0; font-size: 18px;">⚠️ Attention Required</h2>
              <p style="margin: 0; color: #7f1d1d;">You have <strong>${products.length} product${products.length !== 1 ? 's' : ''}</strong> expiring within the next ${alertThreshold} days that require your attention.</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <thead>
                <tr>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Product</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Category</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Expiry Date</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Status</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Quantity</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>

            <div style="text-align: center; margin-top: 32px;">
              <a href="https://app.lifecycle.cloud/dashboard" style="display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View Dashboard</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">This is an automated alert from LifeCycle. You can manage your notification preferences in your account settings.</p>
          </div>

          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© 2024 LifeCycle. All rights reserved.</p>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">lifecycle.cloud | Product Lifecycle Management</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate HTML for weekly report email
 * This template provides strategic insights and analytics for weekly planning.
 * Includes comprehensive statistics, trends, and retrospective data for informed decision-making.
 */
function generateWeeklyReportHTML(businessName: string, stats: EmailStats, expiringProducts: Product[], expiredProducts: Product[]): string {
  const expiringRows = expiringProducts.slice(0, 5).map(product => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${product.name}</strong>
        ${product.batch_number ? `<div style="font-size: 11px; color: #6b7280;">Batch: ${product.batch_number}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <span style="background-color: #f0f4ff; color: #6366f1; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;">${product.category}</span>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(product.expiry_date).toLocaleDateString()}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; text-transform: uppercase; background-color: #fffbeb; color: #f59e0b;">${product.days_until_expiry} days</span>
      </td>
    </tr>
  `).join('');

  const expiredRows = expiredProducts.slice(0, 5).map(product => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <strong>${product.name}</strong>
        ${product.batch_number ? `<div style="font-size: 11px; color: #6b7280;">Batch: ${product.batch_number}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <span style="background-color: #f0f4ff; color: #6366f1; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;">${product.category}</span>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(product.expiry_date).toLocaleDateString()}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; text-transform: uppercase; background-color: #fef2f2; color: #dc2626;">Expired</span>
      </td>
    </tr>
  `).join('');

  const categoryItems = stats.topCategories.map(cat => 
    `<span style="background-color: #f0f4ff; color: #6366f1; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 500;">${cat.category} (${cat.count})</span>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Report - LifeCycle</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📊 Weekly Report</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">${businessName} - Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          
          <div style="padding: 32px 24px;">
            <p>Here's your weekly overview of product inventory and expiry status.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin: 24px 0;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #6366f1; margin: 0;">${stats.totalProducts}</div>
                <div style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Products</div>
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #6366f1; margin: 0;">${stats.expiredCount}</div>
                <div style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Expired</div>
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; color: #6366f1; margin: 0;">${stats.expiringSoonCount}</div>
                <div style="font-size: 12px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Expiring Soon</div>
              </div>
            </div>

            <div style="margin: 32px 0;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📈 Top Categories</h2>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0;">
                ${categoryItems}
              </div>
            </div>

            ${expiredProducts.length > 0 ? `
            <div style="margin: 32px 0;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">❌ Recently Expired Products</h2>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                <thead>
                  <tr>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Product</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Category</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Expiry Date</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${expiredRows}
                </tbody>
              </table>
            </div>
            ` : ''}

            ${expiringProducts.length > 0 ? `
            <div style="margin: 32px 0;">
              <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">⚠️ Products Expiring Soon</h2>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                <thead>
                  <tr>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Product</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Category</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Expiry Date</th>
                    <th style="background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 12px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${expiringRows}
                </tbody>
              </table>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 32px;">
              <a href="https://app.lifecycle.cloud/dashboard" style="display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View Full Dashboard</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">This weekly report helps you stay on top of your inventory. You can manage your notification preferences in your account settings.</p>
          </div>

          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">© 2024 LifeCycle. All rights reserved.</p>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">lifecycle.cloud | Product Lifecycle Management</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  expiry_date: string;
  quantity: number;
  batch_number?: string;
  supplier?: string;
  location?: string;
  days_until_expiry: number;
}

export interface EmailStats {
  totalProducts: number;
  expiredCount: number;
  expiringSoonCount: number;
  topCategories: { category: string; count: number }[];
}

export interface UserEmailData {
  id: string;
  business_name: string;
  email: string;
  alert_threshold: number;
}

/**
 * Send daily expiry alert email to a user
 * This is the consolidated daily notification that combines the functionality
 * of the previous "Email Alerts" and "Daily Summary" features.
 * 
 * Purpose: Daily operational email with ALL products expiring within the user's alert threshold
 * Frequency: Once per day (typically morning)
 * Audience: Users who have daily_expiry_alerts_enabled = true
 */
export async function sendDailyExpiryAlert(
  user: UserEmailData,
  products: Product[]
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    // Generate the email HTML
    const emailHtml = generateExpiryAlertHTML(user.business_name, products, user.alert_threshold);

    // Send the email
    const data = await resend.emails.send({
      from: 'LifeCycle <notifications@lifecycle.cloud>',
      to: [user.email],
      subject: `Daily Expiry Alert - ${products.length} products expiring in next ${user.alert_threshold} days`,
      html: emailHtml,
    });

    console.log(`✅ Daily expiry alert sent to ${user.email}, ID: ${data.data?.id}`);

    return {
      success: true,
      emailId: data.data?.id,
    };
  } catch (error) {
    console.error(`❌ Error sending daily expiry alert to ${user.email}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


/**
 * Send weekly report email to a user
 * This provides a strategic overview of inventory trends and analytics.
 * 
 * Purpose: Weekly strategic insights with analytics, trends, and comprehensive statistics
 * Frequency: Once per week (typically Monday)
 * Audience: Users who have weekly_report_enabled = true
 * Content: Includes retrospective data (expired products, top categories, trends)
 */
export async function sendWeeklyReportEmail(
  user: UserEmailData,
  stats: EmailStats,
  expiringProducts: Product[],
  expiredProducts: Product[]
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    // Generate the email HTML
    const emailHtml = generateWeeklyReportHTML(user.business_name, stats, expiringProducts, expiredProducts);

    // Send the email
    const data = await resend.emails.send({
      from: 'LifeCycle <notifications@lifecycle.cloud>',
      to: [user.email],
      subject: `Weekly Report - ${stats.totalProducts} products in your inventory`,
      html: emailHtml,
    });

    console.log(`✅ Weekly report sent to ${user.email}, ID: ${data.data?.id}`);

    return {
      success: true,
      emailId: data.data?.id,
    };
  } catch (error) {
    console.error(`❌ Error sending weekly report to ${user.email}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a test email to verify the service is working
 */
export async function sendTestEmail(
  to: 'zimraan2012@gmail.com',
  businessName: 'Test Business',
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const testProducts: Product[] = [
      {
        id: 'test-1',
        name: 'Sample Product 1',
        category: 'Test Category',
        expiry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
        quantity: 10,
        batch_number: 'TEST-001',
        days_until_expiry: 3,
      },
      {
        id: 'test-2',
        name: 'Sample Product 2',
        category: 'Test Category',
        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
        quantity: 5,
        days_until_expiry: 7,
      },
    ];

    // Send test daily expiry alert
    const result = await sendDailyExpiryAlert(
      { id: 'test', business_name: businessName, email: to, alert_threshold: 7 },
      testProducts
    );

    return result;
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
