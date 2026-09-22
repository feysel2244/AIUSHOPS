
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE (category text, count bigint)
LANGUAGE sql
AS $func
  SELECT category, count(*)
  FROM (
    SELECT category FROM public.products WHERE status = 'approved' AND deleted_at IS NULL
    UNION ALL
    SELECT category FROM public.services WHERE status = 'approved' AND deleted_at IS NULL
    UNION ALL
    SELECT category FROM public.quick_listings WHERE status = 'active' AND expires_at > now()
  ) all_items
  GROUP BY category;
$func;

