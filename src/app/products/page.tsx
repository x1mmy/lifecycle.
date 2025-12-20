"use client";

import {
  Suspense,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Checkbox } from "~/components/ui/checkbox";
import { useSupabaseAuth } from "~/hooks/useSupabaseAuth";
import type { Product } from "~/types";
import { Header } from "~/components/layout/Header";
import { ProductForm } from "~/components/products/ProductForm";
import { getDaysUntilExpiry, formatDate } from "~/utils/dateUtils";
import {
  getEarliestBatch,
  getEarliestExpiryDate,
  getTotalQuantity,
} from "~/utils/batchHelpers";
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
  supplier: row.supplier ?? undefined,
  location: row.location ?? undefined,
  notes: row.notes ?? undefined,
  addedDate: row.added_date,
  batches: [], // TODO: Products page needs batch architecture update
  // TEMPORARY: These columns don't exist anymore after migration - page will not work
  expiryDate: row.expiry_date ?? "2099-12-31", // Fake date
  quantity: row.quantity ?? 0,
  batchNumber: row.batch_number ?? undefined,
});

// Type definitions for product filtering, sorting, and pagination
type FilterType = "all" | "expired" | "expiring-soon" | "good";
type SortField = "name" | "category" | "expiryDate" | "status" | "quantity";
type SortDirection = "asc" | "desc";

