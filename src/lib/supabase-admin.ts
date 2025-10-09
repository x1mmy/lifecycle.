import { createClient } from '@supabase/supabase-js'
import { env } from '~/env'

/**
 * Server-side Supabase client with service role key
 * 
 * ⚠️  WARNING: ONLY use this on the server side!
 * - Has full database access (bypasses RLS)
 * - Uses service role key (secret, not safe for browser)
 * - For admin operations like user management
 * - DO NOT import this in client-side code
 */
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,    // Supabase project URL
  env.SUPABASE_SERVICE_ROLE_KEY,   // Secret service role key (server-only)
  {
    auth: {
      autoRefreshToken: false,  // Don't refresh tokens (server doesn't need it)
      persistSession: false     // Don't persist sessions (server doesn't need it)
    }
  }
)
