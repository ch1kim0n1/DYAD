import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('issue #60: accuracy audit', () => {
  it('produces a report and meets minimum thresholds', async () => {
    const proc = Bun.spawnSync({
      cmd: ['bun', 'run', 'scripts/accuracy-audit.ts'],
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.exitCode).toBe(0);
    const reportPath = path.resolve(process.cwd(), 'scripts/validation/accuracy-report.md');
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, 'utf8');
    expect(report).toContain('bid_asymmetry');
    expect(report).toContain('predictive_divergence');
    expect(report).toContain('phantom_third_party');
    expect(report).toContain('ethical_refusal');
    // Every detector row must end with ✅ given the current fixtures
    const failingRows = report.split('\n').filter(line => line.startsWith('| ') && line.endsWith('| ⚠ |'));
    expect(failingRows).toEqual([]);
  });
});
