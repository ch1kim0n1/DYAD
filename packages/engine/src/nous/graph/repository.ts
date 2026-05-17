/**
 * NOUS layered repository — GBrain primary + local JSON fallback.
 *
 * Three implementations:
 *   - GBrainGraphRepository: writes to GBrain pages, kind 'dyad_mentalization_graph'
 *   - LocalJsonGraphRepository: writes to ~/.dyad/mentalization-graph-{dyadId}.json
 *   - LayeredGraphRepository (default): writes to both; reads GBrain, falls back to local
 *
 * GBrain page kinds:
 *   - dyad_mentalization_graph (id: mg-{dyadId}) — current state
 *   - dyad_mentalization_snapshot (id: mgs-{dyadId}-{snapshotId}) — temporal replay
 *   - dyad_arbiter_decision (id: ad-{dyadId}-{decisionId}) — self-improvement
 */
import type { MentalizationGraph } from '@dyad/shared';
import { GBrainClient, type GBrainClientOptions } from '../../gbrain/client.js';
import { MentalizationGraphImpl } from './mentalization-graph.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const DYAD_DIR = path.join(os.homedir(), '.dyad');

// ════════════════════════════════════════════════════════════════════════════
// Repository interface
// ════════════════════════════════════════════════════════════════════════════

export interface MentalizationGraphRepository {
  load(dyadId: string): Promise<MentalizationGraph>;
  save(graph: MentalizationGraph): Promise<void>;
}

// ════════════════════════════════════════════════════════════════════════════
// Local JSON repository (fallback)
// ════════════════════════════════════════════════════════════════════════════

export class LocalJsonGraphRepository implements MentalizationGraphRepository {
  async load(dyadId: string): Promise<MentalizationGraph> {
    const filePath = this.getFilePath(dyadId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is corrupt — return empty graph
      return MentalizationGraphImpl.create(dyadId).toObject();
    }
  }

  async save(graph: MentalizationGraph): Promise<void> {
    const filePath = this.getFilePath(graph.dyad_id);
    await fs.mkdir(DYAD_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(graph, null, 2), 'utf-8');
  }

  private getFilePath(dyadId: string): string {
    return path.join(DYAD_DIR, `mentalization-graph-${dyadId}.json`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GBrain repository (primary)
// ════════════════════════════════════════════════════════════════════════════

export class GBrainGraphRepository implements MentalizationGraphRepository {
  constructor(private gbrain: GBrainClient) {}

  async load(dyadId: string): Promise<MentalizationGraph> {
    const pageId = `mg-${dyadId}`;
    try {
      const page = await this.gbrain.getPage(pageId);
      if (!page) {
        return MentalizationGraphImpl.create(dyadId).toObject();
      }
      return JSON.parse(String(page.content)) as MentalizationGraph;
    } catch (error) {
      console.warn(`[GBrainGraphRepository] Failed to load graph for ${dyadId}:`, error);
      return MentalizationGraphImpl.create(dyadId).toObject();
    }
  }

  async save(graph: MentalizationGraph): Promise<void> {
    const pageId = `mg-${graph.dyad_id}`;
    const content = JSON.stringify(graph, null, 2);
    
    try {
      await this.gbrain.upsertPage({
        id: pageId,
        kind: 'dyad_mentalization_graph',
        title: `Mentalization Graph: ${graph.dyad_id}`,
        content,
      });
    } catch (error) {
      console.warn(`[GBrainGraphRepository] Failed to save graph for ${graph.dyad_id}:`, error);
      throw error; // Re-throw so layered repo can fall back
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Layered repository (default)
// ════════════════════════════════════════════════════════════════════════════

export class LayeredGraphRepository implements MentalizationGraphRepository {
  private gbrainRepo: GBrainGraphRepository;
  private localRepo: LocalJsonGraphRepository;

  constructor(gbrainOptions?: GBrainClientOptions) {
    const gbrain = new GBrainClient(gbrainOptions || {});
    this.gbrainRepo = new GBrainGraphRepository(gbrain);
    this.localRepo = new LocalJsonGraphRepository();
  }

  async load(dyadId: string): Promise<MentalizationGraph> {
    // Try GBrain first, fall back to local
    try {
      const graph = await this.gbrainRepo.load(dyadId);
      if (Object.keys(graph.nodes).length > 0) {
        return graph;
      }
    } catch (error) {
      console.warn(`[LayeredGraphRepository] GBrain load failed, falling back to local:`, error);
    }
    
    // Fallback to local
    return this.localRepo.load(dyadId);
  }

  async save(graph: MentalizationGraph): Promise<void> {
    // Write to both; if GBrain fails, still save locally
    let gbrainSuccess = false;
    
    try {
      await this.gbrainRepo.save(graph);
      gbrainSuccess = true;
    } catch (error) {
      console.warn(`[LayeredGraphRepository] GBrain save failed, using local only:`, error);
    }
    
    // Always save locally as backup
    await this.localRepo.save(graph);
    
    if (!gbrainSuccess) {
      console.warn(`[LayeredGraphRepository] Graph saved to local only for ${graph.dyad_id}`);
    }
  }
}
