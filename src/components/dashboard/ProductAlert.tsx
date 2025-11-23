'use client';

import { useState, useRef, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import type { Product } from '~/types';
import { formatDate, getDaysUntilExpiry } from '~/utils/dateUtils';
import { AlertTriangle, XCircle, Trash2, RefreshCw, Pencil } from 'lucide-react';
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

  const daysUntil = getDaysUntilExpiry(product.expiryDate);

  const isExpired = type === 'expired';
  const Icon = isExpired ? XCircle : AlertTriangle;
  const bgColor = isExpired ? 'bg-red-50' : 'bg-amber-50';
  const textColor = isExpired ? 'text-red-600' : 'text-amber-600';
  const borderColor = isExpired ? 'border-red-100' : 'border-amber-100';

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
    deleteProduct.mutate({
      productId: product.id,
      userId,
    });
    setShowDeleteConfirm(false);
  };

  return (
    <>
      {/* Mobile & Tablet: Swipeable Card */}
      <div ref={containerRef} className="relative overflow-hidden lg:overflow-visible rounded-lg">
        {/* Edit button revealed on swipe right (mobile & tablet only) */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-amber-500 flex items-center justify-center lg:hidden">
          <button
            onClick={() => setShowQuantityModal(true)}
            className="flex flex-col items-center justify-center text-white h-full w-full"
          >
            <Pencil className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Update</span>
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

        {/* Main card content */}
        <div
          ref={cardRef}
          {...bind()}
          className={`flex items-start gap-3 p-3 rounded-lg ${bgColor} border ${borderColor} relative group touch-pan-y lg:touch-auto transition-transform`}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 || Math.abs(swipeOffset) === 100 ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${textColor}`} />

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{product.name}</p>
            <p className="text-sm text-gray-600">
              {isExpired
                ? `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago`
                : `Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}
              {' '}
              ({formatDate(product.expiryDate)})
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {product.category} • Qty: {product.quantity ?? 'N/A'}
              {product.batchNumber && ` • Batch: ${product.batchNumber}`}
            </p>
          </div>

          {/* Desktop: Action Buttons (visible on hover) */}
          <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Update Quantity Button */}
            <button
              onClick={() => setShowQuantityModal(true)}
              className="p-2 rounded-lg hover:bg-white/80 transition-colors text-gray-600 hover:text-[#10B981]"
              title="Update quantity"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* Remove Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg hover:bg-white/80 transition-colors text-gray-600 hover:text-red-600"
              title="Remove"
              disabled={deleteProduct.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Quantity Update Modal */}
      <QuantityUpdateModal
        product={product}
        userId={userId}
        isOpen={showQuantityModal}
        onClose={() => setShowQuantityModal(false)}
        onUpdate={onProductDeleted}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Delete
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium">&quot;{product.name}&quot;</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteProduct.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteProduct.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteProduct.isPending}
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
