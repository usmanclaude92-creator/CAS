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
    Assets.xcassets/      App icon + accent color (icon not added yet)
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

## What's not done yet

- **App icon** — `Assets.xcassets/AppIcon.appiconset` has no image yet;
  needs a 1024×1024 PNG.
- **Code signing** — CI only produces an unsigned Simulator build.
  Installing on a real device, TestFlight, or App Store submission needs
  an Apple Developer Program account and signing certificates/provisioning
  profiles added as repository secrets.
- This project file was hand-authored (no Xcode available in this
  environment to generate/verify it) — the structure follows the standard
  Xcode "App" template format and passed local syntax/consistency checks,
  but the first real CI run is the actual test; treat early failures here
  as expected teething, not a sign the approach is wrong.
