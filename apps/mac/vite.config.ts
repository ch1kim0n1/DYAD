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
import {
  loadMedicationsFromGBrain,
  searchMedicationContextInGBrain,
  syncMedicationsToGBrain,
  type CareManualMedication,
} from './src/lib/medication-gbrain.js';

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

      server.middlewares.use('/api/carecircle/medications/scan', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const body = await readJson(req);
          const manual = parseMedications(body);
          await withSeededGBrain(async () => {
            const snapshot = searchMedicationContextInGBrain(careCircleGBrain, manual);
            sendJson(res, 200, snapshot);
          });
        } catch (err) {
          sendJson(res, 500, { error: (err as Error).message });
        }
      });

      server.middlewares.use('/api/carecircle/medications', async (req, res) => {
        if (req.method === 'GET') {
          try {
            await withSeededGBrain(async () => {
              const manual = loadMedicationsFromGBrain(careCircleGBrain);
              const snapshot = searchMedicationContextInGBrain(careCircleGBrain, manual);
              sendJson(res, 200, snapshot);
            });
          } catch (err) {
            sendJson(res, 500, { error: (err as Error).message });
          }
          return;
        }

        if (req.method === 'POST') {
          try {
            const body = await readJson(req);
            const manual = parseMedications(body);
            await withSeededGBrain(async () => {
              syncMedicationsToGBrain(careCircleGBrain, manual);
              const snapshot = searchMedicationContextInGBrain(careCircleGBrain, manual);
              sendJson(res, 200, snapshot);
            });
          } catch (err) {
            sendJson(res, 500, { error: (err as Error).message });
          }
          return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
      });

      server.middlewares.use('/api/carecircle/agent-brief', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const body = await readJson(req);
          const graph = body.graph as Record<string, unknown> | undefined;
          if (!graph) {
            sendJson(res, 400, { error: 'Missing care graph' });
            return;
          }

          const result = await runCareCircleAgent(graph);
          sendJson(res, 200, result);
        } catch (err) {
          sendJson(res, 503, { error: (err as Error).message });
        }
      });
    },
  };
}

