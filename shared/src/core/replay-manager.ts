/**
 * Deterministic Replay Manager
 * 
 * Enables deterministic replay of tool executions by:
 * - Storing corpus entries with content-addressable hashes
 * - Retrieving corpus entries by hash for exact replay
 * - Supporting reproducible evaluation and debugging
 * 
 * Uses SHA-256 hashing for content addressing.
 */

import { createHash } from 'node:crypto';

export interface CorpusEntry {
  hash: string;
  content: string;
  metadata: {
    tool: string;
    timestamp: string;
    task?: string;
    version?: string;
  };
}

export interface ReplayRequest {
  hash: string;
  tool: string;
}

export interface ReplayResult {
  hash: string;
  content: string;
  metadata: CorpusEntry['metadata'];
  found: boolean;
}

export class ReplayManager {
  private corpusPath: string;
  private index: Map<string, CorpusEntry>;

  constructor(corpusPath: string) {
    this.corpusPath = corpusPath;
    this.index = new Map();
    this.loadIndex();
  }

  /**
   * Compute SHA-256 hash of content
   */
  computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Store a corpus entry
   */
  async store(content: string, metadata: CorpusEntry['metadata']): Promise<string> {
    const hash = this.computeHash(content);
    const entry: CorpusEntry = {
      hash,
      content,
      metadata,
    };

    // Store in index
    this.index.set(hash, entry);

    // Persist to disk
    await this.persistEntry(entry);

    return hash;
  }

  /**
   * Retrieve a corpus entry by hash
   */
  async retrieve(hash: string): Promise<ReplayResult> {
    const entry = this.index.get(hash);

    if (!entry) {
      // Try to load from disk
      const loaded = await this.loadEntry(hash);
      if (loaded) {
        this.index.set(hash, loaded);
        return {
          hash,
          content: loaded.content,
          metadata: loaded.metadata,
          found: true,
        };
      }

      return {
        hash,
        content: '',
        metadata: { tool: '', timestamp: '' },
        found: false,
      };
    }

    return {
      hash,
      content: entry.content,
      metadata: entry.metadata,
      found: true,
    };
  }

  /**
   * Check if a hash exists in the corpus
   */
  exists(hash: string): boolean {
    return this.index.has(hash);
  }

  /**
   * Get all entries for a specific tool
   */
  getByTool(tool: string): CorpusEntry[] {
    const entries: CorpusEntry[] = [];
    for (const entry of this.index.values()) {
      if (entry.metadata.tool === tool) {
        entries.push(entry);
      }
    }
    return entries.sort((a, b) => a.metadata.timestamp.localeCompare(b.metadata.timestamp));
  }

  /**
   * Get corpus statistics
   */
  getStatistics(): {
    total_entries: number;
    entries_by_tool: { [tool: string]: number };
    total_size_bytes: number;
  } {
    const entriesByTool: { [tool: string]: number } = {};
    let totalSize = 0;

    for (const entry of this.index.values()) {
      entriesByTool[entry.metadata.tool] = (entriesByTool[entry.metadata.tool] || 0) + 1;
      totalSize += entry.content.length;
    }

    return {
      total_entries: this.index.size,
      entries_by_tool: entriesByTool,
      total_size_bytes: totalSize,
    };
  }

  /**
   * Persist a corpus entry to disk
   */
  private async persistEntry(entry: CorpusEntry): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const entryPath = path.join(this.corpusPath, entry.hash.substring(0, 2), entry.hash);
    const dir = path.dirname(entryPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write entry
    fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2));

    // Update index
    await this.saveIndex();
  }

  /**
   * Load a corpus entry from disk
   */
  private async loadEntry(hash: string): Promise<CorpusEntry | null> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const entryPath = path.join(this.corpusPath, hash.substring(0, 2), hash);

    if (!fs.existsSync(entryPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(entryPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Load the corpus index from disk
   */
  private async loadIndex(): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const indexPath = path.join(this.corpusPath, 'index.json');

    if (!fs.existsSync(indexPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const entries: CorpusEntry[] = JSON.parse(content);

      for (const entry of entries) {
        this.index.set(entry.hash, entry);
      }
    } catch {
      // Start with empty index on error
    }
  }

  /**
   * Save the corpus index to disk
   */
  private async saveIndex(): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const indexPath = path.join(this.corpusPath, 'index.json');
    const dir = path.dirname(indexPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entries = Array.from(this.index.values());
    fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2));
  }

  /**
   * Clean up old entries (older than specified days)
   */
  async cleanupOldEntries(daysOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const toDelete: string[] = [];
    const fs = await import('node:fs');
    const path = await import('node:path');

    for (const [hash, entry] of this.index.entries()) {
      const entryTime = new Date(entry.metadata.timestamp);
      if (entryTime < cutoff) {
        toDelete.push(hash);
      }
    }

    // Delete entries
    for (const hash of toDelete) {
      const entryPath = path.join(this.corpusPath, hash.substring(0, 2), hash);
      if (fs.existsSync(entryPath)) {
        fs.unlinkSync(entryPath);
      }
      this.index.delete(hash);
    }

    // Save updated index
    await this.saveIndex();

    return toDelete.length;
  }
}
