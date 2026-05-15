import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CheckpointData {
  lastSeenDate: number;
  lastProcessedMessageId: string;
  checkpointTimestamp: string;
}

export interface CheckpointOptions {
  /** Conversation id (chat_id, hashed). Scopes the checkpoint file. */
  conversationId?: string;
  /** Override storage directory. Defaults to ~/.dyad/ */
  storageDir?: string;
  /** Direct path override (takes precedence over storageDir + conversationId). */
  checkpointPath?: string;
}

const DEFAULT_DIR = path.join(os.homedir(), '.dyad');

/**
 * CheckpointPersistence — save/load lastSeenDate per conversation
 * to ~/.dyad/checkpoint[-<conversationId>].json.
 */
export class CheckpointPersistence {
  private checkpointPath: string;

  constructor(options: CheckpointOptions = {}) {
    if (options.checkpointPath) {
      this.checkpointPath = options.checkpointPath;
    } else {
      const dir = options.storageDir ?? DEFAULT_DIR;
      const id = options.conversationId ?? process.env.DYAD_CONVERSATION_ID;
      const fileName = id ? `checkpoint-${id}.json` : 'checkpoint.json';
      this.checkpointPath = path.join(dir, fileName);
    }
  }

  save(data: CheckpointData): void {
    const dir = path.dirname(this.checkpointPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.checkpointPath, JSON.stringify(data, null, 2), 'utf8');
  }

  load(): CheckpointData | null {
    try {
      if (!fs.existsSync(this.checkpointPath)) return null;
      return JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8')) as CheckpointData;
    } catch {
      return null;
    }
  }

  delete(): void {
    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
    }
  }

  exists(): boolean {
    return fs.existsSync(this.checkpointPath);
  }

  getPath(): string {
    return this.checkpointPath;
  }
}
