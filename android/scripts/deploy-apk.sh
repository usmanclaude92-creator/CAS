#!/usr/bin/env bash
set -e

# ==============================================================================
# Automatic Android APK Deployment & Launcher Script
# Deploys app-debug.apk via ADB to connected emulators/devices and starts MainActivity.
# ==============================================================================

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
PACKAGE_NAME="com.example.myapplication"
ACTIVITY_NAME=".MainActivity"
COMPONENT="${PACKAGE_NAME}/${ACTIVITY_NAME}"

echo "====================================================="
echo "  Android Emulator Auto-Deploy & Launch Script"
echo "====================================================="

# 1. Verify APK exists or build it
if [ ! -f "$APK_PATH" ]; then
    echo "[!] APK not found at $APK_PATH."
    echo "[*] Triggering build and packaging script..."
    npm run build
fi

if [ ! -f "$APK_PATH" ]; then
    echo "[ERROR] Failed to locate or generate $APK_PATH. Aborting."
    exit 1
fi

APK_SIZE=$(stat -c%s "$APK_PATH" 2>/dev/null || wc -c < "$APK_PATH")
echo "[+] Target APK: $APK_PATH ($APK_SIZE bytes)"

# 2. Check ADB connection
echo "[*] Checking ADB server status..."
adb start-server >/dev/null 2>&1 || true

# Get list of online devices/emulators
TARGET_DEVICE="$1"

if [ -n "$TARGET_DEVICE" ]; then
    DEVICES=("$TARGET_DEVICE")
else
    # Read connected devices excluding header and empty lines
    DEVICES=($(adb devices | awk 'NR>1 && $2=="device" {print $1}'))
fi

if [ ${#DEVICES[@]} -eq 0 ]; then
    echo "[!] No active Android devices or emulators found via 'adb devices'."
    echo "[i] Attempting to wait for any emulator/device for 5 seconds..."
    timeout 5 adb wait-for-device || true
    DEVICES=($(adb devices | awk 'NR>1 && $2=="device" {print $1}'))
fi

if [ ${#DEVICES[@]} -eq 0 ]; then
    echo "-----------------------------------------------------"
    echo "[WARNING] No online Android emulator or device detected."
    echo "[i] When you start your Android emulator or connect a device,"
    echo "    re-run this script: ./scripts/deploy-apk.sh"
    echo "[+] Note: The generated APK has also been placed in .build-outputs/app-debug.apk"
    echo "    for streaming preview environments."
    echo "-----------------------------------------------------"
    exit 0
fi

# 3. Deploy and Launch on each connected device / emulator
for DEV in "${DEVICES[@]}"; do
    echo "-----------------------------------------------------"
    echo "[*] Target Device: $DEV"
    
    # Optional: wake up device/emulator screen
    adb -s "$DEV" shell input keyevent 82 2>/dev/null || true

    echo "[*] Installing APK: $APK_PATH..."
    # -r: reinstall keeping data
    # -t: allow test packages
    # -d: allow version downgrade if needed
    INSTALL_OUTPUT=$(adb -s "$DEV" install -r -t -d "$APK_PATH" 2>&1)
    echo "$INSTALL_OUTPUT"

    if echo "$INSTALL_OUTPUT" | grep -q "Success"; then
        echo "[✓] APK successfully installed on $DEV!"
    else
        echo "[!] Note: Standard install returned above output, proceeding to launch check."
    fi

    echo "[*] Launching $COMPONENT..."
    adb -s "$DEV" shell am start -n "$COMPONENT" \
        -a android.intent.action.MAIN \
        -c android.intent.category.LAUNCHER \
        --activity-brought-to-front

    echo "[✓] Launch command dispatched to $DEV ($COMPONENT)."
done

echo "====================================================="
echo "  Deployment and Activity Launch Completed!"
echo "====================================================="
