'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { Header } from '~/components/layout/Header';

/**
 * Admin Analytics Page - Coming Soon
 * 
 * This page will display:
 * - Product expiry trends
 * - User activity metrics
 * - System usage statistics
 * - Data visualizations
 */
export default function AdminAnalyticsPage() {
  const { isAdmin, loading: authLoading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted-foreground">Data insights and system metrics</p>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-card p-12 rounded-xl shadow text-center">
          <div className="flex justify-center gap-6 mb-8">
            <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="w-16 h-16 bg-green-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="w-16 h-16 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <PieChart className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Advanced analytics and data visualization features are currently in development.
            Check back soon for insights on product trends, user activity, and system metrics.
          </p>

          {/* Planned Features */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-6 bg-muted rounded-lg">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Product Trends</h3>
              <p className="text-sm text-muted-foreground">
                Track expiry rates, category distributions, and inventory patterns
              </p>
            </div>
            
            <div className="p-6 bg-muted rounded-lg">
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">User Metrics</h3>
              <p className="text-sm text-muted-foreground">
                Monitor user activity, engagement rates, and growth statistics
              </p>
            </div>
            
            <div className="p-6 bg-muted rounded-lg">
              <PieChart className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">System Insights</h3>
              <p className="text-sm text-muted-foreground">
                Analyze system usage, performance metrics, and key indicators
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

