import { EventEmitter } from 'node:events';
import chokidar, { FSWatcher } from 'chokidar';
import { ChatDbReader } from './chat-db-reader.js';
import { CheckpointPersistence } from './checkpoint-persistence.js';
import { RawMessage } from '@dyad/shared';

export interface ChatDbWatcherOptions {
  dbPath?: string;
  conversationId?: string;
  checkpoint?: CheckpointPersistence;
  reader?: ChatDbReader;
  /** Polling interval (ms). Default 30s. */
  pollIntervalMs?: number;
}

export interface ChatDbWatcherEvents {
  messages: (messages: RawMessage[]) => void;
  error: (err: Error) => void;
  poll: (info: { count: number; lastSeenDate: number }) => void;
}

/**
 * Watches `chat.db` for changes and polls every `pollIntervalMs` (default 30s).
 * Emits:
 *   - `messages` whenever new rows are seen
 *   - `error` on poll failure
 *   - `poll` after every poll (count may be 0)
 *
 * On construction, attempts to restore `lastSeenDate` from CheckpointPersistence.
 * After every successful poll that yielded messages, the checkpoint is updated.
 */
export class ChatDbWatcher extends EventEmitter {
  private reader: ChatDbReader;
  private watcher: FSWatcher;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastSeenDate: number;
  private dbPath: string;
  private checkpoint: CheckpointPersistence;
  private conversationId?: string;
  private pollIntervalMs: number;

  constructor(options: ChatDbWatcherOptions = {}) {
    super();
    this.dbPath = options.dbPath ?? `${process.env.HOME}/Library/Messages/chat.db`;
    this.conversationId = options.conversationId ?? process.env.DYAD_CONVERSATION_ID;
    this.reader = options.reader ?? new ChatDbReader(this.dbPath);
    this.checkpoint = options.checkpoint ?? new CheckpointPersistence({
      conversationId: this.conversationId,
    });
    this.pollIntervalMs = options.pollIntervalMs ?? 30_000;

    const loaded = this.checkpoint.load();
    this.lastSeenDate = loaded?.lastSeenDate ?? 0;

    this.watcher = chokidar.watch(this.dbPath, { persistent: true, ignoreInitial: true });
    this.watcher.on('change', () => this.pollForNewMessages());
    this.watcher.on('error', err => this.emit('error', err as Error));
  }

  on<K extends keyof ChatDbWatcherEvents>(event: K, listener: ChatDbWatcherEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof ChatDbWatcherEvents>(
    event: K,
    ...args: Parameters<ChatDbWatcherEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  start(pollIntervalMs?: number): void {
    if (pollIntervalMs) this.pollIntervalMs = pollIntervalMs;
    this.pollForNewMessages();
    this.pollInterval = setInterval(() => this.pollForNewMessages(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.watcher.close();
    this.reader.close();
  }

  private pollForNewMessages(): void {
    try {
      const newMessages = this.conversationId
        ? this.reader.readMessages(this.conversationId, this.lastSeenDate || undefined)
        : this.reader.readAllMessages(this.lastSeenDate || undefined);

      if (newMessages.length > 0) {
        this.lastSeenDate = newMessages[newMessages.length - 1].date;
        this.checkpoint.save({
          lastSeenDate: this.lastSeenDate,
          lastProcessedMessageId: String(newMessages[newMessages.length - 1].rowid),
          checkpointTimestamp: new Date().toISOString(),
        });
        this.emit('messages', newMessages);
      }
      this.emit('poll', { count: newMessages.length, lastSeenDate: this.lastSeenDate });
    } catch (err) {
      this.emit('error', err as Error);
    }
  }

  setLastSeenDate(date: number): void {
    this.lastSeenDate = date;
  }

  getLastSeenDate(): number {
    return this.lastSeenDate;
  }
}
