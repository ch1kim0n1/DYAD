/**
 * HogEnricher — pulls external partner context from "The Hog" service.
 *
 * Returns a short summary + recent events that can be prepended to detector
 * prompts as system context. Cached in-memory for 1h to avoid hitting Hog
 * on every detector run.
 *
 * Graceful degradation: returns null when HOG_URL is unset or the request fails.
 */

const env = (key: string): string | undefined => {
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
  return meta?.[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined);
};

export interface HogContext {
  partner_summary: string;
  recent_events: string[];
  enriched_at: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const cache = new Map<string, { value: HogContext; expires: number }>();

export function clearHogCache(): void {
  cache.clear();
}

export async function enrichWithHog(
  conversationId: string,
  options: { force?: boolean } = {}
): Promise<HogContext | null> {
  const url = env('HOG_URL');
  if (!url) return null;

  const now = Date.now();
  if (!options.force) {
    const hit = cache.get(conversationId);
    if (hit && hit.expires > now) return hit.value;
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/enrich`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env('THE_HOG_API_KEY') ? { authorization: `Bearer ${env('THE_HOG_API_KEY')}` } : {}),
      },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<HogContext> & { partnerSummary?: string; recentEvents?: string[] };
    const value: HogContext = {
      partner_summary: data.partner_summary ?? data.partnerSummary ?? '',
      recent_events: data.recent_events ?? data.recentEvents ?? [],
      enriched_at: data.enriched_at ?? now,
    };
    cache.set(conversationId, { value, expires: now + ONE_HOUR_MS });
    return value;
  } catch (err) {
    console.warn('[hog] enrich failed:', (err as Error).message);
    return null;
  }
}
