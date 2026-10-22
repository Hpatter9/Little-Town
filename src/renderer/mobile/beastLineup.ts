// The great creature's pick (the owner's ask: "all five in a row standing idle; when you click on one, it steps forward
// out of the lineup and does an action move; the details show up below it"). The saga's question with `beasts` (sim/
// sagas.ts) is drawn in the event box (eventSheet.ts) as this: a clearing (the question's picture) with the Ape, Wolf,
// Bear, Bull and Golem standing in a row, idle. Tapped, one walks forward out of the line (the rest dim a little), plays
// its move (the wolf lunges, the bull charges, the bear rears up and roars, the golem stomps, the ape spins and hops), and
// settles in front; its card shows in the box's body: its title, what it's like, bars for learning, strength, temper and
// appetite, the work it's best at and what it needs most, and Choose, with a second step to confirm (the pick is for
// good). Tapping another sends the first back into line.
//
// The pictures are the strip's own creature sheets (`__sheetOf` on the strip's window, main.ts), the stand-ins the map
// draws (data/creature.ts `look`): when the kinds' own art comes, it plugs in there and the moves (idle, walk, attack)
// follow. Drawn on one canvas, crisp (no smoothing), only while the box is up.

import { CREATURE_DEFS, CREATURE_KINDS, kindStats, type CreatureKind } from '../../shared/data/creature';
import type { SheetDef } from '../art/creatureSheets';
import { loadImage } from '../art/loadImage';
import { reducedMotion } from '../ui/motion';

export type SheetOf = (id: string) => SheetDef | undefined;

/** How long the chosen one takes to walk out of the line, and to play its move (ms). */
const STEP_MS = 650;
const MOVE_MS = 1100;
/** How far forward it walks (a share of the picture's height), and how much bigger it is drawn there. */
const FORWARD = 0.16;
const NEARER = 1.25;

interface Slot {
  kind: CreatureKind;
  sheet: SheetDef | undefined;
  image: HTMLImageElement | null;
  /** 0 in the line to 1 in front (eased), and when it last started moving. */
  out: number;
  from: number;
  to: number;
  at: number;
  /** When its move began (while it plays). */
  moved: number;
}

/** A frame's rectangle on its sheet, by pose: a strip's own rows, or a four-facing sheet's block (it faces you). */
function frameOf(def: SheetDef, block: number, pose: 'idle' | 'walk' | 'attack', f: number, facing = 0): { x: number; y: number } {
  if (def.strip) {
    const seq = def.strip[pose].length ? def.strip[pose] : def.strip.walk;
    const i = seq[((Math.floor(f) % seq.length) + seq.length) % seq.length];
    return { x: (i % def.strip.perRow) * def.w, y: Math.floor(i / def.strip.perRow) * def.h };
  }
  const bx = (block % def.blocksAcross) * 3;
  const by = Math.floor(block / def.blocksAcross) * 4;
  // (standing still is the middle of the walk; the walk is its three frames)
  const n = pose === 'idle' ? 1 : ((Math.floor(f) % 3) + 3) % 3;
  return { x: (bx + n) * def.w, y: (by + facing) * def.h };
}

export interface BeastLineup {
  /** The picture with the five in it (for the box's art), and the card of the one chosen (for its body). */
  scene: HTMLElement;
  card: HTMLElement;
  stop(): void;
}

