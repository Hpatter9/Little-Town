// A choice event on the phone takes the whole screen (the owner's ask: room to read, a picture with it): a painted
// background chosen for the event (data/eventScenes.ts: the parallax packs' layers stacked into one picture), with
// the townsperson it's about over it when there is one, the title, the full telling, and the answers as big buttons.
// The strip's own small question card stands aside for event questions while this page shows them
// (`__eventSheet` on the strip's window, read in main.ts). Answered, the box stays: the answer taken and what came of it
// (`snapshot.eventOutcome`, set by `setOutcome` in the sim) take the answers' place, and Continue closes it.

import { holdWhileUp } from './popupHold';
import { EVENT_BOX_KINDS } from '../../shared/sim/popups';
import { BACKDROPS, type BackdropId } from '../../shared/data/backdrops';
import type { Snapshot, PromptView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import { emblemCanvas } from '../art/emblems';
import { playEventScene } from '../panel/eventScenePlay';
import { addCardStyles } from '../panel/cardsStyles';
import { reducedMotion } from '../ui/motion';

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

export function createEventSheet(onAnswer: (prompt: number, option: number) => void, strip: HTMLIFrameElement, onPark: (prompt: number) => void = () => {}): EventSheet {
  const el = document.createElement('div');
  el.id = 'event-sheet';
  el.hidden = true;
  document.body.append(el);
  holdWhileUp(el); // (the box holds the town while it's up, the outcome's page too: popupHold.ts)
  let shown = -1;
  let count: HTMLElement | null = null;
  /** The answer given, while the box shows what came of it. */
  let answered: { id: number; from: number; at: number; box: HTMLElement; told: boolean } | null = null;
  let tick = 0;
  let lastSnap: Snapshot | null = null;
  /** Debriefs read (closed at once, never shown again while the sim catches up). */
  const read = new Set<number>();
  /** Waiting this long (real ms) with nothing come of it, the box says so and lets you go on. */
  const QUIET_MS = 2500;
  const win = () => strip.contentWindow as (Window & { __eventSheet?: boolean; __picture?: (h: { person?: number }) => HTMLCanvasElement | null }) | null;

  /** The corner ✕: closes the box. A choice is closed unanswered and waits behind the choices button (the town goes on,
   *  unless the choice holds it); a debrief is read; the page of what came of an answer is gone on from. */
  const x = document.createElement('button');
  x.className = 'event-x';
  x.textContent = '✕';
  x.title = 'Close';
  x.setAttribute('aria-label', 'Close');
  let current: PromptView | null = null;
  x.addEventListener('click', () => {
    if (answered) return void goOn();
    const p = current;
    if (!p) return;
    if (p.kind === 'debrief') onAnswer(p.id, p.defaultOption);
    else onPark(p.id);
    if (p.kind === 'debrief') read.add(p.id);
    shown = -1;
    el.hidden = true;
    document.body.classList.remove('event-open');
  });
  const goOn = () => {
    answered = null;
    shown = -1;
    el.hidden = true;
    document.body.classList.remove('event-open');
  };

  const build = (p: PromptView) => {
    shown = p.id;
    current = p;
    addCardStyles();
    const art = document.createElement('div');
    art.className = 'event-art';
    // a short moving scene of what the event is about, with the townsfolk in it (panel/eventScenePlay.ts)
    const scene = document.createElement('div');
    scene.className = 'ev-scene';
    const played = p.kind !== 'evolve' && lastSnap ? playEventScene(scene, p, lastSnap) : null;
    if (played) art.append(scene);
    else if (p.picture) {
      void backdrop(p.picture).then((c) => {
        if (shown !== p.id) return;
        c.className = 'event-backdrop';
        art.prepend(c);
      });
    }
    // the townsperson it's about, stood in the picture (the scene has them in it already)
    if (p.who != null && !played) {
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
    // a fateful event: the heavier frame and the slower reveal (the title, then the telling a paragraph at a time,
    // then the answers, which can't be tapped until they are there)
    const fateful = !!p.fateful;
    el.classList.toggle('fateful', fateful);
    body.classList.toggle('ui-frame-big', fateful);
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
    // a commanded party's result leads with who came home and who did not, then the haul (sim/muster.ts `debrief`)
    if (p.debrief) text.replaceChildren(...debriefBlock(p.debrief));
    const options = document.createElement('div');
    options.className = evolve ? 'event-options evolve-options' : 'event-options';
    // the answer taken: a gold flash and a burst of sparks over the scene
    const flourish = () => {
      played?.answered();
      const f = document.createElement('div');
      f.className = 'ev-flourish';
      for (let i = 0; i < 10; i++) {
        const sp = document.createElement('i');
        sp.style.setProperty('--a', `${i * 36}deg`);
        f.append(sp);
      }
      art.append(f);
      setTimeout(() => f.remove(), 950);
    };
    const choose = (label: string, i: number) => {
        if (answered) return;
        flourish();
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
      if (i === p.recommended) b.classList.add('recommended');
      if (i === p.recommended) {
        // (the town's own pick, marked with a wax seal)
        const seal = document.createElement('span');
        seal.className = 'ev-seal';
        seal.textContent = '★';
        seal.title = 'The town recommends this';
        b.append(seal, label);
      } else b.textContent = label;
      b.addEventListener('click', () => {
        if (answered) return;
        flourish();
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
    if (fateful && !reducedMotion()) {
      const STEP = 300;
      let at = 0;
      title.classList.add('reveal');
      for (const para of Array.from(text.children) as HTMLElement[]) {
        at += STEP;
        para.classList.add('reveal');
        para.style.setProperty('--d', `${at}ms`);
      }
      at += STEP;
      options.classList.add('reveal', 'holding');
      options.style.setProperty('--d', `${at}ms`);
      setTimeout(() => options.classList.remove('holding'), at + 380);
    }
    count = document.createElement('div');
    count.className = 'event-count';
    // the town's own pick and why (sim/alignment.ts), under the answers
    const advice = document.createElement('div');
    advice.className = 'event-advice';
    if (p.recommended != null && p.why && !evolve) advice.textContent = `The town recommends "${p.options[p.recommended]}": ${p.why}.`;
    body.append(title, text, options, advice, count);
    if (p.pinned) {
      const hold = document.createElement('div');
      hold.className = 'event-hold';
      hold.textContent = 'The town waits for your answer. Close this and it waits behind the choices button.';
      body.append(hold);
    } else if (p.kind !== 'debrief') x.title = 'Close: answer later from the choices button';
    el.replaceChildren(art, body, x);
    el.scrollTop = 0;
  };

  /** The result of a party the player sent: those who came home (with a word on how), those who did not, then the
   *  haul. The haul has a place of its own (`.debrief-haul`, data-slot "loot-reveal") where the item-by-item reveal
   *  of what they brought hangs: for now it lists the haul plainly. */
  const debriefBlock = (d: NonNullable<PromptView['debrief']>): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const head = (text: string, cls = '') => {
      const h = document.createElement('div');
      h.className = `debrief-head ${cls}`.trim();
      h.textContent = text;
      return h;
    };
    out.push(head(d.lost.length ? (d.back.length ? 'Came home' : 'Nobody came home') : 'All came home'));
    if (d.back.length) {
      const row = document.createElement('div');
      row.className = 'debrief-row';
      for (const b of d.back) {
        const one = document.createElement('div');
        one.className = 'debrief-one';
        const face = win()?.__picture?.({ person: b.id });
        if (face) one.append(face);
        const name = document.createElement('div');
        name.className = 'debrief-name';
        name.textContent = b.name;
        one.append(name);
        if (b.note) {
          const note = document.createElement('div');
          note.className = 'debrief-note';
          note.textContent = b.note;
          one.append(note);
        }
        row.append(one);
      }
      out.push(row);
    }
    if (d.lost.length) {
      out.push(head('Did not come home', 'lost'));
      const row = document.createElement('div');
      row.className = 'debrief-lost';
      for (const l of d.lost) {
        const one = document.createElement('div');
        one.textContent = `✝ ${l.name}, level ${l.level}`;
        row.append(one);
      }
      out.push(row);
    }
    out.push(head(d.recalled ? 'What they brought (called back)' : 'What they brought'));
    const haul = document.createElement('div');
    haul.className = 'debrief-haul';
    haul.dataset.slot = 'loot-reveal';
    haul.textContent = d.ending ?? (d.haul.length ? d.haul.join(', ') : 'Nothing: they come home empty-handed.');
    out.push(haul);
    if (d.cleared) {
      const c = document.createElement('div');
      c.className = 'debrief-cleared';
      c.textContent = `${d.place} is cleared.`;
      out.push(c);
    }
    return out;
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
    go.addEventListener('click', goOn);
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
      lastSnap = snap;
      const away = !!snap.battle || !!snap.watch || !!snap.mine || !!snap.tactics || snap.fightOn;
      const w = win();
      if (w) w.__eventSheet = true;
      if (answered && away) answered = null;
      if (answered) {
        el.hidden = false;
        document.body.classList.add('event-open');
        tell(snap);
        return;
      }
      const p = snap.prompts.find((q) => !read.has(q.id) && !q.parked && EVENT_BOX_KINDS.has(q.kind));
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
