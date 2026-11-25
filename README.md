# VELIO

Boka elektriker, städning, trädgård och andra hemtjänster nära dig i Stockholm.

## Auth & database

- **Inloggning:** Google OAuth, e-post med engångskod, eller SMS. Business kräver BankID eller pass.
- **Databas:** Postgres (`DATABASE_URL`) i produktion. Lokalt används PGlite i minnet.

## Development

```bash
npm install
npm run dev
```

Appen körs på [http://localhost:8080](http://localhost:8080).

## Build

```bash
npm run build
npm start
```

## Betalningar

Betalningen sker i appen. Ingen värdsida och ingen redirect till en betalkassa. API:t ligger i `stripe-api/` och deployas som ett eget Vercel-projekt med Root Directory `stripe-api`. Sätt inte igång en live-nyckel.

Miljövariabler på Vercel:

- `STRIPE_SECRET_KEY` — begränsad testnyckel (`rk_test_...`) eller `sk_test_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` från webhooken mot `/api/webhooks/stripe`
- `FIREBASE_SERVICE_ACCOUNT` — tjänstekontots JSON på en rad
- `CRON_SECRET` — valfritt. Vercel anropar `/api/cron/release-payouts` varje timme med den som Bearer-token

Miljövariabler i GitHub Pages-bygget:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — `pk_test_...`. Saknas den visas testläget i appen
- `NEXT_PUBLIC_VELIO_API_BASE` — basadressen till Vercel-projektet, utan avslutande snedstreck

Se även `stripe-api/.env.example`.
