-- Quick Sell orders don't have a real product_id.
-- Make the column nullable so order_items can be inserted without one.
ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;
