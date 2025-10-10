import { useState } from 'react';
import { X, Barcode } from 'lucide-react';
import type { Product } from '~/types';
import { validateRequired, validatePositiveNumber } from '~/utils/validation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { useToast } from '~/hooks/use-toast';   

interface ProductFormProps {
  product?: Product;
  onSubmit: (product: Omit<Product, 'id' | 'addedDate'>) => void;
  onClose: () => void;
}

export const ProductForm = ({ product, onSubmit, onClose }: ProductFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: product?.name ?? '',
    category: product?.category ?? '',
    expiryDate: product?.expiryDate ?? '',
    quantity: product?.quantity ?? 1,
    batchNumber: product?.batchNumber ?? '',
    supplier: product?.supplier ?? '',
    location: product?.location ?? '',
    notes: product?.notes ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [barcode, setBarcode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: '' });
  };

  const lookupBarcode = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;

    setIsLookingUp(true);
    try {
      // Using Open Food Facts API for product lookup
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeValue.trim()}.json`);
      const data: Record<string, any> = await response.json(); // eslint-disable-line @typescript-eslint/no-unsafe-assignment

      if (data.status === 1 && data.product) {
        const productData: Record<string, any> = data.product as Record<string, any>; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        
        // Auto-fill form fields with API data
        const updates: Record<string, string | number> = {};
        
        if (productData.product_name && !formData.name) {
          updates.name = productData.product_name as string;
        }
        
        if (productData.categories && !formData.category) {
          const categories = productData.categories.split(',') as string[]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          updates.category = categories[0]?.trim() ?? '';
        }
        
        if (productData.brands && !formData.supplier) {
          updates.supplier = productData.brands as string;
        }

        if (Object.keys(updates).length > 0) {
          setFormData({ ...formData, ...updates });
          toast({
            title: "Product found!",
            description: "Form fields have been auto-filled with barcode data.",
          });
        } else {
          toast({
            title: "Product found",
            description: "No new information to add from barcode.",
          });
        }
      } else {
        toast({
          title: "Product not found",
          description: "Barcode not found in database. Please enter details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lookup failed",
        description: "Could not look up barcode. Please enter details manually.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Scanner sends Enter after barcode
    if (e.key === 'Enter') {
      e.preventDefault();
      void lookupBarcode(barcode);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!validateRequired(formData.name)) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }

    if (!validateRequired(formData.category)) {
      newErrors.category = 'Category is required';
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    }

    if (!validatePositiveNumber(formData.quantity)) {
      newErrors.quantity = 'Quantity must be a positive number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <h2 className="text-xl font-semibold text-foreground">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-smooth"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Barcode Scanner Section */}
          <div className="p-4 bg-muted rounded-lg border-2 border-dashed border-border">
            <div className="flex items-center gap-2 mb-2">
              <Barcode className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="barcode" className="text-base font-semibold">Scan Barcode (Optional)</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
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
                disabled={isLookingUp}
              />
              <Button
                type="button"
                onClick={() => lookupBarcode(barcode)}
                disabled={isLookingUp || !barcode.trim()}
                variant="outline"
              >
                {isLookingUp ? 'Looking up...' : 'Lookup'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
                placeholder="e.g., Milk 2L"
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className={errors.category ? 'border-destructive' : ''}
                placeholder="e.g., Dairy, Bakery"
              />
              {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
            </div>

            <div>
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                className={errors.expiryDate ? 'border-destructive' : ''}
              />
              {errors.expiryDate && <p className="text-sm text-destructive mt-1">{errors.expiryDate}</p>}
            </div>

            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                className={errors.quantity ? 'border-destructive' : ''}
              />
              {errors.quantity && <p className="text-sm text-destructive mt-1">{errors.quantity}</p>}
            </div>

            <div>
              <Label htmlFor="batchNumber">Batch Number</Label>
              <Input
                id="batchNumber"
                value={formData.batchNumber}
                onChange={(e) => handleChange('batchNumber', e.target.value)}
                placeholder="e.g., B12345"
              />
            </div>

            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                placeholder="e.g., Fresh Foods Co."
              />
            </div>

            <div>
              <Label htmlFor="location">Storage Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g., Aisle 3, Shelf 2"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional information..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {product ? 'Update Product' : 'Add Product'}
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