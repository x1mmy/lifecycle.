-- ============================================================================
-- Migration: Create categories table for user-managed product categories
-- This allows each business to manage their own categories
-- ============================================================================

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure unique category names per user
  UNIQUE (user_id, name)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_categories_user_id 
ON public.categories(user_id);

-- Create index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_categories_name 
ON public.categories(name);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
-- Users can view their own categories
CREATE POLICY "Users can view their own categories"
  ON public.categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own categories
CREATE POLICY "Users can insert their own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own categories
CREATE POLICY "Users can update their own categories"
  ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own categories
CREATE POLICY "Users can delete their own categories"
  ON public.categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all categories
CREATE POLICY "Admins can view all categories"
  ON public.categories
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add comment explaining table purpose
COMMENT ON TABLE public.categories IS
'User-managed product categories. Each business can create, edit, and delete their own categories.';

