# Documentation Audit — Issues #65, #71, #75

## Summary
Audited existing documentation for accuracy and completeness against current implementation.

## Findings

### README.md
- ✅ Comprehensive overview of DYAD's purpose and features
- ✅ Architecture section accurately describes L1-L6 layers
- ✅ Tech stack table is up-to-date
- ✅ Quick start instructions are clear
- ✅ Ethical architecture section is well-articulated
- ✅ Integration with G-stack is documented
- ⚠️ TODO: Add onboarding checklist to Quick Start section
- ⚠️ TODO: Add security checklist (API key handling)
- ⚠️ TODO: Add performance benchmarks section with targets

### implementation.md
- ✅ Detailed engineering specification
- ✅ Phase-by-phase build instructions
- ✅ Code examples for each component
- ✅ Type definitions match current implementation
- ⚠️ TODO: Add fw_third to FeatureVector (added in issue #29 extension)
- ⚠️ TODO: Update LLM model references (claude-haiku-4-5 → claude-sonnet-4-6)
- ⚠️ TODO: Add note about localStorage caching for offline mode (issue #67)

### ARCHITECTURE.md
- ❌ File does not exist
- TODO: Create ARCHITECTURE.md with:
  - Layer-by-layer breakdown
  - Data flow diagrams
  - Component relationships
  - Deployment architecture

### AGENTS.md
- ❌ File does not exist
- TODO: Create AGENTS.md with:
  - G-stack integration details
  - GBrain page schema
  - GToM relational pre-check
  - GMirror insight scoring
  - GAgent ingestion daemon
  - GLearn pattern learning

## Checklists to Add

### Onboarding Checklist (to add to README.md)
- [ ] Grant Full Disk Access to terminal (System Settings → Privacy & Security)
- [ ] Install Bun runtime
- [ ] Clone repository and run `bun install`
- [ ] Copy `.env.example` to `.env` and configure API keys
- [ ] Set `ANTHROPIC_API_KEY` for LLM features
- [ ] Run `bun run dev:mac` to start the app
- [ ] Complete first-run onboarding flow (<5 minutes)
- [ ] Verify chat.db is accessible

### Security Checklist (to add to README.md)
- [ ] Never commit `.env` file (already in `.gitignore`)
- [ ] Use environment variables for all API keys
- [ ] Enable `DYAD_PII_REDACTION=true` in production
- [ ] Set partner name for redaction via `DYAD_PARTNER_NAME`
- [ ] Review `.env.example` before committing changes
- [ ] Rotate API keys regularly (quarterly)
- [ ] Use different keys for dev/staging/production

### Performance Checklist (to add to README.md)
- [ ] L1 extraction: <100ms per message
- [ ] L2 LLM extraction: <2s per message
- [ ] Detector execution: <50ms total
- [ ] Memory growth: <100MB over 30-minute load
- [ ] Run `bun run scripts/validation/performance-benchmark.ts`
- [ ] Run `bun run scripts/validation/stability-test.ts`
- [ ] Monitor memory usage in production
- [ ] Set `LLM_CONCURRENCY` to control parallel LLM calls

## Recommendations

1. **Create ARCHITECTURE.md** with detailed system architecture
2. **Create AGENTS.md** with G-stack integration documentation
3. **Add checklists** to README.md for onboarding, security, and performance
4. **Update implementation.md** with recent changes (fw_third, model updates, caching)
5. **Add CONTRIBUTING.md** with development setup guidelines
6. **Add CHANGELOG.md** tracking version history and breaking changes
