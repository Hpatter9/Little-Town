// Writes src/renderer/art/himekoBlank.json: which cells of each paper-doll sheet in art/himeko/ are blank (the pack
// leaves some cells empty on purpose). hkFolk.ts reads it instead of reading every sheet's pixels back at start-up.
// Run by hand after the sheets change: node tools/make-himeko-blank.cjs
// A cell is blank when fewer than 8 of the pixels sampled every 2nd row and column have any alpha (the old runtime rule).
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const CELL = 128;
const dir = path.join(__dirname, '..', 'src', 'renderer', 'art', 'himeko');
/** The alpha of every pixel of an 8-bit palette PNG (colour type 3, not interlaced), as a row-major array. */
function alphaOf(buf) {
  let at = 8, w = 0, h = 0, plte = 0, trns = null;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8), body = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 3 || body[12] !== 0) throw new Error('not an 8-bit palette PNG'); }
    else if (type === 'PLTE') plte = len / 3;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (w + 1)];
    for (let x = 0; x < w; x++) {
      const v = raw[y * (w + 1) + 1 + x];
      const a = x ? px[y * w + x - 1] : 0, b = y ? px[(y - 1) * w + x] : 0, c = x && y ? px[(y - 1) * w + x - 1] : 0;
      let p = v;
      if (f === 1) p = v + a;
      else if (f === 2) p = v + b;
      else if (f === 3) p = v + ((a + b) >> 1);
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      px[y * w + x] = p & 255;
    }
  }
  return { w, h, a: (i) => { const v = px[i]; return trns ? (v < trns.length ? trns[v] : 255) : 255; } };
}
const out = {};
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.png')).sort()) {
  const { w, h, a } = alphaOf(fs.readFileSync(path.join(dir, f)));
  let bits = 0;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 8; c++) {
      let n = 0;
      for (let y = r * CELL; y < (r + 1) * CELL && y < h && n < 8; y += 2) for (let x = c * CELL; x < (c + 1) * CELL && x < w; x += 2) if (a(y * w + x) > 0) n++;
      if (n < 8) bits |= 1 << (r * 8 + c);
    }
  out[f.slice(0, -4)] = bits >>> 0;
}
fs.writeFileSync(path.join(__dirname, '..', 'src', 'renderer', 'art', 'himekoBlank.json'), JSON.stringify(out));
console.log(Object.keys(out).length, 'sheets');
