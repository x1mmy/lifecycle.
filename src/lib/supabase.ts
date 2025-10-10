import { createClient } from '@supabase/supabase-js'

/**
 * Client-side Supabase client for browser usage
 * 
 * This client:
 * - Uses the public anon key (safe for browser)
 * - Handles user authentication (login/signup/logout)
 * - Respects Row Level Security (RLS) policies
 * - Automatically manages auth sessions
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,      // Supabase project URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // Public anon key (safe for client)
)
