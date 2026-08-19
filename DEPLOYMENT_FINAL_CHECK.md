# AIU Market — final deployment checklist

## Vercel

- Root Directory: the folder containing `package.json` and `vercel.json`.
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Redeploy after adding/changing environment variables.
- `vercel.json` contains the SPA rewrite so refreshing any React route works.

## Supabase database migrations

Run all migrations in `supabase/migrations` in order. In particular:

- `202608180001_notifications_realtime.sql`
- `202608190001_editable_announcement.sql`
- `202608190002_seller_listing_delete.sql`

If `announcement_text` is missing, the editable announcement migration has not been applied.

## Supabase Auth — password reset

1. In Authentication → URL Configuration, keep the production site URL set to the deployed site.
2. Add the deployed site origin to Redirect URLs if it is not already present.
3. The app requests password-reset links with the deployed site origin as `redirectTo`.
4. The reset link opens a recovery session and the app shows the "Set a new password" screen instead of treating the recovery session as a normal login.
5. After a successful password change, the recovery session is signed out and the user is returned to the normal login screen. They must log in with the new password.
6. Supabase's default hosted SMTP is rate-limited. For production, configure a custom SMTP provider in Supabase Auth; otherwise password-reset emails can return `email rate limit exceeded` even when the app code is correct.

## Notifications

- The `notifications` table must be enabled for Realtime.
- The existing RLS policies allow users to read/update only their own notifications.
- The current client-side notification insert policy is intentionally permissive because the application creates notifications for other users. Review/move notification creation to trusted server-side functions before a public production launch.
- Notification sound is subject to browser autoplay rules; the app unlocks audio after the user's first interaction.

## Production test

After deployment, test:

1. Home → Browse → refresh.
2. Home → Terms → refresh.
3. Home → Resources → refresh.
4. Product/service detail → refresh.
5. Seller dashboard → refresh.
6. Notifications → refresh.
7. Forgot password → receive email → open link → set new password → return to login → log in with new password.
8. Buyer confirms an order → seller receives a realtime notification.
9. Admin enters an announcement → banner appears; clearing the text removes it.
10. Seller edits and removes their own listing.
