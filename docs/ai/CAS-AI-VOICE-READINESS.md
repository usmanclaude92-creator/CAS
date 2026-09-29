# CAS AI — Voice Readiness

## Current state: not started, on any surface

Checked for microphone permissions, audio capture APIs, and speech recognition/synthesis references across the whole ecosystem:

| Check | Result |
|---|---|
| `getUserMedia`/`MediaRecorder`/`SpeechRecognition`/`webkitSpeechRecognition` in `src/`, `android/src/`, `ios/` | Zero matches |
| Android `AndroidManifest.xml` permissions | Only `INTERNET` and `ACCESS_NETWORK_STATE` — no `RECORD_AUDIO` |
| iOS `Info.plist` | No `NSMicrophoneUsageDescription` key |

This is a clean slate, not a partial implementation — nothing to audit for correctness, only a gap to plan for later.

## What would be required (future phase, not now)

- **Android:** add `<uses-permission android:name="android.permission.RECORD_AUDIO" />` to `AndroidManifest.xml`, runtime permission request flow, and either a native bridge for on-device STT or a `MediaRecorder`→upload→server-STT flow (simpler given the WebView-wrapper architecture — keeps voice logic in the shared web bundle rather than native code, consistent with how the rest of this app is built).
- **iOS:** add `NSMicrophoneUsageDescription` to `Info.plist`, `AVAudioSession` capture, same choice between native STT bridge vs. web-layer capture through the WKWebView's own `getUserMedia` support (WKWebView supports `getUserMedia` since iOS 14.3 with the right entitlements — would need verification once this phase starts).
- **Web:** browser `MediaRecorder` + `getUserMedia`, works today with no native changes.
- **Backend:** an STT/TTS provider decision (Anthropic's API does not do speech-to-text; this would need a separate provider or a Claude-compatible audio pipeline) — explicitly out of scope for Phase 0/1 per the directive ("Do not implement voice yet").
- **Streaming + barge-in:** would need the AI Gateway's tool-use loop to support streaming responses (the Anthropic TypeScript SDK does), plus a client-side interruption signal — architecturally compatible with the target design in `CAS-AI-ARCHITECTURE.md` but not built.

**Recommendation:** treat voice as a clearly separate later phase (see `CAS-AI-IMPLEMENTATION-ROADMAP.md`), built on top of a working text-based AI Gateway, not in parallel with it.
