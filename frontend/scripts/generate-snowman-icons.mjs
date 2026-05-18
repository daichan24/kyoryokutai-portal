import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function setPixel(data, size, x, y, rgba) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  data[i] = rgba[0];
  data[i + 1] = rgba[1];
  data[i + 2] = rgba[2];
  data[i + 3] = rgba[3];
}

function blendPixel(data, size, x, y, rgba, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const a = (rgba[3] / 255) * alpha;
  data[i] = Math.round(rgba[0] * a + data[i] * (1 - a));
  data[i + 1] = Math.round(rgba[1] * a + data[i + 1] * (1 - a));
  data[i + 2] = Math.round(rgba[2] * a + data[i + 2] * (1 - a));
  data[i + 3] = 255;
}

function circle(data, size, cx, cy, r, rgba) {
  const minX = Math.floor(cx - r - 1);
  const maxX = Math.ceil(cx + r + 1);
  const minY = Math.floor(cy - r - 1);
  const maxY = Math.ceil(cy + r + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r + 0.8) blendPixel(data, size, x, y, rgba, Math.max(0, Math.min(1, r + 0.8 - d)));
    }
  }
}

function rect(data, size, x0, y0, x1, y1, rgba) {
  for (let y = Math.round(y0); y < Math.round(y1); y += 1) {
    for (let x = Math.round(x0); x < Math.round(x1); x += 1) setPixel(data, size, x, y, rgba);
  }
}

function makeIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = y / size;
      setPixel(data, size, x, y, [220 - t * 25, 243 - t * 12, 255, 255]);
    }
  }

  circle(data, size, size * 0.5, size * 0.5, size * 0.43, [178, 221, 242, 255]);
  circle(data, size, size * 0.5, size * 0.69, size * 0.2, [248, 253, 255, 255]);
  circle(data, size, size * 0.5, size * 0.47, size * 0.16, [252, 254, 255, 255]);
  circle(data, size, size * 0.5, size * 0.29, size * 0.115, [252, 254, 255, 255]);

  circle(data, size, size * 0.46, size * 0.28, size * 0.012, [25, 35, 45, 255]);
  circle(data, size, size * 0.54, size * 0.28, size * 0.012, [25, 35, 45, 255]);
  circle(data, size, size * 0.5, size * 0.325, size * 0.012, [243, 115, 53, 255]);
  rect(data, size, size * 0.36, size * 0.38, size * 0.64, size * 0.42, [56, 132, 191, 255]);
  rect(data, size, size * 0.56, size * 0.405, size * 0.67, size * 0.445, [47, 103, 160, 255]);

  circle(data, size, size * 0.5, size * 0.54, size * 0.011, [31, 41, 55, 255]);
  circle(data, size, size * 0.5, size * 0.61, size * 0.011, [31, 41, 55, 255]);
  circle(data, size, size * 0.5, size * 0.68, size * 0.011, [31, 41, 55, 255]);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    data.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [file, size] of [
  ['public/favicon.png', 500],
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
]) {
  writeFileSync(resolve(frontendDir, file), makeIcon(size));
}
