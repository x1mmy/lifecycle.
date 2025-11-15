"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  X,
} from "lucide-react";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import { supabase } from "~/lib/supabase";
import type { Product } from "~/types";
import { Header } from "~/components/layout/Header";
import { ProductForm } from "~/components/products/ProductForm";
import { getDaysUntilExpiry, formatDate } from "~/utils/dateUtils";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

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
type FilterType = "all" | "expired" | "expiring-soon" | "good";
type SortField = "name" | "category" | "expiryDate" | "status" | "quantity";
type SortDirection = "asc" | "desc";

export default function ProductsPage() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Core product data and UI state
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(
    undefined,
  );

  /**
   * Date Range Filter State
   * Allows users to filter products by expiry date range
   * - startDate: Filter products expiring on or after this date
   * - endDate: Filter products expiring on or before this date
   */
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  /**
   * Filter State
   * Allows users to quickly view products by status:
   * - all: Show all products
   * - expired: Products past expiry date
   * - expiring-soon: Products expiring within 7 days
   * - good: Products with more than 7 days until expiry
   */
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  /**
   * Sort State
   * Enables sorting by product attributes with ascending/descending order
   * Default: Sort by expiry date (soonest first)
   */
  const [sortField, setSortField] = useState<SortField>("expiryDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  // Mobile Sort Picker State
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  // Date Filter Dropdown State
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  /**
   * Parse date string from search term
   * Detects various date formats and converts them to YYYY-MM-DD
   * Returns null if the string doesn't match a date pattern
   */
  const parseDateFromSearch = (searchTerm: string): string | null => {
    // Remove whitespace
    const trimmed = searchTerm.trim();

    // Try to parse common date formats
    // Format 1: YYYY-MM-DD (standard format)
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoPattern.test(trimmed)) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return trimmed;
      }
    }

    // Format 2: MM/DD/YYYY or M/D/YYYY (US format)
    const usPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const usMatch = usPattern.exec(trimmed);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      if (month && day && year) {
        const monthInt = parseInt(month, 10);
        const dayInt = parseInt(day, 10);
        const yearInt = parseInt(year, 10);
        if (monthInt >= 1 && monthInt <= 12 && dayInt >= 1 && dayInt <= 31) {
          const date = new Date(yearInt, monthInt - 1, dayInt);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD
            const formattedMonth = monthInt.toString().padStart(2, "0");
            const formattedDay = dayInt.toString().padStart(2, "0");
            return `${yearInt}-${formattedMonth}-${formattedDay}`;
          }
        }
      }
    }

    // Format 3: Try to parse as a natural date string
    const naturalDate = new Date(trimmed);
    if (!isNaN(naturalDate.getTime()) && trimmed.length > 5) {
      // If it's a valid date and not just numbers
      const isoString = naturalDate.toISOString().split("T");
      return isoString[0] ?? null;
    }

    return null;
  };

  // Sort options for mobile picker
  const sortOptions = [
    { value: "expiryDate-asc", label: "Expiry Date (Soonest)" },
    { value: "expiryDate-desc", label: "Expiry Date (Latest)" },
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "category-asc", label: "Category (A-Z)" },
    { value: "category-desc", label: "Category (Z-A)" },
    { value: "quantity-asc", label: "Quantity (Low-High)" },
    { value: "quantity-desc", label: "Quantity (High-Low)" },
  ];

  // Handle sort selection from mobile picker
  const handleSortSelection = (value: string) => {
    const [field, direction] = value.split("-") as [SortField, SortDirection];
    setSortField(field);
    setSortDirection(direction);
    setSortPickerOpen(false);
  };

  // Get current sort option label
  const getCurrentSortLabel = () => {
    const currentValue = `${sortField}-${sortDirection}`;
    return (
      sortOptions.find((option) => option.value === currentValue)?.label ??
      "Sort by"
    );
  };

  /**
   * tRPC Mutations for CRUD Operations
   * All data modifications go through backend API for validation and business logic
   * After mutations, we call loadUserProducts() to refresh the data
   */
  const createProductMutation = api.products.create.useMutation();
  const updateProductMutation = api.products.update.useMutation();
  const deleteProductMutation = api.products.delete.useMutation();

  /**
   * Load products for the current user from Supabase
   * Direct client-side fetch for fast data retrieval
   * Uses RLS policies to ensure users only see their own products
   */
  const loadUserProducts = useCallback(async () => {
    if (!user) return;

    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("expiry_date", { ascending: true });

      if (error) {
        console.error("Error loading products:", error);
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        });
        return;
      }

      // Transform database rows to Product interface
      const transformedProducts = (data as ProductRow[]).map(
        transformProductFromDb,
      );
      setProducts(transformedProducts);
    } catch (error) {
      console.error("Unexpected error loading products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setProductsLoading(false);
    }
  }, [user, toast]);

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Load user products from Supabase
  useEffect(() => {
    if (user) {
      void loadUserProducts();
    }
  }, [user, loadUserProducts]);

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
    if (searchTerm.trim() !== "") {
      // Check if search term is a date
      const parsedDate = parseDateFromSearch(searchTerm);
      if (parsedDate) {
        // If it's a date, filter by expiry date match
        result = result.filter((product) => {
          const expiryDate = new Date(product.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          const searchDate = new Date(parsedDate);
          searchDate.setHours(0, 0, 0, 0);
          return expiryDate.getTime() === searchDate.getTime();
        });
      } else {
        // Otherwise, search across name, category, and batch number
        result = result.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      }
    }

    // Step 2: Apply status filter based on expiry date
    if (activeFilter !== "all") {
      result = result.filter((product) => {
        const daysUntil = getDaysUntilExpiry(product.expiryDate);
        switch (activeFilter) {
          case "expired":
            return daysUntil < 0; // Past expiry date
          case "expiring-soon":
            return daysUntil >= 0 && daysUntil <= 7; // Within 7 days
          case "good":
            return daysUntil > 7; // More than 7 days
          default:
            return true;
        }
      });
    }

    // Step 3: Apply date range filter
    if (startDate || endDate) {
      result = result.filter((product) => {
        const expiryDate = new Date(product.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);

        // Filter by start date (products expiring on or after startDate)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (expiryDate < start) {
            return false;
          }
        }

        // Filter by end date (products expiring on or before endDate)
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(0, 0, 0, 0);
          if (expiryDate > end) {
            return false;
          }
        }

        return true;
      });
    }

    // Step 4: Apply sorting
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      // Get comparable values based on sort field
      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "category":
          aVal = a.category.toLowerCase();
          bVal = b.category.toLowerCase();
          break;
        case "expiryDate":
          aVal = new Date(a.expiryDate).getTime();
          bVal = new Date(b.expiryDate).getTime();
          break;
        case "status":
          // Sort by expiry date priority (products expiring first)
          aVal = new Date(a.expiryDate).getTime();
          bVal = new Date(b.expiryDate).getTime();
          break;
        case "quantity":
          aVal = a.quantity ?? 0;
          bVal = b.quantity ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchTerm, activeFilter, startDate, endDate, sortField, sortDirection]);

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
  }, [searchTerm, activeFilter, startDate, endDate, sortField, sortDirection, pageSize]);

  /**
   * Filter Counts
   * Calculates the number of products in each status category
   * Used to display badges on filter buttons
   * Takes into account the date range filter if active
   */
  const filterCounts = useMemo(() => {
    // First apply date range filter if active
    let dateFilteredProducts = products;

    if (startDate || endDate) {
      dateFilteredProducts = products.filter((product) => {
        const expiryDate = new Date(product.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);

        // Filter by start date (products expiring on or after startDate)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (expiryDate < start) {
            return false;
          }
        }

        // Filter by end date (products expiring on or before endDate)
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(0, 0, 0, 0);
          if (expiryDate > end) {
            return false;
          }
        }

        return true;
      });
    }

    // Then calculate counts from date-filtered products
    return {
      all: dateFilteredProducts.length,
      expired: dateFilteredProducts.filter((p) => getDaysUntilExpiry(p.expiryDate) < 0)
        .length,
      "expiring-soon": dateFilteredProducts.filter((p) => {
        const days = getDaysUntilExpiry(p.expiryDate);
        return days >= 0 && days <= 7;
      }).length,
      good: dateFilteredProducts.filter((p) => getDaysUntilExpiry(p.expiryDate) > 7).length,
    };
  }, [products, startDate, endDate]);

  /**
   * Handle Sort Column Click
   * Toggles sort direction if clicking the same field,
   * otherwise sets new field with ascending direction
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
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
   * Uses tRPC mutations for server-side validation and business logic
   * After mutation, refreshes data with loadUserProducts()
   */
  const handleSubmitProduct = async (
    productData: Omit<Product, "id" | "addedDate">,
  ) => {
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
            barcode: productData.barcode,
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
            barcode: productData.barcode,
          },
        });

        toast({
          title: "Product added",
          description: "The product has been added successfully.",
        });
      }

      // Reload products from client-side and close form
      await loadUserProducts();
      handleCloseForm();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: "Failed to save product. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Confirm Delete Handler
   * Uses tRPC mutation for server-side deletion with security checks
   * After mutation, refreshes data with loadUserProducts()
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

      // Reload products from client-side
      await loadUserProducts();

      // Close modal
      setDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
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
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Expired {Math.abs(daysUntil)}d ago
        </span>
      );
    } else if (daysUntil === 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          0d left
        </span>
      );
    } else if (daysUntil <= 7) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          {daysUntil}d left
        </span>
      );
    } else if (daysUntil <= 30) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
          {daysUntil}d left
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
          {daysUntil}d left
        </span>
      );
    }
  };

  // Show loading spinner while checking authentication
  if (loading || productsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-500">
            {loading ? "Loading..." : "Loading products..."}
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">
            Manage your inventory and track expiration dates
          </p>
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddProduct}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {/* Filter Chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === "all"
                ? "bg-indigo-600 text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50"
            }`}
          >
            All
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeFilter === "all" ? "bg-indigo-500" : "bg-gray-100"
              }`}
            >
              {filterCounts.all}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter("expired")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === "expired"
                ? "bg-red-600 text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50"
            }`}
          >
            Expired
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeFilter === "expired"
                  ? "bg-red-500"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {filterCounts.expired}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter("expiring-soon")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === "expiring-soon"
                ? "bg-amber-600 text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50"
            }`}
          >
            Expiring Soon
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeFilter === "expiring-soon"
                  ? "bg-amber-500"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {filterCounts["expiring-soon"]}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter("good")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeFilter === "good"
                ? "bg-green-600 text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50"
            }`}
          >
            Good
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeFilter === "good"
                  ? "bg-green-500"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {filterCounts.good}
            </span>
          </button>

          {/* Date Filter Button */}
          <button
            onClick={() => setDateFilterOpen(true)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
              startDate || endDate
                ? "bg-purple-600 text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Filter by Date
            {(startDate || endDate) && (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs bg-purple-500`}>
                Active
              </span>
            )}
          </button>
        </div>

        {/* Date Filter Modal - Mobile & Tablet Bottom Sheet, Desktop Centered Modal */}
        {dateFilterOpen && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDateFilterOpen(false)}
            />

            {/* Mobile/Tablet: Bottom Sheet */}
            <div className="absolute right-0 bottom-0 left-0 rounded-t-2xl bg-white shadow-2xl md:hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-12 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="border-b border-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Filter by Date Range
                    </h3>
                    <p className="text-sm text-gray-500">
                      Select date range for products
                    </p>
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label htmlFor="startDate-mobile" className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="startDate-mobile"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {startDate && (
                      <button
                        onClick={() => setStartDate("")}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Clear start date"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="endDate-mobile" className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="endDate-mobile"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {endDate && (
                      <button
                        onClick={() => setEndDate("")}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        title="Clear end date"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => setDateFilterOpen(false)}
                  className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Desktop: Centered Modal */}
            <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Filter by Date Range
                    </h3>
                    <button
                      onClick={() => setDateFilterOpen(false)}
                      className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Select date range for products
                  </p>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label htmlFor="startDate-desktop" className="block text-sm font-medium text-gray-700 mb-2">
                      From Date
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="startDate-desktop"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      {startDate && (
                        <button
                          onClick={() => setStartDate("")}
                          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          title="Clear start date"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="endDate-desktop" className="block text-sm font-medium text-gray-700 mb-2">
                      To Date
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="endDate-desktop"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      {endDate && (
                        <button
                          onClick={() => setEndDate("")}
                          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          title="Clear end date"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium py-2"
                    >
                      Clear All Dates
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <button
                    onClick={() => setDateFilterOpen(false)}
                    className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 transition-colors"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Display - Mobile Cards / Desktop Table */}
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
          {paginatedProducts.length > 0 ? (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden">
                <div className="p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Products ({filteredAndSortedProducts.length})
                    </h3>
                    <button
                      onClick={() => setSortPickerOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                    >
                      <span>{getCurrentSortLabel()}</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {paginatedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-base font-semibold text-gray-900">
                              {product.name}
                            </h4>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                  Category:
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {product.category}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                  Expires:
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatDate(product.expiryDate)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                  Quantity:
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {product.quantity}
                                </span>
                              </div>
                              {product.batchNumber && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-500">
                                    Batch:
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {product.batchNumber}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mt-3">
                              {getStatusBadge(product.expiryDate)}
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                              title="Edit product"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(product)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Product Name
                          {sortField === "name" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("category")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Category
                          {sortField === "category" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("expiryDate")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Expiry Date
                          {sortField === "expiryDate" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("status")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Status
                          {sortField === "status" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("quantity")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Quantity
                          {sortField === "quantity" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-indigo-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Batch #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {formatDate(product.expiryDate)}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {getStatusBadge(product.expiryDate)}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {product.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {product.batchNumber ?? "-"}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-1 text-gray-400 transition-colors hover:text-indigo-600"
                              title="Edit product"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(product)}
                              className="p-1 text-gray-400 transition-colors hover:text-red-600"
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
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 md:px-6">
                {/* Mobile Pagination */}
                <div className="flex flex-col gap-4 md:hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <span className="text-sm text-gray-700">
                      {filteredAndSortedProducts.length} results
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Pagination */}
                <div className="hidden items-center justify-between md:flex">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Show</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                      className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
                                className={`min-w-[2.5rem] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  currentPage === page
                                    ? "bg-indigo-600 text-white"
                                    : "border border-gray-200 hover:bg-white"
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="px-4 py-16 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                <Package className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                {searchTerm || activeFilter !== "all"
                  ? "No products found"
                  : "No products yet"}
              </h3>
              <p className="mx-auto mb-6 max-w-sm text-gray-500">
                {searchTerm
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : activeFilter !== "all"
                    ? "No products match this filter. Try selecting a different filter."
                    : "Get started by adding your first product to track expiry dates."}
              </p>
              {!searchTerm && activeFilter === "all" && (
                <button
                  onClick={handleAddProduct}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Product
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product Form Modal */}
        {isFormOpen && user && (
          <ProductForm
            product={selectedProduct}
            userId={user.id}
            onSubmit={handleSubmitProduct}
            onClose={handleCloseForm}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    Delete Product
                  </h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete{" "}
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
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Sort Picker Bottom Sheet */}
        {sortPickerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSortPickerOpen(false)}
            />

            {/* Bottom Sheet */}
            <div className="absolute right-0 bottom-0 left-0 rounded-t-2xl bg-white shadow-2xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-12 rounded-full bg-gray-300" />
              </div>

              {/* Header */}
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Sort Products
                </h3>
                <p className="text-sm text-gray-500">
                  Choose how to sort your products
                </p>
              </div>

              {/* Options */}
              <div className="max-h-96 overflow-y-auto px-6 py-2">
                {sortOptions.map((option) => {
                  const isSelected =
                    `${sortField}-${sortDirection}` === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSortSelection(option.value)}
                      className={`w-full rounded-lg px-4 py-4 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-900 hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        {isSelected && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Cancel Button */}
              <div className="border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => setSortPickerOpen(false)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
