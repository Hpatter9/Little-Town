// The townsfolk stand on their shadows (the owner: "are they walking up off the ground? I see a shadow down low"): the
// iso looks' sprites are anchored at the figure's feet, which stand some way up each padded frame. Measured here from
// the sheets themselves, so a sheet drawn or padded differently fails rather than floating.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { CHILD_FEET_LIFT, FOLK_FEET, feetAnchor } from '../src/renderer/iso/folkRules';
import { FEET_UP, markLift, markOverFeet } from '../src/renderer/iso/founderMark';

const ROOT = join('src', 'renderer', 'art', 'iso', 'folk', 'settlers');

/** The alpha of every pixel of a PNG (8-bit, paletted with tRNS or RGBA; enough for the PixelLab sheets). */
function alphaOf(file: string): { w: number; h: number; a: Uint8Array } {
  const buf = readFileSync(file);
  let at = 8, w = 0, h = 0, type = 0, trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), kind = buf.toString('ascii', at + 4, at + 8), body = buf.subarray(at + 8, at + 8 + len);
    if (kind === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); type = body[9]; assert.equal(body[8], 8, 'an 8-bit sheet'); }
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 3 ? 1 : assert.fail(`colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      out[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = type === 6 ? out[i * 4 + 3] : trns && out[i] < trns.length ? trns[out[i]] : 255;
  return { w, h, a: alpha };
}

/** The median height of the figure's lowest pixel over the frame's foot, across a sheet's frames. */
function feetUp(look: string, anim: string): number {
  const fh: number = JSON.parse(readFileSync(join(ROOT, look, 'index.json'), 'utf8')).frame[1];
  const { w, h, a } = alphaOf(join(ROOT, look, `${anim}.png`));
  const ups: number[] = [];
  for (let r = 0; r < Math.floor(h / fh); r++)
    for (let c = 0; c < Math.floor(w / fh); c++) {
      let low = -1;
      for (let y = fh - 1; y >= 0 && low < 0; y--) for (let x = 0; x < fh; x++) if (a[(r * fh + y) * w + c * fh + x] > 40) { low = y; break; }
      if (low >= 0) ups.push(fh - 1 - low);
    }
  ups.sort((p, q) => p - q);
  return ups[ups.length >> 1];
}

test("a grown look's sprite is anchored at its feet, which the sheets draw FOLK_FEET up from the frame's foot", () => {
  for (const look of ['man_base', 'woman_base', 'founder_hero', 'founder_heroine'])
    for (const anim of ['idle', 'walk']) {
      const up = feetUp(look, anim);
      assert.ok(Math.abs(up - FOLK_FEET) <= 2, `${look} ${anim}: feet ${up}px up`);
    }
  // (anchored there, the feet land on the sprite's spot: the shadow's)
  assert.equal(Math.round((1 - feetAnchor(156, false)) * 156), FOLK_FEET);
});

test("a child's look is anchored higher, at their own feet", () => {
  for (const look of ['child_boy', 'child_girl']) {
    const up = feetUp(look, 'idle');
    assert.ok(Math.abs(up - (FOLK_FEET + CHILD_FEET_LIFT)) <= 2, `${look}: feet ${up}px up`);
  }
  assert.ok(feetAnchor(148, true) < feetAnchor(148, false));
});

test("the founder's ring sits on the spot itself, the crown over the head, once the figure stands on its feet", () => {
  for (const scale of [0.5, 1]) {
    const o = markOverFeet(scale, 0), l = markLift(scale, 0);
    assert.equal(o.ringDy, 0);
    assert.equal(o.crownDy, l.crownDy + FEET_UP * scale);
  }
});

test('someone asleep out of doors lies on the ground, breathing; in a bed, or walking to one, they do not', async () => {
  const { breathAt, sleepDir, sleepsOut, SLEEP_DIRS } = await import('../src/renderer/iso/folkRules');
  const base = { id: 3, activity: 'sleep', sinceHit: 99, sinceBlow: 99, defending: false, downed: null, hp: 10, look: { gender: 'm', outfit: 0 }, gear: {} } as never as Parameters<typeof sleepsOut>[0];
  assert.ok(sleepsOut(base, 0), 'rough sleeper by the fire');
  assert.ok(!sleepsOut({ ...base, indoors: true }, 0), 'in a bed indoors: not drawn');
  assert.ok(!sleepsOut({ ...base, activity: 'walk' }, 0));
  assert.ok(!sleepsOut(base, 40), 'still on the move');
  assert.ok(!sleepsOut({ ...base, downed: 5 } as never, 0), 'downed is the fall, not sleep');
  assert.ok(SLEEP_DIRS.includes(sleepDir(3)) && SLEEP_DIRS.includes(sleepDir(4)));
  // (one breath every few seconds, small, never shrinking the figure)
  const ys = [...Array(80).keys()].map((i) => breathAt(i * 0.1, 3).sy);
  assert.ok(Math.min(...ys) >= 1 && Math.max(...ys) < 1.05 && Math.max(...ys) - Math.min(...ys) > 0.02);
  assert.notEqual(breathAt(1, 3).sy, breathAt(1, 4).sy, 'each on their own beat');
});
