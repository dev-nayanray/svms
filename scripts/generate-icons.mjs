/**
 * Generates PWA icons without external tooling: encodes PNGs with node's zlib.
 * Blocky "SV" monogram on the brand teal; maskable variants add padding.
 * Run: node scripts/generate-icons.mjs
 */
import zlib from "node:zlib";
import fs from "node:fs";

const FONT = {
  S: ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
};
const FG = [255, 255, 255];
const BG = [15, 118, 110]; // teal-700

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // 8-bit truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function make(size, { maskable = false } = {}) {
  const pad = maskable ? Math.round(size * 0.12) : 0;
  const inner = size - pad * 2;
  const cols = 12;
  const rows = 7;
  const cell = Math.floor(inner / Math.max(cols, rows + 2));
  const gw = cols * cell;
  const gh = rows * cell;
  const ox = Math.round((size - gw) / 2);
  const oy = Math.round((size - gh) / 2);
  const grid = {};
  const draw = (glyph, gx) =>
    FONT[glyph].forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === "1") grid[`${gx + x},${y}`] = 1;
      })
    );
  draw("S", 0);
  draw("V", 7);
  return png(size, size, (x, y) => {
    if (x < pad || y < pad || x >= size - pad || y >= size - pad) return BG;
    const gx = Math.floor((x - ox) / cell);
    const gy = Math.floor((y - oy) / cell);
    return grid[`${gx},${gy}`] ? FG : BG;
  });
}

fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync("public/icons/icon-192.png", make(192));
fs.writeFileSync("public/icons/icon-512.png", make(512));
fs.writeFileSync("public/icons/maskable-512.png", make(512, { maskable: true }));
fs.writeFileSync("public/icons/apple-touch-icon.png", make(180));
console.log("icons written");
