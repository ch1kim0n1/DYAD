import { describe, it, expect } from 'bun:test';

function run(cmd: string[]): { exit: number; stdout: string; stderr: string } {
  const p = Bun.spawnSync({ cmd, cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe' });
  return {
    exit: p.exitCode ?? -1,
    stdout: new TextDecoder().decode(p.stdout ?? new Uint8Array()),
    stderr: new TextDecoder().decode(p.stderr ?? new Uint8Array()),
  };
}

describe('issue #53: checkpoint 1 (ingestion)', () => {
  it('passes against the bid-asymmetry fixture', () => {
    const r = run(['bun', 'run', 'scripts/checkpoint-1-ingestion.ts', '--fixture', 'scripts/fixtures/bid-asymmetry.json']);
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain('Checkpoint 1: Ingestion');
    expect(r.stdout).toContain('✓ messages loaded');
    expect(r.stdout).toContain('✓ extraction succeeded');
  });
});

describe('issue #52: checkpoint 2 (detectors + briefs)', () => {
  it('passes against the bid-asymmetry fixture', () => {
    const r = run(['bun', 'run', 'scripts/checkpoint-2-detectors.ts', '--fixture', 'scripts/fixtures/bid-asymmetry.json']);
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain('Checkpoint 2: Detectors');
    expect(r.stdout).toContain('✓ orchestrator.run() succeeded');
    expect(r.stdout).toContain('✓ ethical refusal returns safe');
    expect(r.stdout).toContain('✓ at least one analytical detector fired');
  });
});
