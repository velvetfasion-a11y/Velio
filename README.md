# VELIO

Boka elektriker, städning, trädgård och andra hemtjänster nära dig i Stockholm.

## Auth & database

- **Inloggning:** BankID och Freja eID via Idura (test), Google OAuth, e-post med engångskod, eller SMS. Business kräver BankID eller pass.
- **BankID-konton är BankID-only.** Ett konto som identifierats med BankID eller Freja eID kan inte också loggas in med e-post, SMS eller Google. Det är BankID-regeln mot ID-växling. Idura-inloggning slås inte ihop med ett befintligt e-post- eller Google-konto.
- **Databas:** Postgres (`DATABASE_URL`) i produktion. Lokalt används PGlite i minnet.

## Logga in med BankID (Idura test)

Idura (tidigare Criipto) är OpenID Connect-leverantören. Flödet är Authorization Code med PKCE på servern (`openid-client`). Klienthemligheten lämnar aldrig webbläsaren. `state`, `nonce` och `id_token` (signatur, utfärdare, mottagare, utgång) kontrolleras innan kontot skapas.

Appen lyssnar på **port 8080**, inte 3000. Callback är inte `/callback`.

Registrera exakt denna redirect URI i Idura (test):

```
http://localhost:8080/api/auth/idura/callback
```

Öppna appen på samma origin, `http://localhost:8080`. Om du i stället använder `http://127.0.0.1:8080` utan `APP_BASE_URL` måste den adressen registreras också:

```
http://127.0.0.1:8080/api/auth/idura/callback
```

Det finns ingen driftsatt server-URL i repot. GitHub Pages är en statisk export och kan inte ta emot Idura-callbacken. När Next-servern driftsätts, registrera `https://<värd>/api/auth/idura/callback` och sätt `APP_BASE_URL` till den originen.

`http://localhost:3000/callback` används inte.

### Miljövariabler

Kopiera `.env.example` till `.env` (committas inte):

| Variabel | Syfte |
| --- | --- |
| `IDURA_ISSUER` | `https://velio.test.idura.broker` |
| `IDURA_CLIENT_ID` | `urn:my:application:identifier:289054` |
| `IDURA_CLIENT_SECRET` | Klienthemligheten från Idura. Bara på servern. |
| `APP_BASE_URL` | `http://localhost:8080` lokalt. Bygger redirect URI. |
| `AUTH_SECRET` | Lång slumpsträng. Krypterar personnummer och signerar inloggningscookien. Måste vara stabil om databasen sparas. |

Tillåtna `acr_values` i testappen: BankID på samma enhet, BankID med QR på annan enhet, och Freja eID. Knapparna är **Logga in med BankID**, **BankID på annan enhet** och **Logga in med Freja eID**.

Personnummer (`ssn`) sparas krypterat. En nyckelhash används för att känna igen samma person. Värdet skickas inte till webbläsaren och skrivs inte i loggar.

### Testa med test-BankID

Iduras testmiljö tar inte emot ett skarpt BankID.

1. Sätt variablerna ovan och starta `npm run dev`.
2. Öppna `http://localhost:8080` och välj **Logga in med BankID** (samma enhet) eller **BankID på annan enhet** (QR).
3. Skapa ett test-BankID enligt [BankID for test](https://developers.bankid.com/test-portal/bankid-for-test). Testappen och den vanliga BankID-appen kan inte vara aktiva samtidigt på samma telefon — använd en annan enhet om du redan har BankID.
4. Godkänn förfrågan som Idura visar. Efter redirecten skapas kontot och sessionen sätts som en HttpOnly-cookie.
5. [BankID:s demo](https://demo.bankid.com) är BankID:s egen demosajt. Den loggar inte in i Velio. Den är bara till för att se hur test-BankID beter sig.

Freja eID använder samma callback och knappen **Logga in med Freja eID** i Iduras testmiljö.

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
