-- Refactor email notification system to two-tier model
-- This migration consolidates the email notification preferences from three to two types:
-- 1. Daily Expiry Alerts (combines email_alerts + daily_summary)
-- 2. Weekly Reports (keeps weekly_report as is)

-- Add new column for daily expiry alerts
ALTER TABLE public.settings ADD COLUMN daily_expiry_alerts_enabled BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing data: if user had either email_alerts OR daily_summary enabled, enable daily_expiry_alerts
UPDATE public.settings 
SET daily_expiry_alerts_enabled = (email_alerts = true OR daily_summary = true)
WHERE daily_expiry_alerts_enabled = true; -- Only update if it's still the default

-- Add comment for documentation
COMMENT ON COLUMN public.settings.daily_expiry_alerts_enabled IS 'Enables daily expiry alerts that combine the functionality of the previous email_alerts and daily_summary features. Daily operational email with products expiring within the user''s alert threshold.';

-- Add comment for weekly_report to clarify its purpose
COMMENT ON COLUMN public.settings.weekly_report IS 'Enables weekly strategic reports with analytics, trends, and comprehensive inventory statistics.';

-- Note: We keep the old columns for backward compatibility during the transition period
-- They will be removed in a future migration after all code has been updated
