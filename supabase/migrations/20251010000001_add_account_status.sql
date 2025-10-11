-- Add is_active column to profiles table
ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Add RLS policy allowing admins to update account status
CREATE POLICY "Admins can update user status"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_active IS 'Indicates whether the user account is active. Admins can deactivate accounts to prevent login.';

