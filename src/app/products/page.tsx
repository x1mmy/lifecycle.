'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Package, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import type { Product } from '~/types';
import { Header } from '~/components/layout/Header';
import { ProductForm } from '~/components/products/ProductForm';
import { getDaysUntilExpiry, formatDate } from '~/utils/dateUtils';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

/**
 * Database Product Row Type
 * Matches the backend API response from tRPC
 * Uses snake_case as it comes from Supabase
 */
interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  expiry_date: string;
  quantity: number;
  batch_number?: string | null;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
  barcode?: string | null;
  added_date: string;
}

/**
 * Transform Database Row to Product Interface
 * Converts from snake_case (database) to camelCase (frontend)
 * Handles null values from database
 */
const transformProductFromDb = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  expiryDate: row.expiry_date,
  quantity: row.quantity,
  batchNumber: row.batch_number ?? undefined,
  supplier: row.supplier ?? undefined,
  location: row.location ?? undefined,
  notes: row.notes ?? undefined,
  addedDate: row.added_date,
});

// Type definitions for product filtering, sorting, and pagination
type FilterType = 'all' | 'expired' | 'expiring-soon' | 'good';
type SortField = 'name' | 'category' | 'expiryDate' | 'quantity';
type SortDirection = 'asc' | 'desc';

