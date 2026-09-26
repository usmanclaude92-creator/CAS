# iOS App

A native Swift/SwiftUI shell hosting a `WKWebView`, mirroring `android/`'s
WebView-wrapper architecture — one web codebase, one thin native shell per
platform, instead of a parallel native reimplementation of every screen.

## Layout

```
ios/
  CAS.xcodeproj/          Xcode project (target: CAS)
  CAS/
    CASApp.swift          @main App entry point
    ContentView.swift     Root SwiftUI view, hosts WebView
    WebView.swift         UIViewRepresentable wrapping WKWebView
    Info.plist
    Assets.xcassets/      App icon + accent color
    www/                  Placeholder web bundle — replaced at build time
```

`www/` here is a placeholder only. Real builds (local or CI) copy the
built web bundle in before compiling — see `.github/workflows/ci.yml`'s
`build-ios` job, which reuses the same mobile-tailored web bundle
`android/` builds (`build-android-web`) rather than duplicating that web
source a third time.

## Building locally (requires a Mac + Xcode)

```sh
# From the CAS-App or android/ web source, build the bundle:
cd android && npm ci && npx vite build --base=./

# Copy it into the iOS app's resources:
rm -rf ../ios/CAS/www && cp -r dist ../ios/CAS/www

# Build for the Simulator:
cd ../ios
xcodebuild build -project CAS.xcodeproj -target CAS -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO
```

## Shipping a build to TestFlight (for testing on a real iPhone)

There's no Mac in this environment, so this whole path runs through
GitHub Actions: a manual workflow (`.github/workflows/ios-testflight.yml`,
"iOS TestFlight Release" in the Actions tab) archives, signs, and uploads
the app using an **App Store Connect API key** — Xcode 13+ can create the
distribution certificate and provisioning profile automatically via that
key, so no manual `.p12`/`.mobileprovision` export is needed.

### One-time setup (needs an Apple Developer Program account, $99/yr)

1. **Enroll** at [developer.apple.com/programs](https://developer.apple.com/programs/) if you haven't (approval can take up to 48h).
2. **Register the app** in [App Store Connect](https://appstoreconnect.apple.com/) → My Apps → + → New App, bundle ID `com.artifysols.cas`, matching the identifier already set in the Xcode project.
3. **Create an API key**: App Store Connect → Users and Access → Integrations → App Store Connect API → Generate API Key. Give it the **Admin** role (a lower role can upload builds but can't create the signing certificate on the first run). Download the `AuthKey_<KEY_ID>.p8` file — Apple only lets you download it once.
4. **Find your Team ID**: [developer.apple.com/account](https://developer.apple.com/account) → Membership details (10 characters, e.g. `A1B2C3D4E5`).
5. **Add 4 repository secrets** (Settings → Secrets and variables → Actions → New repository secret):
   - `APPLE_TEAM_ID` — the Team ID from step 4
   - `APPSTORE_API_KEY_ID` — the Key ID shown next to the key you created
   - `APPSTORE_API_ISSUER_ID` — the Issuer ID shown at the top of the Integrations page
   - `APPSTORE_API_KEY_P8` — paste the entire contents of the downloaded `.p8` file as-is (GitHub secrets support multi-line values)

### Running it

Actions tab → "iOS TestFlight Release" → Run workflow. It builds the same
web bundle `android/` ships, archives and signs the app, and uploads it to
App Store Connect. The build then needs a few minutes to finish processing
before it's selectable in TestFlight → install the **TestFlight** app on
your iPhone, accept the tester invite (add yourself as an internal tester
in App Store Connect → TestFlight first), and install it from there.

### Submitting to the App Store

Once a TestFlight build has been tested, submit the *same* uploaded build
for review from App Store Connect → your app → a version → "Add for
Review" (this also needs app metadata: description, screenshots, privacy
policy URL, etc. filled in on that same page — all one-time account/app
setup that has to happen in App Store Connect itself, not from this repo).

## What's not done yet

- This project file and scheme were hand-authored (no Xcode available in
  this environment to generate/verify them) — the structure follows the
  standard Xcode "App" template format and passed local syntax/consistency
  checks, but the first real CI run is the actual test; treat early
  failures here as expected teething, not a sign the approach is wrong.
- The TestFlight workflow above is unverified until the four secrets exist
  and it's actually run once — I can't create an Apple Developer account
  or App Store Connect API key myself.
