/**
 * Human-readable error message mapper (#66).
 *
 * Anything the app shows to the user — sidecar load errors, transport
 * failures, rate-limit exceptions — runs through here so we never display
 * a raw "EPERM" or "undefined is not a function" string.
 */

export interface FriendlyError {
  title: string;
  body: string;
  action?: string;       // optional one-line recovery suggestion
}

const PATTERNS: { match: RegExp; build: (raw: string) => FriendlyError }[] = [
  {
    match: /EPERM|operation not permitted|Full Disk Access|chat\.db/i,
    build: () => ({
      title: 'DYAD needs Full Disk Access',
      body: 'DYAD reads your messages locally on this device. Without Full Disk Access it can\'t open chat.db.',
      action: 'Open System Settings → Privacy & Security → Full Disk Access and enable DYAD, then relaunch.',
    }),
  },
  {
    match: /ANTHROPIC_API_KEY|invalid x-api-key|401/i,
    build: () => ({
      title: 'No valid Anthropic API key found',
      body: 'DYAD needs an Anthropic API key to generate briefs and reframes.',
      action: 'Set ANTHROPIC_API_KEY in your .env or paste a key in onboarding.',
    }),
  },
  {
    match: /chat\.db.*not found|ENOENT.*Messages\/chat\.db/i,
    build: () => ({
      title: 'No iMessage database found',
      body: 'DYAD requires macOS with iMessage. We couldn\'t find chat.db on this machine.',
      action: 'Confirm Messages.app is signed in and has at least one conversation.',
    }),
  },
  {
    match: /sidecar.*not responding|fetch failed.*7432|engine sidecar/i,
    build: () => ({
      title: 'Analysis engine isn\'t running',
      body: 'The DYAD engine sidecar isn\'t responding on localhost:7432.',
      action: 'Check the terminal that should be running `bun run sidecar:dev`.',
    }),
  },
  {
    match: /rate.?limit|429/i,
    build: () => ({
      title: 'API rate limit reached',
      body: 'We\'re going to slow down for a minute so we don\'t get throttled further.',
      action: 'Analysis will resume automatically in about 60 seconds.',
    }),
  },
  {
    match: /No recent messages|no messages found/i,
    build: () => ({
      title: 'No recent messages found',
      body: 'There are no iMessage conversations in the time window we just looked at.',
      action: 'Make sure you have active iMessage conversations and try again.',
    }),
  },
  {
    match: /MAX_LLM_CALLS_PER_SESSION/i,
    build: (raw) => ({
      title: 'Session call budget reached',
      body: raw,
      action: 'Raise MAX_LLM_CALLS_PER_SESSION in your env or restart the session.',
    }),
  },
];

/**
 * Translate a raw error / string into a FriendlyError. Falls back to a
 * generic message that includes the raw text so the user can still get
 * unstuck without seeing a stack trace.
 */
export function friendlyError(raw: unknown): FriendlyError {
  const text = raw instanceof Error ? raw.message : String(raw);
  for (const p of PATTERNS) {
    if (p.match.test(text)) return p.build(text);
  }
  return {
    title: 'Something went wrong',
    body: text,
    action: 'Reload the app, or check the console for details.',
  };
}
