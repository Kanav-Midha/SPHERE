/*
  # Fix infinite recursion in profiles RLS

  ## Problem
  The "Admins can view all profiles" policy queries the profiles table
  inside a policy on the profiles table, causing infinite recursion.

  ## Fix
  Drop the recursive admin policy. Use a security-definer function
  to check role without triggering RLS recursion.
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );
