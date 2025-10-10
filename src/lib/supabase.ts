import { createBrowserClient } from '@supabase/ssr'

/**
 * Client-side Supabase client for browser usage
 *
 * Why this matters for our routing fix:
 * - We use `createBrowserClient` which stores auth in cookies that the
 *   server-side middleware can read on the very next request.
 * - Previously, the middleware could not “see” the new session right
 *   after login, so it kept redirecting back to /login.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
