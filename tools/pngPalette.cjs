// Re-saves an RGBA PNG (8-bit, not interlaced: what Chromium writes) as a palette PNG when it has 256 colours or
// fewer (pixel art nearly always does), at zlib's best compression. Used by tools/import-himeko.cjs.
const zlib = require('zlib');

function chunks(buf) {
  const out = [];
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i);
    out.push({ type: buf.toString('latin1', i + 4, i + 8), data: buf.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
  }
  return out;
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** RGBA pixels of a colour-type-6, 8-bit PNG. */
function decode(buf) {
  const cs = chunks(buf);
  const ihdr = cs.find((c) => c.type === 'IHDR').data;
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  if (ihdr[8] !== 8 || ihdr[9] !== 6 || ihdr[12] !== 0) return null;
  const raw = zlib.inflateSync(Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const px = Buffer.alloc(w * h * 4);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, px };
}

/** The PNG again, as a palette image if it can be (else unchanged). */
function palettise(buf) {
  const img = decode(buf);
  if (!img) return buf;
  const { w, h, px } = img;
  const index = new Map();
  const idx = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    // (fully clear pixels are all one colour)
    const a = px[i * 4 + 3];
    const key = a === 0 ? 0 : ((px[i * 4] << 24) | (px[i * 4 + 1] << 16) | (px[i * 4 + 2] << 8) | a) >>> 0;
    let n = index.get(key);
    if (n === undefined) {
      if (index.size >= 256) return buf;
      n = index.size;
      index.set(key, n);
    }
    idx[i] = n;
  }
  const plte = Buffer.alloc(index.size * 3);
  const trns = Buffer.alloc(index.size);
  for (const [key, n] of index) {
    plte[n * 3] = key >>> 24;
    plte[n * 3 + 1] = (key >>> 16) & 0xff;
    plte[n * 3 + 2] = (key >>> 8) & 0xff;
    trns[n] = key & 0xff;
  }
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) idx.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const out = Buffer.concat([
    buf.subarray(0, 8),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('tRNS', trns),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return out.length < buf.length ? out : buf;
}

module.exports = { palettise };
