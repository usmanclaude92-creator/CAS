# CAS AI — Mobile Readiness (Android + iOS)

## Architecture (confirmed)

Both `android/` and `ios/` are **thin WebView shells around the same web bundle** — there is no separate native business logic, and no separate backend for either. This was a deliberate, previously-made architecture decision in this project (recorded history: an earlier native Kotlin/Compose rewrite of `android/` was explicitly reverted in favor of this WebView-wrapper approach).

- **Android** (`android/`): a full standalone copy of the web app's `src/`, built with `vite build --base=./`, served inside the native shell via `androidx.webkit.WebViewAssetLoader` at `https://appassets.androidplatform.net/www/...` (required because Chromium WebView refuses `<script type="module">` over raw `file://`). Same `authService.ts`/`supabaseClient.ts` pattern as the root web app; confirmed it calls the **same deployed backend** for admin actions (`android/src/services/authService.ts:487,640` call `/api/admin/users` and `/api/admin/users/:id/set-password` — i.e. the production Vercel deployment, not a bundled or mocked backend).
- **iOS** (`ios/`): Swift/SwiftUI shell hosting a `WKWebView`, loading the same web bundle via `loadFileURL`. No code signing / Apple Developer Program account configured yet (tracked separately, pre-existing, unrelated to AI).

## What this means for the AI feature

**An AI Gateway built once behind `/api/ai/*` on the existing Vercel deployment is automatically available to all three surfaces with zero mobile-specific backend work.** The mobile apps already call this exact backend today (for admin actions) using the same JWT-bearer pattern the AI endpoint would use. No new mobile build, no new native module, no app-store review implication for the backend portion.

The only mobile-side work is UI: a chat panel/entry point in the shared React codebase (so it ships to web + android + ios simultaneously from one change, exactly like every other UI feature in this project this session).

## Confirmed gaps unrelated to AI (do not block Phase 1)

- iOS: no Apple Developer account, no TestFlight distribution yet (separately tracked; irrelevant to AI backend readiness since the WebView content is identical either way).
- `android/supabase/migrations/` is a stale partial copy of the schema (see `CAS-AI-DATABASE-MAP.md`) — irrelevant at runtime since both apps hit the same live Supabase project, but should not be used as a reference by anyone working on AI tools.

## CORS / cross-origin

Both mobile shells make HTTPS requests to the production domain (`cas.artifysols.com`) from within the WebView — architecturally identical to a browser tab calling the same API. The `ALLOWED_ORIGIN` CORS concern flagged in `CAS-AI-API-READINESS.md` applies equally here; no additional mobile-specific CORS configuration is needed beyond getting that env var right.
