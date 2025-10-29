'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Package, AlertTriangle, XCircle, Loader2, Plus, ArrowRight, TrendingUp, Calendar, BarChart3, Trash2 } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { supabase } from '~/lib/supabase';
import type { Product } from '~/types';
import { getDaysUntilExpiry, sortByExpiry, formatDate } from '~/utils/dateUtils';
import { Header } from '~/components/layout/Header';
import { StatCard } from '~/components/dashboard/StatCard';
import { ProductAlert } from '~/components/dashboard/ProductAlert';
import { useToast } from '~/hooks/use-toast';

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
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  /**
   * Bulk Delete All Expired Products
   * Deletes all expired products for the current user
   */
  const handleBulkDeleteExpired = async () => {
    if (!user) return;

    setIsBulkDeleting(true);

    try {
      const expiredProductIds = expired.map((p) => p.id);

      // Delete all expired products
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('user_id', user.id)
        .in('id', expiredProductIds);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Deleted ${expiredProductIds.length} expired product${expiredProductIds.length !== 1 ? 's' : ''}`,
      });

      // Reload products
      void loadUserProducts();
    } catch (error) {
      console.error('Error deleting expired products:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete expired products',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  /**
   * Calculate Statistics
   * Note: Calculations are placed before early returns to satisfy React Hooks rules
   * All hooks must be called in the same order on every render
   */
  
  // Basic product counts
  const totalProducts = products.length;
  
  // Products expiring within 7 days (urgent attention needed)
  const expiringSoon = products.filter((p) => {
    const days = getDaysUntilExpiry(p.expiryDate);
    return days >= 0 && days <= 7;
  });
  
  // Products that have already expired (need immediate action)
  const expired = products.filter((p) => getDaysUntilExpiry(p.expiryDate) < 0);

  /**
   * Category Health Breakdown
   * Groups products by category and tracks their health status
   * - Shows top 5 categories sorted by urgency (most issues first)
   * - Tracks expired and expiring counts per category
   * - Helps identify which product categories need attention
   */
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; expiring: number; expired: number }> = {};
    
    products.forEach((p) => {
      const category = p.category || 'Uncategorized';
      // Initialize category stats if not exists (using nullish coalescing assignment)
      stats[category] ??= { count: 0, expiring: 0, expired: 0 };
      stats[category].count++;
      
      const days = getDaysUntilExpiry(p.expiryDate);
      if (days < 0) {
        stats[category].expired++;
      } else if (days <= 7) {
        stats[category].expiring++;
      }
    });
    
    // Sort categories by urgency (categories with more issues appear first)
    // Return only top 5 categories
    return Object.entries(stats)
      .sort(([, a], [, b]) => (b.expiring + b.expired) - (a.expiring + a.expired))
      .slice(0, 5);
  }, [products]);

  /**
   * Upcoming Expirations Timeline
   * Shows products expiring in the next 30 days
   * - Displays up to 7 products
   * - Sorted by expiry date (soonest first)
   * - Helps users plan ahead and prevent waste
   */
  const upcomingExpirations = useMemo(() => {
    return products
      .filter((p) => {
        const days = getDaysUntilExpiry(p.expiryDate);
        return days >= 0 && days <= 30;
      })
      .sort((a, b) => {
        const daysA = getDaysUntilExpiry(a.expiryDate);
        const daysB = getDaysUntilExpiry(b.expiryDate);
        return daysA - daysB;
      })
      .slice(0, 7); // Limit to 7 items for compact display
  }, [products]);

  // Sort products for display in alert sections (limit to 5 items each)
  const sortedExpiringSoon = sortByExpiry(expiringSoon).slice(0, 5);
  const sortedExpired = sortByExpiry(expired).slice(0, 5);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
     
      <main className="container mx-auto px-4 py-8">
        {/* Header with Quick Actions */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard
          </h1>
          <p className="text-gray-500">
            Overview of your inventory health and expiration alerts
          </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/products')}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
            >
              <Package className="h-4 w-4" />
              View All
            </button>
            <button
              onClick={() => router.push('/products')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push('/products')}
            className="text-left"
          >
          <StatCard
            title="Total Products"
            value={totalProducts}
            icon={Package}
            variant="default"
          />
          </button>
          <button
            onClick={() => router.push('/products')}
            className="text-left"
          >
          <StatCard
            title="Expiring Soon"
            value={expiringSoon.length}
            icon={AlertTriangle}
            variant="warning"
          />
          </button>
          <button
            onClick={() => router.push('/products')}
            className="text-left"
          >
          <StatCard
            title="Expired"
            value={expired.length}
            icon={XCircle}
            variant="destructive"
          />
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Left Column - 2 cols */}
          <div className="xl:col-span-2 space-y-6">
        {/* Alert Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiring Soon */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                      Urgent Attention
              </h2>
            </div>
                  {expiringSoon.length > 0 && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {expiringSoon.length}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Expiring within 7 days
            </p>
            <p className="text-xs text-gray-400 italic mb-4 md:hidden">
              Swipe right to edit, swipe left to delete
            </p>

            {sortedExpiringSoon.length > 0 ? (
                  <>
              <div className="space-y-3">
                {sortedExpiringSoon.map((product) => (
                  <ProductAlert
                    key={product.id}
                    product={product}
                    type="expiring"
                    userId={user?.id ?? ''}
                    onProductDeleted={loadUserProducts}
                  />
                ))}
                    </div>
                {expiringSoon.length > 5 && (
                      <button
                        onClick={() => router.push('/products')}
                        className="w-full mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center justify-center gap-1"
                      >
                        View {expiringSoon.length - 5} more
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                      <AlertTriangle className="h-6 w-6 text-gray-400" />
              </div>
                    <p className="text-sm">All good! No products expiring soon</p>
              </div>
            )}
          </div>

          {/* Expired */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Expired Products
              </h2>
            </div>
                  <div className="flex items-center gap-2">
                    {expired.length > 0 && (
                      <>
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          {expired.length}
                        </span>
                        <button
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
                          title="Remove all expired products"
                        >
                          Remove All
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Remove from inventory
            </p>
            <p className="text-xs text-gray-400 italic mb-4 md:hidden">
              Swipe right to edit, swipe left to delete
            </p>

            {sortedExpired.length > 0 ? (
                  <>
              <div className="space-y-3">
                {sortedExpired.map((product) => (
                  <ProductAlert
                    key={product.id}
                    product={product}
                    type="expired"
                    userId={user?.id ?? ''}
                    onProductDeleted={loadUserProducts}
                  />
                ))}
                    </div>
                {expired.length > 5 && (
                      <button
                        onClick={() => router.push('/products')}
                        className="w-full mt-4 text-sm text-red-600 hover:text-red-700 font-medium flex items-center justify-center gap-1"
                      >
                        View {expired.length - 5} more
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                      <XCircle className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm">Great! No expired products</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - 1 col */}
          <div className="space-y-6">
            {/* Upcoming Expirations Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Next 30 Days
                </h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Upcoming expirations
              </p>
              
              {upcomingExpirations.length > 0 ? (
                <div className="space-y-3">
                  {upcomingExpirations.map((product) => {
                    const days = getDaysUntilExpiry(product.expiryDate);
                    return (
                      <div key={product.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-indigo-600">{days}</span>
                          <span className="text-[10px] text-indigo-600">days</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(product.expiryDate)}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                    <Calendar className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm">No products expiring in the next 30 days</p>
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            {categoryStats.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Category Health
                  </h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Products by category
                </p>
                
                <div className="space-y-3">
                  {categoryStats.map(([category, stats]) => {
                    const hasIssues = stats.expired > 0 || stats.expiring > 0;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{category}</span>
                          <span className="text-sm text-gray-500">{stats.count}</span>
                        </div>
                        <div className="flex gap-1">
                          {stats.expired > 0 && (
                            <div className="flex-1 h-2 bg-red-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-red-500"
                                style={{ width: `${(stats.expired / stats.count) * 100}%` }}
                              />
                            </div>
                          )}
                          {stats.expiring > 0 && (
                            <div className="flex-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-500"
                                style={{ width: `${(stats.expiring / stats.count) * 100}%` }}
                              />
                            </div>
                          )}
                          {!hasIssues && (
                            <div className="flex-1 h-2 bg-green-200 rounded-full">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                            </div>
                          )}
                        </div>
                        {hasIssues && (
                          <div className="flex gap-3 text-xs">
                            {stats.expired > 0 && (
                              <span className="text-red-600">{stats.expired} expired</span>
                            )}
                            {stats.expiring > 0 && (
                              <span className="text-amber-600">{stats.expiring} expiring</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State CTA */}
            {totalProducts === 0 && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm border border-indigo-100 p-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                    <TrendingUp className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Start Tracking Today
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Add your first product to begin managing expiry dates and reduce waste.
                  </p>
                  <button
                    onClick={() => router.push('/products')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium mx-auto"
                  >
                    <Plus className="h-5 w-5" />
                    Add Your First Product
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Remove All Expired Products
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete all <span className="font-medium">{expired.length}</span> expired product{expired.length !== 1 ? 's' : ''}?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDeleteExpired}
                disabled={isBulkDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${expired.length} Product${expired.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBulkDeleting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
