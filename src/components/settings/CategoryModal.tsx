"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface CategoryProductSummary {
  id: string;
  name: string;
  expiryDate: string;
  quantity: number | null;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null; // null for create, Category for edit
  onSave: (name: string, description: string | null) => Promise<void>;
  isLoading?: boolean;
  products?: CategoryProductSummary[];
  productsLoading?: boolean;
  onEditProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  userId?: string; // Required for bulk delete
}

export function CategoryModal({
  isOpen,
  onClose,
  category,
  onSave,
  isLoading = false,
  products = [],
  productsLoading = false,
  onEditProduct,
  onDeleteProduct,
  userId,
}: CategoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  /**
   * Multi-Select State for Products
   */
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastSelectedProductIndex, setLastSelectedProductIndex] = useState<
    number | null
  >(null);
  const [isDraggingProducts, setIsDraggingProducts] = useState(false);
  const [dragStartProductIndex, setDragStartProductIndex] = useState<
    number | null
  >(null);
  const [bulkDeleteProductsModalOpen, setBulkDeleteProductsModalOpen] =
    useState(false);
  const [isBulkDeletingProducts, setIsBulkDeletingProducts] = useState(false);

  const formatExpiryDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setDescription(category.description ?? "");
      } else {
        setName("");
        setDescription("");
      }
      setErrors({});
      // Clear selections when modal opens/closes
      setSelectedProductIds(new Set());
      setLastSelectedProductIndex(null);
    }
  }, [isOpen, category]);

  /**
   * Product Multi-Select Handlers
   */
  // Toggle individual product selection
  const handleToggleProductSelection = (
    productId: string,
    index: number,
    event?: React.MouseEvent,
  ) => {
    // Handle shift-click for range selection
    if (event?.shiftKey && lastSelectedProductIndex !== null) {
      const start = Math.min(lastSelectedProductIndex, index);
      const end = Math.max(lastSelectedProductIndex, index);
      const newSelectedIds = new Set(selectedProductIds);

      for (let i = start; i <= end; i++) {
        if (i < products.length) {
          newSelectedIds.add(products[i]!.id);
        }
      }

      setSelectedProductIds(newSelectedIds);
      setLastSelectedProductIndex(index);
      return;
    }

    // Regular toggle
    const newSelectedIds = new Set(selectedProductIds);
    if (newSelectedIds.has(productId)) {
      newSelectedIds.delete(productId);
    } else {
      newSelectedIds.add(productId);
    }
    setSelectedProductIds(newSelectedIds);
    setLastSelectedProductIndex(index);
  };

  // Select all products
  const handleSelectAllProducts = useCallback(
    (checked: boolean) => {
      setSelectedProductIds((prevSelectedIds) => {
        const newSelectedIds = new Set(prevSelectedIds);
        if (checked) {
          products.forEach((product) => {
            newSelectedIds.add(product.id);
          });
        } else {
          products.forEach((product) => {
            newSelectedIds.delete(product.id);
          });
        }
        return newSelectedIds;
      });
    },
    [products],
  );

  // Check if all products are selected
  const allProductsSelected = useMemo(() => {
    if (products.length === 0) return false;
    return products.every((product) => selectedProductIds.has(product.id));
  }, [products, selectedProductIds]);

  // Drag selection handlers
  const handleProductMouseDown = (index: number) => {
    setIsDraggingProducts(true);
    setDragStartProductIndex(index);
    handleToggleProductSelection(products[index]!.id, index);
  };

  const handleProductMouseEnter = (index: number) => {
    if (isDraggingProducts && dragStartProductIndex !== null) {
      const start = Math.min(dragStartProductIndex, index);
      const end = Math.max(dragStartProductIndex, index);
      const newSelectedIds = new Set(selectedProductIds);

      for (let i = start; i <= end; i++) {
        if (i < products.length) {
          newSelectedIds.add(products[i]!.id);
        }
      }

      setSelectedProductIds(newSelectedIds);
    }
  };

  const handleProductMouseUp = () => {
    setIsDraggingProducts(false);
    setDragStartProductIndex(null);
  };

  // Bulk delete products handler
  const handleBulkDeleteProducts = async () => {
    if (!onDeleteProduct || selectedProductIds.size === 0) return;

    setIsBulkDeletingProducts(true);
    const selectedArray = Array.from(selectedProductIds);

    try {
      for (const productId of selectedArray) {
        onDeleteProduct(productId);
      }
      setSelectedProductIds(new Set());
      setLastSelectedProductIndex(null);
    } catch (error) {
      console.error("Error during bulk product delete:", error);
    } finally {
      setIsBulkDeletingProducts(false);
      setBulkDeleteProductsModalOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate
    if (!name.trim()) {
      setErrors({ name: "Category name is required" });
      return;
    }

    if (name.length > 100) {
      setErrors({ name: "Category name must be less than 100 characters" });
      return;
    }

    if (description.length > 500) {
      setErrors({ name: "Description must be less than 500 characters" });
      return;
    }

    try {
      await onSave(name.trim(), description.trim() || null);
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Error saving category:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Add Category"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">
                Category Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors({ ...errors, name: undefined });
                  }
                }}
                placeholder="e.g., Dairy, Meats, Vegetables"
                className={errors.name ? "border-red-300" : ""}
                disabled={isLoading}
                maxLength={100}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this category"
                rows={4}
                className="resize-none"
                disabled={isLoading}
                maxLength={500}
              />
              <p className="text-xs text-gray-500">
                {description.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {category ? "Updating..." : "Creating..."}
                </>
              ) : category ? (
                "Update Category"
              ) : (
                "Create Category"
              )}
            </Button>
          </DialogFooter>
        </form>

        {category && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allProductsSelected}
                  onCheckedChange={handleSelectAllProducts}
                  disabled={products.length === 0}
                  aria-label="Select all products"
                />
                <h3 className="text-sm font-semibold text-gray-900">
                  Products in this category
                </h3>
              </div>
              <span className="text-sm text-gray-500">
                {products.length} item{products.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Inline Action Bar for Bulk Delete */}
            {selectedProductIds.size > 0 && (
              <div className="sticky top-0 z-10 rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-900">
                    {selectedProductIds.size} product
                    {selectedProductIds.size !== 1 ? "s" : ""} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteProductsModalOpen(true)}
                    className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {productsLoading ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-indigo-600" />
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No products currently use this category.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className={`rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm transition-colors ${
                      selectedProductIds.has(product.id)
                        ? "bg-indigo-50 ring-2 ring-indigo-500"
                        : ""
                    } ${isDraggingProducts ? "cursor-grabbing" : ""}`}
                    onMouseDown={() => handleProductMouseDown(index)}
                    onMouseEnter={() => handleProductMouseEnter(index)}
                    onMouseUp={handleProductMouseUp}
                    onMouseLeave={handleProductMouseUp}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-start gap-2">
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() =>
                            handleToggleProductSelection(product.id, index)
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleProductSelection(product.id, index, e);
                          }}
                          className="mt-0.5 shrink-0"
                          aria-label={`Select ${product.name}`}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            Expiry: {formatExpiryDate(product.expiryDate)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Quantity: {product.quantity ?? "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => onEditProduct?.(product.id)}
                          disabled={!onEditProduct}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct?.(product.id)}
                          disabled={!onDeleteProduct}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bulk Delete Products Confirmation Modal */}
        {bulkDeleteProductsModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    Delete Selected Products
                  </h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete{" "}
                    <span className="font-medium text-gray-900">
                      {selectedProductIds.size} selected product
                      {selectedProductIds.size !== 1 ? "s" : ""}
                    </span>
                    ? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBulkDeleteProductsModalOpen(false)}
                  disabled={isBulkDeletingProducts}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteProducts}
                  disabled={isBulkDeletingProducts}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBulkDeletingProducts ? (
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
      </DialogContent>
    </Dialog>
  );
}
