-- Run this in your Supabase SQL Editor to remove the old constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
