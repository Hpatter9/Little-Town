// Plays a New Town scene (sceneScripts.ts) on one small canvas: the backdrop's layers scrolling (or a set laid from the
// pack's tiles), the stage's props, actors (paper dolls and pack creatures) moving along their paths, gathered
// townsfolk, and particles over them. Everything is a function of the time, so there's nothing to keep between frames,
// and it stops by itself when its canvas leaves the page (the sheet closing). The event cards cue it (`sceneCue`): at a
// vote the crowd raises its hands.

import { hkDraw } from '../art/hkFolk';
import { PACK_LAYOUT, packUrl } from '../art/creatures/packs';
import { loadImage } from '../art/loadImage';
import manifest from '../art/backdrops.json';
import { LOOP, VIEW_H, VIEW_W, type Actor, type Anim, type Crowd, type Fx, type Prop, type SceneScript } from './sceneScripts';
import { EVENT_PROPS, propFile, setFile } from './eventProps';

const ACTOR_SCALE = 1.3;
const FPS = 24;
/** The paper doll's cell for each pose: [column, row] by facing (left 1, right 2). */
const WALK = [1, 0, 2, 0];

const images = new Map<string, Promise<HTMLImageElement>>();
const image = (url: string) => {
  let p = images.get(url);
  if (!p) images.set(url, (p = loadImage(url)));
  return p;
};
const frac = (x: number) => x - Math.floor(x);
/** A steady pseudo-random number for particle `i`, stream `k`. */
const rnd = (i: number, k: number) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
/** The paper doll's row for each facing. */
const ROW = { f: 0, l: 1, r: 2, b: 3 } as const;

/** What a playing scene has been told (a vote taken), and how to draw it once more when it doesn't run on (reduced
 *  motion). */
interface Live {
  cue: string | null;
  cueAt: number;
  redraw: () => void;
  /** Draw times (ms) for the bench (`__sceneStats` on the page). */
  ms: number[];
}
const live = new WeakMap<HTMLCanvasElement, Live>();
let lastLive: Live | null = null;
/** Tell a playing scene what has happened: 'vote' (an answer taken) raises the crowd's hands for a moment. */
export function sceneCue(c: HTMLCanvasElement | null | undefined, cue: 'vote'): void {
  const l = c && live.get(c);
  if (!l) return;
  l.cue = cue;
  l.cueAt = performance.now();
  l.redraw();
}
/** The last scene's draw times: frames drawn and the mean ms (a dev hook: the event cards' frame budget). */
export function sceneStats(): { frames: number; meanMs: number; maxMs: number } | null {
  if (!lastLive || !lastLive.ms.length) return null;
  const m = lastLive.ms;
  return { frames: m.length, meanMs: m.reduce((a, b) => a + b, 0) / m.length, maxMs: Math.max(...m) };
}

/** Play a scene into any container (the New Town sheets, and whatever else wants a moving picture): `script` is a
 *  SceneScript, or the name of one in `scripts`. Returns the canvas; it stops by itself once removed from the page. */
export function playScene(container: HTMLElement, script: SceneScript | string, dolls: string[][] = [], scripts: Record<string, SceneScript> = {}): HTMLCanvasElement | null {
  const sc = typeof script === 'string' ? scripts[script] : script;
  if (!sc) return null;
  const c = animScene(sc, dolls);
  container.append(c);
  return c;
}

