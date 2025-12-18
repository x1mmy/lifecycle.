-- ============================================================
-- ROLLBACK Migration (Use only if you need to temporarily revert)
-- This adds back the old columns to the products table
-- WARNING: This will lose any new batch data created after the migration
-- ============================================================

-- Add back the old columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batch_number TEXT;

-- Copy data from first batch back to product (if batches exist)
UPDATE public.products p
SET
  expiry_date = (
    SELECT expiry_date
    FROM public.product_batches
    WHERE product_id = p.id
    ORDER BY expiry_date ASC
    LIMIT 1
  ),
  quantity = (
    SELECT quantity
    FROM public.product_batches
    WHERE product_id = p.id
    ORDER BY expiry_date ASC
    LIMIT 1
  ),
  batch_number = (
    SELECT batch_number
    FROM public.product_batches
    WHERE product_id = p.id
    ORDER BY expiry_date ASC
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM public.product_batches WHERE product_id = p.id
);

-- Add back the NOT NULL constraint on expiry_date
ALTER TABLE public.products ALTER COLUMN expiry_date SET NOT NULL;

-- Optionally drop the product_batches table
-- DROP TABLE IF EXISTS public.product_batches CASCADE;
