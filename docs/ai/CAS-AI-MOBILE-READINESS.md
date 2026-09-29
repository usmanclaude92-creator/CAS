# CAS AI — Mobile Readiness (Android + iOS)

## Architecture (confirmed)

Both `android/` and `ios/` are **thin WebView shells around a web bundle** — there is no separate native business logic, and no separate backend for either. This was a deliberate, previously-made architecture decision in this project (recorded history: an earlier native Kotlin/Compose rewrite of `android/` was explicitly reverted in favor of this WebView-wrapper approach).

**Correction (found while actually porting the AI Agent to Android — see "Android AI Agent port" below): `android/src` is NOT literally the same bundle as the root web app.** It is a genuinely separate, independently-maintained copy of the frontend (`android/src/` vs. root `src/`), built by its own CI job from `android/`'s own `package.json`/`vite.config`, sharing only the same Supabase project and the same `VITE_ADMIN_API_URL` cross-origin-fetch convention. A feature added to root `src/` does **not** automatically appear on Android — it has to be ported into `android/src` by hand, exactly like the AI Agent was. This document's earlier claim that mobile parity was "automatic" was aspirational, not verified, and was wrong.

- **Android** (`android/`): a full standalone copy of the web app's UI code (not its bundle), built with `vite build --base=./`, served inside the native shell via `androidx.webkit.WebViewAssetLoader` at `https://appassets.androidplatform.net/www/...` (required because Chromium WebView refuses `<script type="module">` over raw `file://`). Same `authService.ts`/`supabaseClient.ts` pattern as the root web app, reaching the **same deployed backend** for admin/AI actions via `VITE_ADMIN_API_URL` — but this env var was **not actually set** in `android/.github/workflows/main.yml`'s build step until this port, so every `adminFetch`/AI-service call was silently resolving under the WebView's own virtual asset origin (a 404, not the real API) rather than `https://cas.artifysols.com`. Fixed alongside the AI Agent port.
- **iOS** (`ios/`): Swift/SwiftUI shell hosting a `WKWebView`, loading the same web bundle via `loadFileURL`. No code signing / Apple Developer Program account configured yet (tracked separately, pre-existing, unrelated to AI). **The AI Agent has not been ported to `ios/`** — same gap as Android had, not yet addressed.

## Android AI Agent port (done)

Ported the full Phase 1-5 AI Agent frontend into `android/src` — `AiAgentButton.tsx`, `AiAgentChatModal.tsx` (text, voice, attachments, action confirmations), `AiAgentAdminView.tsx`, and all 6 client services (`aiChatService`, `aiActionsService`, `aiAttachmentService`, `aiVoiceService`, `aiAdminService`, `aiAutomationsService`) — copied verbatim from root `src/` since none of them import anything Android-specific; only `Header.tsx`, `Sidebar.tsx`, `App.tsx`, and `permissionsData.ts` needed integration edits (button placement, `ai_agent_admin` nav entry gated by `ai_actions.manage`, the four new permission codes). Three things had to be fixed for this to actually work, none of which were true before this port:

1. **`VITE_ADMIN_API_URL` set in CI** (`android/.github/workflows/main.yml`) to `https://cas.artifysols.com` — see above.
2. **`ALLOWED_ORIGIN` on the Vercel production project** extended from `https://cas.artifysols.com` alone to include `https://appassets.androidplatform.net` (the WebViewAssetLoader virtual origin every Android request actually presents as `Origin`) — without this, CORS silently rejected every request from the app regardless of (1).
3. **Native mic/file-picker plumbing added to `MainActivity.kt`**: `RECORD_AUDIO` in `AndroidManifest.xml`, plus `WebChromeClient.onPermissionRequest` (grants mic only after the OS runtime-permission prompt succeeds — the web layer is never trusted to have it already) and `onShowFileChooser` (backs the attachment button's `<input type=file>`). Neither existed before; voice input and file attachments could not have worked in the WebView without them.

**Not verified end-to-end**: no Android SDK/Gradle plugin resolution is available in the sandbox this was built in (no network to Google's Maven, no `ANDROID_HOME`), so the Kotlin changes are unverified by compilation — `tsc`/`eslint`/`vitest` are clean for everything TypeScript, but the next real CI run (or a local `gradle :app:assembleDebug`) is the first actual compile of `MainActivity.kt`. Mic recording and file-picker behavior also need a real device/emulator pass — nothing in this sandbox can drive a WebView's `getUserMedia` prompt or file chooser.

## Confirmed gaps unrelated to AI (do not block Phase 1)

- iOS: no Apple Developer account, no TestFlight distribution yet (separately tracked; irrelevant to AI backend readiness since the WebView content is identical either way). The AI Agent frontend also has not been ported to `ios/` at all yet.
- `android/supabase/migrations/` is a stale partial copy of the schema (see `CAS-AI-DATABASE-MAP.md`) — irrelevant at runtime since both apps hit the same live Supabase project, but should not be used as a reference by anyone working on AI tools.
- `android/src/services/permissionsData.ts` was already missing several modules present in root's copy before this port (all `*.import` codes, the entire Business Partners module) — out of scope for the AI port, left as-is; only the AI-related codes were added to keep this change focused.

## CORS / cross-origin

Both mobile shells make HTTPS requests to the production domain (`cas.artifysols.com`) from within the WebView. Android's actual `Origin` header on those requests is the WebViewAssetLoader virtual domain, `https://appassets.androidplatform.net` — not `cas.artifysols.com` itself — which is now reflected in the Vercel project's `ALLOWED_ORIGIN` (see above; previously it was not, and every cross-origin admin/AI call from Android was silently CORS-rejected in production).
