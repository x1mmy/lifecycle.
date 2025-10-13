import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js Middleware for Authentication and Route Protection
 * 
 * This runs before every page load to:
 * - Check if user is authenticated
 * - Protect routes that require login
 * - Handle admin-only routes
 * - Redirect users to appropriate pages
 */
export async function middleware(req: NextRequest) {
  // Initialize response object
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // Create Supabase client for server-side auth checking
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from request
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        // Set cookies on both request and response
        set(name: string, value: string, options: Record<string, unknown>) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        // Remove cookies from both request and response
        remove(name: string, options: Record<string, unknown>) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get current user from Supabase (more reliable in middleware):
  // Using `getUser()` avoids race conditions where a fresh session
  // from the client isn’t immediately visible as a full `session`
  // object. If a user exists, consider them authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser()


  // Get the current pathname for route matching
  const cleanPathname = req.nextUrl.pathname;

  // Define which routes need authentication
  const protectedRoutes = ['/dashboard', '/admin', '/products', '/settings']
  
  // Define which routes are admin-only (including sub-routes)
  const adminRoutes = ['/admin']
  
  // Define public routes (login/signup pages)
  const publicRoutes = ['/login', '/signup']

  // Check what type of route user is trying to access
  const isProtectedRoute = protectedRoutes.some(route => cleanPathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => cleanPathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => cleanPathname.startsWith(route))

  // RULE 1: Block unauthenticated users from protected routes.
  // Use `!user` instead of `!session` to avoid timing issues.
  if (isProtectedRoute && !user) {
    // Redirect to login page with the original path as redirectTo parameter
    const url = new URL('/login', req.url);
    url.searchParams.set('redirectTo', cleanPathname);
    return NextResponse.redirect(url);
  }

  // RULE 2: Redirect authenticated users away from login/signup pages
  if (isPublicRoute && user) {
    // Check if user is admin to send them to the right dashboard
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    
    // Send admin to admin page, regular users to dashboard
    const isAdmin = !!roleData
    const to = isAdmin ? '/admin' : '/dashboard'
    return NextResponse.redirect(new URL(to, req.url))
  }

  // RULE 3: Block non-admin users from admin-only routes
  if (isAdminRoute && user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    
    const isAdmin = !!roleData
    
    // If user is not admin, send them to regular dashboard
    if (!isAdmin) {
      // Non-admins trying to access /admin are sent to /dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // RULE 4: Handle post-login redirects (when user had a saved destination)
  if (cleanPathname === '/login' && user) {
    // After a successful login, if a redirectTo was provided, send the user there
    const redirectTo = req.nextUrl.searchParams.get('redirectTo')
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }
  }

  // Allow request to continue if no rules matched
  return res
}

/**
 * Configure which paths the middleware should run on
 * Matches all paths except static files, API routes, and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
