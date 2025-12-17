-- ============================================================
-- Migration: Migrate existing product data to batches
-- Purpose: Convert existing products to new batch architecture
-- Each existing product becomes a product + one batch
-- ============================================================

-- Step 1: For each existing product, create a corresponding batch
-- This preserves all existing expiry dates and batch numbers
INSERT INTO public.product_batches (product_id, batch_number, expiry_date, quantity, added_date)
SELECT
  id as product_id,
  batch_number,
  expiry_date,
  quantity,
  added_date
FROM public.products
WHERE expiry_date IS NOT NULL;

-- Note: The DROP COLUMN statements in the previous migration will be executed
-- after this data migration, ensuring no data loss
