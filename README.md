# Construction Accounting System (CAS)

A construction accounting system with a web app and an Android app, both
backed by the same Supabase (Postgres) project. No mock or local-only data:
every read and write goes through the shared database, with the same
role-based access control and workflow rules enforced server-side via RLS
policies and `SECURITY DEFINER` RPCs.

## Layout

- **`/`** — the web application (React + Vite + TypeScript), plus its
  Express admin API server (`server.ts`). Deployed as the primary web app.
- **`/android`** — the Android app: native Kotlin + Jetpack Compose, talking
  directly to Supabase (Auth + Postgrest) as its own client — not a WebView
  around the web app. See `android/app/src/main/java/com/artifysols/cas/`
  for the package layout (`core/`, `data/`, `domain/`, `feature/`). Currently
  covers sign-in and a read-only dashboard summary (Phase 1 of the native
  rebuild); the rest of the web app's modules (invoices, purchases, VAT,
  reports, etc.) aren't ported yet.
- **`/supabase/migrations`** — the database schema shared by both apps.
  `/android/supabase/migrations` is kept in sync as a copy for reference;
  the migrations here are the ones actually applied to the live project.

## Shared backend

Both apps point at the same Supabase project. The web app reads
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from its `.env` (see
`.env.example` at the root); the Android app reads the equivalent
`SUPABASE_URL` / `SUPABASE_ANON_KEY` as Gradle properties or environment
variables at build time (see `android/app/build.gradle.kts`). Both
credentials are the anon key — safe to embed client-side, since every
request is still gated by Postgres RLS using the authenticated user's JWT.
Admin operations that need the service-role key (creating users, approving
demo requests) go through the web app's Express server; the Android app
doesn't call those endpoints yet.

## Development

Each app is built and tested independently from its own directory:

```bash
# Web app
npm install
npm run lint
npm test
npm run build

# Android app (needs the Android SDK + a JDK 17 installed locally)
cd android
SUPABASE_URL=... SUPABASE_ANON_KEY=... gradle :app:lintDebug
SUPABASE_URL=... SUPABASE_ANON_KEY=... gradle :app:testDebugUnitTest
SUPABASE_URL=... SUPABASE_ANON_KEY=... gradle :app:assembleDebug
```
