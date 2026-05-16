# DYAD Build Order

This document describes the dependency order for implementing DYAD issues. Engineers should follow this sequence to avoid compile errors and blocked issues.

## Must Complete First (in order)

1. **#1** - Monorepo scaffold
2. **#97** - Package.json files for all packages (shared, lexicons, ingestion, engine)
3. **#98** - TypeScript path aliases across monorepo (@dyad/* must resolve)
4. **#2** - Shared types (RawMessage, NormalizedMessage, FeatureVector)
5. **#100** - Missing types (SelfModel, PartnerModel, RelationshipModel, LlmExtracted, OrchestratorResult)
6. **#3** - Zod schemas
7. **#99** - Shared index.ts barrel export
8. **#5** - NRC lexicon JSON → **#6** - AFINN JSON → **#101** - Lexicons tsconfig + index.ts
9. **#4** - .env.example → **#59** - GitHub Actions CI

## P1 — Ingestion (in order)

**#7** → **#8** → **#9** → **#10** → **#11**

## P2 — Extraction

**#12** + **#13** (parallel) → **#14** → **#15** → **#16** + **#19** (parallel) → **#17** → **#18**

## P3 — Models (after P2)

**#18** → **#20** + **#21** (parallel) → **#22** → **#23** + **#24** (parallel)

## P4 — Detectors (after P2 + P3)

**#26** → **#27** / **#28** / **#29** (parallel) / **#25** → **#30** → **#31**

## P5 — Generation (after P4)

**#32** → **#33** / **#34** → **#35**

## P6 — App (after P5)

**#102** → **#103** → **#37** → **#104** (sidecar) → **#36** → **#57** → views (**#38-#41** parallel) → **#42**

## QA Runs Alongside

QA runs alongside from P2 onward: **#47** → **#48** → **#49**

## Notes

- All P0 foundation issues (#97-#101, #105) are now complete
- TypeScript path aliases are configured in root tsconfig.json
- All packages use workspace:* protocol for inter-package dependencies
- Lexicons package has resolveJsonModule: true for JSON imports
