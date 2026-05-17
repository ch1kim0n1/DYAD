/**
 * GBrain route tests using an in-memory SQLite database.
 * Routes are tested via a lightweight express app started on a random port.
 */
import * as http from 'http';
import express, { Express } from 'express';
import * as net from 'net';

// Helper: make a simple HTTP request to a local server
function req(
  server: http.Server,
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as net.AddressInfo;
    const payload = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let server: http.Server;

beforeAll((done) => {
  // Use a fresh in-memory database
  process.env.GBRAIN_DB_PATH = ':memory:';

  // Require modules fresh — jest module cache may already have them, so we reset
  jest.resetModules();

  const { resetDb } = require('../src/db');
  resetDb();

  const { migrate } = require('../src/migrate');
  migrate();

  const app: Express = express();
  app.use(express.json());

  const { pagesRouter } = require('../src/routes/pages');
  const { runsRouter } = require('../src/routes/runs');
  const { receiptsRouter } = require('../src/routes/receipts');
  const { driftRouter } = require('../src/routes/drift');
  const { cognitiveRouter } = require('../src/routes/cognitive');
  const { observationsRouter } = require('../src/routes/observations');

  app.use(pagesRouter);
  app.use(runsRouter);
  app.use(receiptsRouter);
  app.use(driftRouter);
  app.use(cognitiveRouter);
  app.use(observationsRouter);

  server = http.createServer(app);
  server.listen(0, '127.0.0.1', done);
});

afterAll((done) => {
  server.close(done);
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
describe('Pages', () => {
  let pageId: string;

  it('POST /pages creates a page (201)', async () => {
    const r = await req(server, 'POST', '/pages', {
      content: 'Hello world',
      metadata: { author: 'test' },
      page_kind: 'note',
      tags: ['alpha', 'beta'],
    });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeDefined();
    expect(r.body.content).toBe('Hello world');
    expect(r.body.tags).toEqual(['alpha', 'beta']);
    pageId = r.body.id;
  });

  it('GET /pages returns array with created page', async () => {
    const r = await req(server, 'GET', '/pages');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.some((p: any) => p.id === pageId)).toBe(true);
  });

  it('GET /pages?tag=alpha filters by tag', async () => {
    const r = await req(server, 'GET', '/pages?tag=alpha');
    expect(r.status).toBe(200);
    expect(r.body.every((p: any) => p.tags.includes('alpha'))).toBe(true);
  });

  it('GET /pages/:id returns the page', async () => {
    const r = await req(server, 'GET', `/pages/${pageId}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(pageId);
  });

  it('GET /pages/:id returns 404 for unknown id', async () => {
    const r = await req(server, 'GET', '/pages/does-not-exist');
    expect(r.status).toBe(404);
  });

  it('POST /pages returns 400 when content is missing', async () => {
    const r = await req(server, 'POST', '/pages', { page_kind: 'note' });
    expect(r.status).toBe(400);
  });

  it('DELETE /pages/:id deletes and returns 204', async () => {
    const r = await req(server, 'DELETE', `/pages/${pageId}`);
    expect(r.status).toBe(204);
  });

  it('DELETE /pages/:id returns 404 after deletion', async () => {
    const r = await req(server, 'DELETE', `/pages/${pageId}`);
    expect(r.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
describe('Runs', () => {
  let runId: string;

  it('POST /runs creates a run (201)', async () => {
    const r = await req(server, 'POST', '/runs', { task_id: 'task-1', config: { model: 'opus' } });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeDefined();
    expect(r.body.task_id).toBe('task-1');
    runId = r.body.id;
  });

  it('GET /runs returns array with created run', async () => {
    const r = await req(server, 'GET', '/runs');
    expect(r.status).toBe(200);
    expect(r.body.some((row: any) => row.id === runId)).toBe(true);
  });

  it('GET /runs?task_id filters', async () => {
    const r = await req(server, 'GET', '/runs?task_id=task-1');
    expect(r.status).toBe(200);
    expect(r.body.every((row: any) => row.task_id === 'task-1')).toBe(true);
  });

  it('GET /runs/:id returns 404 for unknown', async () => {
    const r = await req(server, 'GET', '/runs/nope');
    expect(r.status).toBe(404);
  });

  it('POST /runs returns 400 when task_id missing', async () => {
    const r = await req(server, 'POST', '/runs', { config: {} });
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------
describe('Receipts', () => {
  let runId: string;

  beforeAll(async () => {
    const r = await req(server, 'POST', '/runs', { task_id: 'receipt-run' });
    runId = r.body.id;
  });

  it('POST /receipts creates a receipt (201)', async () => {
    const r = await req(server, 'POST', '/receipts', {
      run_id: runId,
      fingerprint: 'fp-abc',
      payload: { result: 'ok' },
    });
    expect(r.status).toBe(201);
    expect(r.body.run_id).toBe(runId);
    expect(r.body.payload).toEqual({ result: 'ok' });
  });

  it('GET /receipts/:run_id returns receipts for the run', async () => {
    const r = await req(server, 'GET', `/receipts/${runId}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it('POST /receipts returns 400 when required fields missing', async () => {
    const r = await req(server, 'POST', '/receipts', { run_id: runId });
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------
describe('Drift', () => {
  it('POST /drift creates an entry (201)', async () => {
    const r = await req(server, 'POST', '/drift', { metric: 'latency', value: 42.5, window: '7d' });
    expect(r.status).toBe(201);
    expect(r.body.metric).toBe('latency');
    expect(r.body.value).toBe(42.5);
  });

  it('GET /drift/:metric returns entries', async () => {
    const r = await req(server, 'GET', '/drift/latency');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it('POST /drift returns 400 when value is not a number', async () => {
    const r = await req(server, 'POST', '/drift', { metric: 'latency', value: 'fast' });
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Cognitive
// ---------------------------------------------------------------------------
describe('Cognitive', () => {
  it('GET /cognitive/:user_id returns 404 for unknown user', async () => {
    const r = await req(server, 'GET', '/cognitive/unknown-user');
    expect(r.status).toBe(404);
  });

  it('PUT /cognitive/:user_id upserts state', async () => {
    const r = await req(server, 'PUT', '/cognitive/user-1', { state: { mood: 'calm' } });
    expect(r.status).toBe(200);
    expect(r.body.state).toEqual({ mood: 'calm' });
    expect(r.body.user_id).toBe('user-1');
  });

  it('GET /cognitive/:user_id returns state after upsert', async () => {
    const r = await req(server, 'GET', '/cognitive/user-1');
    expect(r.status).toBe(200);
    expect(r.body.state).toEqual({ mood: 'calm' });
  });

  it('PUT /cognitive/:user_id returns 400 when state missing', async () => {
    const r = await req(server, 'PUT', '/cognitive/user-1', { other: 'data' });
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------
describe('Observations', () => {
  it('POST /observations creates and returns 201', async () => {
    const r = await req(server, 'POST', '/observations', {
      type: 'event',
      data: { action: 'click' },
      source: 'ui',
    });
    expect(r.status).toBe(201);
    expect(r.body.type).toBe('event');
    expect(r.body.source).toBe('ui');
  });

  it('GET /observations returns array', async () => {
    const r = await req(server, 'GET', '/observations');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  it('GET /observations?type=event filters', async () => {
    const r = await req(server, 'GET', '/observations?type=event');
    expect(r.status).toBe(200);
    expect(r.body.every((o: any) => o.type === 'event')).toBe(true);
  });

  it('POST /observations returns 400 when type missing', async () => {
    const r = await req(server, 'POST', '/observations', { data: {} });
    expect(r.status).toBe(400);
  });
});
