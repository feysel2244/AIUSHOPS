-- One buyer can review each product once and each service once.
-- Shop-wide review limits are no longer used for listing reviews.

-- Keep the newest review when old data contains duplicates, so the unique indexes can be created safely.
delete from public.reviews r
using public.reviews newer
where r.author_id = newer.author_id
  and r.id <> newer.id
  and r.created_at < newer.created_at
  and r.product_id is not null
  and r.product_id = newer.product_id;

delete from public.reviews r
using public.reviews newer
where r.author_id = newer.author_id
  and r.id <> newer.id
  and r.created_at < newer.created_at
  and r.service_id is not null
  and r.service_id = newer.service_id;

drop trigger if exists reviews_limit_per_shop on public.reviews;

create unique index if not exists reviews_one_product_per_buyer
on public.reviews (author_id, product_id)
where product_id is not null;

create unique index if not exists reviews_one_service_per_buyer
on public.reviews (author_id, service_id)
where service_id is not null;

create or replace function public.prevent_duplicate_listing_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null and exists (
    select 1 from public.reviews
    where author_id = new.author_id
      and product_id = new.product_id
      and id <> new.id
  ) then
    raise exception 'You have already reviewed this product.';
  end if;

  if new.service_id is not null and exists (
    select 1 from public.reviews
    where author_id = new.author_id
      and service_id = new.service_id
      and id <> new.id
  ) then
    raise exception 'You have already reviewed this service.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_limit_per_listing on public.reviews;
create trigger reviews_limit_per_listing
before insert or update of author_id, product_id, service_id
on public.reviews
for each row execute function public.prevent_duplicate_listing_review();
