-- Fix RLS policy on user_roles to allow users to view their own roles
-- This is necessary for users to check if they have admin role during login

-- Add policy allowing users to view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS 
  'Allows users to check their own role assignment. This is required for admin role detection during login and middleware checks.';

