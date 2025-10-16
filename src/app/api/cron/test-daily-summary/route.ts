import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDailyExpiryAlert, type Product, type UserEmailData } from '../../../../lib/email-service';

// Type definitions for database queries
interface Profile {
  id: string;
  business_name: string;
  email: string;
  is_active: boolean;
}

interface UserSetting {
  alert_threshold: number;
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
const TEST_USER_ID = 'a80e9709-340f-4925-ab48-ef0f4cde639e';

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
 * Test cron job endpoint that uses a specific user ID
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('🚀 Starting TEST daily expiry alert cron job...');

    // Get the test user's profile directly
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

    // Get user settings (or use defaults if not found)
    const { data: userSettings } = await supabase
      .from('settings')
      .select('alert_threshold')
      .eq('user_id', TEST_USER_ID)
      .single() as { data: UserSetting | null; error: SupabaseError | null };

    const alertThreshold = userSettings?.alert_threshold ?? 7;
    
    if (!profile.is_active) {
      console.log('⏭️ Test user is inactive');
      return NextResponse.json({ error: 'Test user is inactive' }, { status: 400 });
    }

    console.log(`📧 Testing with user: ${profile.email}`);

    // Get products expiring within the user's alert threshold
    const today = new Date().toISOString().split('T')[0];
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + alertThreshold);
    const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', profile.id)
      .gte('expiry_date', today)
      .lte('expiry_date', thresholdDateStr)
      .order('expiry_date', { ascending: true }) as { data: DatabaseProduct[] | null; error: SupabaseError | null };

    if (productsError) {
      console.error(`❌ Error fetching products for ${profile.email}:`, productsError);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // If no products expiring, create some test products for demonstration
    let testProducts = products ?? [];
    
    if (testProducts.length === 0) {
      console.log('ℹ️ No expiring products found, creating test products...');
      
      // Create test products that expire soon
      const testProductData = [
        {
          user_id: profile.id,
          name: 'Test Product 1',
          category: 'Test Category',
          expiry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          quantity: 10,
          batch_number: 'TEST-001',
          supplier: 'Test Supplier',
          location: 'Test Location',
        },
        {
          user_id: profile.id,
          name: 'Test Product 2',
          category: 'Test Category',
          expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          quantity: 5,
          batch_number: 'TEST-002',
          supplier: 'Test Supplier',
          location: 'Test Location',
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

      testProducts = (insertedProducts ?? []) as DatabaseProduct[];
      console.log(`✅ Created ${testProducts.length} test products`);
    }

    // Transform products to include days until expiry
    const productsWithDays: Product[] = testProducts.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      expiry_date: product.expiry_date,
      quantity: product.quantity,
      batch_number: product.batch_number,
      supplier: product.supplier,
      location: product.location,
      days_until_expiry: calculateDaysUntilExpiry(product.expiry_date),
    }));

    // Send email
    const userData: UserEmailData = {
      id: profile.id,
      business_name: profile.business_name,
      email: profile.email,
      alert_threshold: alertThreshold,
    };

        const result = await sendDailyExpiryAlert(userData, productsWithDays);

    const response = {
      message: 'TEST daily expiry alert cron job completed',
      user_email: profile.email,
      business_name: profile.business_name,
      products_found: productsWithDays.length,
      email_sent: result.success,
      email_id: result.emailId,
      error: result.error,
      timestamp: new Date().toISOString(),
    };

    if (result.success) {
      console.log('✅ TEST daily cron job completed:', response);
    } else {
      console.error('❌ TEST daily cron job failed:', response);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ TEST daily cron job failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
