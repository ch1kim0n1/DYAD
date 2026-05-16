import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import type { RawEmail } from '@dyad/shared';
import { getAuthorizedClient } from './gmail-oauth.js';

export interface GmailListOptions {
  query?: string;
  maxResults?: number;
  pageToken?: string;
}

export interface GmailListResult {
  emails: RawEmail[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? '';
}

function decodeBody(data: string | undefined | null): string {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return '';
}

function hasIcsAttachment(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;
  if (payload.filename?.toLowerCase().endsWith('.ics')) return true;
  if (payload.mimeType === 'text/calendar') return true;
  return payload.parts?.some((p) => hasIcsAttachment(p)) ?? false;
}

function parseMessage(msg: gmail_v1.Schema$Message): RawEmail | null {
  if (!msg.id) return null;
  const headers = msg.payload?.headers;
  const from = headerValue(headers, 'From');
  const subject = headerValue(headers, 'Subject');
  const snippet = msg.snippet ?? '';
  const body = extractPlainText(msg.payload) || snippet;
  const internalDate = msg.internalDate ? Number(msg.internalDate) : Date.now();

  return {
    gmail_id: msg.id,
    from,
    subject,
    snippet,
    body_text: body.slice(0, 8000),
    internal_date: internalDate,
    has_ics_attachment: hasIcsAttachment(msg.payload),
  };
}

export async function listGmailMessages(options: GmailListOptions = {}): Promise<GmailListResult> {
  const auth = await getAuthorizedClient();
  if (!auth) throw new Error('Gmail not connected');

  const gmail = google.gmail({ version: 'v1', auth });
  const query = options.query ?? process.env.GMAIL_SYNC_QUERY ?? 'in:inbox newer_than:2y';
  const maxResults = Math.min(
    options.maxResults ?? Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC ?? 500),
    500
  );

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    pageToken: options.pageToken,
  });

  const ids = listRes.data.messages ?? [];
  const emails: RawEmail[] = [];

  const concurrency = 8;
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const fetched = await Promise.all(
      batch.map(async (ref) => {
        if (!ref.id) return null;
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'full',
        });
        return parseMessage(full.data);
      })
    );
    for (const email of fetched) {
      if (email) emails.push(email);
    }
  }

  return {
    emails,
    nextPageToken: listRes.data.nextPageToken ?? undefined,
    resultSizeEstimate: listRes.data.resultSizeEstimate ?? undefined,
  };
}
