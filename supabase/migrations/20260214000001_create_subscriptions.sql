-- ============================================================================
-- Migration: Create subscription tables and update barcode_cache for tiered access
-- ============================================================================

-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'starter', 'professional');

-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM (
  'active', 'past_due', 'canceled', 'incomplete',
  'incomplete_expired', 'trialing', 'unpaid', 'paused'
);

-- ============================================================================
-- Subscriptions table
-- ============================================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Daily scan counts table (stateless serverless tracking)
-- ============================================================================
CREATE TABLE public.daily_scan_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, scan_date)
);

CREATE INDEX idx_daily_scan_counts_lookup ON public.daily_scan_counts(user_id, scan_date);

-- Enable RLS
ALTER TABLE public.daily_scan_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scan counts"
  ON public.daily_scan_counts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all scan counts"
  ON public.daily_scan_counts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Add community DB columns to barcode_cache
-- ============================================================================
ALTER TABLE public.barcode_cache
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_score INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- Update handle_new_user() to auto-create free subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, business_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'business_name', 'Business'),
    new.email
  );

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');

  -- Create default settings
  INSERT INTO public.settings (user_id)
  VALUES (new.id);

  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (new.id, 'free', 'active');

  RETURN new;
END;
$$;

-- ============================================================================
-- Backfill existing users with free subscriptions
-- ============================================================================
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'free', 'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- RPC function to increment daily scan count (upsert + increment)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_scan_count(p_user_id UUID, p_scan_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.daily_scan_counts (user_id, scan_date, scan_count)
  VALUES (p_user_id, p_scan_date, 1)
  ON CONFLICT (user_id, scan_date)
  DO UPDATE SET scan_count = daily_scan_counts.scan_count + 1
  RETURNING scan_count INTO new_count;
  RETURN new_count;
END;
$$;

-- ============================================================================
-- Updated_at trigger for subscriptions
-- ============================================================================
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
