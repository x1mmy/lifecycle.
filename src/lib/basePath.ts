// src/lib/basePath.ts
// Small, isomorphic helpers for dealing with Next.js basePath.
//
// Why this exists:
// - We serve the app under a sub-path (e.g. "/app").
// - Client components, middleware, and redirects should never hardcode
//   that prefix. These helpers let us build and strip the prefix in a
//   single, consistent place.
// - Works both on the client and in middleware/server code.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app';

const normalize = (p: string) => (p.startsWith('/') ? p : `/${p}`);

/**
 * Prefix a relative path with the configured basePath.
 *
 * Examples:
 * - withBasePath('/login') => '/app/login'
 * - withBasePath('dashboard') => '/app/dashboard'
 * - withBasePath('/app/settings') => '/app/settings' (already prefixed)
 *
 * Use this when constructing redirect targets, Link hrefs, or any
 * navigation that should include the basePath in the browser URL.
 */
export function withBasePath(path: string) {
  const p = normalize(path);
  if (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`)) return p; // already prefixed
  return `${BASE_PATH}${p}`;
}

/**
 * Remove the basePath from an incoming pathname.
 *
 * Examples:
 * - stripBasePath('/app/login') => '/login'
 * - stripBasePath('/login') => '/login' (unchanged)
 * - stripBasePath('/app') => '/'
 *
 * Use this in middleware or server code to perform route matching
 * against "clean" app-relative paths (e.g. '/login', '/dashboard')
 * while still accepting requests that include the basePath.
 */
export function stripBasePath(pathname: string) {
  if (!pathname.startsWith(BASE_PATH)) return pathname;
  const stripped = pathname.slice(BASE_PATH.length);
  return stripped.length === 0 ? '/' : stripped;
}