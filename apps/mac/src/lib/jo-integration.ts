/**
 * Jo integration — pulls the user's personal life context (calendar, notes,
 * recent mood) so the self-model can distinguish stress-induced changes
 * from baseline patterns.
 *
 * Cached in-memory for 30m. Returns null when JO_URL is unset or the
 * request fails (graceful degradation).
 */

const env = (key: string): string | undefined => {
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env;
  return meta?.[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined);
};

export interface JoContext {
  recent_calendar_summary: string;
  mood_indicators: string[];
  contextualized_at: number;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
let cached: { value: JoContext; expires: number } | null = null;

export function clearJoCache(): void {
  cached = null;
}

export async function getJoContext(
  options: { force?: boolean } = {}
): Promise<JoContext | null> {
  const url = env('JO_URL');
  if (!url) return null;

  const now = Date.now();
  if (!options.force && cached && cached.expires > now) return cached.value;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/context`, {
      method: 'GET',
      headers: env('JO_API_KEY') ? { authorization: `Bearer ${env('JO_API_KEY')}` } : {},
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<JoContext> & {
      recentCalendarSummary?: string;
      moodIndicators?: string[];
    };
    const value: JoContext = {
      recent_calendar_summary:
        data.recent_calendar_summary ?? data.recentCalendarSummary ?? '',
      mood_indicators: data.mood_indicators ?? data.moodIndicators ?? [],
      contextualized_at: data.contextualized_at ?? now,
    };
    cached = { value, expires: now + THIRTY_MINUTES_MS };
    return value;
  } catch (err) {
    console.warn('[jo] context failed:', (err as Error).message);
    return null;
  }
}

/**
 * Format Jo context as a prompt-ready string. Returns empty string when
 * context is null so it can be concatenated unconditionally.
 */
export function formatJoForPrompt(ctx: JoContext | null): string {
  if (!ctx) return '';
  const moods = ctx.mood_indicators.length > 0 ? ` Moods: ${ctx.mood_indicators.join(', ')}.` : '';
  return `User's recent life context: ${ctx.recent_calendar_summary}.${moods}`.trim();
}
