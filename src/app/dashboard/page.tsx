'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, AlertTriangle, XCircle, Loader2, Plus, ArrowRight, TrendingUp, Calendar, BarChart3, ScanBarcode } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { getDaysUntilExpiry } from '~/utils/dateUtils';
import { getEarliestBatch, getTotalQuantity, hasExpiredBatches, hasExpiringBatches } from '~/utils/batchHelpers';
import { Header } from '~/components/layout/Header';
import { StatCard } from '~/components/dashboard/StatCard';
import { ProductAlert } from '~/components/dashboard/ProductAlert';
import { ProductForm } from '~/components/products/ProductForm';
import { BarcodeScanner } from '~/components/products/BarcodeScanner';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

interface CategoryStat {
  category: string;
  total: number;
  expired: number;
  expiring: number;
}

interface UpcomingExpiration {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber?: string;
  expiryDate: string;
  daysUntil: number;
  quantity: number | null;
}

interface UrgencyStyle {
  dot: string;
  text: string;
  weight: string;
}

function sortByEarliestExpiry(products: Product[], limit: number): Product[] {
  return products
    .map(product => ({ product, earliestBatch: getEarliestBatch(product) }))
    .sort((a, b) => {
      if (!a.earliestBatch) return 1;
      if (!b.earliestBatch) return -1;
      return new Date(a.earliestBatch.expiryDate).getTime() - new Date(b.earliestBatch.expiryDate).getTime();
    })
    .map(item => item.product)
    .slice(0, limit);
}

