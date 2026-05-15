# Animated View Transitions — Issue #80

## Summary
Documented requirements for adding framer-motion animations to DYAD views. Package installation required.

## Status
⚠️ Requires package installation: `bun add framer-motion`

## Implementation Plan

### 1. Install framer-motion
```bash
cd apps/mac
bun add framer-motion
```

### 2. Add View Transitions in App.tsx
Wrap view containers with `<AnimatePresence>` and add transition variants:
```typescript
<AnimatePresence mode="wait">
  <motion.div
    key={activeView}
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.3 }}
  >
    {activeView === 'map' && <MapViewContainer />}
    {activeView === 'atlas' && <AtlasViewContainer />}
    {activeView === 'mirror' && <MirrorViewContainer />}
    {activeView === 'divergence' && <DivergenceViewContainer />}
  </motion.div>
</AnimatePresence>
```

### 3. Add Marker Animations in MapView.tsx
Wrap detector markers with motion components:
```typescript
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
>
  <ReferenceDot ... />
</motion.div>
```

### 4. Add Spring Animations to MirrorView.tsx
Animate emotion cards with spring physics:
```typescript
<motion.div
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 200 }}
>
  {/* emotion card */}
</motion.div>
```

### 5. Respect Reduced Motion Preference
Check `window.matchMedia('(prefers-reduced-motion: reduce)')` and disable animations if true:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 };
```

## Files to Modify
- `apps/mac/package.json` — add framer-motion dependency
- `apps/mac/src/App.tsx` — add view transitions
- `apps/mac/src/views/MapView.tsx` — add marker animations
- `apps/mac/src/views/AtlasView.tsx` — add list animations
- `apps/mac/src/views/MirrorView.tsx` — add spring animations
- `apps/mac/src/views/DivergenceView.tsx` — add transition animations

## Notes
- Framer-motion is listed in README.md tech stack but not currently installed
- Animations should be subtle and enhance UX, not distract
- Spring animations should use conservative stiffness values for smooth feel
- All animations must respect `prefers-reduced-motion` for accessibility
