import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { careCircleMessyCorpus } from './src/views/carecircleMessyCorpus';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const careCircleRoot = resolve(repoRoot, '..');
const gbrainRepo = resolve(careCircleRoot, 'gbrain');
const gbrainHome = resolve(careCircleRoot, '.gbrain-carecircle');

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
          const result = await searchCareCircleCorpus(query);
          sendJson(res, 200, result);
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

async function searchCareCircleCorpus(query: string) {
  const zeroEntropyKey = "ze_zf9oHaTXbPRMeO3o"
  const collectionName = process.env.ZEROENTROPY_COLLECTION ?? 'carecircle-demo';
  if (zeroEntropyKey) {
    try {
      await ensureZeroEntropyCollection(zeroEntropyKey, collectionName);
      const response = await zeroEntropyFetch(zeroEntropyKey, '/queries/top-snippets', {
        collection_name: collectionName,
        query,
        k: 6,
        precise_responses: true,
        include_document_metadata: true,
        reranker: 'zerank-2',
      });
      const data = (await response.json()) as {
        results?: Array<{ path: string; content: string; score: number }>;
        document_results?: Array<{ path: string; metadata?: Record<string, string | string[]> }>;
      };
      const metadataByPath = new Map((data.document_results ?? []).map((item) => [item.path, item.metadata ?? {}]));

      return {
        status: 'ready',
        source: 'zeroentropy',
        summary: 'I searched the family context and pulled the strongest sources behind this care plan.',
        indexedDocuments: careCircleMessyCorpus.length,
        results: (data.results ?? []).map((item) => ({
          path: item.path,
          title: careCircleMessyCorpus.find((doc) => doc.path === item.path)?.title ?? item.path,
          source: careCircleMessyCorpus.find((doc) => doc.path === item.path)?.source ?? 'ZeroEntropy',
          text: item.content,
          score: item.score,
          metadata: metadataByPath.get(item.path) ?? {},
        })),
      };
    } catch (err) {
      return localCareCircleSearch(query, `ZeroEntropy unavailable: ${(err as Error).message}`);
    }
  }

  return localCareCircleSearch(query, 'Set ZEROENTROPY_API_KEY to query the live ZeroEntropy index.');
}

async function ensureZeroEntropyCollection(apiKey: string, collectionName: string) {
  const collection = await zeroEntropyFetch(apiKey, '/collections/add-collection', {
    collection_name: collectionName,
    num_shards: 1,
  });
  if (![201, 409].includes(collection.status)) {
    throw new Error(`collection setup failed with ${collection.status}`);
  }

  await Promise.all(
    careCircleMessyCorpus.map((doc) =>
      zeroEntropyFetch(apiKey, '/documents/add-document', {
        collection_name: collectionName,
        path: doc.path,
        content: { type: 'text', text: doc.text },
        metadata: normalizeZeroEntropyMetadata(doc.metadata),
      }),
    ),
  );
}

async function zeroEntropyFetch(apiKey: string, path: string, body: unknown) {
  const response = await fetch(`https://api.zeroentropy.dev/v1${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (![200, 201, 409].includes(response.status)) {
    const detail = await response.text();
    throw new Error(`${path} returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return response;
}

function normalizeZeroEntropyMetadata(metadata: Record<string, string | string[]>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      Array.isArray(value) && !key.startsWith('list:') ? `list:${key}` : key,
      value,
    ]),
  );
}

function localCareCircleSearch(query: string, note: string) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  const results = careCircleMessyCorpus
    .map((doc) => {
      const haystack = `${doc.title} ${doc.source} ${doc.text} ${Object.values(doc.metadata).flat().join(' ')}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((doc) => ({
      path: doc.path,
      title: doc.title,
      source: doc.source,
      text: doc.text,
      score: doc.score,
      metadata: doc.metadata,
    }));

  return {
    status: 'demo',
    source: 'local',
    summary: note,
    indexedDocuments: careCircleMessyCorpus.length,
    results,
  };
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
