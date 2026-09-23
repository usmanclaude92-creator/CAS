# Construction Accounting System (CAS)

A construction accounting system with a web app and an Android app, both
backed by the same Supabase (Postgres) project. No mock or local-only data:
every read and write goes through the shared database, with the same
role-based access control and workflow rules enforced server-side via RLS
policies and `SECURITY DEFINER` RPCs.

## Layout

- **`/`** — the web application (React + Vite + TypeScript), plus its
  Express admin API server (`server.ts`). Deployed as the primary web app.
- **`/android`** — the Android app, a WebView wrapper around the same
  React app, packaged as a native APK via Gradle. Kept in its own
  subdirectory (with its own `package.json`, `src/`, etc.) so it can still
  be built and released independently.
- **`/supabase/migrations`** — the database schema shared by both apps.
  `/android/supabase/migrations` is kept in sync as a copy for reference;
  the migrations here are the ones actually applied to the live project.

## Shared backend

Both apps point at the same Supabase project via `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` in their respective `.env` files (see
`.env.example` at the root and in `android/`). Admin operations that need
the service-role key (creating users, approving demo requests) go through
the web app's Express server; the Android app calls those same endpoints
via `VITE_ADMIN_API_URL` rather than embedding the service-role key.

## Development

Each app is built and tested independently from its own directory:

```bash
# Web app
npm install
npm run lint
npm test
npm run build

# Android app
cd android
npm install
npm run lint
npm test
npx vite build --base=./
gradle :app:assembleDebug
```
