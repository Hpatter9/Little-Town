// A 16x16 campfire tray icon, encoded as PNG by hand so no image file is needed.

import zlib from 'node:zlib';

const ROWS = [
  '................',
  '.......y........',
  '......yy........',
  '......yoy.......',
  '.....yooy.y.....',
  '.....yoroyy.....',
  '....yorrroy.....',
  '....yorrrroy....',
  '....yorrrroy....',
  '.....orrrro.....',
  '...bbbbrrbbbb...',
  '..bBBbbbbbbBBb..',
  '..ssbbbBBbbbss..',
  '.sSs.bb..bb.sSs.',
  '.sss........sss.',
  '................',
];

const PALETTE: Record<string, [number, number, number, number]> = {
  '.': [0, 0, 0, 0],
  y: [255, 222, 110, 255],
  o: [245, 150, 50, 255],
  r: [214, 72, 40, 255],
  b: [110, 72, 40, 255],
  B: [150, 102, 58, 255],
  s: [110, 106, 102, 255],
  S: [160, 156, 150, 255],
};

/** The icon as a PNG, each pixel blown up `scale` times (the installer's app icon is the same fire at 256x256). */
export function trayIconPng(scale = 1): Buffer {
  const W = 16 * scale;
  const H = 16 * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < W; x++) raw.set(PALETTE[ROWS[Math.floor(y / scale)][Math.floor(x / scale)]], y * (W * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
