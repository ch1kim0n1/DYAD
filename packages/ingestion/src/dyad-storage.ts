import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DYAD_HOME = path.join(os.homedir(), '.dyad');

export function dyadPath(fileName: string): string {
  return path.join(DYAD_HOME, fileName);
}

export function secureWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    try { fs.chmodSync(dir, 0o700); } catch { /* best-effort */ }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  try { fs.chmodSync(filePath, 0o600); } catch { /* best-effort */ }
}

export function secureReadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function secureDelete(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
