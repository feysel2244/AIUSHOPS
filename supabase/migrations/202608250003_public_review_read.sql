-- Fix: Customer Reviews rating percentages showing 0% on the public shop page.
-- The shop's review_count/rating are stored on shops, but the public client
-- could not read rows from public.reviews. This makes the review distribution
-- query return zero rows, so every percentage becomes 0%.

alter table public.reviews enable row level security;

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews"
on public.reviews
for select
to anon, authenticated
using (true);
