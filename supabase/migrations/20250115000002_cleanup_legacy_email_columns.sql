-- Clean up legacy email notification columns
-- This migration removes the redundant columns after the two-tier refactoring is complete
-- 
-- IMPORTANT: Only run this after confirming all code has been updated to use daily_expiry_alerts_enabled
-- and no longer references email_alerts or daily_summary

-- Remove the legacy columns that are no longer needed
ALTER TABLE public.settings DROP COLUMN IF EXISTS email_alerts;
ALTER TABLE public.settings DROP COLUMN IF EXISTS daily_summary;

-- Add comment to document the cleanup
COMMENT ON TABLE public.settings IS 'User notification preferences for the two-tier email system: daily_expiry_alerts_enabled (daily operational emails) and weekly_report (weekly strategic reports).';
