import { describe, it, expect, beforeEach } from 'bun:test';
import {
  HogClient,
  HogAuthError,
  HogPaymentError,
  HogRateLimitError,
  HogValidationError,
  HogTransportError,
  extractDeepResearchResult,
} from '../src/nous/hog/client';

/** Minimal mock — captures each request and serves canned responses by URL pattern. */
function makeMockFetch(routes: Record<string, { status: number; body: unknown }>): {
  fetchImpl: typeof fetch;
  calls: { url: string; init: RequestInit | undefined }[];
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = url instanceof URL ? url.toString() : typeof url === 'string' ? url : url.url;
    calls.push({ url: u, init });
    const match = Object.entries(routes).find(([pattern]) => u.includes(pattern));
    if (!match) {
      return new Response(JSON.stringify({ error: 'no-route', path: u }), { status: 404 });
    }
    const { status, body } = match[1];
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('HogClient', () => {
  let originalEnv: string | undefined;
  beforeEach(() => {
    originalEnv = process.env['THE_HOG_API_KEY'];
  });

  it('isConfigured() reflects api key presence', () => {
    expect(new HogClient({ apiKey: 'k' }).isConfigured()).toBe(true);
    expect(new HogClient({ apiKey: undefined }).isConfigured()).toBe(originalEnv ? true : false);
  });

  it('injects Bearer token and JSON content-type on POST', async () => {
    const { fetchImpl, calls } = makeMockFetch({
      '/api/deep-research': {
        status: 202,
        body: { operationId: 'op_1', status: 'queued', pollUrl: '/api/operations/op_1', meta: { estimatedCost: 5 } },
      },
    });
    const client = new HogClient({ apiKey: 'hog_test_xxx', fetchImpl });
    await client.deepResearch({ prompt: 'Research X', schema: { type: 'object' } });
    const h = (calls[0].init?.headers as Record<string, string>) ?? {};
    expect(h.Authorization).toBe('Bearer hog_test_xxx');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('forwards Idempotency-Key and X-Project-Id', async () => {
    const { fetchImpl, calls } = makeMockFetch({
      '/api/deep-research': {
        status: 202,
        body: { operationId: 'op_2', meta: { estimatedCost: 8 } },
      },
    });
    const client = new HogClient({ apiKey: 'k', fetchImpl, projectId: 'proj_a' });
    await client.deepResearch(
      { prompt: 'p', schema: {} },
      { idempotencyKey: 'idem-123', projectId: 'proj_b' },
    );
    const h = (calls[0].init?.headers as Record<string, string>) ?? {};
    expect(h['Idempotency-Key']).toBe('idem-123');
    expect(h['X-Project-Id']).toBe('proj_b');
  });

  it('parses 202 deep-research as HogOperationHandle', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/deep-research': {
        status: 202,
        body: { operationId: 'op_dr_1', status: 'queued', meta: { estimatedCost: 12 } },
      },
    });
    const client = new HogClient({ apiKey: 'k', fetchImpl });
    const handle = await client.deepResearch({ prompt: 'p', schema: {} });
    expect(handle.operation_id).toBe('op_dr_1');
    expect(handle.capability).toBe('deep_research');
    expect(handle.est_cost_credits).toBe(12);
  });

  it('getOperation normalises status from succeeded to completed', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/operations/op_x': {
        status: 200,
        body: { id: 'op_x', status: 'succeeded', progress: 100, result: { headline: 'h', facts: [] }, meta: { cost: { actual: 4 } } },
      },
    });
    const client = new HogClient({ apiKey: 'k', fetchImpl });
    const op = await client.getOperation('op_x');
    expect(op.status).toBe('completed');
    expect(op.credits_spent).toBe(4);
  });

  it('getOperation maps processing→running and queued→pending', async () => {
    const { fetchImpl: f1 } = makeMockFetch({ '/api/operations/op_p': { status: 200, body: { id: 'op_p', status: 'processing' } } });
    const { fetchImpl: f2 } = makeMockFetch({ '/api/operations/op_q': { status: 200, body: { id: 'op_q', status: 'queued' } } });
    expect((await new HogClient({ apiKey: 'k', fetchImpl: f1 }).getOperation('op_p')).status).toBe('running');
    expect((await new HogClient({ apiKey: 'k', fetchImpl: f2 }).getOperation('op_q')).status).toBe('pending');
  });

  it('throws HogAuthError on 401', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/operations/x': { status: 401, body: { statusCode: 401, error: 'Unauthorized', message: 'bad key', requestId: 'rid-1' } },
    });
    const client = new HogClient({ apiKey: 'k', fetchImpl });
    await expect(client.getOperation('x')).rejects.toBeInstanceOf(HogAuthError);
  });

  it('throws HogPaymentError on 402', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/deep-research': { status: 402, body: { statusCode: 402, error: 'Payment Required', message: 'no credits' } },
    });
    await expect(new HogClient({ apiKey: 'k', fetchImpl }).deepResearch({ prompt: 'p', schema: {} }))
      .rejects.toBeInstanceOf(HogPaymentError);
  });

  it('throws HogRateLimitError on 429', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/operations/y': { status: 429, body: { statusCode: 429, error: 'Too Many Requests', message: 'slow down' } },
    });
    await expect(new HogClient({ apiKey: 'k', fetchImpl }).getOperation('y'))
      .rejects.toBeInstanceOf(HogRateLimitError);
  });

  it('throws HogValidationError with per-field errors on 400', async () => {
    const { fetchImpl } = makeMockFetch({
      '/api/deep-research': {
        status: 400,
        body: {
          statusCode: 400, error: 'Bad Request', message: 'Validation failed',
          errors: [{ property: 'prompt', message: 'must be a string' }],
        },
      },
    });
    try {
      await new HogClient({ apiKey: 'k', fetchImpl }).deepResearch({ prompt: '', schema: {} });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HogValidationError);
      expect((e as HogValidationError).errors[0].property).toBe('prompt');
    }
  });

  it('throws HogTransportError when fetch throws', async () => {
    const fetchImpl = (async () => { throw new Error('network down'); }) as typeof fetch;
    await expect(new HogClient({ apiKey: 'k', fetchImpl }).getOperation('z'))
      .rejects.toBeInstanceOf(HogTransportError);
  });

  it('throws HogAuthError when api key is absent', async () => {
    delete process.env['THE_HOG_API_KEY'];
    const client = new HogClient({ apiKey: undefined });
    await expect(client.getOperation('any')).rejects.toBeInstanceOf(HogAuthError);
    if (originalEnv) process.env['THE_HOG_API_KEY'] = originalEnv;
  });
});

describe('extractDeepResearchResult', () => {
  it('returns headline+facts when shape matches', () => {
    const out = extractDeepResearchResult({
      headline: 'Acme raised $42M',
      facts: [{ source: 'TechCrunch', text: '...', confidence: 0.9 }],
    });
    expect(out?.headline).toBe('Acme raised $42M');
    expect(out?.facts).toHaveLength(1);
  });

  it('synthesises from company+funding shape', () => {
    const out = extractDeepResearchResult({
      companyName: 'Acme',
      recentFunding: { amount: '$42M', round: 'Series B', date: '2026-02' },
      mainProducts: ['Acme Cloud'],
    });
    expect(out?.headline).toContain('Acme');
    expect(out?.facts.some((f) => f.text.includes('$42M'))).toBe(true);
  });

  it('returns null on unrecognised shape', () => {
    expect(extractDeepResearchResult({ foo: 'bar' })).toBeNull();
    expect(extractDeepResearchResult(null)).toBeNull();
  });
});
