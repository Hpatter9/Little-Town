// A choice event on the phone takes the whole screen (the owner's ask: room to read, a picture with it): a painted
// background chosen for the event (data/eventScenes.ts: the parallax packs' layers stacked into one picture), with
// the townsperson it's about over it when there is one, the title, the full telling, and the answers as big buttons.
// The strip's own small question card stands aside for event questions while this page shows them
// (`__eventSheet` on the strip's window, read in main.ts).

import { BACKDROPS, type BackdropId } from '../../shared/data/backdrops';
import type { Snapshot, PromptView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';

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
    const title = document.createElement('div');
    title.className = 'event-title';
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
    options.className = 'event-options';
    p.options.forEach((label, i) => {
      const b = document.createElement('button');
      b.className = i === p.defaultOption ? 'event-option default' : 'event-option';
      b.textContent = label;
      b.addEventListener('click', () => onAnswer(p.id, i));
      options.append(b);
    });
    count = document.createElement('div');
    count.className = 'event-count';
    body.append(title, text, options, count);
    el.replaceChildren(art, body);
    el.scrollTop = 0;
  };

  return {
    update(snap) {
      const p = snap.prompts.find((q) => q.kind === 'event' || q.kind === 'secret');
      const on = !!p && !snap.battle && !snap.watch && !snap.mine;
      const w = win();
      if (w) w.__eventSheet = true;
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
