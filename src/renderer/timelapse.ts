// The town's history as a flipbook (the owner's pick): each day at noon the strip takes a small picture of the town
// (the map drawn round its buildings, main.ts `shootTown`) and keeps it on the device; the Chronicle's Timelapse tab
// plays them back, the campfire growing into whatever the town became. Kept per town (its seed) in localStorage
// (`littletown.timelapse`), at most `FRAMES_MOST`; past that every other one of the older half is dropped, so a long
// game keeps its whole span, thinner at the start. The pure parts (`thin`, `townBox`, `frameDue`) are tested.

export interface TimelapseFrame {
  day: number;
  era: string;
  people: number;
  /** A small picture (a data URL). */
  url: string;
}
export interface Timelapse {
  seed: string;
  frames: TimelapseFrame[];
}

const KEY = 'littletown.timelapse';
export const FRAMES_MOST = 80;
/** The picture's side (px), and the least of the land it covers (cells), so a young camp isn't blown up huge. */
export const SHOT_SIZE = 192;
export const SHOT_LEAST_CELLS = 26;
const PAD_CELLS = 4;
/** Taken from this hour of the day. */
export const SHOT_HOUR = 12;

export function readTimelapse(): Timelapse | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Timelapse | null;
    return t && Array.isArray(t.frames) ? t : null;
  } catch {
    return null;
  }
}
function write(t: Timelapse): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
    return true;
  } catch {
    return false; // (full: the next try thins harder)
  }
}

/** Too many frames: drop every other one of the older half (the newest are kept close together). */
export function thin(frames: TimelapseFrame[], most = FRAMES_MOST): TimelapseFrame[] {
  let out = frames;
  while (out.length > most) {
    const half = Math.floor(out.length / 2);
    out = [...out.slice(0, half).filter((_, i) => i % 2 === 0), ...out.slice(half)];
  }
  return out;
}

/** A day's picture is due: past noon, and none yet for this day of this town. */
export function frameDue(t: Timelapse | null, seed: string, day: number, hour: number): boolean {
  if (hour < SHOT_HOUR) return false;
  if (!t || t.seed !== seed) return true;
  return !t.frames.some((f) => f.day === day);
}

/** The square of the land to take: round the town's buildings, padded, never smaller than `SHOT_LEAST_CELLS`. */
export function townBox(buildings: { x: number; y: number; w: number; h: number }[], camp: { x: number; y: number }, cell: number): { x: number; y: number; w: number; h: number } {
  let x0 = camp.x;
  let y0 = camp.y;
  let x1 = camp.x;
  let y1 = camp.y;
  for (const b of buildings) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  const side = Math.max(SHOT_LEAST_CELLS * cell, x1 - x0 + 2 * PAD_CELLS * cell, y1 - y0 + 2 * PAD_CELLS * cell);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: Math.round(cx - side / 2), y: Math.round(cy - side / 2), w: Math.round(side), h: Math.round(side) };
}

/** Keep a day's picture (a new town starts a new flipbook). */
export function keepFrame(seed: string, frame: TimelapseFrame): void {
  const t = readTimelapse();
  const frames = t && t.seed === seed ? t.frames.filter((f) => f.day !== frame.day) : [];
  frames.push(frame);
  frames.sort((a, b) => a.day - b.day);
  let kept = thin(frames);
  // (storage full: thin harder until it fits, or give up on this one)
  while (!write({ seed, frames: kept }) && kept.length > 4) kept = thin(kept, Math.floor(kept.length * 0.7));
}

/** A canvas squeezed to the picture's size, as a small image. */
export function frameUrl(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  c.width = c.height = SHOT_SIZE;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.drawImage(src, 0, 0, SHOT_SIZE, SHOT_SIZE);
  const webp = c.toDataURL('image/webp', 0.72);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.75);
}
