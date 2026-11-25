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
- `NEXT_PUBLIC_TURN_URL` — valfri TURN-adress, flera separerade med komma. Behövs när en strikt brandvägg blockerar ljudet. Stun `stun:stun.l.google.com:19302` används alltid
- `NEXT_PUBLIC_TURN_USERNAME` och `NEXT_PUBLIC_TURN_CREDENTIAL` — valfria. De syns i den publicerade sidan, så använd kortlivade uppgifter från Twilio, Metered eller Cloudflare

## Samtal

Samtal i appen går direkt mellan kunden och utföraren. Signaleringen ligger i Firestore (`calls`). En missad ringsignal blir ett kort i chatten efter 30 sekunder.

`/samtal/` är en demo utan konto. Öppna samma rum som kund och som utförare, i två flikar eller på två enheter, och tryck på telefonen. Rumkoden står på sidan.

Maskerade telefonnummer är av tills Twilio är ifyllt. Då visas Ring via telefon. Sätt på Vercel, och deploya om `stripe-api`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PROXY_SERVICE_SID` — Proxy, om ni använder det
- `TWILIO_PROXY_NUMBER` eller `TWILIO_PROXY_NUMBERS` — ett eller flera nummer, kommaseparerade, för röstbryggan
- `TWILIO_WEBHOOK_URL` — exakt `https://<projekt>.vercel.app/api/calls/twiml`

Peka numrets röst-webhook till den adressen. Inget Twilio-konto skapas härifrån.

## Fakturor

När en betalning lyckas skriver API:t en faktura i `invoices/{paymentIntentId}` med löpnummer `VELIO-ÅÅÅÅ-000123`. Saknas uppgifter är den ett utkast, inte en färdig faktura. Personnummer sparas inte på fakturan. RUT är av.

PDF: `GET /api/invoices/{id}/pdf` med Firebase-token. Bara köparen, utföraren eller en admin (custom claim `admin` eller dokumentet `admins/{uid}`).

E-post skickas bara om `RESEND_API_KEY` och `RESEND_FROM` finns. Annars hoppas den över.

Miljövariabler på Vercel:

- `VELIO_COMPANY_NAME`
- `VELIO_ORG_NR`
- `VELIO_VAT_NR`
- `VELIO_ADDRESS`
- `VELIO_EMAIL`
- `VELIO_F_SKATT` — `true` eller `false`
- `VELIO_VAT_REGISTERED` — `true` eller `false`. Saknas värdet blir fakturan ett utkast
- `VELIO_VAT_RATE` — valfritt, standard 25 när VELIO är momsregistrerat
- `RESEND_API_KEY` och `RESEND_FROM` — valfritt

Deploya `firestore.rules` innan fakturorna ska gå att läsa i appen.

## Admin

`/admin/` är skrivbordet. Utan behörighet syns bara Ingen behörighet. Demo läget är märkt Demo och innehåller inga riktiga personer.

Gör ett konto till admin genom att skapa dokumentet `admins/{uid}` i Firestore. Uid finns under Authentication för `velvetfasion@gmail.com`. Alternativt, från en maskin med tjänstekontot: `getAuth().setCustomUserClaims(uid, { admin: true })` och logga in igen så att token förnyas. API:t godkänner båda.

Se även `stripe-api/.env.example`.
