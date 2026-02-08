/**
 * Batch Helper Utilities
 * Helper functions for working with products that have multiple batches
 */

import type { Product, ProductBatch } from '~/types';
import { getDaysUntilExpiry } from '~/utils/dateUtils';

/**
 * Get the earliest expiring batch for a product
 */
export function getEarliestBatch(product: Product): ProductBatch | undefined {
  if (!product.batches || product.batches.length === 0) {
    return undefined;
  }

  return product.batches.reduce((earliest, batch) => {
    const earliestDate = new Date(earliest.expiryDate);
    const batchDate = new Date(batch.expiryDate);
    return batchDate < earliestDate ? batch : earliest;
  });
}

/**
 * Get the earliest expiry date for a product
 */
export function getEarliestExpiryDate(product: Product): string | undefined {
  const batch = getEarliestBatch(product);
  return batch?.expiryDate;
}

/**
 * Get the earliest batch that is in the expiring window (0 <= daysUntil <= threshold).
 * Used for Urgent Attention so we show the batch expiring soon, not an already-expired batch.
 */
export function getEarliestExpiringBatch(
  product: Product,
  daysThreshold = 7,
): ProductBatch | undefined {
  if (!product.batches || product.batches.length === 0) {
    return undefined;
  }

  const expiringBatches = product.batches.filter(batch => {
    const daysUntil = getDaysUntilExpiry(batch.expiryDate);
    return daysUntil >= 0 && daysUntil <= daysThreshold;
  });

  if (expiringBatches.length === 0) return undefined;

  return expiringBatches.reduce((earliest, batch) => {
    const earliestDate = new Date(earliest.expiryDate);
    const batchDate = new Date(batch.expiryDate);
    return batchDate < earliestDate ? batch : earliest;
  });
}

/**
 * Get total quantity across all batches
 */
export function getTotalQuantity(product: Product): number {
  if (!product.batches || product.batches.length === 0) {
    return 0;
  }

  return product.batches.reduce((total, batch) => {
    return total + (batch.quantity ?? 0);
  }, 0);
}

/**
 * Get all batches across all products (flattened)
 */
export function getAllBatches(products: Product[]): Array<ProductBatch & { productName: string; productCategory: string }> {
  return products.flatMap(product =>
    (product.batches ?? []).map(batch => ({
      ...batch,
      productName: product.name,
      productCategory: product.category,
    }))
  );
}

/**
 * Check if product has any expired batches.
 * Uses date-only comparison: expired = strictly in the past (not today).
 * Items expiring today (daysUntil === 0) are treated as expiring, not expired.
 */
export function hasExpiredBatches(product: Product): boolean {
  if (!product.batches || product.batches.length === 0) {
    return false;
  }

  return product.batches.some(batch => getDaysUntilExpiry(batch.expiryDate) < 0);
}

/**
 * Check if product has any expiring batches (within days threshold).
 * Includes "expiring today" (daysUntil === 0) in Urgent Attention, not Expired.
 */
export function hasExpiringBatches(product: Product, daysThreshold = 7): boolean {
  if (!product.batches || product.batches.length === 0) {
    return false;
  }

  return product.batches.some(batch => {
    const daysUntil = getDaysUntilExpiry(batch.expiryDate);
    return daysUntil >= 0 && daysUntil <= daysThreshold;
  });
}

/**
 * Get count of expired batches for a product (date-only: expired = strictly before today).
 */
export function getExpiredBatchCount(product: Product): number {
  if (!product.batches || product.batches.length === 0) {
    return 0;
  }

  return product.batches.filter(batch => getDaysUntilExpiry(batch.expiryDate) < 0).length;
}

/**
 * Get count of expiring batches for a product (includes today).
 */
export function getExpiringBatchCount(product: Product, daysThreshold = 7): number {
  if (!product.batches || product.batches.length === 0) {
    return 0;
  }

  return product.batches.filter(batch => {
    const daysUntil = getDaysUntilExpiry(batch.expiryDate);
    return daysUntil >= 0 && daysUntil <= daysThreshold;
  }).length;
}