function parseMedications(body: Record<string, unknown>): CareManualMedication[] {
  const raw = body.medications;
  if (!Array.isArray(raw)) return [];
  return raw as CareManualMedication[];
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

async function runCareCircleAgent(graph: Record<string, unknown>) {
  const apiKey = process.env.CARE_AGENT_API_KEY ?? process.env.HF_TOKEN ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Set CARE_AGENT_API_KEY, HF_TOKEN, or OPENAI_API_KEY to enable agent analysis.');
  }

  const model = process.env.CARE_AGENT_MODEL ?? 'gpt-4o-mini';
  const apiUrl = process.env.CARE_AGENT_API_URL ?? 'https://api.openai.com/v1/chat/completions';
  const prompt = [
    'You are Snoopie, CareCircle’s calm family care companion for an elder-care demo.',
    'You are speaking to Maya after a long day. Be warm, brief, steady, and useful.',
    'Sound like a capable helper quietly taking things off her plate, not a clinical dashboard or corporate assistant.',
    'Read the care-network graph and return only JSON that matches the requested shape.',
    'Identify what changed this week, unresolved loops, task assignments, and message drafts.',
    'For every whatChanged item, make recommendedAction a two-sentence source-aware rationale plus the next step.',
    'The rationale should connect at least two source types when possible, such as family notes + messages, calendar + task ownership, or pharmacy notification + symptom mentions.',
    'Make the reasoning feel like synthesis across messy sources, not a restatement of the claim.',
    'Write reasoning in first person as Snoopie using “I”. Use phrases like “I noticed,” “I remembered,” “I staged,” “I kept this careful,” and “so you do not have to re-read the whole thread tonight.”',
    'Do not say “CareCircle stages,” “CareCircle routes,” or “CareCircle is.”',
    'Avoid stiff phrases like “source-aware rationale,” “detected,” “correlated,” “escalate,” “optimize,” and “workflow.”',
    'Prefer humane language: “I noticed,” “this may be worth checking,” “I kept this under human review,” “one clear next step,” and “nothing gets sent until you approve it.”',
    'Safety rules: do not diagnose dementia; do not claim medication caused symptoms; do not claim you know Linda’s feelings; do not imply AI replaces family, doctors, pharmacists, or caregivers.',
    'Use language like “may be worth checking,” “human review,” “doctor or pharmacist,” and “family notes mention.”',
    'Frame support around Linda staying comfortable and independent.',
  ].join('\n');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({
            expectedShape: {
              headline: 'string',
              summary: 'string',
              whatChanged: [
                {
                  id: 'string',
                  claim: 'string',
                  confidence: 'number from 0 to 1',
                  evidenceObservationIds: ['observation id'],
                  recommendedAction:
                    'two-sentence cross-source reasoning plus next step; connect multiple source types and avoid diagnosis/causation',
                  safetyLevel: 'normal | human_review | medical_review',
                },
              ],
              unresolvedLoops: [
                {
                  id: 'string',
                  description: 'string',
                  status: 'open | resolved',
                  relatedPersonIds: ['person id'],
                  evidenceObservationIds: ['observation id'],
                  suggestedNextStep: 'string',
                  openedAt: 'ISO timestamp',
                },
              ],
              taskSplit: [
                {
                  id: 'string',
                  ownerPersonId: 'person id',
                  title: 'string',
                  description: 'string',
                  status: 'suggested | accepted | done',
                  linkedInsightIds: ['insight id'],
                },
              ],
              whatUsuallyWorks: ['string'],
              messageDrafts: {
                toParent: 'string',
                toSiblings: 'string',
                toDoctorOrPharmacist: 'string',
              },
            },
            graph,
          }),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`agent request failed with ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('agent returned no content');
  const parsed = parseAgentJson(raw);

  return {
    brief: normalizeAgentBrief(parsed),
    analysisMode: 'agent',
  };
}

function parseAgentJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('agent returned non-JSON content');
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function normalizeAgentBrief(value: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    id: stringOr(value.id, `carecircle-agent-${Date.now()}`),
    generatedAt: stringOr(value.generatedAt, now),
    headline: stringOr(value.headline, 'Human review suggested for this week'),
    summary: enforceSafetyLanguage(
      stringOr(
        value.summary,
        'Family notes mention changes this week. This may be worth checking with a doctor or pharmacist, with the family staying in control.',
      ),
    ),
    whatChanged: arrayOfRecords(value.whatChanged).map((item, index) => ({
      id: stringOr(item.id, `agent-insight-${index + 1}`),
      claim: stringOr(item.claim, 'Family notes mention a change worth reviewing.'),
      confidence: numberBetween(item.confidence, 0, 1, 0.78),
      evidenceObservationIds: stringArray(item.evidenceObservationIds),
      recommendedAction: enforceSafetyLanguage(
        sourceAwareAgentReasoning(
          stringOr(item.id, `agent-insight-${index + 1}`),
          stringOr(item.claim, 'Family notes mention a change worth reviewing.'),
          stringArray(item.evidenceObservationIds),
          stringOr(item.recommendedAction, ''),
        ),
      ),
      safetyLevel: safetyLevel(item.safetyLevel),
    })),
    unresolvedLoops: arrayOfRecords(value.unresolvedLoops).map((item, index) => ({
      id: stringOr(item.id, `agent-loop-${index + 1}`),
      description: stringOr(item.description, 'Follow-up still open.'),
      status: item.status === 'resolved' ? 'resolved' : 'open',
      relatedPersonIds: stringArray(item.relatedPersonIds),
      evidenceObservationIds: stringArray(item.evidenceObservationIds),
      suggestedNextStep: stringOr(item.suggestedNextStep, 'Assign one family owner and close the loop.'),
      openedAt: stringOr(item.openedAt, now),
    })),
    taskSplit: arrayOfRecords(value.taskSplit).map((item, index) => ({
      id: stringOr(item.id, `agent-action-${index + 1}`),
      ownerPersonId: stringOr(item.ownerPersonId, index === 0 ? 'sarah' : index === 1 ? 'arjun' : 'maya'),
      title: stringOr(item.title, 'Review next step'),
      description: enforceSafetyLanguage(stringOr(item.description, 'This is staged for family review before anyone acts.')),
      status: actionStatus(item.status),
      linkedInsightIds: stringArray(item.linkedInsightIds),
    })),
    whatUsuallyWorks: stringArray(value.whatUsuallyWorks).slice(0, 4),
    messageDrafts: normalizeMessageDrafts(value.messageDrafts),
  };
}

function sourceAwareAgentReasoning(id: string, claim: string, evidenceIds: string[], agentText: string) {
  if (agentText.length > 120 && /family notes|message|calendar|pharmacy|task|source/i.test(agentText)) {
    return firstPersonReasoning(agentText);
  }

  const text = `${id} ${claim} ${evidenceIds.join(' ')}`.toLowerCase();
  if (text.includes('dizz') || text.includes('med')) {
    return 'I noticed Linda mentioned dizziness twice in the family messages, and I also saw the pharmacy note about the blood pressure medication change this week. I am not assuming one caused the other; I just want to make it easy for you to ask a doctor or pharmacist the right, careful question.';
  }

  if (text.includes('appointment')) {
    return 'I saw the appointment question come up more than once, and I noticed Arjun is already the person who usually handles calendar follow-up. I routed this to him as one clear confirmation so you do not have to re-read the whole thread tonight.';
  }

  if (text.includes('lunch') || text.includes('meal')) {
    return 'I found two meal notes on different days, and I remembered that Linda does better with gentle morning calls and concrete choices. I staged this as a soft check-in about appetite and routine, not a diagnosis or a big alarm.';
  }

  return (
    firstPersonReasoning(agentText) ||
    'I connected this to the week’s source history and kept the next step calm, specific, and under human review. Nothing gets sent or escalated until the family decides.'
  );
}

function firstPersonReasoning(value: string) {
  return value
    .replace(/\bCareCircle is not\b/g, 'I am not')
    .replace(/\bCareCircle is\b/g, 'I am')
    .replace(/\bCareCircle stages\b/g, 'I stage')
    .replace(/\bCareCircle staged\b/g, 'I staged')
    .replace(/\bCareCircle routes\b/g, 'I route')
    .replace(/\bCareCircle routed\b/g, 'I routed')
    .replace(/\bCareCircle connected\b/g, 'I connected')
    .replace(/\bCareCircle should\b/g, 'I should')
    .replace(/\bCareCircle\b/g, 'I');
}

function normalizeMessageDrafts(value: unknown) {
  const record = isRecord(value) ? value : {};
  return {
    toParent: stringOr(
      record.toParent,
      'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
    ),
    toSiblings: stringOr(
      record.toSiblings,
      'Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I’ll check in with Mom this morning.',
    ),
    toDoctorOrPharmacist: enforceSafetyLanguage(
      stringOr(
        record.toDoctorOrPharmacist,
        'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
      ),
    ),
  };
}

function enforceSafetyLanguage(value: string) {
  return value
    .replace(/\bcaused\b/gi, 'may be related to')
    .replace(/\bdementia\b/gi, 'a pattern worth human review')
    .replace(/\bdiagnose[sd]?\b/gi, 'review');
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberBetween(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function safetyLevel(value: unknown): 'normal' | 'human_review' | 'medical_review' {
  if (value === 'normal' || value === 'human_review' || value === 'medical_review') return value;
  return 'human_review';
}

function actionStatus(value: unknown): 'suggested' | 'accepted' | 'done' {
  if (value === 'accepted' || value === 'done') return value;
  return 'suggested';
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
