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
  user_id: string;
  alert_threshold: number;
  daily_expiry_alerts_enabled: boolean;
  profiles: Profile;
}

interface DatabaseProduct {
  id: string;
  name: string;
  category: string;
  supplier?: string;
}

interface DatabaseBatch {
  id: string;
  product_id: string;
  batch_number?: string;
  expiry_date: string;
  quantity: number | null;
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
 * Daily cron job to send daily expiry alerts
 * Updated to work with product_batches architecture
 *
 * Purpose: Send daily operational emails with ALL batches expiring within user's alert threshold
 * Frequency: Daily at 9:00 AM UTC
 * Audience: Users who have daily_expiry_alerts_enabled = true
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

    console.log('🚀 Starting daily expiry alert cron job (batch architecture)...');

    // Get all users who have daily expiry alerts enabled
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('user_id, alert_threshold, daily_expiry_alerts_enabled')
      .eq('daily_expiry_alerts_enabled', true) as { data: Array<{user_id: string, alert_threshold: number, daily_expiry_alerts_enabled: boolean}> | null; error: SupabaseError | null };

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      console.log('ℹ️ No users found with daily expiry alerts enabled');
      return NextResponse.json({
        message: 'No users with daily expiry alerts enabled',
        processed: 0,
        emails_sent: 0
      });
    }

    // Get profiles for all users with enabled alerts
    const userIds = settings.map(s => s.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, business_name, email, is_active')
      .in('id', userIds) as { data: Array<{id: string, business_name: string, email: string, is_active: boolean}> | null; error: SupabaseError | null };

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    // Combine settings and profiles data
    const users: UserSetting[] = settings.map(setting => {
      const profile = profiles?.find(p => p.id === setting.user_id);
      if (!profile) {
        throw new Error(`Profile not found for user ${setting.user_id}`);
      }
      return {
        user_id: setting.user_id,
        alert_threshold: setting.alert_threshold,
        daily_expiry_alerts_enabled: setting.daily_expiry_alerts_enabled,
        profiles: profile
      };
    });

    console.log(`📧 Found ${users.length} users with daily expiry alerts enabled`);

    let processedUsers = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    // Process each user
    for (const userSetting of users) {
      try {
        const profile = userSetting.profiles;

        // Skip inactive users
        if (!profile.is_active) {
          console.log(`⏭️ Skipping inactive user: ${profile.email}`);
          continue;
        }

        processedUsers++;

        // Get batches expiring within the user's alert threshold
        const today = new Date().toISOString().split('T')[0];
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + userSetting.alert_threshold);
        const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

        // Step 1: Get all products for this user
        const { data: userProducts, error: productsError } = await supabase
          .from('products')
          .select('id, name, category, supplier')
          .eq('user_id', profile.id) as { data: DatabaseProduct[] | null; error: SupabaseError | null };

        if (productsError) {
          console.error(`❌ Error fetching products for ${profile.email}:`, productsError);
          errors.push(`Failed to fetch products for ${profile.email}`);
          continue;
        }

        if (!userProducts || userProducts.length === 0) {
          console.log(`ℹ️ No products found for ${profile.email}`);
          continue;
        }

        // Step 2: Get batches expiring within threshold
        const productIds = userProducts.map(p => p.id);
        const { data: batches, error: batchesError } = await supabase
          .from('product_batches')
          .select('*')
          .in('product_id', productIds)
          .gte('expiry_date', today!)
          .lte('expiry_date', thresholdDateStr!)
          .order('expiry_date', { ascending: true }) as { data: DatabaseBatch[] | null; error: SupabaseError | null };

        if (batchesError) {
          console.error(`❌ Error fetching batches for ${profile.email}:`, batchesError);
          errors.push(`Failed to fetch batches for ${profile.email}`);
          continue;
        }

        // Skip if no batches expiring
        if (!batches || batches.length === 0) {
          console.log(`ℹ️ No expiring batches for ${profile.email}`);
          continue;
        }

        // Step 3: Combine batch data with product info for email
        const productsForEmail: Product[] = batches.map(batch => {
          const product = userProducts.find(p => p.id === batch.product_id);
          return {
            id: batch.id,
            name: product?.name ?? 'Unknown Product',
            category: product?.category ?? 'Unknown',
            expiry_date: batch.expiry_date,
            quantity: batch.quantity ?? 0,
            batch_number: batch.batch_number,
            supplier: product?.supplier,
            location: undefined,
            days_until_expiry: calculateDaysUntilExpiry(batch.expiry_date),
          };
        });

        // Send email
        const userData: UserEmailData = {
          id: profile.id,
          business_name: profile.business_name,
          email: profile.email,
          alert_threshold: userSetting.alert_threshold,
        };

        const result = await sendDailyExpiryAlert(userData, productsForEmail);

        if (result.success) {
          emailsSent++;
          console.log(`✅ Sent expiry alert to ${profile.email} for ${batches.length} batches`);
        } else {
          console.error(`❌ Failed to send email to ${profile.email}:`, result.error);
          errors.push(`Failed to send email to ${profile.email}: ${result.error}`);
        }

      } catch (userError) {
        console.error(`❌ Error processing user ${userSetting.user_id}:`, userError);
        errors.push(`Error processing user ${userSetting.user_id}: ${userError instanceof Error ? userError.message : String(userError)}`);
      }
    }

    const response = {
      message: 'Daily expiry alert cron job completed',
      processed: processedUsers,
      emails_sent: emailsSent,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('✅ Daily cron job completed:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Daily cron job failed:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
