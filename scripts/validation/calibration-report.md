# Threshold calibration (#70)

Generated 2026-05-15T23:13:57.115Z by `scripts/calibrate-thresholds.ts`.

Window: 40 messages · step: 20 messages.

| Fixture | windows | bid_asymmetry | predictive_divergence | phantom_third_party |
|---------|---------|---------------|------------------------|---------------------|
| healthy-couple | 1 | 0 | 1 | 0 |
| bid-asymmetry | 4 | 4 | 2 | 0 |
| predictive-divergence | 1 | 0 | 1 | 0 |

## Range check

Targets (windows ≈ a couple of days of activity each):
- bid_asymmetry:         0-8
- predictive_divergence: 0-12
- phantom_third_party:   0-4

Per fixture:
- **healthy-couple**:
  - bid_asymmetry: ✅ (0)
  - predictive_divergence: ✅ (1)
  - phantom_third_party: ✅ (0)
- **bid-asymmetry**:
  - bid_asymmetry: ✅ (4)
  - predictive_divergence: ✅ (2)
  - phantom_third_party: ✅ (0)
- **predictive-divergence**:
  - bid_asymmetry: ✅ (0)
  - predictive_divergence: ✅ (1)
  - phantom_third_party: ✅ (0)

## Threshold knobs in source

If a detector lands outside its range:

- `packages/engine/src/detectors/bid-asymmetry.ts` → `MIN_BID_COUNT`, `partnerResponseRate < 0.50`, `userResponseRate > 0.70`
- `packages/engine/src/detectors/predictive-divergence.ts` → `WINDOW`, `DIVERGENCE_THRESHOLD`
- `packages/engine/src/detectors/phantom-third-party.ts` → `MIN_WINDOW`, `RATIO_THRESHOLD`
- `packages/engine/src/detectors/primary-secondary.ts` → `DEFAULT_NRC_GATE`

Annotate any change with `// Tuned from calibration` and re-run this script.
