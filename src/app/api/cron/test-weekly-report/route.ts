import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWeeklyReportEmail, type Product, type UserEmailData, type EmailStats } from '../../../../lib/email-service';

// Type definitions for database queries
interface Profile {
  id: string;
  business_name: string;
  email: string;
  is_active: boolean;
}

interface DatabaseProduct {
  id: string;
  name: string;
  category: string;
  expiry_date: string;
  quantity: number;
  batch_number?: string;
  supplier?: string;
  location?: string;
}

interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

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

// Test user ID - replace with your actual user ID
const TEST_USER_ID = 'bf72fc3b-4d9a-451a-95b0-e6b993d50111';

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
 * Get user's email stats for testing
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
    .eq('user_id', userId) as { data: DatabaseProduct[] | null; error: SupabaseError | null };

  if (allProductsError) {
    throw new Error(`Failed to fetch products: ${allProductsError.message}`);
  }

  const products = allProducts ?? [];

  // Categorize products
  const expiredProducts: Product[] = [];
  const expiringProducts: Product[] = [];
  const categoryCounts: Record<string, number> = {};

  products.forEach(product => {
    const daysUntilExpiry = calculateDaysUntilExpiry(product.expiry_date);
    
    // Count categories
    categoryCounts[product.category ?? ''] = (categoryCounts[product.category ?? ''] ?? 0) + 1;

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
 * Test weekly report cron job endpoint that uses a specific user ID
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('🚀 Starting TEST weekly report cron job...');

    // Get the test user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', TEST_USER_ID)
      .single() as { data: Profile | null; error: SupabaseError | null };

    if (profileError) {
      console.error('❌ Error fetching test user profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch test user profile' }, { status: 500 });
    }

    if (!profile) {
      console.log('❌ Test user not found in profiles');
      return NextResponse.json({ error: 'Test user not found in profiles' }, { status: 404 });
    }
    
    if (!profile.is_active) {
      console.log('⏭️ Test user is inactive');
      return NextResponse.json({ error: 'Test user is inactive' }, { status: 400 });
    }

    console.log(`📧 Testing with user: ${profile.email}`);

    // Get user's email stats
    const { stats, expiringProducts, expiredProducts } = await getUserEmailStats(profile.id);

    // If no products exist, create some test data for demonstration
    if (stats.totalProducts === 0) {
      console.log('ℹ️ No products found, creating test products...');
      
      const testProductData = [
        {
          user_id: profile.id,
          name: 'Test Product 1',
          category: 'Electronics',
          expiry_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
          quantity: 10,
          batch_number: 'TEST-001',
          supplier: 'Test Supplier',
          location: 'Warehouse A',
        },
        {
          user_id: profile.id,
          name: 'Test Product 2',
          category: 'Electronics',
          expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
          quantity: 5,
          batch_number: 'TEST-002',
          supplier: 'Test Supplier',
          location: 'Warehouse B',
        },
        {
          user_id: profile.id,
          name: 'Test Product 3',
          category: 'Food',
          expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
          quantity: 20,
          batch_number: 'TEST-003',
          supplier: 'Food Supplier',
          location: 'Cold Storage',
        }
      ];

      const { data: insertedProducts, error: insertError } = await supabase
        .from('products')
        .insert(testProductData)
        .select();

      if (insertError) {
        console.error('❌ Error creating test products:', insertError);
        return NextResponse.json({ error: 'Failed to create test products' }, { status: 500 });
      }

      console.log(`✅ Created ${insertedProducts?.length || 0} test products`);
      
      // Refresh stats with new products
      await getUserEmailStats(profile.id);
    }

    // Send email
    const userData: UserEmailData = {
      id: profile.id,
      business_name: profile.business_name,
      email: profile.email,
      alert_threshold: 7,
    };

    const result = await sendWeeklyReportEmail(
      userData,
      stats,
      expiringProducts,
      expiredProducts
    );

    const response = {
      message: 'TEST weekly report cron job completed',
      user_email: profile.email,
      business_name: profile.business_name,
      stats: stats,
      email_sent: result.success,
      email_id: result.emailId,
      error: result.error,
      timestamp: new Date().toISOString(),
    };

    if (result.success) {
      console.log('✅ TEST weekly cron job completed:', response);
    } else {
      console.error('❌ TEST weekly cron job failed:', response);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ TEST weekly cron job failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
