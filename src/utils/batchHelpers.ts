/**
 * Batch Helper Utilities
 * Helper functions for working with products that have multiple batches
 */

import type { Product, ProductBatch } from '~/types';

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
 * Check if product has any expired batches
 */
export function hasExpiredBatches(product: Product): boolean {
  if (!product.batches || product.batches.length === 0) {
    return false;
  }

  const today = new Date();
  return product.batches.some(batch => new Date(batch.expiryDate) < today);
}

/**
 * Check if product has any expiring batches (within days threshold)
 */
export function hasExpiringBatches(product: Product, daysThreshold = 7): boolean {
  if (!product.batches || product.batches.length === 0) {
    return false;
  }

  const today = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return product.batches.some(batch => {
    const expiryDate = new Date(batch.expiryDate);
    return expiryDate >= today && expiryDate <= thresholdDate;
  });
}

/**
 * Get count of expired batches for a product
 */
export function getExpiredBatchCount(product: Product): number {
  if (!product.batches || product.batches.length === 0) {
    return 0;
  }

  const today = new Date();
  return product.batches.filter(batch => new Date(batch.expiryDate) < today).length;
}

/**
 * Get count of expiring batches for a product
 */
export function getExpiringBatchCount(product: Product, daysThreshold = 7): number {
  if (!product.batches || product.batches.length === 0) {
    return 0;
  }

  const today = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return product.batches.filter(batch => {
    const expiryDate = new Date(batch.expiryDate);
    return expiryDate >= today && expiryDate <= thresholdDate;
  }).length;
}
