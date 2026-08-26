-- Run this in your Supabase SQL Editor to remove the old constraint
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_availability_check;