function getUrgencyColor(daysUntil: number): UrgencyStyle {
  if (daysUntil <= 3) {
    return { dot: 'bg-red-500', text: 'text-red-600', weight: 'font-semibold' };
  }
  if (daysUntil <= 7) {
    return { dot: 'bg-amber-500', text: 'text-amber-600', weight: 'font-medium' };
  }
  return { dot: 'bg-emerald-500', text: 'text-emerald-600', weight: 'font-medium' };
}

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
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | undefined>();

  // Fetch products with batches using tRPC
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = api.products.getAll.useQuery(
    { userId: user?.id ?? '' },
    { enabled: !!user?.id }
  );

  // Mutations for Quick Add
  const utils = api.useUtils();
  const createProductMutation = api.products.create.useMutation();
  const createBatchMutation = api.products.createBatch.useMutation();

  // Delete product mutation
  const deleteProduct = api.products.delete.useMutation({
    onSuccess: () => {
      void refetchProducts();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete product',
        variant: 'destructive',
      });
    },
  });

  // Double-check authentication (middleware should handle this, but good to be safe)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  /**
   * Bulk Delete All Expired Products
   * Deletes all products that have expired batches
   */
  const handleBulkDeleteExpired = async () => {
    if (!user) return;

    setIsBulkDeleting(true);

    try {
      // Delete all expired products in parallel
      await Promise.all(
        expired.map((product) =>
          deleteProduct.mutateAsync({
            productId: product.id,
            userId: user.id,
          })
        )
      );

      toast({
        title: 'Success',
        description: `Deleted ${expired.length} expired product${expired.length !== 1 ? 's' : ''}`,
      });

      await refetchProducts();
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

  const handleBarcodeScan = (barcode: string) => {
    setScannedBarcode(barcode);
    setIsScannerOpen(false);
    setIsQuickAddOpen(true);
  };

  const handleQuickAddClose = () => {
    setIsQuickAddOpen(false);
    setScannedBarcode(undefined);
  };

  /**
   * Quick Add submit handler
   * Creates product with first batch, then additional batches
   */
  const handleSubmitProduct = async (
    productData: Omit<Product, 'id' | 'addedDate'> & {
      allBatches?: Array<{ tempId: string; expiryDate: string; quantity: string | number; batchNumber: string }>;
    },
  ) => {
    if (!user) return;

    try {
      if (!productData.expiryDate) {
        throw new Error('Expiry date is required for the first batch');
      }

      const newProduct = await createProductMutation.mutateAsync({
        userId: user.id,
        product: {
          name: productData.name,
          category: productData.category,
          supplier: productData.supplier,
          location: productData.location,
          notes: productData.notes,
          barcode: productData.barcode,
        },
        batch: {
          expiryDate: productData.expiryDate,
          quantity: productData.quantity,
          batchNumber: productData.batchNumber,
        },
      });

      // Create additional batches if provided
      if (productData.allBatches && productData.allBatches.length > 1) {
        const additionalBatches = productData.allBatches.slice(1);
        for (const batch of additionalBatches) {
          const quantity = batch.quantity
            ? typeof batch.quantity === 'string' ? parseInt(batch.quantity, 10) : batch.quantity
            : null;

          await createBatchMutation.mutateAsync({
            userId: user.id,
            productId: newProduct.id,
            batch: {
              expiryDate: batch.expiryDate,
              quantity,
              batchNumber: batch.batchNumber || undefined,
            },
          });
        }
      }

      toast({
        title: 'Product added',
        description: 'The product has been added successfully.',
      });

      await utils.products.getCategories.invalidate({ userId: user.id });
      await refetchProducts();
      handleQuickAddClose();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error',
        description: 'Failed to add product. Please try again.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Calculate Statistics
   * Note: Calculations are placed before early returns to satisfy React Hooks rules
   * All hooks must be called in the same order on every render
   */

  // Basic product counts
  const totalProducts = products.length;

  // Products with expiring batches (within 7 days)
  const expiringSoon = useMemo(
    () => products.filter(product => hasExpiringBatches(product, 7)),
    [products],
  );

  // Products with at least one batch expiring today (daysUntil === 0)
  const expiringToday = useMemo(
    () =>
      products.filter(product =>
        (product.batches ?? []).some(batch => getDaysUntilExpiry(batch.expiryDate) === 0),
      ),
    [products],
  );

  // Products with expired batches
  const expired = useMemo(
    () => products.filter(product => hasExpiredBatches(product)),
    [products],
  );

  // Total units across all batches
  const totalUnits = useMemo(
    () => products.reduce((sum, p) => sum + getTotalQuantity(p), 0),
    [products],
  );

  /**
   * Category Health Breakdown
   * Groups products by category and tracks their health status
   */
  const categoryStats = useMemo((): CategoryStat[] => {
    const stats = new Map<string, CategoryStat>();

    products.forEach(product => {
      const existing = stats.get(product.category) ?? {
        category: product.category,
        total: 0,
        expired: 0,
        expiring: 0,
      };

      existing.total++;
      if (hasExpiredBatches(product)) existing.expired++;
      if (hasExpiringBatches(product, 7)) existing.expiring++;

      stats.set(product.category, existing);
    });

    return Array.from(stats.values())
      .sort((a, b) => (b.expired + b.expiring) - (a.expired + a.expiring))
      .slice(0, 5);
  }, [products]);

  /**
   * Upcoming Expirations Timeline
   * Shows batches expiring in the next 30 days
   */
  const upcomingExpirations = useMemo((): UpcomingExpiration[] => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expirations: UpcomingExpiration[] = [];

    products.forEach(product => {
      (product.batches ?? []).forEach(batch => {
        const expiryDate = new Date(batch.expiryDate);
        if (expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
          expirations.push({
            productId: product.id,
            productName: product.name,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            daysUntil: getDaysUntilExpiry(batch.expiryDate),
            quantity: batch.quantity,
          });
        }
      });
    });

    return expirations
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 7);
  }, [products]);

  // Sort products for display in alert sections (limit to 5 items each)
  const sortedExpiringSoon = useMemo(
    () => sortByEarliestExpiry(expiringSoon, 5),
    [expiringSoon],
  );

  const sortedExpired = useMemo(
    () => sortByEarliestExpiry(expired, 5),
    [expired],
  );

  // Show loading spinner while checking authentication status
  if (loading || productsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
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

      {/* Items expiring today only */}
      {expiringToday.length > 0 && (
        <div className="bg-red-50 border-b border-red-200/60">
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span>
                <span className="font-semibold">{expiringToday.length} {expiringToday.length === 1 ? 'item' : 'items'} expire today</span>
                <span className="hidden sm:inline text-red-600">&nbsp;— {expiringToday.slice(0, 3).map(p => p.name).join(', ')}{expiringToday.length > 3 ? `, +${expiringToday.length - 3} more` : ''}</span>
              </span>
            </p>
            <button
              onClick={() => router.push('/products')}
              className="text-sm font-medium text-red-600 hover:text-red-800 flex items-center gap-1 shrink-0 ml-4 transition-colors"
            >
              View <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Header with Quick Actions */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard
          </h1>
          <p className="text-gray-500 text-sm">
            Your inventory health and expiration alerts at a glance
          </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 active:bg-gray-950 transition-colors flex items-center gap-2 font-medium shadow-sm"
            >
              <ScanBarcode className="h-4 w-4" />
              Scan Barcode
            </button>
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="px-4 py-2.5 bg-[#059669] text-white rounded-lg hover:bg-[#047857] active:bg-[#065f46] transition-colors flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Quick Add
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
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
          <div className="text-left">
          <StatCard
            title="Total Units"
            value={totalUnits}
            icon={BarChart3}
            variant="info"
          />
          </div>
        </div>

        {/* Main Content Grid - 2 column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Left Column - Urgent Attention + Expired Products stacked */}
          <div className="lg:col-span-3 space-y-6">
            {/* Urgent Attention */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Urgent Attention
                  </h2>
                  {expiringSoon.length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      {expiringSoon.length}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 italic mb-4 lg:hidden">
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
                        onProductDeleted={() => void refetchProducts()}
                      />
                    ))}
                  </div>
                  {expiringSoon.length > 5 && (
                    <button
                      onClick={() => router.push('/products')}
                      className="w-full mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center justify-center gap-1"
                    >
                      View {expiringSoon.length - 5} more →
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                    <AlertTriangle className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm">
                    {totalProducts === 0
                      ? 'Add products to start tracking expiration alerts'
                      : totalProducts <= 2
                        ? 'Add more products to get better visibility into upcoming expirations'
                        : 'No products expiring within 7 days. Monitor this section for urgent items.'}
                  </p>
                </div>
              )}
            </div>

            {/* Expired Products */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Expired Products
                  </h2>
                  {expired.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                      {expired.length}
                    </span>
                  )}
                </div>
                {expired.length > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                    title="Remove all expired products"
                  >
                    Remove All
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 italic mb-4 lg:hidden">
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
                        onProductDeleted={() => void refetchProducts()}
                      />
                    ))}
                  </div>
                  {expired.length > 5 && (
                    <button
                      onClick={() => router.push('/products')}
                      className="w-full mt-4 text-sm text-red-600 hover:text-red-700 font-medium flex items-center justify-center gap-1"
                    >
                      View {expired.length - 5} more →
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                    <XCircle className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm">
                    {totalProducts === 0
                      ? 'Add products to track expiration dates'
                      : totalProducts <= 2
                        ? 'Continue adding products to monitor expiration status'
                        : 'No expired products in your inventory'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Next 30 Days + Categories stacked */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Expirations Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-[#10B981]" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Next 30 Days
                </h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Upcoming expirations
              </p>

              {upcomingExpirations.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {upcomingExpirations.slice(0, 5).map((expiration) => {
                      const urgency = getUrgencyColor(expiration.daysUntil);
                      const details = [
                        expiration.batchNumber ? `Batch #${expiration.batchNumber}` : '',
                        expiration.quantity !== null ? `${expiration.quantity} units` : '',
                      ].filter(Boolean).join(' · ');

                      return (
                        <div
                          key={`${expiration.productId}-${expiration.batchId}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgency.dot}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {expiration.productName}
                              </p>
                              {details && (
                                <p className="text-xs text-gray-500">{details}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm ${urgency.weight} ${urgency.text}`}>
                              {expiration.daysUntil === 0 ? 'Today' : `${expiration.daysUntil} ${expiration.daysUntil === 1 ? 'day' : 'days'}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {upcomingExpirations.length > 5 && (
                    <button
                      onClick={() => router.push('/products')}
                      className="w-full mt-4 text-sm text-[#10B981] hover:text-[#059669] font-medium flex items-center justify-center gap-1"
                    >
                      View {upcomingExpirations.length - 5} more →
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                    <Calendar className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm">
                    {totalProducts === 0
                      ? 'Add products with expiry dates to see upcoming expirations here'
                      : totalProducts <= 2
                        ? 'Add more products to track upcoming expirations'
                        : 'No products expiring in the next 30 days'}
                  </p>
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            {categoryStats.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-[#10B981]" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Categories
                  </h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Top categories by urgency
                </p>
                <div className="space-y-2">
                  {categoryStats.map((stat) => (
                    <div
                      key={stat.category}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {stat.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          {stat.total} {stat.total === 1 ? 'product' : 'products'}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {stat.expired > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                            {stat.expired} expired
                          </span>
                        )}
                        {stat.expiring > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                            {stat.expiring} expiring
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State CTA */}
            {totalProducts < 50 && (
              <div className="bg-gradient-to-br from-emerald-50 to-[#10B981]/10 rounded-lg shadow-sm border border-emerald-100 p-4 sm:p-6 md:p-8 xl:p-10 xl:max-w-4xl xl:mx-auto">
                <div className="text-center">
                  {totalProducts === 0 ? (
                    <>
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#059669]/20 mb-3 sm:mb-4">
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-[#10B981]" />
                      </div>
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                        Start Your Inventory Management Journey
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4 max-w-md mx-auto">
                        Track expiration dates, reduce waste, and stay compliant with automated alerts and monitoring.
                      </p>
                      {/* Benefits List */}
                      <div className="mb-6 max-w-md lg:max-w-lg xl:max-w-xl mx-auto text-left space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Get alerts before products expire
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Reduce waste and save money
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Maintain compliance with ease
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/products')}
                        className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 font-semibold text-sm sm:text-base mx-auto transform hover:scale-105"
                      >
                        <Plus className="h-5 w-5" />
                        Start Adding Products
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#059669]/20 mb-3 sm:mb-4">
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-[#10B981]" />
                      </div>
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-2">
                        Keep Building Your Inventory
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4 max-w-md mx-auto">
                        The more products you track, the better protection you have against waste and compliance issues.
                      </p>
                      {/* Progress Indicator */}
                      <div className="mb-6 max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
                        <div className="mb-2">
                          <p className="text-xs sm:text-sm text-gray-600" aria-live="polite">
                            You&apos;re tracking {totalProducts} {totalProducts === 1 ? 'product' : 'products'}. Shops typically track 50–200 items.
                          </p>
                        </div>
                        {/* Minimal progress bar */}
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#10B981] transition-all duration-300"
                            style={{ width: `${Math.min((totalProducts / 50) * 100, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={totalProducts}
                            aria-valuemin={0}
                            aria-valuemax={50}
                            aria-label={`Progress: ${totalProducts} of 50 products`}
                          />
                        </div>
                      </div>
                      {/* Benefits Reinforcement */}
                      <div className="mb-6 max-w-md lg:max-w-lg xl:max-w-xl mx-auto text-left space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">
                            More products mean better visibility into your inventory health
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Comprehensive tracking helps prevent costly waste
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/products')}
                        className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 font-semibold text-sm sm:text-base mx-auto transform hover:scale-105"
                      >
                        <Plus className="h-5 w-5" />
                        Add More Products
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Barcode Scanner (standalone) */}
      <BarcodeScanner
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      {/* Quick Add Product Modal */}
      {isQuickAddOpen && user && (
        <ProductForm
          userId={user.id}
          onSubmit={handleSubmitProduct}
          onClose={handleQuickAddClose}
          isSubmitting={createProductMutation.isPending}
          initialBarcode={scannedBarcode}
        />
      )}

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
