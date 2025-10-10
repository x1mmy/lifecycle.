import { useState } from "react";
import { X, Barcode } from "lucide-react";
import type { Product } from "~/types";
import { validateRequired, validatePositiveNumber } from "~/utils/validation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  DropdownMenuSelect,
  DropdownMenuSelectContent,
  DropdownMenuSelectItem,
  DropdownMenuSelectTrigger,
  DropdownMenuSelectValue,
} from "~/components/ui/dropdown-menu-select";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

interface ProductFormProps {
  product?: Product;
  userId: string;
  onSubmit: (product: Omit<Product, "id" | "addedDate">) => void;
  onClose: () => void;
}

export const ProductForm = ({
  product,
  userId,
  onSubmit,
  onClose,
}: ProductFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    expiryDate: product?.expiryDate ?? "",
    quantity: product?.quantity ?? 1,
    batchNumber: product?.batchNumber ?? "",
    supplier: product?.supplier ?? "",
    location: product?.location ?? "",
    notes: product?.notes ?? "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [barcode, setBarcode] = useState("");
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);

  // Use tRPC mutation for barcode lookup (server-side API call)
  const barcodeLookup = api.products.lookupBarcode.useMutation();

  // Get existing categories for dropdown
  const { data: categories = [] } = api.products.getCategories.useQuery(
    { userId },
    { enabled: !!userId },
  );

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

          // Clear barcode input
          setBarcode("");
        } else {
          // Product found but no new info to add
          toast({
            title: "Product already filled",
            description: "Product found but form already has this information.",
          });
          setBarcode("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!validateRequired(formData.name)) {
      newErrors.name = "Product name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Product name must be at least 2 characters";
    }

    if (!validateRequired(formData.category)) {
      newErrors.category = "Category is required";
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = "Expiry date is required";
    }

    if (!validatePositiveNumber(formData.quantity)) {
      newErrors.quantity = "Quantity must be a positive number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl shadow-xl">
        {/* Header */}
        <div className="border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-xl font-semibold">
            {product ? "Edit Product" : "Add New Product"}
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-accent rounded-lg p-2 transition-colors"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Barcode Scanner Section */}
          <div className="bg-muted border-border rounded-lg border-2 border-dashed p-4">
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
                onClick={() => lookupBarcode(barcode)}
                disabled={barcodeLookup.isPending || !barcode.trim()}
                variant="outline"
              >
                {barcodeLookup.isPending ? "Looking up..." : "Lookup"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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
                <DropdownMenuSelect
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                >
                  <DropdownMenuSelectTrigger
                    className={errors.category ? "border-destructive" : ""}
                  >
                    <DropdownMenuSelectValue placeholder="Select a category..." />
                  </DropdownMenuSelectTrigger>
                  <DropdownMenuSelectContent>
                    {/* Add new category option at the top */}
                    <DropdownMenuSelectItem
                      value="__new__"
                      className="font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      + Add new category
                    </DropdownMenuSelectItem>

                    {/* Separator */}
                    <div className="mx-2 my-1 h-px bg-gray-200" />

                    {/* Existing categories */}
                    {categories
                      .filter((category) => category && category.trim() !== "") // Filter out empty/invalid categories
                      .map((category) => (
                        <DropdownMenuSelectItem
                          key={category}
                          value={category}
                          className="hover:bg-gray-50"
                        >
                          {category}
                        </DropdownMenuSelectItem>
                      ))}
                  </DropdownMenuSelectContent>
                </DropdownMenuSelect>
              )}
              {errors.category && (
                <p className="text-destructive mt-1 text-sm">
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange("expiryDate", e.target.value)}
                className={errors.expiryDate ? "border-destructive" : ""}
              />
              {errors.expiryDate && (
                <p className="text-destructive mt-1 text-sm">
                  {errors.expiryDate}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  handleChange("quantity", parseInt(e.target.value) || 0)
                }
                className={errors.quantity ? "border-destructive" : ""}
              />
              {errors.quantity && (
                <p className="text-destructive mt-1 text-sm">
                  {errors.quantity}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="batchNumber">Batch Number</Label>
              <Input
                id="batchNumber"
                value={formData.batchNumber}
                onChange={(e) => handleChange("batchNumber", e.target.value)}
                placeholder="e.g., B12345"
              />
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

            <div className="md:col-span-2">
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

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {product ? "Update Product" : "Add Product"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
