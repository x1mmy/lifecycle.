import { useState } from 'react';
import { X, Package } from 'lucide-react';
import type { Product } from '~/types';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

interface QuantityUpdateModalProps {
  product: Product;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const QuantityUpdateModal = ({
  product,
  userId,
  isOpen,
  onClose,
  onUpdate,
}: QuantityUpdateModalProps) => {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(product.quantity?.toString() ?? '');
  const [error, setError] = useState('');

  // tRPC mutation for updating product
  const updateProduct = api.products.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `Updated quantity for "${product.name}"`,
      });
      onUpdate(); // Reload products
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update quantity',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!quantity || quantity.trim() === '') {
      setError('Quantity is required');
      return;
    }

    const numValue = parseInt(quantity, 10);
    if (isNaN(numValue) || numValue < 0) {
      setError('Quantity must be a positive number');
      return;
    }

    // Update product with new quantity
    updateProduct.mutate({
      productId: product.id,
      userId,
      product: {
        name: product.name,
        category: product.category,
        expiryDate: product.expiryDate,
        quantity: numValue,
        batchNumber: product.batchNumber,
        supplier: product.supplier,
        location: product.location,
        notes: product.notes,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#10B981]" />
            <h2 className="text-lg font-semibold text-gray-900">
              Update Quantity
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
            type="button"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Updating quantity for: <span className="font-medium text-gray-900">{product.name}</span>
            </p>

            <Label htmlFor="quantity">New Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError('');
              }}
              className={error ? 'border-red-500' : ''}
              placeholder="Enter quantity..."
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={updateProduct.isPending}
            >
              {updateProduct.isPending ? 'Updating...' : 'Update'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateProduct.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
