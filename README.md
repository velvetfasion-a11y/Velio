# VELIO

Boka elektriker, städning, trädgård och andra hemtjänster nära dig i Stockholm.

## Auth & database

- **Inloggning:** Cursor-identitet (riktig session när appen publiceras som privat/team). Lokalt används en simulerad användare.
- **Databas:** Postgres via Cursor (`DATABASE_URL`), typiskt Neon i produktion. Lokalt används PGlite i minnet.

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