export function beastLineup(sheetOf: SheetOf, backdrop: Promise<HTMLCanvasElement> | null, onChoose: (option: number) => void): BeastLineup {
  const scene = document.createElement('div');
  scene.className = 'beast-scene';
  const canvas = document.createElement('canvas');
  canvas.className = 'beast-canvas';
  scene.append(canvas);
  const card = document.createElement('div');
  card.className = 'beast-card';
  const still = reducedMotion();
  let back: HTMLCanvasElement | null = null;
  void backdrop?.then((c) => (back = c)).catch(() => undefined);
  const slots: Slot[] = CREATURE_KINDS.map((kind) => ({ kind, sheet: sheetOf(CREATURE_DEFS[kind].look.sheet), image: null, out: 0, from: 0, to: 0, at: 0, moved: -1 }));
  for (const s of slots) if (s.sheet) void loadImage(s.sheet.url).then((im) => (s.image = im)).catch(() => undefined);
  let picked = -1;
  let confirming = false;

  const outOf = (s: Slot, now: number) => {
    const t = Math.min(1, (now - s.at) / STEP_MS);
    const e = t * t * (3 - 2 * t);
    return s.from + (s.to - s.from) * e;
  };
  const slotX = (i: number, w: number) => (w * (i + 0.5)) / slots.length;

  const draw = (now: number) => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const g = canvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    if (back) {
      // (the clearing, cropped to cover)
      const k = Math.max(w / back.width, h / back.height);
      g.drawImage(back, (w - back.width * k) / 2, (h - back.height * k) / 2, back.width * k, back.height * k);
    } else {
      g.fillStyle = '#2a3a24';
      g.fillRect(0, 0, w, h);
    }
    // (the ground they stand on, a little darker toward the front)
    const ground = g.createLinearGradient(0, h * 0.55, 0, h);
    ground.addColorStop(0, '#0000');
    ground.addColorStop(1, '#0008');
    g.fillStyle = ground;
    g.fillRect(0, h * 0.55, w, h * 0.45);
    // (a person's height in the picture, so the five fit across it: each drawn by its own scale against it)
    const tall = Math.min(h * 0.3, (w / slots.length) * 0.8);
    const order = slots.map((s, i) => ({ s, i, o: outOf(s, now) })).sort((a, b) => a.o - b.o);
    for (const { s, i, o } of order) {
      const def = s.sheet;
      if (!def || !s.image) continue;
      const look = CREATURE_DEFS[s.kind].look;
      const moving = Math.abs(s.to - s.from) > 0 && now - s.at < STEP_MS;
      const moveT = s.moved >= 0 ? (now - s.moved) / MOVE_MS : -1;
      const acting = moveT >= 0 && moveT < 1;
      const secs = now / 1000;
      let pose: 'idle' | 'walk' | 'attack' = moving ? 'walk' : 'idle';
      let f = moving ? secs * 10 : secs * 6;
      let facing = 0;
      let lift = 0;
      let stretch = 1;
      let lunge = 0;
      if (acting && !still) {
        if (def.strip) {
          // (a strip's own attack row, played once, with a lunge forward)
          pose = 'attack';
          f = moveT * def.strip.attack.length;
          lunge = Math.sin(moveT * Math.PI) * 0.12;
        } else if (s.kind === 'ape') {
          // (a clever spin on the spot, and two hops)
          facing = [0, 1, 3, 2][Math.floor(moveT * 8) % 4];
          lift = Math.abs(Math.sin(moveT * Math.PI * 2)) * 0.18;
          pose = 'walk';
          f = secs * 12;
        } else if (s.kind === 'bear') {
          // (it rears up, and comes down with a roar)
          stretch = 1 + Math.sin(Math.min(1, moveT * 1.6) * Math.PI) * 0.28;
          lift = Math.sin(Math.min(1, moveT * 1.6) * Math.PI) * 0.06;
        } else {
          // (the golem lifts a great foot and stamps: the ground shakes)
          lift = moveT < 0.5 ? Math.sin(moveT * Math.PI) * 0.12 : 0;
          pose = 'walk';
          f = moveT < 0.5 ? 0 : 1;
        }
      }
      const fr = frameOf(def, look.block, pose, f, facing);
      // (as on the map, where `look.scale` draws it a person's height, 40px)
      const k = (tall / 40) * look.scale * (1 + (NEARER - 1) * o);
      const cx = slotX(i, w) + lunge * w * (i < 2 ? 1 : -1) * 0.3;
      const feet = h * (0.72 + FORWARD * o) - lift * h;
      const dw = def.w * k;
      const dh = def.h * k * stretch;
      const top = feet - dh * (def.feet ?? 1);
      // (its shadow, then it: dimmed while another is out in front)
      g.globalAlpha = 0.35;
      g.fillStyle = '#000';
      g.beginPath();
      g.ellipse(cx, h * (0.72 + FORWARD * o), dw * 0.22, dw * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.save();
      // (the rest stand back in the shade while one is out in front)
      if (picked >= 0 && picked !== i) g.filter = 'brightness(0.55)';
      // (strips face left unless they say otherwise; the line faces the middle)
      const faceRight = i < slots.length / 2;
      const flip = def.strip ? (def.facesRight ? !faceRight : faceRight) : false;
      g.translate(cx, 0);
      if (flip) g.scale(-1, 1);
      g.drawImage(s.image, fr.x, fr.y, def.w, def.h, -dw / 2, top, dw, dh);
      g.restore();
      g.globalAlpha = 1;
      if (acting && !still && s.kind === 'golem' && moveT >= 0.5 && moveT < 0.75) {
        // (a puff of dust where the foot came down)
        g.globalAlpha = 1 - (moveT - 0.5) * 4;
        g.fillStyle = '#d8c8a0';
        for (let d = -2; d <= 2; d++) {
          g.beginPath();
          g.arc(cx + d * dw * 0.12, feet - 4, dw * 0.05 * (1 + (moveT - 0.5) * 6), 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }
  };

  let raf = 0;
  const born = performance.now();
  const loop = (now: number) => {
    // (the box went another way, or closed: nothing more to draw)
    if (!canvas.isConnected && now - born > 1000) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const pick = (i: number) => {
    const now = performance.now();
    if (i === picked) {
      // (tapped again: it does its move once more)
      slots[i].moved = now;
      return;
    }
    if (picked >= 0) {
      const old = slots[picked];
      old.from = outOf(old, now);
      old.to = 0;
      old.at = now;
      old.moved = -1;
    }
    picked = i;
    confirming = false;
    const s = slots[i];
    s.from = outOf(s, now);
    s.to = 1;
    s.at = now;
    s.moved = now + STEP_MS;
    showCard();
  };
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    pick(Math.max(0, Math.min(slots.length - 1, Math.floor(((ev.clientX - r.left) / r.width) * slots.length))));
  });

  const showCard = () => {
    if (picked < 0) {
      const hint = document.createElement('div');
      hint.className = 'beast-hint';
      hint.textContent = 'Tap one of the five to bring it forward.';
      return card.replaceChildren(hint);
    }
    const kind = slots[picked].kind;
    const d = CREATURE_DEFS[kind];
    const head = document.createElement('div');
    head.className = 'beast-head';
    const name = document.createElement('div');
    name.className = 'beast-name';
    name.textContent = `The ${d.name}`;
    const title = document.createElement('div');
    title.className = 'beast-title';
    title.textContent = d.title;
    head.append(name, title);
    const lines = d.flavour.map((t) => {
      const p = document.createElement('p');
      p.className = 'beast-flavour';
      p.textContent = t;
      return p;
    });
    const bars = document.createElement('div');
    bars.className = 'beast-bars';
    for (const b of kindStats(kind)) {
      const row = document.createElement('div');
      row.className = 'beast-bar';
      const label = document.createElement('span');
      label.textContent = b.label;
      const track = document.createElement('span');
      track.className = 'beast-track';
      const fill = document.createElement('i');
      fill.style.width = `${Math.round(Math.max(0.08, Math.min(1, b.value)) * 100)}%`;
      track.append(fill);
      row.append(label, track);
      bars.append(row);
    }
    const good = document.createElement('div');
    good.className = 'beast-line';
    good.append(strong('Best at: '), document.createTextNode(d.goodAt));
    const need = document.createElement('div');
    need.className = 'beast-line';
    need.append(strong('Needs most: '), document.createTextNode(d.needsMost));
    const act = document.createElement('div');
    act.className = 'beast-act';
    if (!confirming) {
      const b = button(`Choose the ${d.name}`, 'event-option recommended', () => {
        confirming = true;
        showCard();
      });
      act.append(b);
    } else {
      const sure = document.createElement('div');
      sure.className = 'beast-sure';
      sure.textContent = `Raise the ${d.name}? The town keeps the one it takes: this can't be undone.`;
      act.append(
        sure,
        button(`Yes, the ${d.name}`, 'event-option recommended', () => onChoose(CREATURE_KINDS.indexOf(kind))),
        button('Look again', 'event-option', () => {
          confirming = false;
          showCard();
        }),
      );
    }
    card.replaceChildren(head, ...lines, bars, good, need, act);
  };
  showCard();
  return {
    scene,
    card,
    stop: () => cancelAnimationFrame(raf),
  };
}

function strong(t: string): HTMLElement {
  const b = document.createElement('b');
  b.textContent = t;
  return b;
}
function button(label: string, cls: string, on: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', on);
  return b;
}
