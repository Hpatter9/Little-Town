// The first-town tutorial's cards (steps and rules: `tutorialSteps.ts`). A small card says what a control is, with a
// ring round the real control. It starts "reading": the town is held while the card is up (`holdWhileUp`, popupHold.ts).
// "Show me" lets the town run while the player tries it: the card shrinks to its hint and the step is done by the thing
// itself, or by Next. The card sits in the half of the screen away from the control it points at, so it never covers it.
// Hidden while a menu, a fight or an event box has the screen. Skipping ends it for good (a replay is in ☰ Settings).

import type { Bridge } from '../../shared/ipc';
import { holdWhileUp } from './popupHold';
import { setTutorialActive, stepDone, TUTORIAL_STEPS, tutorialFinished, type TutorialFacts, type TutorialTarget } from './tutorialSteps';

interface Deps {
  bridge: Pick<Bridge, 'onState'>;
  strip: HTMLIFrameElement;
  /** The page's map zoom now. */
  zoom: () => number;
}

type StripWin = Window & { __camera?: { touchedAt: number } };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function createTutorial({ bridge, strip, zoom }: Deps): { start: () => void; running: () => boolean } {
  const root = el('div', '');
  root.id = 'tutorial';
  root.hidden = true;
  const veil = el('div', 'tut-veil'); // (up while a step is being read: it is what holds the town)
  const ring = el('div', 'tut-ring');
  const card = el('div', 'tut-card');
  const count = el('div', 'tut-count');
  const title = el('div', 'tut-title');
  const text = el('div', 'tut-text');
  const buttons = el('div', 'tut-buttons');
  const skip = el('button', 'tut-skip', 'Skip');
  const go = el('button', 'tut-go');
  buttons.append(skip, go);
  card.append(count, title, text, buttons);
  root.append(veil, ring, card);
  document.body.append(root);
  holdWhileUp(veil);

  let step = -1;
  let phase: 'read' | 'try' = 'read';
  let opened: string[] = [];
  let baseTouched = 0;
  let baseZoom = 1;
  let timer = 0;

  const camera = () => (strip.contentWindow as StripWin | null)?.__camera;
  const facts = (): TutorialFacts => ({
    opened,
    moved: (camera()?.touchedAt ?? baseTouched) !== baseTouched || Math.abs(zoom() - baseZoom) > 0.01,
    clearing: !!strip.contentDocument?.getElementById('clear-land')?.classList.contains('on'),
  });

  bridge.onState((s) => {
    if (step >= 0 && s.panel && s.panel !== 'newgame') opened.push(s.panel);
  });

  /** The control a step points at, in the page's own px (null: nothing to ring). */
  const rectOf = (t: TutorialTarget): DOMRect | null => {
    if (t === 'founder') return document.querySelector('.top-founder')?.getBoundingClientRect() ?? null;
    if (t === 'stores') return document.getElementById('stores-readout')?.getBoundingClientRect() ?? null;
    if (t === 'tab:build' || t === 'tab:research') return document.querySelector(`#tabs button[data-panel="${t.slice(4)}"]`)?.getBoundingClientRect() ?? null;
    if (t === 'clear') {
      const b = strip.contentDocument?.getElementById('clear-land')?.getBoundingClientRect();
      const o = strip.getBoundingClientRect();
      // (the strip is laid out bigger than it shows, and scaled to fit the page by the map's zoom: so scaled back)
      const k = o.width / Math.max(1, strip.contentWindow?.innerWidth ?? o.width);
      return b ? new DOMRect(o.left + b.left * k, o.top + b.top * k, b.width * k, b.height * k) : null;
    }
    return null;
  };

  const covered = () => {
    const b = document.body.classList;
    const ev = document.getElementById('event-sheet');
    return b.contains('menu-open') || b.contains('battle') || b.contains('event-open') || !!(ev && !ev.hidden);
  };

  const place = () => {
    const s = TUTORIAL_STEPS[step];
    const r = rectOf(s.target);
    ring.hidden = !r;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = Math.min(280, W - 24);
    card.style.width = `${w}px`;
    if (r) {
      ring.style.cssText = `left:${r.left - 5}px;top:${r.top - 5}px;width:${r.width + 10}px;height:${r.height + 10}px`;
    }
    const cx = r ? r.left + r.width / 2 : W / 2;
    const left = Math.max(12, Math.min(W - w - 12, cx - w / 2));
    const lowDown = r && r.top + r.height / 2 < H / 2; // (the control is up high: the card goes low, above the tabs)
    card.style.left = `${left}px`;
    if (lowDown) {
      // (the tabs are along the bottom upright, and along the top on a phone on its side)
      const tabs = document.getElementById('tabs')?.getBoundingClientRect().top ?? H;
      card.style.top = 'auto';
      card.style.bottom = `${tabs > H / 2 ? H - tabs + 8 : 8}px`;
    } else {
      const top = (document.getElementById('top')?.getBoundingClientRect().bottom ?? 56) + 8;
      card.style.bottom = 'auto';
      card.style.top = `${top}px`;
    }
  };

  const draw = () => {
    const s = TUTORIAL_STEPS[step];
    const hidden = covered();
    root.hidden = hidden;
    veil.hidden = hidden || phase !== 'read';
    root.classList.toggle('trying', phase === 'try');
    count.textContent = `${step + 1} of ${TUTORIAL_STEPS.length}`;
    title.textContent = s.title;
    text.textContent = s.text;
    go.textContent = s.done && phase === 'read' ? 'Show me' : step === TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next ›';
    if (!hidden) place();
  };

  const finish = () => {
    window.clearInterval(timer);
    timer = 0;
    step = -1;
    root.hidden = true;
    veil.hidden = true;
    setTutorialActive(false);
    tutorialFinished(localStorage);
  };

  const begin = (i: number) => {
    // (leaving the clearing step with the pickaxe still on: switch it off, so a tap on the map is a tap again)
    const clear = strip.contentDocument?.getElementById('clear-land');
    if (step >= 0 && TUTORIAL_STEPS[step].target === 'clear' && clear?.classList.contains('on')) clear.click();
    if (i >= TUTORIAL_STEPS.length) return finish();
    step = i;
    phase = 'read';
    opened = [];
    baseTouched = camera()?.touchedAt ?? 0;
    baseZoom = zoom();
    draw();
  };

  go.addEventListener('click', () => {
    if (step < 0) return;
    if (TUTORIAL_STEPS[step].done && phase === 'read') {
      phase = 'try';
      draw();
    } else begin(step + 1);
  });
  skip.addEventListener('click', finish);
  window.addEventListener('resize', () => step >= 0 && draw());

  return {
    start: () => {
      if (step >= 0) return;
      setTutorialActive(true);
      begin(0);
      timer = window.setInterval(() => {
        if (step < 0) return;
        if (stepDone(step, facts())) begin(step + 1);
        else draw(); // (it follows the control as the page changes: a turned phone, the stores readout appearing)
      }, 300);
    },
    running: () => step >= 0,
  };
}
