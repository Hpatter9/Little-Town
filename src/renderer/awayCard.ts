// Coming back to the town: while the time away is caught up the town isn't drawn, only a plain line and a bar
// (`createCatchingUp`); then one card of what mattered (`createAwayCard`: deaths, births and newcomers, raids and how
// they ended, a new age, finds, questions waiting; sim/awaySummary.ts), with Continue. Nothing important, no card.

import { holdWhileUp } from './mobile/popupHold';
import type { AwayLine } from '../shared/sim/awaySummary';

export function createCatchingUp(): { show(share: number): void; hide(): void } {
  const box = document.createElement('div');
  box.id = 'catching-up';
  box.hidden = true;
  box.innerHTML = '<div>Catching up on your town…</div><div class="cu-bar"><div class="cu-fill"></div></div>';
  document.body.append(box);
  const fill = box.querySelector('.cu-fill') as HTMLElement;
  return {
    show(share) {
      box.hidden = false;
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
    },
    hide() {
      box.hidden = true;
    },
  };
}

export function createAwayCard(closed?: () => void): { show(lines: AwayLine[]): void; get open(): boolean } {
  const box = document.createElement('div');
  box.id = 'away-card';
  box.setAttribute('data-hit', '');
  box.hidden = true;
  document.body.append(box);
  holdWhileUp(box); // (the card holds the town while it's up: mobile/popupHold.ts)
  return {
    show(lines) {
      box.replaceChildren();
      if (!lines.length) return void (box.hidden = true);
      const title = document.createElement('div');
      title.className = 'aw-title';
      title.textContent = 'While you were away';
      const list = document.createElement('ul');
      for (const l of lines) {
        const li = document.createElement('li');
        li.className = l.tone;
        li.textContent = l.text;
        list.append(li);
      }
      const ok = document.createElement('button');
      ok.className = 'tab';
      ok.textContent = 'Continue';
      const shut = () => {
        box.hidden = true;
        closed?.();
      };
      ok.addEventListener('click', shut);
      const x = document.createElement('button');
      x.className = 'rr-x';
      x.textContent = '✕';
      x.title = 'Close';
      x.setAttribute('aria-label', 'Close');
      x.addEventListener('click', shut);
      box.append(title, list, ok, x);
      box.hidden = false;
    },
    get open() {
      return !box.hidden;
    },
  };
}
