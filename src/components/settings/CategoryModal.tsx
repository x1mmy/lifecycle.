"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
}: CategoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

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
        setDescription(category.description || "");
      } else {
        setName("");
        setDescription("");
      }
      setErrors({});
    }
  }, [isOpen, category]);

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
              <h3 className="text-sm font-semibold text-gray-900">
                Products in this category
              </h3>
              <span className="text-sm text-gray-500">
                {products.length} item{products.length === 1 ? "" : "s"}
              </span>
            </div>

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
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          Expiry: {formatExpiryDate(product.expiryDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Quantity: {product.quantity ?? "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
