'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Package, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { supabase } from '~/lib/supabase';
import type { Product } from '~/types';
import { getDaysUntilExpiry, sortByExpiry } from '~/utils/dateUtils';
import { Header } from '~/components/layout/Header';
import { StatCard } from '~/components/dashboard/StatCard';
import { ProductAlert } from '~/components/dashboard/ProductAlert';

// Database row type (snake_case from Supabase)
interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  expiry_date: string;
  quantity: number;
  batch_number?: string;
  supplier?: string;
  location?: string;
  notes?: string;
  barcode?: string;
  added_date: string;
}

// Transform database row to Product interface (camelCase)
const transformProductFromDb = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  expiryDate: row.expiry_date,
  quantity: row.quantity,
  batchNumber: row.batch_number,
  supplier: row.supplier,
  location: row.location,
  notes: row.notes,
  addedDate: row.added_date,
});

/**
 * Dashboard Page - Protected Route for Regular Users
 * 
 * This page is protected by:
 * 1. Middleware (redirects unauthenticated users)
 * 2. Component-level auth check (double protection)
 */
export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  /**
   * Load products for the current user from Supabase
   * Uses RLS policies to ensure users only see their own products
   */
  const loadUserProducts = useCallback(async () => {
    if (!user) return;
    
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('expiry_date', { ascending: true });

      if (error) {
        console.error('Error loading products:', error);
        return;
      }

      // Transform database rows to Product interface
      const transformedProducts = (data as ProductRow[]).map(transformProductFromDb);
      setProducts(transformedProducts);
    } catch (error) {
      console.error('Unexpected error loading products:', error);
    } finally {
      setProductsLoading(false);
    }
  }, [user]);

  // Double-check authentication (middleware should handle this, but good to be safe)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load user products from Supabase
  useEffect(() => {
    if (user) {
      void loadUserProducts();
    }
  }, [user, loadUserProducts]);

  // Show loading spinner while checking authentication status
  if (loading || productsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-500">
            {loading ? 'Loading...' : 'Loading products...'}
          </p>
        </div>
      </div>
    );
  }

  // Don't render page content if user is not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // Calculate statistics
  const totalProducts = products.length;
  const expiringSoon = products.filter((p) => {
    const days = getDaysUntilExpiry(p.expiryDate);
    return days >= 0 && days <= 7;
  });
  const expired = products.filter((p) => getDaysUntilExpiry(p.expiryDate) < 0);

  // Sort for display
  const sortedExpiringSoon = sortByExpiry(expiringSoon).slice(0, 5);
  const sortedExpired = sortByExpiry(expired).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
     
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard
          </h1>
          <p className="text-gray-500">
            Overview of your inventory health and expiration alerts
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Products"
            value={totalProducts}
            icon={Package}
            variant="default"
          />
          <StatCard
            title="Expiring Soon"
            value={expiringSoon.length}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Expired"
            value={expired.length}
            icon={XCircle}
            variant="destructive"
          />
        </div>

        {/* Alert Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiring Soon */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Urgent Attention Required
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Products expiring within 7 days
            </p>
            
            {sortedExpiringSoon.length > 0 ? (
              <div className="space-y-3">
                {sortedExpiringSoon.map((product) => (
                  <ProductAlert key={product.id} product={product} type="expiring" />
                ))}
                {expiringSoon.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    And {expiringSoon.length - 5} more...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No products expiring soon</p>
              </div>
            )}
          </div>

          {/* Expired */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Expired Products
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Action required - remove from inventory
            </p>
            
            {sortedExpired.length > 0 ? (
              <div className="space-y-3">
                {sortedExpired.map((product) => (
                  <ProductAlert key={product.id} product={product} type="expired" />
                ))}
                {expired.length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    And {expired.length - 5} more...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <XCircle className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No expired products</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
