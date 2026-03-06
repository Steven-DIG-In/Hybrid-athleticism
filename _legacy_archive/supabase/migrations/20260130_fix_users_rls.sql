-- Fix RLS policies for users table to allow signup
-- This adds the missing INSERT policy that allows users to create their own profile during signup

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS users_insert_own ON users;
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;

-- Allow users to INSERT their own profile during signup
-- The auth_id must match the authenticated user's ID
CREATE POLICY users_insert_own ON users
  FOR INSERT 
  WITH CHECK (auth_id = auth.uid());

-- Allow users to SELECT their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT 
  USING (auth_id = auth.uid());

-- Allow users to UPDATE their own profile (for onboarding, etc.)
CREATE POLICY users_update_own ON users
  FOR UPDATE 
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
