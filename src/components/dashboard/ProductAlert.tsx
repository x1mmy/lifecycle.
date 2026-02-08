'use client';

import { useState, useRef, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import type { Product, ProductBatch } from '~/types';
import { formatDate, getDaysUntilExpiry } from '~/utils/dateUtils';
import { getEarliestExpiryDate, getEarliestBatch, getEarliestExpiringBatch } from '~/utils/batchHelpers';
import { Trash2, Pencil, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';
import { QuantityUpdateModal } from './QuantityUpdateModal';

interface ProductAlertProps {
  product: Product;
  type: 'expired' | 'expiring';
  userId: string;
  onProductDeleted: () => void;
}

export const ProductAlert = ({ product, type, userId, onProductDeleted }: ProductAlertProps) => {
  const { toast } = useToast();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect if we're on mobile or tablet (screen width < 1024px = lg breakpoint)
  // This includes phones and tablets in both portrait and landscape modes
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Click outside handler to reset swipe
  useEffect(() => {
    if (!isMobile || swipeOffset === 0) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSwipeOffset(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [swipeOffset, isMobile]);

  const isExpired = type === 'expired';
  // Urgent Attention: use the batch that is expiring soon (0–7 days), not the absolute earliest (which could be long-expired)
  const earliestBatch: ProductBatch | undefined = isExpired
    ? getEarliestBatch(product)
    : getEarliestExpiringBatch(product, 7);
  const earliestExpiryDate = earliestBatch?.expiryDate ?? (isExpired ? getEarliestExpiryDate(product) : undefined);
  const daysUntil = earliestExpiryDate ? getDaysUntilExpiry(earliestExpiryDate) : 0;

  // Target mockup: white cards with subtle borders; expired has left red accent
  const cardBase = 'bg-white border border-gray-200';
  const leftAccent = isExpired ? 'border-l-4 border-l-red-500' : '';
  const urgencyTextColor = !isExpired && daysUntil <= 3 ? 'text-red-600' : !isExpired ? 'text-amber-600' : 'text-red-600';

  const isLastBatch = (product.batches ?? []).length === 1;

  // tRPC mutation for deleting product
  const deleteProduct = api.products.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Product deleted',
        description: `"${product.name}" has been removed`,
      });
      onProductDeleted();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete product',
        variant: 'destructive',
      });
    },
  });

  // tRPC mutation for deleting batch
  const deleteBatch = api.products.deleteBatch.useMutation({
    onSuccess: () => {
      const batchInfo = earliestBatch?.batchNumber
        ? `Batch ${earliestBatch.batchNumber}`
        : 'Batch';
      toast({
        title: 'Batch deleted',
        description: `${batchInfo} removed from "${product.name}"`,
      });
      onProductDeleted();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete batch',
        variant: 'destructive',
      });
    },
  });

  // Swipe gesture handler (mobile only)
  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx] }) => {
      // Disable swipe on desktop
      if (!isMobile) return;

      // Max swipe distance is 100px
      const maxSwipe = 100;

      // Allow both left and right swipes
      const offset = Math.max(Math.min(mx, maxSwipe), -maxSwipe);

      if (down) {
        setSwipeOffset(offset);
      } else {
        // Snap behavior based on velocity and distance
        if (Math.abs(vx) > 0.5 || Math.abs(offset) > maxSwipe / 2) {
          // Snap to revealed state (left or right)
          setSwipeOffset(offset > 0 ? maxSwipe : -maxSwipe);
        } else {
          setSwipeOffset(0); // Snap back to hidden
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      preventScroll: true,
      enabled: isMobile, // Only enable on mobile
    }
  );

  const handleDelete = () => {
    // If this is the last batch, delete the entire product
    if (isLastBatch) {
      deleteProduct.mutate({
        productId: product.id,
        userId,
      });
    } else {
      // Otherwise, delete only the earliest expiring batch
      if (earliestBatch) {
        deleteBatch.mutate({
          userId,
          batchId: earliestBatch.id,
        });
      }
    }
    setShowDeleteConfirm(false);
  };

  return (
    <>
      {/* Mobile & Tablet: Swipeable Card */}
      <div ref={containerRef} className="relative overflow-hidden lg:overflow-visible rounded-lg">
        {/* Edit button revealed on swipe right (mobile & tablet only) */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-amber-500 flex items-center justify-center lg:hidden">
          <button
            onClick={() => {
              setIsUpdating(true);
              setShowQuantityModal(true);
            }}
            disabled={isUpdating}
            className="flex flex-col items-center justify-center text-white h-full w-full disabled:opacity-70"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-5 w-5 mb-1 animate-spin" />
                <span className="text-xs font-medium">Updating</span>
              </>
            ) : (
              <>
                <Pencil className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">Update</span>
              </>
            )}
          </button>
        </div>

        {/* Delete button revealed on swipe left (mobile & tablet only) */}
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-red-600 flex items-center justify-center lg:hidden">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex flex-col items-center justify-center text-white h-full w-full"
          >
            <Trash2 className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Delete</span>
          </button>
        </div>

        {/* Main card content - white card, expired: left red accent; expiring: check button */}
        <div
          ref={cardRef}
          {...bind()}
          className={`flex items-center gap-3 p-3 rounded-lg ${cardBase} ${leftAccent} relative group touch-pan-y lg:touch-auto transition-transform shadow-sm`}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 || Math.abs(swipeOffset) === 100 ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {earliestBatch?.batchNumber ? `Batch #${earliestBatch.batchNumber}` : 'Batch'}
              {' · '}
              Qty: {earliestBatch?.quantity ?? '—'}
              {isExpired && ` · Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago`}
            </p>
          </div>

          {/* Expiring: urgency label on right + green check button */}
          {!isExpired && (
            <>
              <span className={`text-sm font-medium shrink-0 ${urgencyTextColor}`}>
                {daysUntil === 0 ? 'Today' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
              </span>
              <button
                onClick={() => {
                  setIsUpdating(true);
                  setShowQuantityModal(true);
                }}
                disabled={isUpdating}
                className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Update quantity / mark handled"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} />
                )}
              </button>
            </>
          )}

          {/* Expired: trash button only (desktop always visible to match mockup) */}
          {isExpired && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-red-600 transition-colors shrink-0"
              title="Remove"
              disabled={deleteProduct.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

        </div>
      </div>

      {/* Quantity Update Modal */}
      <QuantityUpdateModal
        product={product}
        userId={userId}
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false);
          setIsUpdating(false);
        }}
        onUpdate={() => {
          setIsUpdating(false);
          onProductDeleted();
        }}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Delete
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {isLastBatch ? (
                <>
                  This is the last batch. Deleting it will remove the entire product{' '}
                  <span className="font-medium">&quot;{product.name}&quot;</span>.
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete the {earliestBatch?.batchNumber ? `batch "${earliestBatch.batchNumber}"` : 'earliest batch'}{' '}
                  from <span className="font-medium">&quot;{product.name}&quot;</span>?
                  {earliestExpiryDate && (
                    <> (expires {formatDate(earliestExpiryDate)})</>
                  )}
                  {' '}This action cannot be undone.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteProduct.isPending || deleteBatch.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteProduct.isPending || deleteBatch.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteProduct.isPending || deleteBatch.isPending}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
