// A choice event on the phone takes the whole screen (the owner's ask: room to read, a picture with it): a painted
// background chosen for the event (data/eventScenes.ts: the parallax packs' layers stacked into one picture), with
// the townsperson it's about over it when there is one, the title, the full telling, and the answers as big buttons.
// The strip's own small question card stands aside for event questions while this page shows them
// (`__eventSheet` on the strip's window, read in main.ts). Answered, the box stays: the answer taken and what came of it
// (`snapshot.eventOutcome`, set by `setOutcome` in the sim) take the answers' place, and Continue closes it.

import { BACKDROPS, type BackdropId } from '../../shared/data/backdrops';
import type { Snapshot, PromptView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import { emblemCanvas } from '../art/emblems';

const W = 576;
const H = 324;
const pictures = new Map<string, Promise<HTMLCanvasElement>>();
/** A painted background's layers, far to near, laid on one canvas. */
function backdrop(id: string): Promise<HTMLCanvasElement> {
  let p = pictures.get(id);
  if (!p) {
    const layers = BACKDROPS[id as BackdropId] ?? 1;
    p = loadImage(`backdrops/${id}.webp`).then((im) => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < layers; i++) g.drawImage(im, 0, i * H, W, H, 0, 0, W, H);
      return c;
    });
    p.catch(() => pictures.delete(id));
    pictures.set(id, p);
  }
  return p;
}

export interface EventSheet {
  update(snap: Snapshot): void;
}

