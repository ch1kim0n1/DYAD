export interface JoEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
}

export interface JoPhoto {
  id: string;
  timestamp: string;
  location?: string;
}

export interface JoContext {
  upcoming_events: JoEvent[];
  recent_photos: JoPhoto[];
  note_snippets: string[];
}

export interface JoClientOptions {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Client for jo — personal context federation (calendar, photos, notes).
 * Gracefully returns empty context when the service is unavailable (demo mode).
 */
export class JoClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: JoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env['JO_BASE_URL'] ?? 'http://localhost:4002';
    this.apiKey = options.apiKey ?? process.env['JO_API_KEY'];
  }

  async getContext(userId: string, windowDays = 7): Promise<JoContext> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const url = new URL(`${this.baseUrl}/context`);
      url.searchParams.set('user', userId);
      url.searchParams.set('days', String(windowDays));

      const response = await fetch(url.toString(), { method: 'GET', headers });
      if (!response.ok) return this.empty();

      return (await response.json()) as JoContext;
    } catch {
      return this.empty();
    }
  }

  private empty(): JoContext {
    return { upcoming_events: [], recent_photos: [], note_snippets: [] };
  }
}
