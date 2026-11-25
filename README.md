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
