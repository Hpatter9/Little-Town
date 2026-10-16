// A stand-in for the reveal card (claude/reveals: mobile/revealCard.ts `showReveal(card)`), with the same call, until that
// lands: the coordinator joins them at merge by pointing milestoneCards.ts at revealCard.ts and deleting this file.
// A short framed card over the page: an icon, a title, a line, a foot (the day); a tap closes it, the next waits its turn.

import { icon } from '../ui/icon';

export interface RevealCard {
  /** What it tells, for the look (a rank rising or falling, a first). */
  kind: 'rise' | 'fall' | 'first';
  /** A stat icon name (ui/icon.ts). */
  icon: string;
  title: string;
  line: string;
  /** A second, quieter line (what a founder would say). */
  aside?: string;
  /** The foot: the day. */
  foot: string;
}

const queue: RevealCard[] = [];
let open: HTMLElement | null = null;

const STYLE = `
.reveal-veil { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 7, 15, 0.62); }
.reveal-card { box-sizing: border-box; width: min(100%, 340px); max-height: 100%; overflow: auto; padding: 18px 18px 14px; text-align: center; color: #f6ecd2; background: #231a12; border: 2px solid #d6b25e; outline: 1px solid #5a4423; outline-offset: -6px; border-radius: 4px; box-shadow: 0 6px 30px rgba(0, 0, 0, 0.6); }
.reveal-card.fall { border-color: #9a7a7a; }
.reveal-icon { display: inline-block; margin-bottom: 6px; }
.reveal-title { margin: 0 0 6px; font-size: 18px; letter-spacing: 0.04em; color: #ffe39a; }
.reveal-line { margin: 0 0 8px; font-size: 14px; line-height: 1.4; }
.reveal-aside { margin: 0 0 8px; font-size: 13px; font-style: italic; opacity: 0.8; }
.reveal-foot { font-size: 11px; opacity: 0.6; letter-spacing: 0.08em; text-transform: uppercase; }
@media (orientation: landscape) and (max-height: 460px) { .reveal-card { padding: 10px 14px 8px; } .reveal-title { font-size: 16px; margin-bottom: 3px; } .reveal-line, .reveal-aside { margin-bottom: 4px; font-size: 13px; } }
`;

function next(): void {
  open = null;
  const card = queue.shift();
  if (!card) return;
  if (!document.getElementById('reveal-style')) {
    const st = document.createElement('style');
    st.id = 'reveal-style';
    st.textContent = STYLE;
    document.head.append(st);
  }
  const veil = document.createElement('div');
  veil.className = 'reveal-veil';
  const box = document.createElement('div');
  box.className = `reveal-card ${card.kind}`;
  const mark = icon(card.icon, 32);
  if (mark) {
    mark.classList.add('reveal-icon');
    box.append(mark);
  }
  const add = (tag: string, cls: string, text: string) => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    box.append(e);
  };
  add('h3', 'reveal-title', card.title);
  add('p', 'reveal-line', card.line);
  if (card.aside) add('p', 'reveal-aside', card.aside);
  add('div', 'reveal-foot', card.foot);
  veil.append(box);
  veil.addEventListener('click', () => {
    veil.remove();
    next();
  });
  document.body.append(veil);
  open = veil;
}

export function showReveal(card: RevealCard): void {
  queue.push(card);
  if (!open) next();
}
