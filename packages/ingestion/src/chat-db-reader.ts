import Database from 'better-sqlite3';
import { RawMessage } from '@dyad/shared';
import * as crypto from 'crypto';

/**
 * Reads iMessages from ~/Library/Messages/chat.db
 */
export class ChatDbReader {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || `${process.env.HOME}/Library/Messages/chat.db`;
    this.db = new Database(this.dbPath, { readonly: true });
  }

  /**
   * Read messages from a specific chat
   */
  readMessages(chatId: string, since?: number): RawMessage[] {
    const query = `
      SELECT 
        m.rowid,
        m.text,
        m.handle_id,
        m.date,
        m.is_from_me,
        m.chat_id
      FROM message m
      WHERE m.chat_id = ?
        ${since ? 'AND m.date > ?' : ''}
      ORDER BY m.date ASC
    `;

    const stmt = this.db.prepare(query);
    const rows = since ? stmt.all(chatId, since) : stmt.all(chatId);

    return rows.map((row: any) => ({
      rowid: row.rowid,
      text: row.text || '',
      handle_id: this.hashHandle(row.handle_id),
      date: row.date,
      is_from_me: Boolean(row.is_from_me),
      chat_id: this.hashChatId(row.chat_id),
    }));
  }

  /**
   * Read all messages from all chats
   */
  readAllMessages(since?: number): RawMessage[] {
    const query = `
      SELECT 
        m.rowid,
        m.text,
        m.handle_id,
        m.date,
        m.is_from_me,
        m.chat_id
      FROM message m
      ${since ? 'WHERE m.date > ?' : ''}
      ORDER BY m.date ASC
    `;

    const stmt = this.db.prepare(query);
    const rows = since ? stmt.all(since) : stmt.all();

    return rows.map((row: any) => ({
      rowid: row.rowid,
      text: row.text || '',
      handle_id: this.hashHandle(row.handle_id),
      date: row.date,
      is_from_me: Boolean(row.is_from_me),
      chat_id: this.hashChatId(row.chat_id),
    }));
  }

  /**
   * Get list of all chat IDs
   */
  getChatIds(): string[] {
    const query = `
      SELECT DISTINCT chat_id
      FROM message
      WHERE chat_id IS NOT NULL
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all();

    return rows.map((row: any) => this.hashChatId(row.chat_id));
  }

  /**
   * Hash handle_id for privacy (SHA-256)
   */
  private hashHandle(handleId: string): string {
    return crypto.createHash('sha256').update(handleId).digest('hex');
  }

  /**
   * Hash chat_id for privacy
   */
  private hashChatId(chatId: string): string {
    return crypto.createHash('sha256').update(chatId).digest('hex');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
