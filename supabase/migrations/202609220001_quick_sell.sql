-- ─── Quick Sell: casual one-off student listings ────────────────────────────
-- Any authenticated student can post up to 5 items without a shop.
-- Buyers purchase through the normal cart + checkout for commission tracking.

CREATE TABLE IF NOT EXISTS public.quick_listings (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  condition       TEXT          NOT NULL DEFAULT 'good'
                                CHECK (condition IN ('new','like_new','good','fair')),
  category        TEXT          NOT NULL,
  images          TEXT[]        NOT NULL DEFAULT '{}',
  pickup_location TEXT          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','sold','expired','removed')),
  expires_at      TIMESTAMPTZ   NOT NULL DEFAULT now() + INTERVAL '30 days',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Join-friendly view so callers can get seller name/year/whatsapp
-- (profiles table already exists in the project)

-- Indexes
CREATE INDEX IF NOT EXISTS quick_listings_seller_idx  ON public.quick_listings(seller_id);
CREATE INDEX IF NOT EXISTS quick_listings_status_idx  ON public.quick_listings(status);
CREATE INDEX IF NOT EXISTS quick_listings_category_idx ON public.quick_listings(category);

-- RLS
ALTER TABLE public.quick_listings ENABLE ROW LEVEL SECURITY;

-- Public: read active, non-expired listings
CREATE POLICY "Public can view active quick listings"
  ON public.quick_listings FOR SELECT
  USING (status = 'active' AND expires_at > now());

-- Admins: read all
CREATE POLICY "Admins can view all quick listings"
  ON public.quick_listings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Authenticated: insert own rows (max-5 enforced in app layer)
CREATE POLICY "Auth users can create quick listings"
  ON public.quick_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Owners: update own rows
CREATE POLICY "Sellers can update own quick listings"
  ON public.quick_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Owners: delete own rows
CREATE POLICY "Sellers can delete own quick listings"
  ON public.quick_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- ─── Orders: add optional link to a quick listing ────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quick_listing_id UUID
    REFERENCES public.quick_listings(id) ON DELETE SET NULL;
