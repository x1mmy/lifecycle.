import { useState, useEffect } from "react";
import { X, Barcode, Camera, Plus, Trash2 } from "lucide-react";
import type { Product, ProductBatch } from "~/types";
import { validateRequired, validatePositiveNumber } from "~/utils/validation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";
import { BarcodeScanner } from "./BarcodeScanner";
import { formatDate } from "~/utils/dateUtils";

interface ProductFormProps {
  product?: Product;
  userId: string;
  onSubmit: (product: Omit<Product, "id" | "addedDate">) => void;
  onClose: () => void;
}

// Form data type (product details only)
interface ProductFormData {
  name: string;
  category: string;
  supplier: string;
  location: string;
  notes: string;
}

// Batch form data (for the batch table)
interface BatchFormData {
  tempId: string; // Temporary ID for UI tracking
  expiryDate: string;
  quantity: string | number;
  batchNumber: string;
}

// Storage key for form draft (isolated per browser tab via sessionStorage)
const FORM_DRAFT_KEY = "product-form-draft";

export const ProductForm = ({
  product,
  userId,
  onSubmit,
  onClose,
}: ProductFormProps) => {
  const { toast } = useToast();

  /**
   * Initialize product form data
   */
  const [formData, setFormData] = useState<ProductFormData>(() => {
    if (product) {
      return {
        name: product.name ?? "",
        category: product.category ?? "",
        supplier: product.supplier ?? "",
        location: product.location ?? "",
        notes: product.notes ?? "",
      };
    }

    return {
      name: "",
      category: "",
      supplier: "",
      location: "",
      notes: "",
    };
  });

  /**
   * Initialize batches state
   * If editing: load existing batches
   * If adding new: start with one empty batch
   */
  const [batches, setBatches] = useState<BatchFormData[]>(() => {
    if (product?.batches && product.batches.length > 0) {
      return product.batches.map((batch) => ({
        tempId: batch.id,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity ?? "",
        batchNumber: batch.batchNumber ?? "",
      }));
    }

    // Start with one empty batch for new products
    return [
      {
        tempId: `temp-${Date.now()}`,
        expiryDate: "",
        quantity: "",
        batchNumber: "",
      },
    ];
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});
  const [barcode, setBarcode] = useState<string>("");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Batch management functions
  const addBatch = () => {
    setBatches([
      ...batches,
      {
        tempId: `temp-${Date.now()}`,
        expiryDate: "",
        quantity: "",
        batchNumber: "",
      },
    ]);
  };

  const removeBatch = (tempId: string) => {
    if (batches.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one batch is required",
        variant: "destructive",
      });
      return;
    }
    setBatches(batches.filter((batch) => batch.tempId !== tempId));
  };

  const updateBatch = (tempId: string, field: keyof Omit<BatchFormData, 'tempId'>, value: string | number) => {
    setBatches(
      batches.map((batch) =>
        batch.tempId === tempId ? { ...batch, [field]: value } : batch
      )
    );
    // Clear error for this batch field
    setBatchErrors({ ...batchErrors, [`${tempId}-${field}`]: "" });
  };

  // Initialize barcode from product when editing
  useEffect(() => {
    if (product?.barcode && typeof product.barcode === 'string') {
      setBarcode(product.barcode);
    }
  }, [product]);

  /**
   * Auto-save form draft to sessionStorage
   * Saves both product data and batches
   */
  useEffect(() => {
    if (product) return; // Don't save draft when editing

    const hasData = Object.values(formData).some((value) => value !== "");
    if (hasData && typeof window !== "undefined") {
      sessionStorage.setItem(
        FORM_DRAFT_KEY,
        JSON.stringify({ product: formData, batches })
      );
    }
  }, [formData, batches, product]);

  // Use tRPC mutation for barcode lookup (server-side API call)
  const barcodeLookup = api.products.lookupBarcode.useMutation();

  // Get existing categories for dropdown
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = api.products.getCategories.useQuery(
    { userId },
    {
      enabled: !!userId,
      retry: 2, // Retry failed requests 2 times
      retryDelay: 1000, // Wait 1 second between retries
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    },
  );

  // Show toast on category load error (but don't block form)
  useEffect(() => {
    if (categoriesError) {
      toast({
        title: "Categories load failed",
        description: "You can still type a category manually. Categories will be available after refresh.",
        variant: "destructive",
      });
    }
  }, [categoriesError, toast]);

  const handleChange = (field: string, value: string | number) => {
    if (field === "category" && value === "__new__") {
      setIsAddingNewCategory(true);
      setFormData({ ...formData, [field]: "" });
    } else {
      setFormData({ ...formData, [field]: value });
    }
    setErrors({ ...errors, [field]: "" });
  };

  /**
   * Barcode Lookup Handler
   * Now uses server-side tRPC endpoint instead of direct API call
   * Benefits:
   * - API calls happen on server (more secure)
   * - Centralized error handling
   * - Can add rate limiting/caching later
   * - Easier to switch barcode providers
   */
  const lookupBarcode = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) {
      toast({
        title: "No barcode entered",
        description: "Please enter or scan a barcode first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Call server-side tRPC endpoint
      const result = await barcodeLookup.mutateAsync({
        barcode: barcodeValue.trim(),
      });

      // Check if product was found
      if (result.found && result.data) {
        const updates: Record<string, string | number> = {};

        // Auto-fill form fields with data from barcode lookup
        if (result.data.name && !formData.name) {
          updates.name = result.data.name;
        }

        if (result.data.category && !formData.category) {
          updates.category = result.data.category;
        }

        if (result.data.supplier && !formData.supplier) {
          updates.supplier = result.data.supplier;
        }

        // Update form if we got any data
        if (Object.keys(updates).length > 0) {
          setFormData({ ...formData, ...updates });

          // Show success toast
          toast({
            title: "✅ Product found!",
            description: `Found "${result.data.name ?? "product"}" - Form fields have been auto-filled.`,
          });

          // Keep barcode visible so it gets saved with the product
        } else {
          // Product found but no new info to add
          toast({
            title: "Product already filled",
            description: "Product found but form already has this information.",
          });
          // Keep barcode visible so it gets saved with the product
        }
      } else {
        // Product not found in database
        toast({
          title: "❌ Product not found",
          description: `Barcode "${barcodeValue.trim()}" not found in database. Please enter product details manually.`,
          variant: "destructive",
        });

        // Don't clear barcode in case user wants to try again
      }
    } catch (error) {
      // Network or server error
      console.error("Barcode lookup error:", error);

      toast({
        title: "⚠️ Lookup failed",
        description:
          "Failed to connect to barcode database. Please enter product details manually.",
        variant: "destructive",
      });
    }
  };

  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Scanner sends Enter after barcode
    if (e.key === "Enter") {
      e.preventDefault();
      void lookupBarcode(barcode);
    }
  };

  /**
   * Handle barcode scanned from camera
   * Auto-fills the barcode input and triggers lookup
   */
  const handleBarcodeScanned = (scannedBarcode: string) => {
    console.log("Barcode scanned from camera:", scannedBarcode);
    setBarcode(scannedBarcode);

    // Automatically trigger lookup
    void lookupBarcode(scannedBarcode);

    // Show success toast
    toast({
      title: "Barcode scanned!",
      description: `Scanned: ${scannedBarcode}`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation - Product details
    const newErrors: Record<string, string> = {};
    const newBatchErrors: Record<string, string> = {};

    if (!validateRequired(formData.name)) {
      newErrors.name = "Product name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Product name must be at least 2 characters";
    }

    if (!validateRequired(formData.category)) {
      newErrors.category = "Category is required";
    }

    // Validate batches - at least one batch with expiry date is required
    let hasValidBatch = false;
    batches.forEach((batch, index) => {
      if (!batch.expiryDate) {
        newBatchErrors[`${batch.tempId}-expiryDate`] = "Expiry date is required";
      } else {
        hasValidBatch = true;
      }

      // Validate quantity if provided
      if (batch.quantity && batch.quantity !== "") {
        const qty = typeof batch.quantity === "string" ? parseInt(batch.quantity, 10) : batch.quantity;
        if (isNaN(qty) || qty <= 0) {
          newBatchErrors[`${batch.tempId}-quantity`] = "Quantity must be a positive number";
        }
      }
    });

    if (!hasValidBatch) {
      toast({
        title: "Validation Error",
        description: "At least one batch with an expiry date is required",
        variant: "destructive",
      });
    }

    if (Object.keys(newErrors).length > 0 || Object.keys(newBatchErrors).length > 0) {
      setErrors(newErrors);
      setBatchErrors(newBatchErrors);
      return;
    }

    // Prepare product data with first batch (for backwards compatibility with current API)
    const firstBatch = batches[0];
    if (!firstBatch) {
      toast({
        title: "Error",
        description: "At least one batch is required",
        variant: "destructive",
      });
      return;
    }

    const submitData: Omit<Product, "id" | "addedDate"> = {
      name: formData.name,
      category: formData.category,
      expiryDate: firstBatch.expiryDate,
      quantity: firstBatch.quantity ? (typeof firstBatch.quantity === "string" ? parseInt(firstBatch.quantity, 10) : firstBatch.quantity) : null,
      batchNumber: firstBatch.batchNumber || undefined,
      supplier: formData.supplier || undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
      barcode: barcode.trim() ? barcode.trim() : undefined,
    };

    // Submit the form
    onSubmit(submitData);

    // Clear draft from sessionStorage after successful submission
    if (!product && typeof window !== "undefined") {
      sessionStorage.removeItem(FORM_DRAFT_KEY);
    }
  };

  /**
   * Handle form close/cancel
   * Clears sessionStorage draft when user explicitly cancels
   * (but draft is preserved during tab switches via auto-save)
   */
  const handleClose = () => {
    if (!product && typeof window !== "undefined") {
      sessionStorage.removeItem(FORM_DRAFT_KEY);
      console.log("🗑️ Cleared form draft from sessionStorage (user cancelled)");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl shadow-xl">
        {/* Header */}
        <div className="border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-xl font-semibold">
            {product ? "Edit Product" : "Add New Product"}
          </h2>
          <button
            onClick={handleClose}
            className="hover:bg-accent rounded-lg p-2 transition-colors"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Barcode Scanner Section - Full Width */}
          <div className="bg-muted border-border rounded-lg border-2 border-dashed p-4 mb-6">
            <div className="mb-2 flex items-center gap-2">
              <Barcode className="text-muted-foreground h-5 w-5" />
              <Label htmlFor="barcode" className="text-base font-semibold">
                Scan Barcode (Optional)
              </Label>
            </div>
            <p className="text-muted-foreground mb-3 text-sm">
              Scan a barcode to auto-fill product information
            </p>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={handleBarcodeKeyPress}
                placeholder="Scan or enter barcode..."
                className="flex-1"
                disabled={barcodeLookup.isPending}
              />
              <Button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                variant="outline"
                className="shrink-0"
                title="Scan with camera"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={() => lookupBarcode(barcode)}
                disabled={barcodeLookup.isPending || !barcode.trim()}
                variant="outline"
              >
                {barcodeLookup.isPending ? "Looking up..." : "Lookup"}
              </Button>
            </div>
          </div>

          {/* Barcode Scanner Modal */}
          <BarcodeScanner
            open={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScan={handleBarcodeScanned}
          />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN - Product Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Details</h3>

              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={errors.name ? "border-destructive" : ""}
                  placeholder="e.g., Milk 2L"
                />
                {errors.name && (
                  <p className="text-destructive mt-1 text-sm">{errors.name}</p>
                )}
              </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              {isAddingNewCategory ? (
                <div className="space-y-2">
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    className={errors.category ? "border-destructive" : ""}
                    placeholder="Enter new category..."
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingNewCategory(false);
                      setFormData({ ...formData, category: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                >
                  <SelectTrigger
                    className={errors.category ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add new category option at the top */}
                    <SelectItem
                      value="__new__"
                      className="font-medium text-[#10B981] hover:bg-[#10B981]/10 hover:text-[#059669]"
                    >
                      + Add new category
                    </SelectItem>

                    {/* Separator */}
                    <div className="mx-2 my-1 h-px bg-gray-200" />

                    {/* Loading state */}
                    {categoriesLoading && (
                      <SelectItem value="__loading__" disabled>
                        Loading categories...
                      </SelectItem>
                    )}

                    {/* Error state - Show helpful message but allow manual entry */}
                    {categoriesError && (
                      <SelectItem value="__error__" disabled>
                        Error loading - Click &quot;+ Add new category&quot; to enter manually
                      </SelectItem>
                    )}

                    {/* Existing categories - Show even if there was an error (might be cached) */}
                    {!categoriesLoading && categories
                      .filter((category: string) => category && category.trim() !== "") // Filter out empty/invalid categories
                      .map((category: string) => (
                        <SelectItem
                          key={category}
                          value={category}
                          className="hover:bg-gray-50"
                        >
                          {category}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {errors.category && (
                <p className="text-destructive mt-1 text-sm">
                  {errors.category}
                </p>
              )}
            </div>

              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => handleChange("supplier", e.target.value)}
                  placeholder="e.g., Fresh Foods Co."
                />
              </div>

              <div>
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., Aisle 3, Shelf 2"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Additional information..."
                  rows={3}
                />
              </div>
            </div>

            {/* RIGHT COLUMN - Batch Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Batches</h3>
                <Button
                  type="button"
                  onClick={addBatch}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Batch
                </Button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {batches.map((batch, index) => (
                  <div
                    key={batch.tempId}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Batch #{index + 1}
                      </span>
                      {batches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBatch(batch.tempId)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`batch-${batch.tempId}-expiry`}>
                          Expiry Date *
                        </Label>
                        <Input
                          id={`batch-${batch.tempId}-expiry`}
                          type="date"
                          value={batch.expiryDate}
                          onChange={(e) =>
                            updateBatch(batch.tempId, "expiryDate", e.target.value)
                          }
                          className={
                            batchErrors[`${batch.tempId}-expiryDate`]
                              ? "border-destructive"
                              : ""
                          }
                        />
                        {batchErrors[`${batch.tempId}-expiryDate`] && (
                          <p className="text-destructive mt-1 text-xs">
                            {batchErrors[`${batch.tempId}-expiryDate`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`batch-${batch.tempId}-quantity`}>
                          Quantity
                        </Label>
                        <Input
                          id={`batch-${batch.tempId}-quantity`}
                          type="number"
                          min="1"
                          value={batch.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateBatch(
                              batch.tempId,
                              "quantity",
                              val === "" ? "" : parseInt(val, 10)
                            );
                          }}
                          placeholder="e.g., 10"
                          className={
                            batchErrors[`${batch.tempId}-quantity`]
                              ? "border-destructive"
                              : ""
                          }
                        />
                        {batchErrors[`${batch.tempId}-quantity`] && (
                          <p className="text-destructive mt-1 text-xs">
                            {batchErrors[`${batch.tempId}-quantity`]}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`batch-${batch.tempId}-batchNumber`}>
                          Batch Number
                        </Label>
                        <Input
                          id={`batch-${batch.tempId}-batchNumber`}
                          value={batch.batchNumber}
                          onChange={(e) =>
                            updateBatch(batch.tempId, "batchNumber", e.target.value)
                          }
                          placeholder="e.g., B12345"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
            <Button type="submit" className="flex-1">
              {product ? "Update Product" : "Add Product"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
