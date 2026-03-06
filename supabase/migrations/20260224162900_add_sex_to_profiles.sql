-- Add 'sex' column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex text;
