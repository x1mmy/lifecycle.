'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '~/lib/supabase';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
// import { Header } from '~/components/layout/Header';
// import { Card } from '~/components/ui/card';
// import { Skeleton } from '~/components/ui/skeleton';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '~/components/ui/table';
// import { Badge } from '~/components/ui/badge';
// import { formatDate } from '~/utils/dateUtils';

interface UserProfile {
  id: string;
  business_name: string;
  email: string;
  created_at: string;
  phone?: string;
  address?: string;
}

/**
 * Admin Dashboard Page - Protected Route for Admin Users Only
 * 
 * This page is protected by:
 * 1. Middleware (redirects non-admin users to /dashboard)
 * 2. Component-level auth + role check (double protection)
 */
export default function AdminDashboardPage() {
  const { isAdmin, loading: authLoading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
  });

  // Check authentication AND admin role
  useEffect(() => {
    // First check: user must be authenticated
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Second check: user must have admin role
    if (!authLoading && !isAdmin) {
      router.push('/dashboard'); // Send non-admin users to regular dashboard
      return;
    }

    // If user is admin, load admin-specific data
    if (isAdmin) {
      void loadAdminData();
    }
  }, [isAdmin, authLoading, isAuthenticated, router]);

  /**
   * Load admin-specific data from Supabase
   * Only admins can access this data due to RLS policies
   */
  const loadAdminData = async () => {
    try {
      // Load all user profiles (admin can see all users)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      setUsers(profiles || []);
     
      // Load total product count across all users
      const { count: productCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (productsError) throw productsError;

      // Update admin dashboard statistics
      setStats({
        totalUsers: profiles?.length || 0,
        totalProducts: productCount ?? 0,
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  // Show loading spinner while checking authentication or loading data
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated or not admin (will redirect)
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage all users and tenants</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalProducts}</p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold text-foreground mb-4">All Users / Tenants</h2>
          <div className="text-center text-muted-foreground py-8">
            No users found
          </div>
        </div>
      </main>
    </div>
  );
}
