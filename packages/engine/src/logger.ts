/**
 * Pino structured logger (#84).
 *
 * One process-wide logger. The engine, sidecar, ingestion package, and
 * any script can import `logger` and emit structured fields instead of
 * raw `console.log`. Logs go to stderr in JSON; in development with
 * `NODE_ENV !== 'production'` they're piped through `pino-pretty` for
 * a human-readable, colourised stream.
 *
 * No log line carries raw message text — only `message_id`, counts, and
 * derived metrics. See docs/SECURITY.md.
 */
import pino, { type Logger } from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

function buildLogger(): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    try {
      // pino-pretty is an optional dependency; fall back gracefully.
      return pino({
        level,
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
      });
    } catch { /* fall through */ }
  }
  return pino({ level });
}

export const logger: Logger = buildLogger();

/** Convenience child logger with a sticky `module` field. */
export function child(name: string): Logger {
  return logger.child({ module: name });
}
