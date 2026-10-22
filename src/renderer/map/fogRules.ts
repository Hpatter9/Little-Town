// The fog of war's picture, as numbers (no Pixi, so the tests can run it): one pixel a cell. Never explored is
// solid black, explored and out of sight is a cold grey veil with a cloudy texture, in sight is clear. The alpha
// eases toward its target and is blurred a little so the edges are soft, not squares.

/** The veil's strength over land seen and left. */
export const GREY_ALPHA = 0.6;
/** The grey of that veil (r, g, b): cold and dull, which mutes the colours under it. */
export const GREY_RGB: readonly [number, number, number] = [92, 98, 110];
/** How much of the way the alpha goes to its target each step (about 0.12 s a step). */
export const EASE = 0.35;

/** Where each cell wants its alpha: 1 dark, GREY_ALPHA seen once, 0 in sight. A missing record is no fog. */
export function targetAlpha(explored: string | undefined, sight: string | undefined, out: Float32Array): void {
  for (let i = 0; i < out.length; i++) {
    if (explored === undefined) out[i] = 0;
    else if (sight !== undefined && sight.charCodeAt(i) === 49) out[i] = 0;
    else out[i] = explored.charCodeAt(i) === 49 ? GREY_ALPHA : 1;
  }
}

/** Ease `cur` toward `want`; true while any cell is still on the way. */
export function ease(cur: Float32Array, want: Float32Array, k = EASE): boolean {
  let moving = false;
  for (let i = 0; i < cur.length; i++) {
    const d = want[i] - cur[i];
    if (d > 0.01 || d < -0.01) {
      cur[i] += d * k;
      moving = true;
    } else cur[i] = want[i];
  }
  return moving;
}

/** A cell's cloudiness, -1..1, the same each time. */
export function cloud(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 32768 - 1;
}

/** Paint the veil into RGBA bytes (a premultiplied-free straight alpha): a 3x3 blur of the alpha for soft edges,
 *  the colour from grey toward black as it thickens, and the cloudy texture where the veil is thin or grey. */
export function paint(cur: Float32Array, w: number, h: number, out: Uint8ClampedArray): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let wt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const k = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          sum += cur[yy * w + xx] * k;
          wt += k;
        }
      }
      let a = sum / wt;
      // (cloud only on the grey: none on solid black or on clear land)
      const mid = 4 * a * (1 - a);
      a = Math.min(1, Math.max(0, a + cloud(x, y) * 0.07 * mid));
      const thick = Math.max(0, (a - GREY_ALPHA) / (1 - GREY_ALPHA));
      const o = (y * w + x) * 4;
      out[o] = GREY_RGB[0] * (1 - thick);
      out[o + 1] = GREY_RGB[1] * (1 - thick);
      out[o + 2] = GREY_RGB[2] * (1 - thick);
      out[o + 3] = a * 255;
    }
}

/** Whether a point (px) is in sight now; with no fog record, everything is. */
export function inSight(sight: string | undefined, w: number, cell: number, x: number, y: number, h: number): boolean {
  if (sight === undefined) return true;
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return true;
  return sight.charCodeAt(cy * w + cx) === 49;
}
