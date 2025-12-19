import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import type { Product, ProductBatch } from '~/types';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
import { formatDate } from '~/utils/dateUtils';

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
  const utils = api.useUtils();

  // Track quantities for each batch
  const [batchQuantities, setBatchQuantities] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset quantities when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      const quantities: Record<string, string> = {};
      (product.batches ?? []).forEach(batch => {
        quantities[batch.id] = batch.quantity?.toString() ?? '';
      });
      setBatchQuantities(quantities);
      setErrors({});
    }
  }, [isOpen, product]);

  // tRPC mutation for updating batch
  const updateBatch = api.products.updateBatch.useMutation({
    onSuccess: async () => {
      // Invalidate products cache to refetch with updated quantities
      await utils.products.getAll.invalidate({ userId });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update quantity',
        variant: 'destructive',
      });
    },
  });

  const handleQuantityChange = (batchId: string, value: string) => {
    setBatchQuantities(prev => ({ ...prev, [batchId]: value }));
    setErrors(prev => ({ ...prev, [batchId]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const batches = product.batches ?? [];

    // Validate all batches
    batches.forEach(batch => {
      const qty = batchQuantities[batch.id];
      if (qty && qty.trim() !== '') {
        const numValue = parseInt(qty, 10);
        if (isNaN(numValue) || numValue < 0) {
          newErrors[batch.id] = 'Must be a positive number';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Update all batches with changed quantities
    try {
      const updatePromises = batches
        .filter(batch => {
          const newQty = batchQuantities[batch.id];
          const oldQty = batch.quantity?.toString() ?? '';
          return newQty !== oldQty; // Only update if changed
        })
        .map(batch => {
          const qty = batchQuantities[batch.id];
          return updateBatch.mutateAsync({
            userId,
            batchId: batch.id,
            batch: {
              expiryDate: batch.expiryDate,
              quantity: qty && qty.trim() !== '' ? parseInt(qty, 10) : null,
              batchNumber: batch.batchNumber,
            },
          });
        });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        toast({
          title: 'Success',
          description: `Updated ${updatePromises.length} batch${updatePromises.length !== 1 ? 'es' : ''}`,
        });
      }

      onUpdate(); // Reload products
      onClose();
    } catch (error) {
      // Error already handled by mutation
      console.error('Error updating batches:', error);
    }
  };

  if (!isOpen) return null;

  const batches = product.batches ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#10B981]" />
            <h2 className="text-lg font-semibold text-gray-900">
              Update Quantities
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
              Updating quantities for: <span className="font-medium text-gray-900">{product.name}</span>
            </p>

            {batches.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No batches found for this product
              </p>
            ) : (
              <div className="space-y-4 max-h-100 overflow-y-auto">
                {batches.map((batch, index) => (
                  <div
                    key={batch.id}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Batch #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500">
                        Expires: {formatDate(batch.expiryDate)}
                      </span>
                    </div>

                    {batch.batchNumber && (
                      <p className="text-xs text-gray-500 mb-2">
                        Batch Number: {batch.batchNumber}
                      </p>
                    )}

                    <div>
                      <Label htmlFor={`quantity-${batch.id}`} className="text-sm">
                        Quantity
                      </Label>
                      <Input
                        id={`quantity-${batch.id}`}
                        type="number"
                        min="0"
                        value={batchQuantities[batch.id] ?? ''}
                        onChange={(e) => handleQuantityChange(batch.id, e.target.value)}
                        className={errors[batch.id] ? 'border-red-500' : ''}
                        placeholder="Enter quantity..."
                      />
                      {errors[batch.id] && (
                        <p className="mt-1 text-xs text-red-600">{errors[batch.id]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-200">
            <Button
              type="submit"
              className="flex-1"
              disabled={updateBatch.isPending || batches.length === 0}
            >
              {updateBatch.isPending ? 'Updating...' : 'Update All'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateBatch.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
