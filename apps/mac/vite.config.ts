import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRecentEventsFromGBrain, searchCareCircleGBrain } from './src/lib/carecircle-gbrain-queries.js';
import { CareCircleGBrainStore } from './src/lib/carecircle-gbrain-store.js';
import {
  getCalendarIcsUrlFromEnv,
  listCalendarBlocksFromGBrain,
  normalizeIcsUrl,
  syncCalendarIcsToGBrain,
} from './src/lib/sync-calendar-gbrain.js';
import { ensureCareCircleGBrainSeeded } from './src/lib/seed-carecircle-gbrain.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const careCircleRoot = resolve(repoRoot, '..');
const gbrainRepo = resolve(careCircleRoot, 'gbrain');
const gbrainHome = process.env.GBRAIN_HOME ?? resolve(repoRoot, '.gbrain-carecircle');
const careCircleGBrain = new CareCircleGBrainStore(gbrainHome);

async function withSeededGBrain<T>(fn: () => T | Promise<T>): Promise<T> {
  await ensureCareCircleGBrainSeeded(careCircleGBrain);
  return fn();
}

function careCircleGBrainBridge() {
  return {
    name: 'carecircle-gbrain-bridge',
    configureServer(server) {
      server.middlewares.use('/api/carecircle/gbrain-memory', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const body = await readJson(req);
          const slug = safeSlug(String(body.slug ?? 'carecircle/demo/accepted-plan'));
          const markdown = String(body.markdown ?? '');
          if (!markdown.trim()) {
            sendJson(res, 400, { error: 'Missing markdown' });
            return;
          }

          const result = await runGBrainPut(slug, markdown);
          sendJson(res, 200, { ok: true, slug, result });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/provider-context', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          await readJson(req);
          sendJson(res, 200, {
            status: 'ready',
            source: 'demo',
            summary:
              'Provider handoff packet prepared from CareCircle sources. External context stays separate from family-note evidence.',
            checkedAt: new Date().toISOString(),
            operationId: `provider-handoff-${Date.now()}`,
            requestId: 'carecircle-provider-demo',
            items: [
              {
                title: 'Who to contact first',
                detail:
                  'Call the local pharmacy first for medication timing, dosage, and side-effect guidance. Escalate to Dr. Chen if the pharmacist recommends clinical review.',
                sourceLabel: 'Provider routing',
              },
              {
                title: 'Questions to ask',
                detail:
                  'Ask whether dizziness after a medication change is worth reviewing, whether timing with meals matters, and what warning signs should prompt a doctor call.',
                sourceLabel: 'Handoff checklist',
              },
              {
                title: 'Safety wording',
                detail:
                  'Use “family notes mention” and “may be worth checking.” Do not say medication caused symptoms or imply a diagnosis.',
                sourceLabel: 'CareCircle safety boundary',
              },
            ],
          });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/context-search', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const body = await readJson(req);
          const query = String(body.query ?? 'pharmacy dizziness medication appointment');
          const result = await withSeededGBrain(() => searchCareCircleGBrain(careCircleGBrain, query));
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/recent-events-summary', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          await readJson(req);
          await withSeededGBrain(async () => {
            const payload = buildRecentEventsFromGBrain(careCircleGBrain);
            sendJson(res, 200, { ...payload, gbrainSaved: true, source: 'gbrain', gbrainHome });
          });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/calendar-sync', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const body = await readJson(req);
          const rawUrl = String(body.icsUrl ?? getCalendarIcsUrlFromEnv() ?? '');
          const icsUrl = normalizeIcsUrl(rawUrl);
          await withSeededGBrain(async () => {
            const result = await syncCalendarIcsToGBrain(careCircleGBrain, icsUrl);
            sendJson(res, 200, { ...result, source: 'gbrain' });
          });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/calendar-events', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          await withSeededGBrain(async () => {
            const listed = listCalendarBlocksFromGBrain(careCircleGBrain);
            sendJson(res, 200, { ...listed, source: 'gbrain' });
          });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });
    },
  };
}

function runGBrainPut(slug: string, markdown: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('bun', ['run', 'src/cli.ts', 'put', slug], {
      cwd: gbrainRepo,
      env: { ...process.env, GBRAIN_HOME: gbrainHome },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(stderr.trim() || stdout.trim() || `gbrain exited ${code}`));
    });
    child.stdin.end(markdown);
  });
}

function readJson(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolvePromise(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function safeSlug(value: string) {
  return value.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/^-+|-+$/g, '') || 'carecircle/demo/accepted-plan';
}

// Tauri expects a fixed port and forwards stdout/stderr to it.
export default defineConfig({
  plugins: [react(), careCircleGBrainBridge()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2022', 'safari15'],
    outDir: 'dist',
    rollupOptions: {
      // `@tauri-apps/plugin-notification` is loaded via a dynamic import
      // inside src/lib/notifications.ts with a graceful fallback. It's
      // not installed by default (Tauri plugins are optional), so we
      // tell Rollup to treat it as external instead of resolving it
      // at build time.
      external: ['@tauri-apps/plugin-notification'],
    },
  },
});
