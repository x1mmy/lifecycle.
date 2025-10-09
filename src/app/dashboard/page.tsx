'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
// import { storage } from '~/utils/storage';
// import { Product } from '~/types';
// import { getDaysUntilExpiry, sortByExpiry } from '~/utils/dateUtils';
// import { Header } from '~/components/layout/Header';
// import { StatCard } from '~/components/dashboard/StatCard';
// import { ProductAlert } from '~/components/dashboard/ProductAlert';

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
  // const [products, setProducts] = useState<Product[]>([]);

  // Double-check authentication (middleware should handle this, but good to be safe)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Future: Load user products from Supabase
  // useEffect(() => {
  //   if (user) {
  //     const userProducts = storage.getProducts(user.id);
  //     setProducts(userProducts);
  //   }
  // }, [user]);

  // Show loading spinner while checking authentication status
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render page content if user is not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // Calculate statistics
  // const totalProducts = products.length;
  // const expiringSoon = products.filter((p) => {
  //   const days = getDaysUntilExpiry(p.expiryDate);
  //   return days >= 0 && days <= 7;
  // });
  // const expired = products.filter((p) => getDaysUntilExpiry(p.expiryDate) < 0);

  // Sort for display
  // const sortedExpiringSoon = sortByExpiry(expiringSoon).slice(0, 5);
  // const sortedExpired = sortByExpiry(expired).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
     
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Overview of your inventory health and expiration alerts
          </p>
        </div>

        {/* Statistics Cards */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        </div> */}

        {/* Alert Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiring Soon */}
          <div className="bg-card rounded-xl shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-semibold text-foreground">
                Urgent Attention Required
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Products expiring within 7 days
            </p>
           
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No products expiring soon</p>
            </div>
          </div>

          {/* Expired */}
          <div className="bg-card rounded-xl shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">
                Expired Products
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Action required - remove from inventory
            </p>
           
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No expired products</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
