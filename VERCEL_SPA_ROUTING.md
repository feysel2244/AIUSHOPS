# Vercel SPA routing

This project uses React Router with `BrowserRouter`. The `vercel.json` rewrite sends direct requests for client-side routes back to `index.html`, so refreshing any route works instead of returning Vercel's `404: NOT_FOUND`.

Examples:
- `/browse`
- `/shop/<slug>`
- `/product/<slug>`
- `/service/<slug>`
- `/cart`
- `/orders`
- `/account`
- `/wishlist`
- `/become-seller`
- `/seller/dashboard`
- `/admin`
- `/notifications`
- `/payment-complete`
- `/about`
- `/contact`
- `/terms`
- `/privacy`
- `/how-it-works`
- `/resources`

Keep `vercel.json` in the same directory as `package.json` and set that directory as the Vercel Root Directory.
