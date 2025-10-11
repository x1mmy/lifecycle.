'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, Package } from 'lucide-react';
import { useState } from 'react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { Button } from '~/components/ui/button';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useSupabaseAuth();

  const handleLogout = () => {
    void logout();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;
  
  // Check if we're on an admin page
  const isAdminPage = pathname?.startsWith('/admin');

  // Show different navigation based on whether we're on admin pages or regular pages
  const navLinks = isAdminPage
    ? [
        // Admin navigation
        { path: '/admin', label: 'Admin Dashboard' },
        { path: '/admin/analytics', label: 'Analytics' },
      ]
    : [
        // Regular user navigation
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/products', label: 'Products' },
        { path: '/settings', label: 'Settings' },
        ...(isAdmin ? [{ path: '/admin', label: 'Admin' }] : []),
      ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - links to admin or dashboard depending on context */}
          <Link 
            href={isAdminPage ? '/admin' : '/dashboard'} 
            className="flex items-center gap-2 font-bold text-xl text-indigo-600"
          >
            <Package className="h-6 w-6" />
            <span>LifeCycle</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium text-gray-900 text-sm">
                {user?.user_metadata?.business_name ?? user?.email?.split('@')[0] ?? 'User'}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                    isActive(link.path)
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <div className="px-4 py-2">
                  <p className="font-medium text-gray-900">
                    {user?.user_metadata?.business_name ?? user?.email?.split('@')[0] ?? 'User'}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Log Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};