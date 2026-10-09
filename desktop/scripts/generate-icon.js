"use strict";

/**
 * Generates desktop/assets/icon.png (a 256x256 rounded blue tile with a white
 * check mark) using only Node built-ins. Run with: npm run icon
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const SIZE = 256;
const CORNER_RADIUS = 52;
const BG = [37, 99, 235]; // #2563eb
const FG = [255, 255, 255];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function roundedSquareCoverage(x, y) {
  const r = CORNER_RADIUS;
  const dx = Math.max(r - x, 0, x - (SIZE - r));
  const dy = Math.max(r - y, 0, y - (SIZE - r));
  const dist = Math.hypot(dx, dy);
  if (dist <= r - 1) return 1;
  if (dist >= r + 1) return 0;
  return Math.max(0, Math.min(1, r + 0.5 - dist));
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (vx * wx + vy * wy) / len2));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function buildPng() {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  const p1 = [SIZE * 0.28, SIZE * 0.53];
  const p2 = [SIZE * 0.44, SIZE * 0.69];
  const p3 = [SIZE * 0.73, SIZE * 0.33];
  const thickness = SIZE * 0.075;

  let offset = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const alpha = roundedSquareCoverage(cx, cy);

      const d = Math.min(
        segmentDistance(cx, cy, p1[0], p1[1], p2[0], p2[1]),
        segmentDistance(cx, cy, p2[0], p2[1], p3[0], p3[1])
      );
      let fill = 0;
      if (d <= thickness) fill = 1;
      else if (d < thickness + 1) fill = thickness + 1 - d;

      raw[offset++] = Math.round(BG[0] * (1 - fill) + FG[0] * fill);
      raw[offset++] = Math.round(BG[1] * (1 - fill) + FG[1] * fill);
      raw[offset++] = Math.round(BG[2] * (1 - fill) + FG[2] * fill);
      raw[offset++] = Math.round(alpha * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "icon.png");
fs.writeFileSync(outFile, buildPng());
console.log(`wrote ${outFile}`);