/** A canvas that plays `script`; `dolls` are the paper dolls' layer keys (hkFolk.ts), the one an actor's `who` names. */
export function animScene(script: SceneScript, dolls: string[][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'nt-scene nt-anim';
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  const set = script.back.startsWith('set:') ? script.back.slice(4) : null;
  const back = (manifest as Record<string, { layers: number; ext: string }>)[script.back];
  let backImg: HTMLImageElement | null = null;
  void image(set ? setFile(set) : `backdrops/${script.back}.${back?.ext ?? 'webp'}`).then((im) => (backImg = im));
  const props = new Map<string, HTMLImageElement>();
  for (const pr of script.props ?? [])
    if (EVENT_PROPS[pr.id] && !props.has(pr.id)) {
      const id = pr.id;
      void image(propFile(id)).then((im) => props.set(id, im));
    }
  const sheets = new Map<string, HTMLImageElement>();
  for (const a of script.actors)
    if (typeof a.who === 'string' && PACK_LAYOUT[a.who] && !sheets.has(a.who)) {
      const id = a.who;
      void image(packUrl(id)).then((im) => sheets.set(id, im));
    }

  let seen = false;
  const born = performance.now();
  let last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state: Live = { cue: null, cueAt: 0, redraw: () => paint(performance.now()), ms: [] };
  live.set(c, state);
  lastLive = state;
  const paint = (now: number) => {
    const t0 = performance.now();
    // (a vote's raised hands last a moment; with reduced motion they stay raised)
    const cue = state.cue && (reduced || now - state.cueAt < 2200) ? { what: state.cue, since: reduced ? 1 : (now - state.cueAt) / 1000 } : null;
    draw(g, script, dolls, backImg, sheets, props, reduced ? 2 : (now - born) / 1000, cue);
    if (state.ms.length < 400) state.ms.push(performance.now() - t0);
  };
  const frame = (now: number) => {
    if (c.isConnected) seen = true;
    else if (seen || now - born > 3000) return;
    if (now - last >= 1000 / FPS - 1) {
      last = now;
      paint(now);
    }
    if (!reduced) requestAnimationFrame(frame);
    // (still: drawn until everything it shows has loaded)
    else if (!seen || !backImg || props.size < new Set((script.props ?? []).map((p) => p.id)).size || now - born < 1500) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return c;
}

type Cue = { what: string; since: number } | null;

function draw(g: CanvasRenderingContext2D, s: SceneScript, dolls: string[][], backImg: HTMLImageElement | null, sheets: Map<string, HTMLImageElement>, props: Map<string, HTMLImageElement>, t: number, cue: Cue): void {
  g.clearRect(0, 0, VIEW_W, VIEW_H);
  // (a quake: the whole picture jolts now and then)
  const jolt = s.shake && frac(t / 1.7) < 0.3 ? Math.round(Math.sin(t * 60) * s.shake) : 0;
  g.save();
  g.translate(jolt, 0);
  const n = (manifest as Record<string, { layers: number }>)[s.back]?.layers ?? 1;
  if (backImg && s.back.startsWith('set:')) g.drawImage(backImg, 0, 0, VIEW_W, VIEW_H);
  else if (backImg) {
    const k = VIEW_H / 324;
    for (let i = 0; i < n; i++) {
      // (the far layers go slower than the near)
      const off = frac(((s.scroll ?? 0) * (n > 1 ? i / (n - 1) : 1) * t) / VIEW_W) * VIEW_W;
      for (const dx of [off - VIEW_W, off]) g.drawImage(backImg, 0, i * 324, 576, 324, Math.round(dx), 0, Math.ceil(576 * k), VIEW_H);
    }
  }
  if (s.tint) {
    g.globalAlpha = s.tint[1];
    g.fillStyle = s.tint[0];
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;
  }
  // (back to front: whatever stands further up the picture first; things hung on the wall before all)
  const order: { y: number; draw: () => void }[] = [];
  for (const p of s.props ?? []) order.push({ y: p.back ? -1 : (p.z ?? p.y ?? 0.9), draw: () => prop(g, p, props, t) });
  s.actors.forEach((a, i) => order.push({ y: a.y ?? 0.9, draw: () => actor(g, a, dolls, sheets, t, i === s.speaker ? 'talk' : null) }));
  for (const cr of s.crowd ?? []) for (const m of crowdOf(cr, dolls.length)) order.push({ y: m.y, draw: () => member(g, cr, m, dolls, t, cue) });
  order.sort((a, b) => a.y - b.y);
  for (const o of order) o.draw();
  s.fx.forEach((f, j) => fx(g, f, t, j));
  g.restore();
}

function prop(g: CanvasRenderingContext2D, p: Prop, props: Map<string, HTMLImageElement>, t: number): void {
  const art = EVENT_PROPS[p.id];
  const im = props.get(p.id);
  if (!art || !im) return;
  const k = p.k ?? 1;
  const w = Math.round(art.w * k);
  const h = Math.round(art.h * k);
  // (a strip's frame by the time, each fire a little out of step with the next)
  const f = art.frames > 1 ? Math.floor(t * 10 + p.x * 13) % art.frames : 0;
  const x = Math.round(p.x * VIEW_W);
  const y = Math.round((p.y ?? 0.9) * VIEW_H);
  g.save();
  g.translate(x, y);
  if (p.flip) g.scale(-1, 1);
  // (a shared picture shrunk to the stage is smoothed; the stage's own, and pixel cells blown up, stay crisp)
  const sw = im.width / art.frames;
  g.imageSmoothingEnabled = art.k < 1;
  g.drawImage(im, f * sw, 0, sw, im.height, -Math.round(w / 2), -h, w, h);
  g.imageSmoothingEnabled = false;
  g.restore();
}

/** Where each of a crowd stands: two staggered rows, the back one a touch smaller, by a steady jitter. */
function crowdOf(cr: Crowd, dolls: number): { i: number; doll: number; x: number; y: number; k: number }[] {
  const from = cr.from ?? 0;
  const n = Math.max(0, Math.min(cr.n, dolls - from));
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = n > 3 && cr.rows !== 1 ? i % 2 : 0;
    const x = cr.x[0] + ((cr.x[1] - cr.x[0]) * (i + 0.5)) / n + (rnd(i, 7) - 0.5) * 0.03;
    const y = row ? cr.y[0] : cr.y[1];
    out.push({ i, doll: from + i, x, y: y + (rnd(i, 8) - 0.5) * 0.02, k: row ? 0.9 : 1 });
  }
  return out;
}

/** The paper doll's column for a pose at time `t` (`ref` puts each out of step with the others). */
function poseCol(anim: Anim | 'talk', t: number, ref: number): number {
  switch (anim) {
    case 'walk': return WALK[Math.floor(t * 8) % 4];
    case 'work': return Math.floor(t * 3) % 2 ? 4 : 3;
    case 'attack': return Math.floor(t * 4) % 3 ? (Math.floor(t * 4) % 3 === 1 ? 3 : 4) : 0;
    case 'shoot': return Math.floor(t * 1.5) % 2 ? 5 : 0;
    case 'read': return 6;
    // (speaking: a hand out now and then, as one makes a point)
    case 'talk': return frac(t / 1.6 + ref * 0.37) < 0.35 ? 5 : frac(t / 2.9 + ref) < 0.2 ? 3 : 0;
    case 'kneel': return 7;
    case 'cheer': return frac(t / 0.8 + ref * 0.3) < 0.5 ? 3 : 0;
    default: return 0;
  }
}

function member(g: CanvasRenderingContext2D, cr: Crowd, m: { i: number; doll: number; x: number; y: number; k: number }, dolls: string[][], t: number, cue: Cue): void {
  const keys = dolls[m.doll];
  if (!keys) return;
  // (a murmur: now and then one shifts their weight, or turns to a neighbour)
  const r = rnd(m.i, 9);
  const u = frac(t / (2.2 + r * 2) + r);
  const shift = u < 0.12 ? (r > 0.5 ? 1 : -1) : 0;
  const turn = cr.face === 'b' && u > 0.55 && u < 0.62 ? (r > 0.5 ? 'r' : 'l') : cr.face;
  // (a vote: hands go up one after another, and stay up a while)
  const voting = cue?.what === 'vote' && cue.since > rnd(m.i, 10) * 0.6;
  const col = voting ? 3 : poseCol(cr.anim ?? 'idle', t, r);
  const h = cr.h * ACTOR_SCALE * m.k;
  const feet = m.y * VIEW_H - (voting ? Math.abs(Math.sin(t * 6 + m.i)) : 0);
  hkDraw(g, keys, col, ROW[turn], m.x * VIEW_W + shift, feet, h);
}

function actor(g: CanvasRenderingContext2D, a: Actor, dolls: string[][], sheets: Map<string, HTMLImageElement>, t: number, as: 'talk' | null): void {
  const u = frac(t / LOOP + (a.phase ?? 0));
  const x = (a.x[0] + (a.x[1] - a.x[0]) * u) * VIEW_W;
  const moving = a.x[0] !== a.x[1];
  const face = moving ? (a.x[1] < a.x[0] ? 'l' : 'r') : (a.face ?? 'r');
  // (a speaker bobs a little as they talk)
  const feet = (a.y ?? 0.9) * VIEW_H + (a.bob ? Math.sin(t * 2 + (a.phase ?? 0) * 6) * a.bob : 0) - (as === 'talk' ? Math.round(Math.max(0, Math.sin(t * 7)) ) : 0);
  const h = a.h * ACTOR_SCALE;
  if (typeof a.who === 'number') {
    const keys = dolls[Math.min(a.who, dolls.length - 1)];
    if (!keys) return;
    const row = ROW[face];
    const col = poseCol(as ?? a.anim, t, a.phase ?? 0);
    // (bobbing a step as they walk)
    const hop = a.anim === 'walk' && col !== 0 ? -1 : 0;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowOffsetY = 1;
    hkDraw(g, keys, col, row, x, feet + hop, h);
    g.restore();
    return;
  }
  const lay = PACK_LAYOUT[a.who];
  const im = sheets.get(a.who);
  if (!lay || !im) return;
  const want = a.anim === 'shoot' || a.anim === 'work' || a.anim === 'read' ? 'attack' : a.anim === 'walk' || a.anim === 'attack' ? a.anim : 'idle';
  const anim = lay.rows.includes(want) ? want : 'idle';
  const count = lay.counts[anim] ?? 1;
  const f = Math.floor(t * 9 + (a.phase ?? 0) * 7) % count;
  const row = lay.rows.indexOf(anim);
  const w = (lay.w * h) / lay.h;
  const flip = (face !== 'l') !== lay.facesRight;
  g.save();
  g.translate(Math.round(x), Math.round(feet));
  if (flip) g.scale(-1, 1);
  g.drawImage(im, f * lay.w, row * lay.h, lay.w, lay.h, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  g.restore();
}

/* ------------------------------------------------------------ particles: each a function of the time */

function fx(g: CanvasRenderingContext2D, f: Fx, t: number, j: number): void {
  const W = VIEW_W;
  const H = VIEW_H;
  const col = f.colour;
  const dot = (x: number, y: number, s: number, c: string, a = 1) => {
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), s, s);
  };
  if (f.kind === 'flash') {
    const p = t % 4;
    const a = p < 0.25 ? 0.5 * (1 - p / 0.25) : p > 0.4 && p < 0.55 ? 0.3 : 0;
    if (a > 0) {
      g.globalAlpha = a;
      g.fillStyle = col ?? '#ffffff';
      g.fillRect(0, 0, W, H);
    }
    g.globalAlpha = 1;
    return;
  }
  for (let i = 0; i < f.n; i++) {
    const k = i + j * 97;
    const r1 = rnd(k, 1);
    const r2 = rnd(k, 2);
    const r3 = rnd(k, 3);
    const ax = (f.at?.[0] ?? r1) * W;
    const ay = (f.at?.[1] ?? 0.9) * H;
    const at = f.at !== undefined;
    switch (f.kind) {
      case 'rain': {
        const u = frac(t / 0.6 + r2);
        dot(r1 * W + u * -16, u * H * 1.05 - 6, 1, col ?? '#b8d0ff', 0.6);
        dot(r1 * W + u * -16 - 1, u * H * 1.05 - 3, 1, col ?? '#b8d0ff', 0.6);
        break;
      }
      case 'snow': {
        const u = frac(t / (5 + r3 * 3) + r2);
        dot(r1 * W + Math.sin(t + k) * 6, u * H, r3 > 0.6 ? 2 : 1, '#ffffff', 0.9);
        break;
      }
      case 'ash': {
        const u = frac(t / (6 + r3 * 3) + r2);
        dot(r1 * W + Math.sin(t * 0.8 + k) * 8 + u * 20, u * H, 1, '#a8a4a0', 0.7);
        break;
      }
      case 'leaves':
      case 'petals': {
        const u = frac(t / (4 + r3 * 3) + r2);
        const c = f.kind === 'petals' ? ['#ffb0d0', '#fff0f4'][i % 2] : ['#6ac04a', '#c8a030', '#4a9a3a', '#d87a30'][i % 4];
        dot(-8 + u * (W + 16), r2 * H * 0.75 + Math.sin(u * 14 + k) * 12, 2, c, 0.95);
        break;
      }
      case 'embers': {
        const u = frac(t / (2 + r3) + r2);
        dot(ax + (at ? (r1 - 0.5) * 36 : 0) + Math.sin(t * 3 + k) * 3, ay - u * 70, 1, col ?? '#ff8a3a', 1 - u);
        break;
      }
      case 'sparks': {
        const u = frac(t / (0.7 + r3 * 0.4) + r2);
        const ang = -Math.PI * (0.15 + 0.7 * r1);
        const v = 34 + 26 * r3;
        dot(ax + Math.cos(ang) * v * u, ay + Math.sin(ang) * v * u + 70 * u * u, 1, col ?? '#ffcf5a', 1 - u);
        break;
      }
      case 'bubbles': {
        const u = frac(t / (3 + r3 * 2) + r2);
        const x = (at ? ax + (r1 - 0.5) * 30 : r1 * W) + Math.sin(t * 2 + k) * 3;
        const y = (at ? ay : H * 0.95) - u * H * 0.8;
        g.globalAlpha = 0.8 * (1 - u * 0.5);
        g.strokeStyle = col ?? '#cdeaff';
        g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, 2 + Math.floor(r3 * 3), 2 + Math.floor(r3 * 3));
        break;
      }
      case 'wisps': {
        const u = frac(t / (5 + r3 * 3) + r2);
        const x = r1 * W + Math.sin(t * 0.7 + k * 3) * 20;
        const y = H * 0.9 - u * H * 0.7;
        const a = Math.sin(u * Math.PI);
        dot(x - 1, y - 1, 4, col ?? '#8cff9a', a * 0.25);
        dot(x, y, 2, col ?? '#8cff9a', a);
        break;
      }
      case 'fireflies': {
        const x = r1 * W + Math.sin(t * 0.5 + k) * 15;
        const y = H * (0.35 + 0.5 * r2) + Math.cos(t * 0.7 + k * 2) * 8;
        const blink = 0.5 + 0.5 * Math.sin(t * 3 + k * 5);
        dot(x - 1, y - 1, 4, col ?? '#ffe970', blink * 0.2);
        dot(x, y, 2, col ?? '#ffe970', blink);
        break;
      }
      case 'dust': {
        const u = frac(t / (2 + r3 * 2) + r2);
        dot(-10 + u * (W + 20), H * (0.6 + 0.38 * r2) + Math.sin(t * 2 + k) * 3, r3 > 0.5 ? 2 : 1, col ?? '#d8c090', 0.5);
        break;
      }
      case 'smoke':
      case 'steam': {
        const steam = f.kind === 'steam';
        const u = frac(t / (steam ? 2 : 3.2) + r2);
        const s = Math.round(3 + u * (steam ? 6 : 9));
        dot((at ? ax : r1 * W) + Math.sin(u * 6 + k) * 5 + u * 14 - s / 2, (at ? ay : H * 0.6) - u * (steam ? 40 : 55), s, col ?? '#cfcfcf', (steam ? 0.45 : 0.55) * (1 - u));
        break;
      }
      case 'bats':
      case 'birds': {
        const bat = f.kind === 'bats';
        const dir = i % 2 ? -1 : 1;
        const u = frac(t / (bat ? 4.5 : 7) + r2);
        const x = dir > 0 ? -12 + u * (W + 24) : W + 12 - u * (W + 24);
        const y = H * ((bat ? 0.1 : 0.08) + 0.3 * r3) + Math.sin(t * (bat ? 6 : 2) + k * 2) * (bat ? 8 : 3);
        const up = Math.floor(t * (bat ? 10 : 4) + k) % 2;
        g.globalAlpha = 1;
        g.fillStyle = bat ? '#1a1018' : '#2a2a30';
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
        g.fillRect(Math.round(x) - 2, Math.round(y) + (up ? -1 : 1), 2, 1);
        g.fillRect(Math.round(x) + 2, Math.round(y) + (up ? -1 : 1), 2, 1);
        break;
      }
      case 'fish': {
        const dir = i % 2 ? -1 : 1;
        const u = frac(t / (5 + r3 * 3) + r2);
        const x = dir > 0 ? -8 + u * (W + 16) : W + 8 - u * (W + 16);
        const y = H * (0.3 + 0.5 * r1) + Math.sin(t * 2 + k) * 3;
        const c = ['#cfe8ff', '#ffb060', '#ffe070'][i % 3];
        g.globalAlpha = 0.95;
        g.fillStyle = c;
        g.fillRect(Math.round(x), Math.round(y), 4, 2);
        g.fillRect(Math.round(x) - dir * 2, Math.round(y) + (Math.floor(t * 8) % 2 ? 0 : 1), 2, 1);
        break;
      }
      case 'mist': {
        const u = frac(t / 22 + r2);
        g.globalAlpha = 0.12;
        g.fillStyle = col ?? '#ffffff';
        const y = H * (0.55 + 0.12 * i);
        g.fillRect(Math.round(-W + u * 2 * W), Math.round(y), W, 22);
        g.fillRect(Math.round(-W + u * 2 * W) + 20, Math.round(y) + 6, W - 40, 12);
        break;
      }
      default:
        break;
    }
  }
  g.globalAlpha = 1;
}
