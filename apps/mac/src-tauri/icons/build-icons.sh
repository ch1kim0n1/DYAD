#!/bin/bash
# Generate icon PNGs + .icns from icon.svg (#79).
# Requires macOS `iconutil` (built-in) and `rsvg-convert` (brew install librsvg).
# Run on a Mac before `tauri build`.

set -euo pipefail
ICON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ICON_DIR"

if ! command -v rsvg-convert > /dev/null; then
  echo "Error: rsvg-convert not found. Run: brew install librsvg" >&2
  exit 1
fi

# Tauri-required PNG outputs at the root of icons/
for size in 32 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" icon.svg -o "icon-${size}.png"
done
cp icon-1024.png icon.png   # default Tauri picks this one

# iconset for .icns — macOS only
ICONSET=icon.iconset
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
for s in 16 32 64 128 256 512 1024; do
  rsvg-convert -w "$s"           -h "$s"           icon.svg -o "$ICONSET/icon_${s}x${s}.png"
  rsvg-convert -w "$((s * 2))"   -h "$((s * 2))"   icon.svg -o "$ICONSET/icon_${s}x${s}@2x.png" || true
done

if command -v iconutil > /dev/null; then
  iconutil -c icns "$ICONSET" -o icon.icns
  echo "Wrote icon.icns"
else
  echo "iconutil not found (you're not on macOS). PNGs written, but .icns must be built on a Mac."
fi

ls -la icon-*.png icon.icns 2>/dev/null || true
