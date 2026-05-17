import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GMirrorObservability, redactPII } from '../src/core/observability';
import { GMirror } from '../src/core/gmirror';

jest.setTimeout(15000);

describe('GMirror observability', () => {
  const originalAuditDir = process.env.GMIRROR_AUDIT_DIR;

  afterEach(() => {
    if (originalAuditDir === undefined) delete process.env.GMIRROR_AUDIT_DIR;
    else process.env.GMIRROR_AUDIT_DIR = originalAuditDir;
  });

  it('redacts PII from structured payloads', () => {
    expect(redactPII({
      user_email: 'person@example.com',
      nested: { api_key: 'test-key' },
      message: 'contact person@example.com',
    })).toEqual({
      user_email: '[REDACTED]',
      nested: { api_key: '[REDACTED]' },
      message: 'contact [REDACTED_EMAIL]',
    });
  });

  it('exports Prometheus and OpenTelemetry metrics with latency quantiles', () => {
    const observability = new GMirrorObservability('gmirror');
    observability.metrics.recordPublicMethod('scoreChange', 10, 'ok');
    observability.metrics.recordPublicMethod('scoreChange', 20, 'ok');
    observability.metrics.recordPublicMethod('scoreChange', 30, 'error');

    const prometheus = observability.metrics.prometheus();
    expect(prometheus).toContain('gmirror_public_method_throughput_total{method="scoreChange",status="ok"} 2');
    expect(prometheus).toContain('gmirror_public_method_errors_total{method="scoreChange"} 1');
    expect(prometheus).toContain('quantile="0.95"');

    const otel = observability.metrics.openTelemetry();
    expect(JSON.stringify(otel)).toContain('service.name');
  });

  it('writes decision and shell-job audit JSONL files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmirror-audit-'));
    process.env.GMIRROR_AUDIT_DIR = dir;
    const observability = new GMirrorObservability('gmirror');

    observability.audit.logDecision({
      operation: 'scoreChange',
      decision: 'pass',
      success: true,
      metadata: { email: 'person@example.com' },
    });
    observability.audit.logShellJob({
      command: 'npm test',
      exit_code: 0,
      metadata: { token: 'test-token' },
    });

    const files = fs.readdirSync(dir);
    expect(files.some(file => file.startsWith('decisions-'))).toBe(true);
    expect(files.some(file => file.startsWith('shell-jobs-'))).toBe(true);
    const content = files.map(file => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('person@example.com');
    expect(content).not.toContain('test-token');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exposes metrics and trace snapshots from GMirror public methods', async () => {
    const gmirror = new GMirror({ gbrainTimeoutMs: 200 });
    await gmirror.healthCheck();

    expect(gmirror.exportPrometheusMetrics()).toContain('gmirror_public_method_throughput_total');
    expect(JSON.stringify(gmirror.exportOpenTelemetryMetrics())).toContain('resourceMetrics');
    expect(JSON.stringify(gmirror.getObservabilitySnapshot())).toContain('GMirror.healthCheck');
  });
});
