// A big moment shown as a film would (cinema/moments.ts picks them): black bars slide in at the top and the foot of the
// town, and a title card rises with the moment's name and a line, in a colour by its mood, for a few seconds; "Show me"
// goes to whoever it's about. The camera never moves on its own (the owner's call). In the strip's page (index.html
// `#cinema`).

import type { Moment } from './moments';

/** How long the card stays (ms). */
const SHOW_MS = 5200;

export function startCinema(root: HTMLElement): { show: (m: Moment, showMe: (() => void) | null) => void; busy: () => boolean } {
  const el = document.createElement('div');
  el.id = 'cinema';
  el.innerHTML = '<div class="cine-bar top"></div><div class="cine-bar bottom"></div><div class="cine-card"><div class="cine-title"></div><div class="cine-sub"></div><button class="cine-go">Show me</button></div>';
  root.append(el);
  const title = el.querySelector('.cine-title') as HTMLElement;
  const sub = el.querySelector('.cine-sub') as HTMLElement;
  const go = el.querySelector('.cine-go') as HTMLButtonElement;
  let timer = 0;
  let until = 0;
  let action: (() => void) | null = null;
  const hide = () => {
    el.classList.remove('on');
    until = 0;
  };
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    hide();
    action?.();
  });
  el.addEventListener('click', hide);
  return {
    show(m, showMe) {
      title.textContent = m.title;
      sub.textContent = m.sub;
      el.dataset.mood = m.mood;
      action = showMe;
      go.hidden = !showMe;
      el.classList.add('on');
      clearTimeout(timer);
      until = performance.now() + SHOW_MS;
      timer = window.setTimeout(hide, SHOW_MS);
    },
    busy: () => performance.now() < until,
  };
}
