# UI screenshots (#73)

Drop screenshots here at the four target resolutions:

```
ui-screenshots/
  ├── map-1200x800.png
  ├── map-1440x900.png
  ├── map-1920x1080.png
  ├── map-2560x1440.png
  ├── atlas-1200x800.png
  ├── atlas-1440x900.png
  ├── atlas-1920x1080.png
  ├── atlas-2560x1440.png
  ├── mirror-1200x800.png
  ├── mirror-1440x900.png
  ├── mirror-1920x1080.png
  ├── mirror-2560x1440.png
  ├── divergence-1200x800.png
  ├── divergence-1440x900.png
  ├── divergence-1920x1080.png
  ├── divergence-2560x1440.png
  ├── crisis-overlay-1200x800.png
  └── onboarding-1200x800.png
```

## Capture procedure (macOS)

```bash
# 1. Resize the Tauri window via the menu Window → Zoom or by hand.
# 2. Cmd+Shift+5 → "Capture Selected Window" → click DYAD window.
# 3. Save as `<view>-<WIDTHxHEIGHT>.png` directly to this folder.
```

For the 1920×1080 and 2560×1440 captures, hook the laptop up to a real
external display (or use SwitchResX) so the OS reports the right pixel
ratio.

## What we check on each screenshot

| Check | Pass criterion |
|-------|----------------|
| No clipped text in any card | Manual look |
| Chart axis labels readable | At 1920×1080, font height ≥ 11px |
| Gottman badge colour matches status | Stable green / warning amber / failing red |
| Tab labels visible at the narrow end (1200px) | "The Map" / "The Atlas" / "Divergence" / "The Mirror" not truncated |
| Status indicator dot visible | 8×8 dot present in every screenshot |
| CrisisOverlay covers entire viewport | No analytical UI visible behind it |

Note any issue inline in `scripts/validation/ui-visual-qa-results.md`.

Screenshots are not committed by default (the directory only ships with
`.gitkeep` + this README) because PNGs bloat the repo. If you want to
share captures, push to a separate gist / branch.
