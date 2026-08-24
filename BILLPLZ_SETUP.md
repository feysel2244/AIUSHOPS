# Billplz Payment Setup

This app uses Supabase Edge Functions so Billplz secrets never reach browser code.

## Billplz Dashboard

1. Sign up at Billplz and use the sandbox first: `https://www.billplz-sandbox.com`.
2. Create a Collection in the Billplz dashboard and copy the Collection ID.
3. Copy the API Secret Key from Billplz account settings.
4. Copy the X Signature key. The webhook uses this to verify Billplz callbacks.

## Supabase Setup

Run the migration in `supabase/migrations/202608150001_billplz_payments.sql`, then deploy both functions:

```bash
supabase functions deploy create-payment
supabase functions deploy payment-webhook --no-verify-jwt
```

Set these Edge Function secrets in Supabase:

```bash
supabase secrets set BILLPLZ_API_KEY=...
supabase secrets set BILLPLZ_COLLECTION_ID=...
supabase secrets set BILLPLZ_X_SIGNATURE_KEY=...
supabase secrets set BILLPLZ_BASE_URL=https://www.billplz-sandbox.com/api/v3
supabase secrets set SITE_URL=https://your-frontend-url
```

Use `https://www.billplz.com/api/v3` for `BILLPLZ_BASE_URL` only after sandbox testing.

## Security Notes

- Do not put Billplz secrets in `.env.local` or frontend code.
- Frontend pages only create unpaid orders and redirect to Billplz.
- Only `payment-webhook` marks payments as paid, after verifying Billplz `x_signature`.
- The `/payment-complete` page only polls and displays status. It does not update payment state.
