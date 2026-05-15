# UI Visual QA — Issue #73

## Summary
Documented visual QA checklist for DYAD macOS app at demo resolution (1200x800).

## Resolution
- Target: 1200x800 (as configured in tauri.conf.json)
- Minimum: 900x600 (minimum window size)

## Visual QA Checklist

### General Layout
- [ ] App window opens at correct size (1200x800)
- [ ] Window cannot be resized below minimum (900x600)
- [ ] Header displays correctly with navigation tabs
- [ ] Status indicator visible in header
- [ ] Error messages display in header when present
- [ ] No horizontal scrollbars at target resolution
- [ ] No content clipped at edges

### The Map View
- [ ] Chart renders correctly at 1200x800
- [ ] Self line (blue) visible and distinct
- [ ] Partner line (orange) visible and distinct
- [ ] Grid lines visible but not distracting
- [ ] Axis labels readable
- [ ] Tooltip displays on hover
- [ ] Detector markers (yellow dots) visible
- [ ] Legend displays correctly
- [ ] Empty state message displays when <5 messages

### The Atlas View
- [ ] Message list scrolls smoothly
- [ ] Primary emotion color underlines visible
- [ ] Emotion tag chips display correctly
- [ ] Timestamps readable
- [ ] Participant indicators clear
- [ ] Text contrast sufficient in dark mode
- [ ] No overflow or clipping

### The Mirror View
- [ ] Self-model metrics display correctly
- [ ] Attachment indicator bars render
- [ ] Horseman profile visible
- [ ] Bid responsiveness baseline shown
- [ ] All labels readable
- [ ] Color scheme consistent with app theme

### The Divergence View
- [ ] Brief text displays correctly
- [ ] Reframe text displays correctly
- [ ] Loading state shows when generating reframe
- [ ] Request button visible and clickable
- [ ] Text wrapping correct
- [ ] No overflow issues

### Onboarding Flow
- [ ] Welcome screen displays correctly
- [ ] Permissions screen shows Full Disk Access instructions
- [ ] API key screen displays configuration instructions
- [ ] Ready screen shows tips
- [ ] Navigation buttons work
- [ ] Overlay covers entire window
- [ ] No content visible behind overlay

### Crisis Overlay
- [ ] Overlay covers entire screen when unsafe
- [ ] Refusal message displays clearly
- [ ] Referral resources visible
- [ ] Dismiss button works
- [ ] Navigation tabs disabled after dismiss (except Mirror)

### Dark Mode
- [ ] All text readable against dark background
- [ ] Contrast ratios meet WCAG AA (4.5:1 for normal text)
- [ ] Color palette consistent across views
- [ ] No color contrast issues

### Responsive Behavior
- [ ] Window resize handles gracefully
- [ ] Charts resize correctly
- [ ] Text reflows properly
- [ ] No layout breaks at minimum size

## Known Issues
- None documented yet

## Screenshot Locations
Screenshots should be saved to:
```
screenshots/
  ├── map-view-1200x800.png
  ├── atlas-view-1200x800.png
  ├── mirror-view-1200x800.png
  ├── divergence-view-1200x800.png
  ├── onboarding-welcome.png
  ├── onboarding-permissions.png
  ├── onboarding-api-key.png
  ├── onboarding-ready.png
  └── crisis-overlay.png
```

## Tools for Screenshot Capture
- macOS: Cmd+Shift+4 for region, Cmd+Shift+5 for options
- Ensure app is at exact 1200x800 resolution
- Use consistent naming convention
- Include in repo if documenting visual bugs