export default function ProductsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Core product data and UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);

  /**
   * tRPC Query for Products
   * Fetches all products from backend API
   * - Automatically refetches on window focus
   * - Handles loading and error states
   * - Type-safe with full TypeScript support
   */
  const {
    data: productsData,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = api.products.getAll.useQuery(
    { userId: user?.id ?? '' },
    { enabled: !!user?.id } // Only run query when user is authenticated
  );
  
  // Transform database rows to Product interface (camelCase)
  const products: Product[] = useMemo(() => {
    if (!productsData) return [];
    return productsData.map((row: ProductRow) => transformProductFromDb(row));
  }, [productsData]);
  
  /**
   * Filter State
   * Allows users to quickly view products by status:
   * - all: Show all products
   * - expired: Products past expiry date
   * - expiring-soon: Products expiring within 7 days
   * - good: Products with more than 7 days until expiry
   */
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  /**
   * Sort State
   * Enables sorting by product attributes with ascending/descending order
   * Default: Sort by expiry date (soonest first)
   */
  const [sortField, setSortField] = useState<SortField>('expiryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  /**
   * Pagination State
   * Manages table pagination for better performance with large datasets
   * - currentPage: Active page number (1-indexed)
   * - pageSize: Number of items per page (10, 25, or 50)
   */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  /**
   * Delete Confirmation Modal State
   * Custom modal replaces browser's confirm() dialog for better UX
   */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  /**
   * tRPC Mutations for CRUD Operations
   * All data operations now go through backend API instead of direct Supabase calls
   */
  const createProductMutation = api.products.create.useMutation();
  const updateProductMutation = api.products.update.useMutation();
  const deleteProductMutation = api.products.delete.useMutation();

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  /**
   * Filter, Sort, and Paginate Products
   * This is the main data transformation pipeline that:
   * 1. Applies search filter (name, category, batch number)
   * 2. Applies status filter (all, expired, expiring-soon, good)
   * 3. Sorts by selected field and direction
   * 
   * Memoized for performance - only recalculates when dependencies change
   */
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Step 1: Apply search filter across multiple fields
    if (searchTerm.trim() !== '') {
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Step 2: Apply status filter based on expiry date
    if (activeFilter !== 'all') {
      result = result.filter((product) => {
        const daysUntil = getDaysUntilExpiry(product.expiryDate);
        switch (activeFilter) {
          case 'expired':
            return daysUntil < 0; // Past expiry date
          case 'expiring-soon':
            return daysUntil >= 0 && daysUntil <= 7; // Within 7 days
          case 'good':
            return daysUntil > 7; // More than 7 days
          default:
            return true;
        }
      });
    }

    // Step 3: Apply sorting
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      // Get comparable values based on sort field
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = a.category.toLowerCase();
          bVal = b.category.toLowerCase();
          break;
        case 'expiryDate':
          aVal = new Date(a.expiryDate).getTime();
          bVal = new Date(b.expiryDate).getTime();
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchTerm, activeFilter, sortField, sortDirection]);

  /**
   * Pagination Calculations
   * Slices the filtered/sorted products into pages
   */
  const totalPages = Math.ceil(filteredAndSortedProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedProducts.slice(startIndex, endIndex);
  }, [filteredAndSortedProducts, currentPage, pageSize]);

  // Reset to page 1 when filters/sort/pageSize change (prevents empty page scenarios)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter, sortField, sortDirection, pageSize]);

  /**
   * Filter Counts
   * Calculates the number of products in each status category
   * Used to display badges on filter buttons
   */
  const filterCounts = useMemo(() => {
    return {
      all: products.length,
      expired: products.filter((p) => getDaysUntilExpiry(p.expiryDate) < 0).length,
      'expiring-soon': products.filter((p) => {
        const days = getDaysUntilExpiry(p.expiryDate);
        return days >= 0 && days <= 7;
      }).length,
      good: products.filter((p) => getDaysUntilExpiry(p.expiryDate) > 7).length,
    };
  }, [products]);

  /**
   * Handle Sort Column Click
   * Toggles sort direction if clicking the same field,
   * otherwise sets new field with ascending direction
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Form Handlers
   * Manage the product form modal for adding/editing products
   */

  // Open form for adding new product
  const handleAddProduct = () => {
    setSelectedProduct(undefined); // Clear selection to indicate new product
    setIsFormOpen(true);
  };

  // Open form for editing existing product
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product); // Set product to pre-fill form
    setIsFormOpen(true);
  };

  // Close form and clear selection
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedProduct(undefined);
  };

  /**
   * Delete Product Handler
   * Opens custom confirmation modal instead of browser's confirm()
   * Provides better UX with styled modal and product details
   */
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  /**
   * Submit Product Handler
   * Uses backend tRPC API for create/update operations
   * - Server-side validation with Zod
   * - Automatic refetch after successful mutation
   * - Centralized error handling
   */
  const handleSubmitProduct = async (productData: Omit<Product, 'id' | 'addedDate'>) => {
    if (!user) return;

    try {
      if (selectedProduct) {
        // Update existing product via tRPC
        await updateProductMutation.mutateAsync({
          productId: selectedProduct.id,
          userId: user.id,
          product: {
            name: productData.name,
            category: productData.category,
            expiryDate: productData.expiryDate,
            quantity: productData.quantity,
            batchNumber: productData.batchNumber,
            supplier: productData.supplier,
            location: productData.location,
            notes: productData.notes,
          },
        });

        toast({
          title: "Product updated",
          description: "The product has been updated successfully.",
        });
      } else {
        // Create new product via tRPC
        await createProductMutation.mutateAsync({
          userId: user.id,
          product: {
            name: productData.name,
            category: productData.category,
            expiryDate: productData.expiryDate,
            quantity: productData.quantity,
            batchNumber: productData.batchNumber,
            supplier: productData.supplier,
            location: productData.location,
            notes: productData.notes,
          },
          });

        toast({
          title: "Product added",
          description: "The product has been added successfully.",
        });
      }

      // Refetch products and close form
      await refetchProducts();
      handleCloseForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: "Failed to save product. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Confirm Delete Handler
   * Uses backend tRPC API for delete operation
   * - Server-side ownership verification
   * - Automatic refetch after successful deletion
   */
  const handleConfirmDelete = async () => {
    if (!user || !productToDelete) return;

    try {
      // Delete product via tRPC
      await deleteProductMutation.mutateAsync({
        productId: productToDelete.id,
        userId: user.id,
      });

      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      });

      // Refetch products
      await refetchProducts();
      
      // Close modal
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get status badge for a product
  const getStatusBadge = (expiryDate: string) => {
    const daysUntil = getDaysUntilExpiry(expiryDate);
    
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Expired {Math.abs(daysUntil)}d ago
        </span>
      );
    } else if (daysUntil === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          0d left
        </span>
      );
    } else if (daysUntil <= 7) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          {daysUntil}d left
        </span>
      );
    } else if (daysUntil <= 30) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {daysUntil}d left
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          {daysUntil}d left
        </span>
      );
    }
  };

  // Show loading spinner while checking authentication
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

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
     
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-500">
            Manage your inventory and track expiration dates
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-200 bg-white rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button 
            onClick={handleAddProduct}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            All
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'all' ? 'bg-indigo-500' : 'bg-gray-100'
            }`}>
              {filterCounts.all}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('expired')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeFilter === 'expired'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-red-300 hover:bg-red-50'
            }`}
          >
            Expired
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'expired' ? 'bg-red-500' : 'bg-red-100 text-red-700'
            }`}>
              {filterCounts.expired}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('expiring-soon')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeFilter === 'expiring-soon'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            Expiring Soon
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'expiring-soon' ? 'bg-amber-500' : 'bg-amber-100 text-amber-700'
            }`}>
              {filterCounts['expiring-soon']}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('good')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeFilter === 'good'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            Good
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeFilter === 'good' ? 'bg-green-500' : 'bg-green-100 text-green-700'
            }`}>
              {filterCounts.good}
            </span>
          </button>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {paginatedProducts.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                        Product Name
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                        <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('category')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                        Category
                          {sortField === 'category' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                        <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('expiryDate')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                        Expiry Date
                          {sortField === 'expiryDate' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                        <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('quantity')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                      Quantity
                          {sortField === 'quantity' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(product.expiryDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(product.expiryDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.batchNumber ?? '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEditProduct(product)}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Edit product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(product)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-700">
                  of {filteredAndSortedProducts.length} results
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      );
                    })
                    .map((page, index, array) => {
                      // Add ellipsis
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsis && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[2.5rem] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-indigo-600 text-white'
                                : 'hover:bg-white border border-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                </div>
                
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
          ) : (
            /* Empty State */
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                <Package className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || activeFilter !== 'all' 
                  ? 'No products found' 
                  : 'No products yet'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                {searchTerm 
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : activeFilter !== 'all'
                  ? 'No products match this filter. Try selecting a different filter.'
                  : 'Get started by adding your first product to track expiry dates.'}
              </p>
              {!searchTerm && activeFilter === 'all' && (
                <button
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Product
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product Form Modal */}
        {isFormOpen && (
          <ProductForm
            product={selectedProduct}
            onSubmit={handleSubmitProduct}
            onClose={handleCloseForm}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && productToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Delete Product
                  </h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-gray-900">
                      {productToDelete.name}
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
