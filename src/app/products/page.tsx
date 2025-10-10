'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
// import { storage } from '~/utils/storage';
// import { Product } from '~/types';
// import { Header } from '~/components/layout/Header';
// import { ProductTable } from '~/components/products/ProductTable';
// import { ProductForm } from '~/components/products/ProductForm';
// import { Button } from '~/components/ui/button';
// import { Input } from '~/components/ui/input';
// import { useToast } from '~/hooks/use-toast';

export default function ProductsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  // const { toast } = useToast();
  
  // const [products, setProducts] = useState<Product[]>([]);
  // const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  // const [searchTerm, setSearchTerm] = useState('');
  // const [showForm, setShowForm] = useState(false);
  // const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  // const [deleteId, setDeleteId] = useState<string | null>(null);
  // const [sortField, setSortField] = useState<keyof Product>('expiryDate');
  // const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Future: Load user products from Supabase
  // useEffect(() => {
  //   if (user) {
  //     loadProducts();
  //   }
  // }, [user]);

  // const loadProducts = () => {
  //   if (user) {
  //     const userProducts = storage.getProducts(user.id);
  //     setProducts(userProducts);
  //   }
  // };

  // Show loading spinner while checking authentication
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

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
     
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Products</h1>
          <p className="text-muted-foreground">
            Manage your inventory and track expiration dates
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              className="pl-10 w-full px-3 py-2 border border-input bg-background rounded-md"
            />
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {/* Products Table */}
        <div className="bg-card rounded-xl shadow p-6">
          <div className="text-center text-muted-foreground py-8">
            No products found. Add your first product to get started.
          </div>
        </div>
      </main>
    </div>
  );
}
