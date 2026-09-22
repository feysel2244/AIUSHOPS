-- Add payment fields to profiles so Quick Sell sellers can receive payments
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_qr_url    TEXT,
  ADD COLUMN IF NOT EXISTS bank_name         TEXT,
  ADD COLUMN IF NOT EXISTS account_name      TEXT,
  ADD COLUMN IF NOT EXISTS account_number    TEXT;
