import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { dyadPath, secureDelete, secureReadJson, secureWriteJson } from './dyad-storage.js';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_FILE = 'gmail-tokens.json';

export interface GmailTokenStore {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  email?: string;
  scope?: string;
}

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGmailOAuthConfig(): GmailOAuthConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ?? 'http://127.0.0.1:7432/oauth2callback';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createOAuthClient(config?: GmailOAuthConfig): OAuth2Client | null {
  const cfg = config ?? getGmailOAuthConfig();
  if (!cfg) return null;
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function loadGmailTokens(): GmailTokenStore | null {
  return secureReadJson<GmailTokenStore>(dyadPath(TOKEN_FILE));
}

export function saveGmailTokens(tokens: GmailTokenStore): void {
  secureWriteJson(dyadPath(TOKEN_FILE), tokens);
}

export function clearGmailTokens(): void {
  secureDelete(dyadPath(TOKEN_FILE));
}

export function isGmailConnected(): boolean {
  const tokens = loadGmailTokens();
  return Boolean(tokens?.access_token || tokens?.refresh_token);
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  if (!client) throw new Error('Gmail OAuth not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)');
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_READONLY_SCOPE],
  });
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokenStore> {
  const client = createOAuthClient();
  if (!client) throw new Error('Gmail OAuth not configured');
  const { tokens } = await client.getToken(code);
  const store: GmailTokenStore = {
    access_token: tokens.access_token ?? '',
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
    scope: tokens.scope ?? GMAIL_READONLY_SCOPE,
  };
  client.setCredentials(tokens);
  try {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    store.email = profile.data.emailAddress ?? undefined;
  } catch {
    /* profile optional */
  }
  saveGmailTokens(store);
  return store;
}

export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const cfg = getGmailOAuthConfig();
  const stored = loadGmailTokens();
  if (!cfg || !stored) return null;

  const client = createOAuthClient(cfg);
  if (!client) return null;

  client.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.expiry_date,
  });

  const needsRefresh =
    stored.expiry_date != null && stored.expiry_date < Date.now() + 60_000;

  if (needsRefresh && stored.refresh_token) {
    const { credentials } = await client.refreshAccessToken();
    const updated: GmailTokenStore = {
      ...stored,
      access_token: credentials.access_token ?? stored.access_token,
      expiry_date: credentials.expiry_date ?? stored.expiry_date,
      refresh_token: credentials.refresh_token ?? stored.refresh_token,
    };
    saveGmailTokens(updated);
    client.setCredentials(credentials);
  }

  return client;
}

export async function getGmailStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
}> {
  const configured = getGmailOAuthConfig() !== null;
  const tokens = loadGmailTokens();
  const connected = Boolean(tokens?.access_token || tokens?.refresh_token);
  return {
    configured,
    connected,
    email: tokens?.email,
  };
}
