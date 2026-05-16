/**
 * Shareable insight card (#90).
 *
 * Produces an 800×400 PNG @2x (1600×800) summarising a brief. Pure
 * canvas — no `html-to-image` dependency, no node module bloat, works
 * offline, and the names are anonymised on export.
 *
 * Returns a Blob the caller can save via the Tauri file dialog or a
 * download anchor.
 */
export interface ShareCardOptions {
  detectorType: string;
  severity?: string;
  brief: string;
  gottmanStatus?: 'stable' | 'warning' | 'failing';
  date?: Date;
  scale?: number;
}

const W = 800;
const H = 400;

function gottmanColour(status?: string): string {
  if (status === 'stable') return '#22c55e';
  if (status === 'warning') return '#f59e0b';
  if (status === 'failing') return '#ef4444';
  return '#8a8a92';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

export async function renderShareCardPng(options: ShareCardOptions): Promise<Blob> {
  const scale = options.scale ?? 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(scale, scale);

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0a0a0c');
  grad.addColorStop(1, '#16161a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#5b8def';
  ctx.font = 'bold 22px -apple-system, system-ui, sans-serif';
  ctx.fillText('DYAD', 32, 50);
  ctx.fillStyle = '#8a8a92';
  ctx.font = '14px -apple-system, system-ui, sans-serif';
  const date = (options.date ?? new Date()).toISOString().slice(0, 10);
  ctx.fillText(date, W - 32 - ctx.measureText(date).width, 50);

  // Title
  ctx.fillStyle = '#e8e8ed';
  ctx.font = 'bold 26px -apple-system, system-ui, sans-serif';
  const title = options.detectorType.replace(/_/g, ' ') + (options.severity ? ` · ${options.severity}` : '');
  ctx.fillText(title, 32, 110);

  // Brief
  ctx.fillStyle = '#e8e8ed';
  ctx.font = '16px -apple-system, system-ui, sans-serif';
  const lastY = wrapText(ctx, options.brief, 32, 150, W - 64, 24);

  // Gottman badge
  if (options.gottmanStatus) {
    const colour = gottmanColour(options.gottmanStatus);
    ctx.fillStyle = colour + '33';
    ctx.fillRect(32, lastY + 40, 180, 32);
    ctx.fillStyle = colour;
    ctx.font = 'bold 13px -apple-system, system-ui, sans-serif';
    ctx.fillText(`● ${options.gottmanStatus.toUpperCase()}`, 44, lastY + 60);
  }

  // Footer
  ctx.fillStyle = '#8a8a92';
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  ctx.fillText('You + Partner  ·  dyad.app', 32, H - 24);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob returned null')), 'image/png'),
  );
}

/** Helper that triggers a browser-style download. Tauri can swap this for a save dialog. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
