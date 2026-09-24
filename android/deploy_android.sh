#!/bin/bash
# ==============================================================================
# deploy_android.sh
# Builds the debug APK (assembleDebug) and installs it on a connected
# Android emulator or device via 'adb install -r'.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== [1/4] Checking environment prerequisites ==="
GRADLE_CMD=""
if command -v gradle >/dev/null 2>&1; then
    GRADLE_CMD="gradle"
elif [ -f "./gradlew" ]; then
    GRADLE_CMD="./gradlew"
fi

if [ -z "$GRADLE_CMD" ]; then
    echo "Error: Neither gradle nor ./gradlew found." >&2
    exit 1
fi

echo "=== [2/4] Building Debug APK (assembleDebug) ==="
$GRADLE_CMD :app:assembleDebug

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "Error: Build completed but APK not found at $APK_PATH" >&2
    exit 1
fi

echo "Debug APK ready at: $APK_PATH ($(du -h "$APK_PATH" | cut -f1))"

echo "=== [3/4] Checking connected Android devices/emulators via adb ==="
if ! command -v adb >/dev/null 2>&1; then
    echo "Warning: 'adb' command not found in PATH."
    echo "The generated APK is at: $APK_PATH"
    echo "You can install it manually using:"
    echo "  adb install -r $APK_PATH"
    exit 0
fi

DEVICE_COUNT=$(adb devices | grep -v "List of devices" | grep -c "device$" || true)

if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo "Warning: No online emulator/device found by adb."
    echo "Run 'adb devices' to inspect connected hardware or start your Android emulator."
    exit 0
fi

echo "Found $DEVICE_COUNT connected device(s)/emulator(s)."

echo "=== [4/4] Deploying APK via 'adb install -r' ==="
adb install -r "$APK_PATH"

echo "=== Launching MainActivity ==="
PACKAGE_NAME="com.artifysols.cas"
MAIN_ACTIVITY=".MainActivity"
adb shell am start -n "${PACKAGE_NAME}/${PACKAGE_NAME}${MAIN_ACTIVITY}" || true

echo "=== Deployment successful! ==="
