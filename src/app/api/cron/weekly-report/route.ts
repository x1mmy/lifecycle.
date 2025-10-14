import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWeeklyReportEmail, type Product, type UserEmailData, type EmailStats } from '../../../../lib/email-service';

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Calculate days until expiry
 */
function calculateDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get user's email stats for the month
 */
async function getUserEmailStats(userId: string): Promise<{
  stats: EmailStats;
  expiringProducts: Product[];
  expiredProducts: Product[];
}> {
  // Get all products for the user
  const { data: allProducts, error: allProductsError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId);

  if (allProductsError) {
    throw new Error(`Failed to fetch products: ${allProductsError.message}`);
  }

  const products = allProducts || [];
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0];

  // Categorize products
  const expiredProducts: Product[] = [];
  const expiringProducts: Product[] = [];
  const categoryCounts: Record<string, number> = {};

  products.forEach(product => {
    const daysUntilExpiry = calculateDaysUntilExpiry(product.expiry_date);
    
    // Count categories
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;

    // Transform to Product type
    const transformedProduct: Product = {
      id: product.id,
      name: product.name,
      category: product.category,
      expiry_date: product.expiry_date,
      quantity: product.quantity,
      batch_number: product.batch_number,
      supplier: product.supplier,
      location: product.location,
      days_until_expiry: daysUntilExpiry,
    };

    if (daysUntilExpiry <= 0) {
      expiredProducts.push(transformedProduct);
    } else if (daysUntilExpiry <= 30) {
      expiringProducts.push(transformedProduct);
    }
  });

  // Sort expired products by most recent first
  expiredProducts.sort((a, b) => 
    new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime()
  );

  // Sort expiring products by closest expiry first
  expiringProducts.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

  // Get top 5 categories
  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const stats: EmailStats = {
    totalProducts: products.length,
    expiredCount: expiredProducts.length,
    expiringSoonCount: expiringProducts.length,
    topCategories,
  };

  return {
    stats,
    expiringProducts: expiringProducts.slice(0, 10), // Top 10 expiring soon
    expiredProducts: expiredProducts.slice(0, 10), // Top 10 most recently expired
  };
}

/**
 * Weekly cron job to send summary reports
 * Runs every Monday at 10:00 AM UTC
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET for security
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      console.error('❌ Unauthorized cron job request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Starting weekly report cron job...');

    // Get all users who have weekly_report enabled
    const { data: users, error: usersError } = await supabase
      .from('settings')
      .select(`
        user_id,
        profiles!inner (
          id,
          business_name,
          email,
          is_active
        )
      `)
      .eq('weekly_report', true);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ No users found with weekly reports enabled');
      return NextResponse.json({ 
        message: 'No users with weekly reports enabled',
        processed: 0,
        emails_sent: 0
      });
    }

    console.log(`📧 Found ${users.length} users with weekly reports enabled`);

    let processedUsers = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    // Process each user
    for (const userSetting of users) {
      try {
        const profile = userSetting.profiles as any;
        
        // Skip inactive users
        if (!profile.is_active) {
          console.log(`⏭️ Skipping inactive user: ${profile.email}`);
          continue;
        }

        processedUsers++;

        // Get user's email stats
        const { stats, expiringProducts, expiredProducts } = await getUserEmailStats(profile.id);

        // Send email (always send, even if no products)
        const userData: UserEmailData = {
          id: profile.id,
          business_name: profile.business_name,
          email: profile.email,
          alert_threshold: 7, // Default for weekly reports
        };

        const result = await sendWeeklyReportEmail(
          userData,
          stats,
          expiringProducts,
          expiredProducts
        );

        if (result.success) {
          emailsSent++;
          console.log(`✅ Sent weekly report to ${profile.email}`);
        } else {
          console.error(`❌ Failed to send weekly report to ${profile.email}:`, result.error);
          errors.push(`Failed to send email to ${profile.email}: ${result.error}`);
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${userSetting.user_id}:`, userError);
        errors.push(`Error processing user ${userSetting.user_id}: ${userError}`);
      }
    }

    const response = {
      message: 'Weekly report cron job completed',
      processed: processedUsers,
      emails_sent: emailsSent,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('✅ Weekly cron job completed:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Weekly cron job failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
