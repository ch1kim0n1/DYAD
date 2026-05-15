/**
 * GBrain client interface — for persisting and retrieving state from GBrain
 */

export interface GBrainPage {
  id: string;
  kind: string;
  title: string;
  content: any;
  created_at: string;
  updated_at: string;
}

export interface GBrainClientOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class GBrainClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: GBrainClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.GBRAIN_BASE_URL || 'http://localhost:3000';
    this.apiKey = options.apiKey || process.env.GBRAIN_API_KEY;
  }

  /**
   * Create or update a page in GBrain
   */
  async upsertPage(page: Omit<GBrainPage, 'created_at' | 'updated_at'>): Promise<GBrainPage> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(page),
    });

    if (!response.ok) {
      throw new Error(`GBrain upsert failed: ${response.statusText}`);
    }

    return response.json() as Promise<GBrainPage>;
  }

  /**
   * Retrieve a page by ID
   */
  async getPage(id: string): Promise<GBrainPage | null> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/pages/${id}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`GBrain get failed: ${response.statusText}`);
    }

    return response.json() as Promise<GBrainPage | null>;
  }

  /**
   * Search pages by kind and metadata
   */
  async searchPages(kind: string, query?: Record<string, any>): Promise<GBrainPage[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const url = new URL(`${this.baseUrl}/api/pages/search`);
    url.searchParams.append('kind', kind);
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GBrain search failed: ${response.statusText}`);
    }

    return response.json() as Promise<GBrainPage[]>;
  }

  /**
   * Delete a page
   */
  async deletePage(id: string): Promise<void> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/pages/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GBrain delete failed: ${response.statusText}`);
    }
  }
}