export function createEventSheet(onAnswer: (prompt: number, option: number) => void, strip: HTMLIFrameElement): EventSheet {
  const el = document.createElement('div');
  el.id = 'event-sheet';
  el.hidden = true;
  document.body.append(el);
  let shown = -1;
  let count: HTMLElement | null = null;
  /** The answer given, while the box shows what came of it. */
  let answered: { id: number; from: number; at: number; box: HTMLElement; told: boolean } | null = null;
  let tick = 0;
  /** Debriefs read (closed at once, never shown again while the sim catches up). */
  const read = new Set<number>();
  /** Waiting this long (real ms) with nothing come of it, the box says so and lets you go on. */
  const QUIET_MS = 2500;
  const win = () => strip.contentWindow as (Window & { __eventSheet?: boolean; __picture?: (h: { person?: number }) => HTMLCanvasElement | null }) | null;

  const build = (p: PromptView) => {
    shown = p.id;
    const art = document.createElement('div');
    art.className = 'event-art';
    if (p.picture) {
      void backdrop(p.picture).then((c) => {
        if (shown !== p.id) return;
        c.className = 'event-backdrop';
        art.prepend(c);
      });
    }
    // the townsperson it's about, stood in the picture
    if (p.who != null) {
      const face = win()?.__picture?.({ person: p.who });
      if (face) {
        face.className = 'event-who';
        art.append(face);
      }
    }
    const body = document.createElement('div');
    body.className = 'event-body';
    const evolve = p.kind === 'evolve' && !!p.roads?.length;
    if (evolve) el.classList.add('evolve');
    else el.classList.remove('evolve');
    const title = document.createElement('div');
    title.className = evolve ? 'event-title evolve-title' : 'event-title';
    title.textContent = p.title;
    const text = document.createElement('div');
    text.className = 'event-text';
    for (const para of (p.story ?? p.text).split(/(?<=[.!?])\s+(?=[A-Z"'(])/).reduce<string[]>((out, s, i) => {
      // (two or three sentences a paragraph, so it reads like a page)
      if (i % 3 === 0) out.push(s);
      else out[out.length - 1] += ` ${s}`;
      return out;
    }, [])) {
      const para2 = document.createElement('p');
      para2.textContent = para;
      text.append(para2);
    }
    const options = document.createElement('div');
    options.className = evolve ? 'event-options evolve-options' : 'event-options';
    const choose = (label: string, i: number) => {
        if (answered) return;
        onAnswer(p.id, i);
        if (p.kind === 'debrief' || p.kind === 'watch') {
          read.add(p.id);
          shown = -1;
          el.hidden = true;
          document.body.classList.remove('event-open');
          return;
        }
        options.replaceWith(answerBox(p, label));
    };
    // an evolution: each road a card with its emblem, its role, its telling and its signature skill
    if (evolve) {
      for (const [i, r] of p.roads!.entries()) {
        const card = document.createElement('div');
        card.className = 'road-card';
        const head = document.createElement('div');
        head.className = 'road-head';
        head.append(emblemCanvas(r.id, 64));
        const names = document.createElement('div');
        names.className = 'road-names';
        const name = document.createElement('div');
        name.className = 'road-name';
        name.textContent = r.name;
        const role = document.createElement('div');
        role.className = 'road-role';
        role.textContent = r.role;
        names.append(name, role);
        head.append(names);
        const lore = document.createElement('p');
        lore.className = 'road-lore';
        lore.textContent = r.lore;
        card.append(head, lore);
        if (r.skill) {
          const sk = document.createElement('div');
          sk.className = 'road-skill';
          const skName = document.createElement('span');
          skName.className = 'road-skill-name';
          skName.textContent = `✧ ${r.skill.name}`;
          sk.append(skName, document.createTextNode(` ${r.skill.text}`));
          card.append(sk);
        }
        const b = document.createElement('button');
        b.className = 'event-option road-take';
        b.textContent = `Walk the ${r.name}'s road`;
        b.addEventListener('click', () => choose(r.name, i));
        card.append(b);
        options.append(card);
      }
      const rest = p.options.slice(p.roads!.length);
      rest.forEach((label, j) => {
        const i = p.roads!.length + j;
        const b = document.createElement('button');
        b.className = i === p.defaultOption ? 'event-option default road-let' : 'event-option road-let';
        b.textContent = label;
        b.addEventListener('click', () => choose(label, i));
        options.append(b);
      });
    }
    if (!evolve) p.options.forEach((label, i) => {
      const b = document.createElement('button');
      b.className = i === p.defaultOption ? 'event-option default' : 'event-option';
      b.textContent = label;
      b.addEventListener('click', () => {
        if (answered) return;
        onAnswer(p.id, i);
        // (a debrief is read, not answered, and a fight to watch is watched or not: either just closes)
        if (p.kind === 'debrief' || p.kind === 'watch') {
          read.add(p.id);
          shown = -1;
          el.hidden = true;
          document.body.classList.remove('event-open');
          return;
        }
        options.replaceWith(answerBox(p, label));
      });
      options.append(b);
    });
    count = document.createElement('div');
    count.className = 'event-count';
    body.append(title, text, options, count);
    el.replaceChildren(art, body);
    el.scrollTop = 0;
  };

  /** In the answers' place once one is taken: the choice, then what came of it, then Continue. */
  const answerBox = (p: PromptView, label: string): HTMLElement => {
    const box = document.createElement('div');
    box.className = 'event-result';
    const chose = document.createElement('div');
    chose.className = 'event-chose';
    chose.textContent = label;
    const came = document.createElement('div');
    came.className = 'event-came waiting';
    came.textContent = '…';
    const go = document.createElement('button');
    go.className = 'event-option event-continue';
    go.textContent = 'Continue';
    go.hidden = true;
    go.addEventListener('click', () => {
      answered = null;
      shown = -1;
      el.hidden = true;
      document.body.classList.remove('event-open');
    });
    box.append(chose, came, go);
    answered = { id: p.id, from: tick, at: performance.now(), box, told: false };
    if (count) count.textContent = '';
    count = null;
    return box;
  };
  /** What came of the answer, when the sim has told it (or, after a while, that nothing more did). */
  const tell = (snap: Snapshot) => {
    const a = answered!;
    if (a.told) return;
    const o = snap.eventOutcome;
    const came = a.box.querySelector('.event-came') as HTMLElement;
    const go = a.box.querySelector('.event-continue') as HTMLElement;
    if (o && o.tick >= a.from) {
      came.classList.remove('waiting');
      came.replaceChildren();
      const head = document.createElement('div');
      head.className = 'event-came-head';
      head.textContent = 'What came of it';
      const body = document.createElement('div');
      body.textContent = o.text ? o.text[0].toUpperCase() + o.text.slice(1) + (/[.!?)]$/.test(o.text) ? '' : '.') : 'Nothing more came of it.';
      came.append(head, body);
    } else if (performance.now() - a.at > QUIET_MS) {
      came.classList.remove('waiting');
      came.textContent = 'It is done.';
    } else return;
    a.told = true;
    go.hidden = false;
  };

  return {
    update(snap) {
      tick = snap.tick;
      const away = !!snap.battle || !!snap.watch || !!snap.mine;
      const w = win();
      if (w) w.__eventSheet = true;
      if (answered && away) answered = null;
      if (answered) {
        el.hidden = false;
        document.body.classList.add('event-open');
        tell(snap);
        return;
      }
      const p = snap.prompts.find((q) => !read.has(q.id) && (q.kind === 'event' || q.kind === 'secret' || q.kind === 'saga' || q.kind === 'road' || q.kind === 'debrief' || q.kind === 'envoy' || q.kind === 'watch' || q.kind === 'dragon' || q.kind === 'evolve' || q.kind === 'refugees' || q.kind === 'village' || q.kind === 'council' || q.kind === 'trial' || q.kind === 'revolt'));
      const on = !!p && !away;
      el.hidden = !on;
      document.body.classList.toggle('event-open', on);
      if (!on || !p) {
        shown = -1;
        return;
      }
      if (p.id !== shown) build(p);
      if (count) count.textContent = p.secondsLeft === null ? '' : `If nobody chooses: "${p.options[p.defaultOption]}" in ${Math.ceil(p.secondsLeft)}s`;
    },
  };
}
