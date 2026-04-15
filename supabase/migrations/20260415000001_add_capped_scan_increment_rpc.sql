-- ============================================================================
-- Migration: Add race-safe capped daily scan increment RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_scan_count_if_allowed(
  p_user_id UUID,
  p_scan_date DATE,
  p_max_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, scan_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
  existing_count INTEGER;
BEGIN
  IF p_max_limit <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Ensure daily row exists so we can safely run atomic conditional update.
  INSERT INTO public.daily_scan_counts (user_id, scan_date, scan_count)
  VALUES (p_user_id, p_scan_date, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  -- Atomic increment: succeeds only when still below limit.
  UPDATE public.daily_scan_counts
  SET scan_count = scan_count + 1
  WHERE user_id = p_user_id
    AND scan_date = p_scan_date
    AND scan_count < p_max_limit
  RETURNING daily_scan_counts.scan_count INTO updated_count;

  IF updated_count IS NOT NULL THEN
    RETURN QUERY SELECT true, updated_count;
    RETURN;
  END IF;

  -- Limit already reached; return current value without incrementing.
  SELECT dsc.scan_count
  INTO existing_count
  FROM public.daily_scan_counts dsc
  WHERE dsc.user_id = p_user_id
    AND dsc.scan_date = p_scan_date;

  RETURN QUERY SELECT false, COALESCE(existing_count, 0);
END;
$$;
