import type { ExternalContext } from '@dyad/shared';

export interface HogEnricherOptions {
  baseUrl?: string;
  apiKey?: string;
  cacheTtlMs?: number;
}

/**
 * Client for The Hog — partner public-footprint enrichment service.
 * Gracefully returns [] when the service is unavailable (demo mode).
 */
export class HogEnricher {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { data: ExternalContext[]; fetchedAt: number }>();

  constructor(options: HogEnricherOptions = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env['THE_HOG_BASE_URL'] ?? 'http://localhost:4001';
    this.apiKey = options.apiKey ?? process.env['THE_HOG_API_KEY'];
    this.cacheTtlMs = options.cacheTtlMs ?? 6 * 60 * 60 * 1000; // 6 h
  }

  async enrich(partnerId: string): Promise<ExternalContext[]> {
    const cached = this.cache.get(partnerId);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.data;
    }

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/context?entity=${encodeURIComponent(partnerId)}`,
        { method: 'GET', headers },
      );

      if (!response.ok) return [];

      const data = (await response.json()) as ExternalContext[];
      this.cache.set(partnerId, { data, fetchedAt: Date.now() });
      return data;
    } catch {
      return [];
    }
  }

  clearCache(partnerId?: string): void {
    if (partnerId) {
      this.cache.delete(partnerId);
    } else {
      this.cache.clear();
    }
  }
}
