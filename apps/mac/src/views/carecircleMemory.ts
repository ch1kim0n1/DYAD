import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import type { CareGBrainMemoryState, CareLiveNote } from './carecircleRuntime.js';

const MEMORY_KEY = 'carecircle.gbrain.pages.v1';

interface CareCircleMemoryPage {
  id: string;
  kind: 'carecircle_brief_memory';
  title: string;
  content: {
    graph_id: string;
    brief_id: string;
    headline: string;
    summary: string;
    task_split: string[];
    unresolved_loops: string[];
    safety_boundary: string;
  };
  created_at: string;
  updated_at: string;
}

export async function saveCareBriefToGBrainMemory(brief: CareBrief): Promise<CareGBrainMemoryState> {
  const now = new Date().toISOString();
  const page: CareCircleMemoryPage = {
    id: `carecircle::brief::${brief.id}`,
    kind: 'carecircle_brief_memory',
    title: `CareCircle brief memory: ${brief.headline}`,
    content: {
      graph_id: 'carecircle-demo',
      brief_id: brief.id,
      headline: brief.headline,
      summary: brief.summary,
      task_split: brief.taskSplit.map((action) => `${action.title} -> ${action.status}`),
      unresolved_loops: brief.unresolvedLoops.map((loop) => loop.description),
      safety_boundary: 'Medication and symptom notes require human review; CareCircle does not diagnose.',
    },
    created_at: now,
    updated_at: now,
  };

  const pages = upsertLocalMemory(page);
  const liveSaved = await tryLiveGBrainSave(page);

  return {
    status: liveSaved ? 'saved' : 'local',
    source: liveSaved ? 'gbrain' : 'local',
    pageId: page.id,
    savedAt: now,
    memoryCount: pages.length,
    summary: liveSaved
      ? 'Care plan saved to GBrain memory for the next check-in.'
      : 'Care plan saved to local GBrain demo memory for the next check-in.',
  };
}

export async function saveFamilyNoteToGBrainMemory(note: CareLiveNote): Promise<boolean> {
  const markdown = `---
type: carecircle_family_note
title: Family note from Maya
---

# Family note

${note.text}

Source: family note
Captured: ${note.createdAt}
Safety boundary: Family notes are context for human review, not diagnosis.
`;

  return tryLocalGBrainBridgePayload({
    slug: `carecircle/notes/${note.id}`,
    markdown,
  });
}

export async function syncCareGraphToGBrainMemory(graph: CareCircleGraph): Promise<boolean> {
  const markdown = `---
type: carecircle_source_bundle
title: CareCircle week source bundle
---

# CareCircle week source bundle

These are synthetic demo observations from family notes, messages, appointments, medication alerts, and tasks.
CareCircle stores them as memory, then uses deterministic workflows to cluster changes and stage actions.

${graph.observations
  .map(
    (observation) =>
      `- [${formatMemorySource(observation.source)}] ${observation.text} (${observation.timestamp}; ${observation.tags.join(', ')})`,
  )
  .join('\n')}

Safety boundary: Source memory supports family and provider review. It does not diagnose or replace clinical judgment.
`;

  return tryLocalGBrainBridgePayload({
    slug: `carecircle/sources/${graph.id}-week`,
    markdown,
  });
}

function upsertLocalMemory(page: CareCircleMemoryPage): CareCircleMemoryPage[] {
  const pages = readLocalMemory().filter((item) => item.id !== page.id);
  pages.unshift(page);
  window.localStorage.setItem(MEMORY_KEY, JSON.stringify(pages.slice(0, 12)));
  return pages;
}

function readLocalMemory(): CareCircleMemoryPage[] {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CareCircleMemoryPage[]) : [];
  } catch {
    return [];
  }
}

async function tryLiveGBrainSave(page: CareCircleMemoryPage): Promise<boolean> {
  const bridgeSaved = await tryLocalGBrainBridgePage(page);
  if (bridgeSaved) return true;

  const baseUrl = (import.meta as unknown as { env?: { VITE_GBRAIN_BASE_URL?: string } }).env?.VITE_GBRAIN_BASE_URL;
  if (!baseUrl) return false;

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/pages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(page),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function tryLocalGBrainBridgePage(page: CareCircleMemoryPage): Promise<boolean> {
  return tryLocalGBrainBridgePayload({
    slug: `carecircle/demo/${page.content.brief_id}`,
    markdown: pageToMarkdown(page),
  });
}

async function tryLocalGBrainBridgePayload(memory: { slug: string; markdown: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/carecircle/gbrain-memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(memory),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function pageToMarkdown(page: CareCircleMemoryPage): string {
  return `---
type: carecircle
title: ${page.title}
---

# ${page.content.headline}

${page.content.summary}

## Task split

${page.content.task_split.map((item) => `- ${item}`).join('\n')}

## Loose ends

${page.content.unresolved_loops.map((item) => `- ${item}`).join('\n')}

## Safety boundary

${page.content.safety_boundary}
`;
}

function formatMemorySource(source: string): string {
  return source.replaceAll('_', ' ');
}
