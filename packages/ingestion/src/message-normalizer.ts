import { RawMessage, NormalizedMessage } from '@dyad/shared';
import * as crypto from 'crypto';

/**
 * Converts RawMessage to NormalizedMessage
 */
export class MessageNormalizer {
  /**
   * Convert a single raw message to normalized message
   */
  normalize(raw: RawMessage, redactedText?: string): NormalizedMessage {
    const message_id = this.generateMessageId(raw.rowid, raw.chat_id);
    const participant_id = this.generateParticipantId(raw.handle_id);
    const timestamp = this.convertAppleEpochToISO(raw.date);

    return {
      message_id,
      participant_id,
      is_from_me: raw.is_from_me,
      text: redactedText || raw.text,
      timestamp,
      chat_id: raw.chat_id,
    };
  }

  /**
   * Convert multiple raw messages to normalized messages
   */
  normalizeBatch(rawMessages: RawMessage[], redactedTexts?: Map<string, string>): NormalizedMessage[] {
    return rawMessages.map(raw => {
      const redactedText = redactedTexts?.get(`${raw.rowid}`);
      return this.normalize(raw, redactedText);
    });
  }

  /**
   * Generate message ID: SHA-256(rowid + chat_id)
   */
  private generateMessageId(rowid: number, chatId: string): string {
    const input = `${rowid}${chatId}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate participant ID: SHA-256(handle_id).slice(0, 16)
   */
  private generateParticipantId(handleId: string): string {
    const hash = crypto.createHash('sha256').update(handleId).digest('hex');
    return hash.slice(0, 16);
  }

  /**
   * Convert Apple Messages epoch to ISO 8601.
   *
   * iMessage chat.db stores `message.date` as nanoseconds since
   * 2001-01-01 00:00:00 UTC on macOS High Sierra and later. Older rows
   * (pre-High Sierra) may be stored in seconds. We detect by magnitude:
   * any value >= 1e12 is treated as nanoseconds; smaller as seconds.
   */
  private convertAppleEpochToISO(appleEpoch: number): string {
    const appleEpochStartMs = Date.UTC(2001, 0, 1, 0, 0, 0);
    const offsetMs = appleEpoch >= 1e12
      ? appleEpoch / 1_000_000
      : appleEpoch * 1000;
    return new Date(appleEpochStartMs + offsetMs).toISOString();
  }
}
