# Security Review — Issue #69

## Summary
No hardcoded secrets found. All API keys are correctly read from environment variables. The project follows security best practices for secret management.

## Findings

### Hardcoded Secrets
- ✅ No actual API keys found in codebase
- ✅ No `sk-ant-` (Anthropic) patterns in source code
- ✅ No other API key patterns in source code

### Environment Variable Usage
- ✅ `ANTHROPIC_API_KEY` read from `process.env` or `import.meta.env`
- ✅ `GSTACK_API_KEY` read from environment variables
- ✅ `GBRAIN_API_KEY` read from environment variables
- ✅ `THE_HOG_API_KEY` read from environment variables
- ✅ `JO_API_KEY` read from environment variables

### Configuration Files
- ✅ `.env.example` contains placeholder values only (`your_api_key_here`)
- ✅ `.env` is in `.gitignore` (not committed)
- ✅ No secrets in git history

### Code Locations Using Secrets
- `packages/engine/src/llm-extractor.ts` — reads `ANTHROPIC_API_KEY` from env
- `packages/engine/src/intervention/brief-prompt.ts` — reads `ANTHROPIC_API_KEY` from env
- `packages/engine/src/intervention/reframe-prompt.ts` — reads `ANTHROPIC_API_KEY` from env
- `packages/engine/src/detectors/primary-secondary.ts` — reads `ANTHROPIC_API_KEY` from env
- `packages/engine/src/gbrain/client.ts` — reads `GBRAIN_API_KEY` from env
- `apps/mac/src/lib/gstack-client.ts` — reads `GSTACK_API_KEY` from env

### PII Handling
- ✅ `DYAD_PII_REDACTION` flag available in `.env.example`
- ✅ Partner names are redacted to `[PARTNER]` before LLM calls
- ✅ Message text is PII-redacted in NormalizedMessage

### Recommendations
- ✅ Current security posture is good
- Consider adding `.env` to `.dockerignore` if containerizing
- Consider adding secret scanning to CI pipeline (e.g., TruffleHog, Gitleaks)
- Document how to rotate API keys in production

## Conclusion
No security issues found. The project correctly uses environment variables for all secrets and does not commit any sensitive data to the repository.