function ProductsPageContent() {
  const { user, loading, isAuthenticated } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Fetch products with batches using tRPC
  const {
    data: products = [],
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = api.products.getAll.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id },
  );

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(
    undefined,
  );
  const [prefillProductId, setPrefillProductId] = useState<string | null>(
    searchParams?.get("productId") ?? null,
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
   * Multi-Select State
   * Manages selection of multiple products for bulk operations
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Batch detail panel state
  const [selectedProductForBatches, setSelectedProductForBatches] = useState<Product | null>(null);

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
   * After mutations, we call refetchProducts() to refresh the data
   */
  const utils = api.useUtils(); // Get tRPC utils for cache invalidation
  const createProductMutation = api.products.create.useMutation();
  const updateProductMutation = api.products.update.useMutation();
  const deleteProductMutation = api.products.delete.useMutation();

  // Capture productId from query string whenever it changes
  useEffect(() => {
    const productIdFromQuery = searchParams?.get("productId");
    if (productIdFromQuery) {
      setPrefillProductId(productIdFromQuery);
    }
  }, [searchParams]);

  // Once products are loaded, open the edit modal if a prefill product exists
  useEffect(() => {
    if (!prefillProductId || products.length === 0) return;
    const productToPrefill = products.find(
      (product) => product.id === prefillProductId,
    );

    if (productToPrefill) {
      setSelectedProduct(productToPrefill);
      setIsFormOpen(true);
      setPrefillProductId(null);
      router.replace("/products", { scroll: false });
    }
  }, [prefillProductId, products, router]);

  // Authentication check - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  /**
   * Filter, Sort, and Paginate Products
   * This is the main data transformation pipeline that:
   * 1. Applies search filter (name, category, batch number)
   * 2. Applies status filter (all, expired, expiring-soon, good)
   * 3. Sorts by selected field and direction
   *
   * Updated to work with batch architecture - uses earliest batch for filtering/sorting
   * Memoized for performance - only recalculates when dependencies change
   */
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Step 1: Apply search filter across multiple fields
    if (searchTerm.trim() !== "") {
      // Check if search term is a date
      const parsedDate = parseDateFromSearch(searchTerm);
      if (parsedDate) {
        // If it's a date, filter by any batch expiry date match
        result = result.filter((product) => {
          return (product.batches ?? []).some((batch) => {
            const expiryDate = new Date(batch.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);
            const searchDate = new Date(parsedDate);
            searchDate.setHours(0, 0, 0, 0);
            return expiryDate.getTime() === searchDate.getTime();
          });
        });
      } else {
        // Otherwise, search across name, category, and batch numbers
        result = result.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.batches ?? []).some((batch) =>
              batch.batchNumber
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase()),
            ),
        );
      }
    }

    // Step 2: Apply status filter based on earliest batch expiry date
    if (activeFilter !== "all") {
      result = result.filter((product) => {
        const earliestExpiryDate = getEarliestExpiryDate(product);
        if (!earliestExpiryDate) return false;

        const daysUntil = getDaysUntilExpiry(earliestExpiryDate);
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

    // Step 3: Apply date range filter (using earliest batch)
    if (startDate || endDate) {
      result = result.filter((product) => {
        const earliestExpiryDate = getEarliestExpiryDate(product);
        if (!earliestExpiryDate) return false;

        const expiryDate = new Date(earliestExpiryDate);
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

    // Step 4: Apply sorting (using earliest batch for expiry-related sorts)
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
          {
            const aExpiry = getEarliestExpiryDate(a);
            const bExpiry = getEarliestExpiryDate(b);
            aVal = aExpiry
              ? new Date(aExpiry).getTime()
              : Number.MAX_SAFE_INTEGER;
            bVal = bExpiry
              ? new Date(bExpiry).getTime()
              : Number.MAX_SAFE_INTEGER;
          }
          break;
        case "status":
          // Sort by expiry date priority (products expiring first)
          {
            const aExpiry = getEarliestExpiryDate(a);
            const bExpiry = getEarliestExpiryDate(b);
            aVal = aExpiry
              ? new Date(aExpiry).getTime()
              : Number.MAX_SAFE_INTEGER;
            bVal = bExpiry
              ? new Date(bExpiry).getTime()
              : Number.MAX_SAFE_INTEGER;
          }
          break;
        case "quantity":
          aVal = getTotalQuantity(a);
          bVal = getTotalQuantity(b);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    products,
    searchTerm,
    activeFilter,
    startDate,
    endDate,
    sortField,
    sortDirection,
  ]);

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
  }, [
    searchTerm,
    activeFilter,
    startDate,
    endDate,
    sortField,
    sortDirection,
    pageSize,
  ]);

  /**
   * Filter Counts
   * Calculates the number of products in each status category
   * Used to display badges on filter buttons
   * Takes into account the date range filter if active
   */
  const filterCounts = useMemo(() => {
    // First apply date range filter if active (using earliest batch)
    let dateFilteredProducts = products;

    if (startDate || endDate) {
      dateFilteredProducts = products.filter((product) => {
        const earliestExpiryDate = getEarliestExpiryDate(product);
        if (!earliestExpiryDate) return false;

        const expiryDate = new Date(earliestExpiryDate);
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

    // Then calculate counts from date-filtered products (using earliest batch)
    return {
      all: dateFilteredProducts.length,
      expired: dateFilteredProducts.filter((p) => {
        const earliestExpiryDate = getEarliestExpiryDate(p);
        return earliestExpiryDate
          ? getDaysUntilExpiry(earliestExpiryDate) < 0
          : false;
      }).length,
      "expiring-soon": dateFilteredProducts.filter((p) => {
        const earliestExpiryDate = getEarliestExpiryDate(p);
        if (!earliestExpiryDate) return false;
        const days = getDaysUntilExpiry(earliestExpiryDate);
        return days >= 0 && days <= 7;
      }).length,
      good: dateFilteredProducts.filter((p) => {
        const earliestExpiryDate = getEarliestExpiryDate(p);
        return earliestExpiryDate
          ? getDaysUntilExpiry(earliestExpiryDate) > 7
          : false;
      }).length,
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

  // Get batch mutations
  const updateBatchMutation = api.products.updateBatch.useMutation();
  const createBatchMutation = api.products.createBatch.useMutation();
  const deleteBatchMutation = api.products.deleteBatch.useMutation();

  /**
   * Delete Batch Handler
   * Deletes a specific batch from a product
   */
  const handleDeleteBatch = async (batchId: string, productName: string) => {
    if (!user) return;

    // Check if this is the last batch
    const product = selectedProductForBatches;
    if (product && (product.batches ?? []).length === 1) {
      toast({
        title: "Cannot delete",
        description: "Products must have at least one batch. Delete the product instead.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteBatchMutation.mutateAsync({
        userId: user.id,
        batchId,
      });

      toast({
        title: "Batch deleted",
        description: `Batch removed from "${productName}"`,
      });

      // Refresh products
      await refetchProducts();

      // Update the selected product in the panel
      if (product) {
        const updatedProduct = products.find(p => p.id === product.id);
        if (updatedProduct) {
          setSelectedProductForBatches(updatedProduct);
        } else {
          // Product no longer exists, close panel
          setSelectedProductForBatches(null);
        }
      }
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Error",
        description: "Failed to delete batch. Please try again.",
        variant: "destructive",
      });
    }
  };

  /**
   * Submit Product Handler
   * Uses tRPC mutations for server-side validation and business logic
   * After mutation, refreshes data with refetchProducts()
   */
  const handleSubmitProduct = async (
    productData: Omit<Product, "id" | "addedDate"> & {
      allBatches?: Array<{ tempId: string; expiryDate: string; quantity: string | number; batchNumber: string }>;
      deletedBatchIds?: string[];
    },
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
            // expiryDate, quantity, batchNumber are batch-specific now
            supplier: productData.supplier,
            location: productData.location,
            notes: productData.notes,
            barcode: productData.barcode,
          },
        });

        // Delete removed batches first
        if (productData.deletedBatchIds && productData.deletedBatchIds.length > 0) {
          for (const batchId of productData.deletedBatchIds) {
            await deleteBatchMutation.mutateAsync({
              userId: user.id,
              batchId,
            });
          }
        }

        // Handle all batches if provided (from ProductForm)
        if (productData.allBatches && productData.allBatches.length > 0) {
          const existingBatches = selectedProduct.batches ?? [];
          const existingBatchIds = new Set(existingBatches.map(b => b.id));

          // Process each batch
          for (const batch of productData.allBatches) {
            const isNewBatch = batch.tempId.startsWith('temp-');

            if (isNewBatch) {
              // Create new batch
              await createBatchMutation.mutateAsync({
                userId: user.id,
                productId: selectedProduct.id,
                batch: {
                  expiryDate: batch.expiryDate,
                  quantity: batch.quantity ? (typeof batch.quantity === "string" ? parseInt(batch.quantity, 10) : batch.quantity) : null,
                  batchNumber: batch.batchNumber || undefined,
                },
              });
            } else if (existingBatchIds.has(batch.tempId)) {
              // Update existing batch
              await updateBatchMutation.mutateAsync({
                userId: user.id,
                batchId: batch.tempId,
                batch: {
                  expiryDate: batch.expiryDate,
                  quantity: batch.quantity ? (typeof batch.quantity === "string" ? parseInt(batch.quantity, 10) : batch.quantity) : null,
                  batchNumber: batch.batchNumber || undefined,
                },
              });
            }
          }
        }

        toast({
          title: "Product updated",
          description: "The product has been updated successfully.",
        });
      } else {
        // Create new product via tRPC
        // Ensure expiryDate is provided for the first batch
        if (!productData.expiryDate) {
          throw new Error("Expiry date is required for the first batch");
        }

        await createProductMutation.mutateAsync({
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

        toast({
          title: "Product added",
          description: "The product has been added successfully.",
        });
      }

      // Invalidate categories cache to refresh dropdown with any new categories
      await utils.products.getCategories.invalidate({ userId: user.id });
      // Also invalidate settings categories so the settings page updates instantly
      await utils.settings.getCategories.invalidate({ userId: user.id });

      // Reload products from client-side and close form
      await refetchProducts();
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
   * After mutation, refreshes data with refetchProducts()
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
      await refetchProducts();

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
        <span className="inline-flex items-center rounded-full bg-[#059669]/20 px-2.5 py-0.5 text-xs font-medium text-[#059669]">
          {daysUntil}d left
        </span>
      );
    }
  };

  /**
   * Multi-Select Handlers
   * Manage selection state for bulk operations
   */

  // Toggle individual product selection
  const handleToggleSelection = (
    productId: string,
    index: number,
    event?: React.MouseEvent,
  ) => {
    // Handle shift-click for range selection
    if (event?.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelectedIds = new Set(selectedIds);

      for (let i = start; i <= end; i++) {
        if (i < paginatedProducts.length) {
          newSelectedIds.add(paginatedProducts[i]!.id);
        }
      }

      setSelectedIds(newSelectedIds);
      setLastSelectedIndex(index);
      return;
    }

    // Regular toggle
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(productId)) {
      newSelectedIds.delete(productId);
    } else {
      newSelectedIds.add(productId);
    }
    setSelectedIds(newSelectedIds);
    setLastSelectedIndex(index);
  };

  // Select all visible products
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prevSelectedIds) => {
        const newSelectedIds = new Set(prevSelectedIds);
        if (checked) {
          paginatedProducts.forEach((product) => {
            newSelectedIds.add(product.id);
          });
        } else {
          paginatedProducts.forEach((product) => {
            newSelectedIds.delete(product.id);
          });
        }
        return newSelectedIds;
      });
    },
    [paginatedProducts],
  );

  // Check if all visible products are selected
  const allVisibleSelected = useMemo(() => {
    if (paginatedProducts.length === 0) return false;
    return paginatedProducts.every((product) => selectedIds.has(product.id));
  }, [paginatedProducts, selectedIds]);

  // Check if some visible products are selected (for indeterminate state)
  const someVisibleSelected = useMemo(() => {
    return paginatedProducts.some((product) => selectedIds.has(product.id));
  }, [paginatedProducts, selectedIds]);

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  // Track the initial selection state when drag starts
  const dragStartSelectedState = useRef<boolean>(false);
  const initialSelectionState = useRef<Set<string>>(new Set());

  // Drag selection handlers
  const handleMouseDown = (index: number, event?: React.MouseEvent) => {
    // Don't start drag if clicking directly on checkbox or its children
    if (event?.target instanceof HTMLElement) {
      // Check if clicking on checkbox button or its children (SVG check icon)
      const isCheckboxClick = Boolean(
        (event.target.closest('button[type="button"]')?.querySelector("svg") ??
          event.target.tagName === "svg") ||
          event.target.closest("[data-state]"),
      );

      if (isCheckboxClick) {
        return;
      }
    }

    setIsDragging(true);
    setDragStartIndex(index);
    // Remember the initial state of the starting item and all selections
    const productId = paginatedProducts[index]!.id;
    dragStartSelectedState.current = selectedIds.has(productId);
    initialSelectionState.current = new Set(selectedIds);

    // Toggle the starting item to the opposite state
    const newSelectedIds = new Set(selectedIds);
    if (dragStartSelectedState.current) {
      newSelectedIds.delete(productId);
    } else {
      newSelectedIds.add(productId);
    }
    setSelectedIds(newSelectedIds);
  };

  const handleMouseEnter = (index: number) => {
    if (isDragging && dragStartIndex !== null) {
      const start = Math.min(dragStartIndex, index);
      const end = Math.max(dragStartIndex, index);

      // Start with the initial selection state (before drag started)
      const newSelectedIds = new Set(initialSelectionState.current);

      // Set all items in range to the NEW state (opposite of initial state)
      // If starting item was initially selected, deselect all in range
      // If starting item was initially unselected, select all in range
      const targetState = !dragStartSelectedState.current;
      for (let i = start; i <= end; i++) {
        if (i < paginatedProducts.length) {
          if (targetState) {
            newSelectedIds.add(paginatedProducts[i]!.id);
          } else {
            newSelectedIds.delete(paginatedProducts[i]!.id);
          }
        }
      }

      setSelectedIds(newSelectedIds);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartIndex(null);
    dragStartSelectedState.current = false;
    initialSelectionState.current = new Set();
  };

  // Add global mouse up listener to properly end drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!user || selectedIds.size === 0) return;

    setIsBulkDeleting(true);
    const selectedArray = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;
    const failedProducts: string[] = [];

    try {
      for (const productId of selectedArray) {
        try {
          await deleteProductMutation.mutateAsync({
            productId,
            userId: user.id,
          });
          successCount++;
        } catch {
          failCount++;
          const product = products.find((p) => p.id === productId);
          if (product) {
            failedProducts.push(product.name);
          }
        }
      }

      if (successCount > 0) {
        toast({
          title: "Products deleted",
          description: `Successfully deleted ${successCount} product${successCount !== 1 ? "s" : ""}.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
        });
        await refetchProducts();
        handleClearSelection();
      }

      if (failCount > 0 && failedProducts.length > 0) {
        toast({
          title: "Some deletions failed",
          description: `Failed to delete: ${failedProducts.slice(0, 3).join(", ")}${failedProducts.length > 3 ? ` and ${failedProducts.length - 3} more` : ""}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error during bulk delete:", error);
      toast({
        title: "Error",
        description: "An error occurred during bulk deletion",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteModalOpen(false);
    }
  };

  // Keyboard shortcuts - use refs to avoid dependency issues
  const selectAllRef = useRef(handleSelectAll);
  const clearSelectionRef = useRef(handleClearSelection);
  const selectedIdsRef = useRef(selectedIds);
  const paginatedProductsRef = useRef(paginatedProducts);

  useEffect(() => {
    selectAllRef.current = handleSelectAll;
    clearSelectionRef.current = handleClearSelection;
    selectedIdsRef.current = selectedIds;
    paginatedProductsRef.current = paginatedProducts;
  }, [handleSelectAll, handleClearSelection, selectedIds, paginatedProducts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + A: Select all visible
      if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        event.preventDefault();
        if (paginatedProductsRef.current.length > 0) {
          selectAllRef.current(true);
        }
      }
      // Escape: Clear selection
      else if (event.key === "Escape") {
        clearSelectionRef.current();
      }
      // Delete/Backspace: Open delete confirmation
      else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedIdsRef.current.size > 0
      ) {
        event.preventDefault();
        setBulkDeleteModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Show loading spinner while checking authentication
  if (loading || productsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
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
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 pl-10 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#10B981] focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddProduct}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2 font-medium text-white transition-colors hover:bg-[#059669]"
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
                ? "bg-[#059669] text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-[#10B981]/50 hover:bg-[#059669]/10"
            }`}
          >
            All
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                activeFilter === "all" ? "bg-[#059669]" : "bg-gray-100"
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
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              startDate || endDate
                ? "bg-[#059669] text-white shadow-md"
                : "border border-gray-200 bg-white text-gray-700 hover:border-[#10B981]/50 hover:bg-[#059669]/10"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Filter by Date
            {(startDate || endDate) && (
              <span
                className={`ml-1 rounded-full bg-[#059669] px-2 py-0.5 text-xs`}
              >
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
                      className="text-sm font-medium text-[#10B981] hover:text-[#059669]"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4 px-6 py-4">
                <div>
                  <label
                    htmlFor="startDate-mobile"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    From Date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="startDate-mobile"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981] focus:outline-none"
                    />
                    {startDate && (
                      <button
                        onClick={() => setStartDate("")}
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title="Clear start date"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="endDate-mobile"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    To Date
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="endDate-mobile"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981] focus:outline-none"
                    />
                    {endDate && (
                      <button
                        onClick={() => setEndDate("")}
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                  className="w-full rounded-lg bg-[#059669] px-4 py-3 font-medium text-white transition-colors hover:bg-[#059669]"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Desktop: Centered Modal */}
            <div className="absolute inset-0 hidden items-center justify-center p-4 md:flex">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                {/* Header */}
                <div className="border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Filter by Date Range
                    </h3>
                    <button
                      onClick={() => setDateFilterOpen(false)}
                      className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Select date range for products
                  </p>
                </div>

                {/* Content */}
                <div className="space-y-4 px-6 py-4">
                  <div>
                    <label
                      htmlFor="startDate-desktop"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      From Date
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="startDate-desktop"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981] focus:outline-none"
                      />
                      {startDate && (
                        <button
                          onClick={() => setStartDate("")}
                          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Clear start date"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="endDate-desktop"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      To Date
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="endDate-desktop"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981] focus:outline-none"
                      />
                      {endDate && (
                        <button
                          onClick={() => setEndDate("")}
                          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                      className="w-full py-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                    >
                      Clear All Dates
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-6 py-4">
                  <button
                    onClick={() => setDateFilterOpen(false)}
                    className="w-full rounded-lg bg-[#059669] px-4 py-2 font-medium text-white transition-colors hover:bg-[#059669]"
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
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={handleSelectAll}
                        className="shrink-0"
                        aria-label="Select all products"
                      />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Products ({filteredAndSortedProducts.length})
                      </h3>
                    </div>
                    <button
                      onClick={() => setSortPickerOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                    >
                      <span>{getCurrentSortLabel()}</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {paginatedProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
                          selectedIds.has(product.id)
                            ? "ring-2 ring-[#10B981]"
                            : ""
                        } ${isDragging ? "cursor-grabbing" : ""}${isDragging ? "select-none" : ""}`}
                        onMouseDown={(e) => handleMouseDown(index, e)}
                        onMouseEnter={() => handleMouseEnter(index)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex shrink-0 items-center pt-0.5">
                            <Checkbox
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={(checked) => {
                                const newSelectedIds = new Set(selectedIds);
                                if (checked) {
                                  newSelectedIds.add(product.id);
                                } else {
                                  newSelectedIds.delete(product.id);
                                }
                                setSelectedIds(newSelectedIds);
                                setLastSelectedIndex(index);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              aria-label={`Select ${product.name}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="truncate text-sm font-semibold text-gray-900">
                                {product.name}
                              </h4>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditProduct(product);
                                  }}
                                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-[#059669]/10 hover:text-[#10B981]"
                                  title="Edit product"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(product);
                                  }}
                                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="Delete product"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-1.5 space-y-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Category:</span>
                                <span className="font-medium text-gray-900">
                                  {product.category}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Batches:</span>
                                <span className="font-medium text-gray-900">
                                  {(product.batches ?? []).length}
                                </span>
                              </div>
                              {(() => {
                                const earliestBatch = getEarliestBatch(product);
                                if (!earliestBatch) return null;
                                return (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">
                                        Earliest Expiry:
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {formatDate(earliestBatch.expiryDate)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">
                                        Total Qty:
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {getTotalQuantity(product)}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              {(() => {
                                const earliestExpiryDate =
                                  getEarliestExpiryDate(product);
                                return earliestExpiryDate
                                  ? getStatusBadge(earliestExpiryDate)
                                  : null;
                              })()}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProductForBatches(product);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#059669] active:bg-[#047857]"
                              >
                                <Package className="h-3.5 w-3.5" />
                                View Batches
                              </button>
                            </div>
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
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all products"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 transition-colors hover:text-gray-700"
                        >
                          Product Name
                          {sortField === "name" ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#10B981]" />
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
                              <ArrowUp className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#10B981]" />
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
                              <ArrowUp className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#10B981]" />
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
                              <ArrowUp className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#10B981]" />
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
                              <ArrowUp className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-[#10B981]" />
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
                    {paginatedProducts.map((product, index) => (
                      <tr
                        key={product.id}
                        className={`border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                          selectedIds.has(product.id) ? "bg-[#059669]/10" : ""
                        } ${isDragging ? "cursor-grabbing" : ""}${isDragging ? "select-none" : ""}`}
                        onMouseDown={(e) => handleMouseDown(index, e)}
                        onMouseEnter={() => handleMouseEnter(index)}
                      >
                        <td className="w-12 px-4 py-4">
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={(checked) => {
                              const newSelectedIds = new Set(selectedIds);
                              if (checked) {
                                newSelectedIds.add(product.id);
                              } else {
                                newSelectedIds.delete(product.id);
                              }
                              setSelectedIds(newSelectedIds);
                              setLastSelectedIndex(index);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td
                          className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900 cursor-pointer hover:text-[#10B981]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductForBatches(product);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {product.name}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {(() => {
                            const earliestExpiryDate =
                              getEarliestExpiryDate(product);
                            return earliestExpiryDate
                              ? formatDate(earliestExpiryDate)
                              : "-";
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {(() => {
                            const earliestExpiryDate =
                              getEarliestExpiryDate(product);
                            return earliestExpiryDate
                              ? getStatusBadge(earliestExpiryDate)
                              : null;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {getTotalQuantity(product)}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          {(product.batches ?? []).length} batch
                          {(product.batches ?? []).length !== 1 ? "es" : ""}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-1 text-gray-400 transition-colors hover:text-[#10B981]"
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
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#10B981] focus:outline-none"
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
                                className={`min-w-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  currentPage === page
                                    ? "bg-[#059669] text-white"
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
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#059669]/20">
                <Package className="h-8 w-8 text-[#10B981]" />
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
                  className="inline-flex items-center gap-2 rounded-lg bg-[#059669] px-4 py-2 font-medium text-white transition-colors hover:bg-[#059669]"
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
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
                          ? "bg-[#059669]/10 text-[#059669]"
                          : "text-gray-900 hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        {isSelected && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#059669]">
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

        {/* Floating Action Buttons for Bulk Operations - Desktop/Tablet */}
        {selectedIds.size > 0 && (
          <>
            <div className="fixed right-6 bottom-6 z-40 hidden flex-col gap-2 transition-all duration-300 md:flex">
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-2 rounded-full border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-95"
                aria-label="Unselect all products"
              >
                <X className="h-4 w-4" />
                <span>Unselect All</span>
              </button>
              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-xl active:scale-95"
                aria-label={`Delete ${selectedIds.size} selected product${selectedIds.size !== 1 ? "s" : ""}`}
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  Delete {selectedIds.size}{" "}
                  {selectedIds.size === 1 ? "product" : "products"}
                </span>
              </button>
            </div>

            {/* Mobile Action Bar - Full width on small screens */}
            <div className="fixed right-0 bottom-0 left-0 z-40 block transition-all duration-300 md:hidden">
              <div className="border-t border-gray-200 bg-white p-3 shadow-lg">
                <div className="flex gap-2">
                  <button
                    onClick={handleClearSelection}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                    aria-label="Unselect all products"
                  >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">Unselect All</span>
                    <span className="sm:hidden">Clear</span>
                  </button>
                  <button
                    onClick={() => setBulkDeleteModalOpen(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>
                      Delete {selectedIds.size}{" "}
                      {selectedIds.size === 1 ? "product" : "products"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {bulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    Delete Selected Products
                  </h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete{" "}
                    <span className="font-medium text-gray-900">
                      {selectedIds.size} selected product
                      {selectedIds.size !== 1 ? "s" : ""}
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBulkDeleteModalOpen(false)}
                  disabled={isBulkDeleting}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Details Slide-out Panel */}
        {selectedProductForBatches && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 transition-opacity"
              onClick={() => setSelectedProductForBatches(null)}
            />

            {/* Slide-out Panel */}
            <div className="absolute top-0 right-0 bottom-0 flex">
              <div className="ml-auto flex w-full max-w-md flex-col bg-white shadow-2xl">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-6 w-6 text-[#10B981]" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Batch Details
                        </h2>
                        <p className="text-sm text-gray-500">
                          {selectedProductForBatches.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedProductForBatches(null)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Close panel"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Batches List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {(selectedProductForBatches.batches ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="mb-3 h-12 w-12 text-gray-300" />
                      <p className="text-sm text-gray-500">
                        No batches found for this product
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(selectedProductForBatches.batches ?? []).map((batch, index) => {
                        const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
                        const isExpired = daysUntilExpiry < 0;
                        const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

                        return (
                          <div
                            key={batch.id}
                            className={`rounded-lg border p-4 ${
                              isExpired
                                ? 'border-red-200 bg-red-50'
                                : isExpiringSoon
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Batch #{index + 1}
                                </h3>
                                {batch.batchNumber && (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {batch.batchNumber}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(batch.expiryDate)}
                                <button
                                  onClick={() => handleDeleteBatch(batch.id, selectedProductForBatches.name)}
                                  className="p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 rounded"
                                  title="Delete batch"
                                  disabled={deleteBatchMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Expiry Date:</span>
                                <span className="font-medium text-gray-900">
                                  {formatDate(batch.expiryDate)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Quantity:</span>
                                <span className="font-medium text-gray-900">
                                  {batch.quantity ?? 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Summary */}
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Total Batches:</span>
                      <span className="font-semibold text-gray-900">
                        {(selectedProductForBatches.batches ?? []).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Total Quantity:</span>
                      <span className="font-semibold text-gray-900">
                        {getTotalQuantity(selectedProductForBatches)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Category:</span>
                      <span className="font-semibold text-gray-900">
                        {selectedProductForBatches.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-gray-500">Loading products...</div>
      }
    >
      <ProductsPageContent />
    </Suspense>
  );
}
