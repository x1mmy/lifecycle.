-- ============================================================================
-- Migration: Create barcode_cache table for shared product lookup
-- This is NON-BREAKING and does not modify existing tables or data
-- ============================================================================

-- Create barcode_cache table
CREATE TABLE IF NOT EXISTS public.barcode_cache (
  barcode TEXT PRIMARY KEY,                    -- Unique barcode (UPC/EAN/etc)
  name TEXT NOT NULL,                          -- Product name
  supplier TEXT,                               -- Manufacturer/brand
  category TEXT,                               -- Product category
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups by creation date
CREATE INDEX IF NOT EXISTS idx_barcode_cache_created
ON public.barcode_cache(created_at DESC);

-- Add comment explaining table purpose
COMMENT ON TABLE public.barcode_cache IS
'Shared barcode lookup cache. Stores one unique entry per barcode for auto-fill functionality. First business to scan a barcode populates the cache for all users.';

-- Optional: Row Level Security (RLS)
-- Cache is read by all users, written during product creation
ALTER TABLE public.barcode_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone (authenticated) can read cache
CREATE POLICY "Allow public read access to barcode cache"
ON public.barcode_cache
FOR SELECT
TO authenticated
USING (true);

-- Policy: Anyone (authenticated) can insert new barcodes
CREATE POLICY "Allow authenticated insert to barcode cache"
ON public.barcode_cache
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Prevent updates (first come first serve, immutable)
-- If you want to allow updates later, change this
CREATE POLICY "Prevent updates to barcode cache"
ON public.barcode_cache
FOR UPDATE
TO authenticated
USING (false);

-- ============================================================================
-- Optional: Populate cache from existing products with barcodes
-- This backfills the cache with products already in your database
-- Only runs if there are existing products with barcodes
-- ============================================================================

-- Insert unique barcodes from existing products into cache
-- Uses DISTINCT ON to get first occurrence of each barcode
INSERT INTO public.barcode_cache (barcode, name, supplier, category, created_at)
SELECT DISTINCT ON (barcode)
  barcode,
  name,
  supplier,
  category,
  added_date as created_at
FROM public.products
WHERE barcode IS NOT NULL
  AND barcode != ''
  AND name IS NOT NULL
ORDER BY barcode, added_date ASC  -- First (oldest) entry per barcode wins
ON CONFLICT (barcode) DO NOTHING;  -- Skip if already exists

-- ============================================================================
-- Performance optimization: Add index to products.barcode (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_barcode
ON public.products(barcode)
WHERE barcode IS NOT NULL;

-- ============================================================================
-- End of migration
-- ============================================================================
