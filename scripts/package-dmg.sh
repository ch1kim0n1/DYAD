#!/bin/bash
# DMG packaging + signing + notarization (#76, #77, #78).
#
# Required env:
#   APPLE_TEAM_ID                 e.g. ABC123XYZ
#   APPLE_SIGNING_IDENTITY        e.g. "Developer ID Application: Your Name (ABC123XYZ)"
#   APPLE_ID                      Apple ID email for notarization
#   APPLE_APP_SPECIFIC_PASSWORD   App-specific password (NOT your iCloud password)
#
# Optional:
#   SKIP_NOTARIZE=1               build + sign only, no Apple notarytool round-trip
#
# Usage:
#   bun run --cwd apps/mac tauri:build      # produces the .app bundle
#   bash scripts/package-dmg.sh             # signs, dmg's, notarizes, staples

set -euo pipefail

APP_NAME="DYAD"
VERSION="0.1.0"
BUNDLE_ID="com.dyad.app"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_BUILD_PATH="$PROJECT_ROOT/apps/mac/src-tauri/target/release/bundle/macos/$APP_NAME.app"
DIST_DIR="$PROJECT_ROOT/dist"
DMG_PATH="$DIST_DIR/$APP_NAME-$VERSION.dmg"

echo "=== DYAD DMG packaging ==="
echo "version=$VERSION  bundle=$BUNDLE_ID"

if [ ! -d "$APP_BUILD_PATH" ]; then
  echo "Error: $APP_BUILD_PATH not found. Run 'bun run --cwd apps/mac tauri:build' first." >&2
  exit 1
fi
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Apple Developer team id}"
: "${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY (full string from 'security find-identity -v -p codesigning')}"

mkdir -p "$DIST_DIR"

echo "→ Signing $APP_NAME.app"
codesign --force --deep --options runtime --timestamp \
  --entitlements "$PROJECT_ROOT/apps/mac/src-tauri/entitlements.plist" \
  --sign "$APPLE_SIGNING_IDENTITY" \
  "$APP_BUILD_PATH"

echo "→ Verifying signature"
codesign --verify --deep --strict --verbose=2 "$APP_BUILD_PATH"
codesign -dv --verbose=4 "$APP_BUILD_PATH" 2>&1 | head -20

echo "→ Building $DMG_PATH"
rm -f "$DMG_PATH"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$APP_BUILD_PATH" \
  -ov -format UDZO \
  "$DMG_PATH"

echo "→ Signing the DMG"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG_PATH"

if [ "${SKIP_NOTARIZE:-0}" = "1" ]; then
  echo "→ SKIP_NOTARIZE=1 — skipping notarytool round-trip"
else
  : "${APPLE_ID:?Set APPLE_ID for notarization}"
  : "${APPLE_APP_SPECIFIC_PASSWORD:?Set APPLE_APP_SPECIFIC_PASSWORD (app-specific password)}"

  echo "→ Submitting to notarytool (a few minutes)"
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

  echo "→ Stapling notarization ticket"
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler staple "$APP_BUILD_PATH"

  echo "→ Final Gatekeeper check"
  spctl -a -vv -t install "$DMG_PATH"
fi

ls -lh "$DMG_PATH"
echo "Done."
