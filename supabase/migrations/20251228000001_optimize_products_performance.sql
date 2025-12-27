-- ============================================================
-- Migration: Optimize products.getAll performance
-- Purpose: Add indexes to reduce query time to under 400ms
-- ============================================================

-- Create composite index on products table for user queries
-- This speeds up the "WHERE user_id = X ORDER BY name" query significantly
CREATE INDEX IF NOT EXISTS idx_products_user_id_name
  ON public.products(user_id, name);

-- Create composite index on product_batches for JOIN operations
-- This speeds up the JOIN between products and batches
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id_expiry
  ON public.product_batches(product_id, expiry_date);

-- Add statistics collection for better query planning
ANALYZE public.products;
ANALYZE public.product_batches;

-- Add comments for documentation
COMMENT ON INDEX idx_products_user_id_name IS 'Optimizes product retrieval by user with name sorting';
COMMENT ON INDEX idx_product_batches_product_id_expiry IS 'Optimizes batch JOIN and expiry date sorting';
