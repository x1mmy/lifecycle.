// src/lib/basePath.ts
// Simple path normalization helpers.
// Since we're using a dedicated subdomain (app.lifecycle.cloud), 
// we no longer need base path handling.

const normalize = (p: string) => (p.startsWith('/') ? p : `/${p}`);

/**
 * Normalize a path by ensuring it starts with '/'.
 *
 * Examples:
 * - withBasePath('/login') => '/login'
 * - withBasePath('dashboard') => '/dashboard'
 * - withBasePath('/settings') => '/settings'
 */
export function withBasePath(path: string) {
  return normalize(path);
}

/**
 * Return the pathname as-is since we no longer have a base path.
 *
 * Examples:
 * - stripBasePath('/login') => '/login'
 * - stripBasePath('/dashboard') => '/dashboard'
 * - stripBasePath('/') => '/'
 */
export function stripBasePath(pathname: string) {
  return pathname;
}