/**
 * Filesystem helpers that apply owner-only permissions to anything DYAD
 * writes under `~/.dyad/` (#69).
 *
 * On POSIX systems we set 0700 on the directory and 0600 on every file
 * we create. On Windows `chmod` is a no-op via Node's compatibility
 * layer — that's fine; the user's profile directory is already private.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export function ensureSecureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: DIR_MODE });
  } else {
    try { fs.chmodSync(dirPath, DIR_MODE); } catch { /* best-effort */ }
  }
}

/**
 * Write a file under a DYAD directory. Creates parent dirs at 0700 and
 * sets the resulting file to 0600.
 */
export function secureWriteFile(filePath: string, contents: string | Buffer): void {
  ensureSecureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
  try { fs.chmodSync(filePath, FILE_MODE); } catch { /* best-effort */ }
}
