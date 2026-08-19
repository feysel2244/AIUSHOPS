-- Keep shop/listing rating totals correct and limit each user to two reviews per shop.
-- Ratings are stored as 0-5 averages, not totals.

alter table public.products add column if not exists rating numeric default 0;
alter table public.products add column if not exists review_count integer default 0;
alter table public.services add column if not exists rating numeric default 0;
alter table public.services add column if not exists review_count integer default 0;

-- Normalize any older 10-point review values into the app's 5-star scale.
update public.reviews
set rating = round((rating / 2)::numeric, 1)
where rating > 5 and rating <= 10;

update public.reviews
set rating = 5
where rating > 5;

update public.reviews
set rating = 1
where rating < 1;

alter table public.reviews drop constraint if exists reviews_rating_between_1_and_5;
alter table public.reviews
  add constraint reviews_rating_between_1_and_5
  check (rating between 1 and 5);

create or replace function public.update_shop_rating_from_reviews(target_shop_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shops
  set
    rating = coalesce((
      select round(avg(least(greatest(rating, 1), 5))::numeric, 1)
      from public.reviews
      where shop_id = target_shop_id
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where shop_id = target_shop_id
    )
  where id = target_shop_id;
$$;

grant execute on function public.update_shop_rating_from_reviews(uuid) to authenticated;

create or replace function public.update_product_rating_from_reviews(target_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products
  set
    rating = coalesce((
      select round(avg(least(greatest(rating, 1), 5))::numeric, 1)
      from public.reviews
      where product_id = target_product_id
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where product_id = target_product_id
    )
  where id = target_product_id;
$$;

grant execute on function public.update_product_rating_from_reviews(uuid) to authenticated;

create or replace function public.update_service_rating_from_reviews(target_service_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.services
  set
    rating = coalesce((
      select round(avg(least(greatest(rating, 1), 5))::numeric, 1)
      from public.reviews
      where service_id = target_service_id
    ), 0),
    review_count = (
      select count(*)
      from public.reviews
      where service_id = target_service_id
    )
  where id = target_service_id;
$$;

grant execute on function public.update_service_rating_from_reviews(uuid) to authenticated;

create or replace function public.prevent_more_than_two_shop_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.reviews
    where author_id = new.author_id
      and shop_id = new.shop_id
      and id <> new.id
  ) >= 2 then
    raise exception 'You can only leave 2 reviews for the same shop.';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_limit_per_shop on public.reviews;
create trigger reviews_limit_per_shop
before insert or update of author_id, shop_id on public.reviews
for each row execute function public.prevent_more_than_two_shop_reviews();

create or replace function public.refresh_shop_rating_after_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.shop_id is not null then
      perform public.update_shop_rating_from_reviews(old.shop_id);
    end if;
    if old.product_id is not null then
      perform public.update_product_rating_from_reviews(old.product_id);
    end if;
    if old.service_id is not null then
      perform public.update_service_rating_from_reviews(old.service_id);
    end if;
    return old;
  end if;

  if new.shop_id is not null then
    perform public.update_shop_rating_from_reviews(new.shop_id);
  end if;
  if new.product_id is not null then
    perform public.update_product_rating_from_reviews(new.product_id);
  end if;
  if new.service_id is not null then
    perform public.update_service_rating_from_reviews(new.service_id);
  end if;

  if tg_op = 'UPDATE' and old.shop_id is distinct from new.shop_id and old.shop_id is not null then
    perform public.update_shop_rating_from_reviews(old.shop_id);
  end if;
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id and old.product_id is not null then
    perform public.update_product_rating_from_reviews(old.product_id);
  end if;
  if tg_op = 'UPDATE' and old.service_id is distinct from new.service_id and old.service_id is not null then
    perform public.update_service_rating_from_reviews(old.service_id);
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_refresh_shop_rating on public.reviews;
create trigger reviews_refresh_shop_rating
after insert or update or delete on public.reviews
for each row execute function public.refresh_shop_rating_after_review();

-- Repair existing shops once, so old reviews stop showing an overall rating of 0.
update public.shops s
set
  rating = coalesce(r.avg_rating, 0),
  review_count = coalesce(r.review_count, 0)
from (
  select shop_id, round(avg(least(greatest(rating, 1), 5))::numeric, 1) as avg_rating, count(*) as review_count
  from public.reviews
  group by shop_id
) r
where s.id = r.shop_id;

update public.shops s
set rating = 0, review_count = 0
where not exists (
  select 1
  from public.reviews r
  where r.shop_id = s.id
);

-- Repair existing product ratings. A review only counts for the product it references.
update public.products p
set
  rating = coalesce(r.avg_rating, 0),
  review_count = coalesce(r.review_count, 0)
from (
  select product_id, round(avg(least(greatest(rating, 1), 5))::numeric, 1) as avg_rating, count(*) as review_count
  from public.reviews
  where product_id is not null
  group by product_id
) r
where p.id = r.product_id;

update public.products p
set rating = 0, review_count = 0
where not exists (
  select 1
  from public.reviews r
  where r.product_id = p.id
);

-- Repair existing service ratings. A review only counts for the service it references.
update public.services s
set
  rating = coalesce(r.avg_rating, 0),
  review_count = coalesce(r.review_count, 0)
from (
  select service_id, round(avg(least(greatest(rating, 1), 5))::numeric, 1) as avg_rating, count(*) as review_count
  from public.reviews
  where service_id is not null
  group by service_id
) r
where s.id = r.service_id;

update public.services s
set rating = 0, review_count = 0
where not exists (
  select 1
  from public.reviews r
  where r.service_id = s.id
);
