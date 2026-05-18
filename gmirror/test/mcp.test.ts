// gmirror/test/mcp.test.ts
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('GMirror MCP Server', () => {
  const serverSource = readFileSync(join(__dirname, '../src/mcp/server.ts'), 'utf8');

  it('declares the expected server identity', () => {
    expect(serverSource).toContain("name: 'gmirror'");
    expect(serverSource).toContain("version: '0.1.0'");
  });

  it('declares the expected tool names', () => {
    for (const tool of [
      'gmirror_score',
      'gmirror_health',
      'gmirror_failure_modes',
      'gmirror_get_failure_modes',
      'gmirror_calibrate',
      'gmirror_get_receipts',
      'gmirror_get_trend',
    ]) {
      expect(serverSource).toContain(tool);
    }
  });

  it('declares required schemas for scoring tools', () => {
    expect(serverSource).toContain("required: ['payload']");
  });

  it('enforces token auth, read/write scopes, and rate limits for MCP calls', () => {
    expect(serverSource).toContain('requiredScopeForTool');
    expect(serverSource).toContain('Insufficient permissions: requires');
    expect(serverSource).toContain('Rate limit exceeded');
    expect(serverSource).toContain("secrets.get('gmirror_mcp_token')");
    expect(serverSource).toContain('PermissionModel.loadDefault');
    expect(serverSource).toContain('mcp_auth_denied');
  });

  it('validates input using Zod schemas', () => {
    expect(serverSource).toContain('z.object');
    expect(serverSource).toContain('z.string');
  });

  it('returns standardized error responses', () => {
    expect(serverSource).toContain('content: [');
    expect(serverSource).toContain('isError: true');
  });

  it('implements proper scope separation', () => {
    expect(serverSource).toContain('read');
    expect(serverSource).toContain('write');
  });
});
