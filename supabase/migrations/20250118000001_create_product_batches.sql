-- ============================================================
-- Migration: Create product_batches table
-- Purpose: Enable multiple expiry dates and batch numbers per product
-- Architecture: 1:many relationship (product -> batches)
-- ============================================================

-- Create product_batches table
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  batch_number TEXT,
  expiry_date DATE NOT NULL,
  quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
  added_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries by product_id
CREATE INDEX idx_product_batches_product_id ON public.product_batches(product_id);

-- Create index for expiry date queries (for alerts)
CREATE INDEX idx_product_batches_expiry_date ON public.product_batches(expiry_date);

-- Enable RLS on product_batches
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_batches (inherit from parent product)
-- Users can only see batches for their own products
CREATE POLICY "Users can view their own product batches"
  ON public.product_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert batches for their own products"
  ON public.product_batches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own product batches"
  ON public.product_batches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own product batches"
  ON public.product_batches
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_batches.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all product batches"
  ON public.product_batches
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Remove batch-specific columns from products table
-- These will now be tracked in product_batches
ALTER TABLE public.products DROP COLUMN IF EXISTS expiry_date;
ALTER TABLE public.products DROP COLUMN IF EXISTS quantity;
ALTER TABLE public.products DROP COLUMN IF EXISTS batch_number;

-- Add comment for documentation
COMMENT ON TABLE public.product_batches IS 'Tracks individual batches for products with their own expiry dates and quantities';
COMMENT ON COLUMN public.product_batches.product_id IS 'Foreign key to products table - links batch to product';
COMMENT ON COLUMN public.product_batches.batch_number IS 'Optional batch/lot number for tracking';
COMMENT ON COLUMN public.product_batches.expiry_date IS 'Expiration date for this specific batch';
COMMENT ON COLUMN public.product_batches.quantity IS 'Quantity for this batch (nullable)';
