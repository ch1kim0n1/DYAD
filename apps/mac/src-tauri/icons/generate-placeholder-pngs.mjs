#!/usr/bin/env node
/**
 * Cross-platform placeholder PNGs for the Tauri build (#79).
 *
 * Tauri's macOS bundler requires concrete PNG files at the paths listed in
 * tauri.conf.json. On a Mac you'd run `build-icons.sh` to render proper
 * PNGs + an `.icns` from `icon.svg`. On a Windows / CI box where
 * `rsvg-convert` isn't installed, this script writes minimal valid PNGs
 * with the DYAD palette so the build still succeeds.
 *
 * Run:  node apps/mac/src-tauri/icons/generate-placeholder-pngs.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** CRC-32 — used for PNG chunks. */
function crc32(buf) {
  let c;
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Build a simple radial-blob PNG. Two overlapping circles + dark background.
 * Honest-to-god rendering, not a 1×1 stub.
 */
function makePng(size) {
  // Palette
  const BG = [0x10, 0x10, 0x14, 0xff];     // dark navy
  const SELF = [0x5b, 0x8d, 0xef, 0xff];   // blue
  const PARTNER = [0xf5, 0x9e, 0x0b, 0xff];// amber
  const BLEND = [0xfd, 0xe0, 0x47, 0xff];  // yellow (overlap)

  // Centers + radius
  const cx1 = size * 0.38, cx2 = size * 0.62, cy = size * 0.50;
  const r = size * 0.26;
  const corner = size * 0.20;

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let px = BG;
      // rounded-rect mask
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx < corner && dy < corner) {
        const rxy = Math.hypot(corner - dx, corner - dy);
        if (rxy > corner) {
          // outside the rounded corner — leave transparent
          const idx = (y * size + x) * 4;
          pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
          continue;
        }
      }
      const inSelf = Math.hypot(x - cx1, y - cy) <= r;
      const inPartner = Math.hypot(x - cx2, y - cy) <= r;
      if (inSelf && inPartner) px = BLEND;
      else if (inSelf) px = SELF;
      else if (inPartner) px = PARTNER;
      const idx = (y * size + x) * 4;
      pixels[idx] = px[0]; pixels[idx+1] = px[1]; pixels[idx+2] = px[2]; pixels[idx+3] = px[3];
    }
  }

  // PNG IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;           // bit depth
  ihdr[9] = 6;           // colour type (RGBA)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT — filter byte 0 per scanline + raw RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    pixels.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [32, 128, 256, 512, 1024]) {
  writeFileSync(join(__dirname, `icon-${size}.png`), makePng(size));
}
writeFileSync(join(__dirname, 'icon.png'), makePng(1024));
// dmg background — wide banner, dark with palette accent
writeFileSync(join(__dirname, 'dmg-background.png'), makePng(600));

console.log('Wrote icon-{32,128,256,512,1024}.png, icon.png, dmg-background.png');
console.log('On a Mac, run build-icons.sh to replace these with rsvg-convert renderings + icon.icns');
