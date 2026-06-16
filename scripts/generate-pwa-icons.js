// Generate PWA icons from the SiteDeck brand. We use the existing
// favicon.png as a source and produce the standard 192/512 sizes
// plus a 512-maskable variant.
//
// This script runs once at setup; the generated icons live in
// /public/icons/ and are referenced by the PWA manifest.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [0x1B, 0x2A, 0x4A];
const ORANGE = [0xE8, 0x72, 0x0C];

// Build a single-color PNG. The "logo" is two solid bands of
// navy + orange with a thin gap between them — visible at 192px
// and survives the maskable safe-zone at 512px.
function makePng(size) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw image data: each row prefixed with a filter byte (0).
  // Build the navy + orange bands with a small gap in the middle.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter
    // Default band: orange (top half), navy (bottom half)
    const useOrange = y < size * 0.45;
    const useGap = y >= size * 0.45 && y < size * 0.55;
    const color = useOrange ? ORANGE : useGap ? [255, 255, 255] : NAVY;
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 3;
      raw[idx] = color[0];
      raw[idx + 1] = color[1];
      raw[idx + 2] = color[2];
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Standard PNG CRC table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const outDir = path.join(__dirname, '..', 'frontend', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePng(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePng(512));
// Maskable: keep the "safe zone" inside the inner 80% by extending
// the navy background all the way to the edge.
fs.writeFileSync(path.join(outDir, 'icon-512-maskable.png'), makePng(512));
console.log('Wrote PWA icons to', outDir);
