# AIU Market — Final Fixes

This build includes the final marketplace fixes requested:

- Seller applications now save `shop_type` (Products / Services / Both) and do not overwrite `profiles.is_admin`.
- Admin seller approvals refresh automatically through Supabase Realtime, with a manual Refresh Applications button.
- Admin approval/rejection sends a notification to the applicant.
- Seller dashboard supports Product and Service listing creation, service-specific fields, editing and removal.
- Seller Settings includes Delete My Shop (soft-deactivates the shop and keeps transaction history).
- About, Contact, Resources, Terms of Use, and Privacy Policy now contain complete AIU Market-specific text.
- Pay-now checkout requires an uploaded payment proof image before “I've Paid” can be confirmed.
- Notification sound has a bundled-audio + Web Audio fallback and a Test sound button.
- Notification cards are constrained to the viewport on small screens.
- Soft-deleted shops/listings are filtered out of marketplace pages.

## Supabase migration

Run the new migration in Supabase SQL Editor:

`supabase/migrations/202608190003_final_marketplace_fixes.sql`

Run it after the existing migrations in the project.

## Environment

The Vercel deployment still needs:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

in the Vercel Project Settings → Environment Variables.

## Important browser audio note

Browsers block sound until the user has interacted with the page. The app now unlocks audio on the first pointer/touch/keyboard interaction. The Notifications page also has a Test sound button.
