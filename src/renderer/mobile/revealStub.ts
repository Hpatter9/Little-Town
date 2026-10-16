// A stand-in for the reveal card (claude/reveals is building the real one in mobile/revealCard.ts, `showReveal(card)`;
// when it lands, the import in mobile/obituaryReveal.ts moves to it and this file goes). A card over the whole page:
// a picture, a small line above the title, the title, a few lines, and up to two buttons (the last closes it).

export interface RevealCard {
  /** Each card is shown once: its key is remembered. */
  key: string;
  /** The small line above the title ("In memory", "A new tier"). */
  kicker?: string;
  title: string;
  lines: string[];
  /** A picture at the top (a portrait, a building). */
  art?: HTMLElement | null;
  tone?: 'gold' | 'red' | 'blue';
  /** Buttons besides "Close": each closes the card, then runs. */
  actions?: { label: string; run: () => void }[];
}

const STYLE = `
#reveal-stub { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(6, 4, 2, 0.72); }
#reveal-stub .rv-card { width: min(360px, 100%); max-height: calc(100% - 32px); overflow-y: auto; padding: 18px 16px 14px; border-radius: 10px; background: #1d150e; border: 1px solid #6a4e2e; color: #f4e6cc; font: 14px/1.4 Georgia, serif; text-align: center; box-shadow: 0 10px 40px #000a; }
#reveal-stub.tone-red .rv-card { border-color: #a04848; }
#reveal-stub.tone-gold .rv-card { border-color: #d8b048; }
#reveal-stub .rv-art { display: flex; justify-content: center; margin-bottom: 8px; }
#reveal-stub .rv-art canvas { width: 96px; height: 96px; image-rendering: pixelated; border-radius: 8px; background: #0008; }
#reveal-stub .rv-kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.7; }
#reveal-stub .rv-title { font-size: 20px; font-weight: 700; margin: 2px 0 8px; }
#reveal-stub p { margin: 0 0 6px; }
#reveal-stub p.said { font-style: italic; color: #f0d8a8; }
#reveal-stub .rv-btns { display: flex; gap: 8px; justify-content: center; margin-top: 12px; }
#reveal-stub button { min-height: 40px; min-width: 96px; padding: 0 14px; border-radius: 6px; border: 1px solid #6a4e2e; background: #2c2016; color: inherit; font: inherit; }
#reveal-stub button.main { background: #4a3420; }
`;

const queue: RevealCard[] = [];
let open = false;

export function showReveal(card: RevealCard): void {
  if (queue.some((c) => c.key === card.key)) return;
  queue.push(card);
  if (!open) next();
}

function next(): void {
  const card = queue.shift();
  if (!card) return;
  open = true;
  if (!document.getElementById('reveal-stub-style')) document.head.append(Object.assign(document.createElement('style'), { id: 'reveal-stub-style', textContent: STYLE }));
  const box = document.createElement('div');
  box.id = 'reveal-stub';
  box.className = `tone-${card.tone ?? 'gold'}`;
  const c = document.createElement('div');
  c.className = 'rv-card';
  if (card.art) {
    const a = document.createElement('div');
    a.className = 'rv-art';
    a.append(card.art);
    c.append(a);
  }
  if (card.kicker) c.append(Object.assign(document.createElement('div'), { className: 'rv-kicker', textContent: card.kicker }));
  c.append(Object.assign(document.createElement('div'), { className: 'rv-title', textContent: card.title }));
  for (const l of card.lines) c.append(Object.assign(document.createElement('p'), { className: l.startsWith('“') ? 'said' : '', textContent: l }));
  const btns = document.createElement('div');
  btns.className = 'rv-btns';
  const close = () => {
    box.remove();
    open = false;
    next();
  };
  for (const a of card.actions ?? []) {
    const b = Object.assign(document.createElement('button'), { className: 'main', textContent: a.label });
    b.addEventListener('click', () => {
      close();
      a.run();
    });
    btns.append(b);
  }
  const x = Object.assign(document.createElement('button'), { textContent: 'Close' });
  x.addEventListener('click', close);
  btns.append(x);
  c.append(btns);
  box.append(c);
  box.addEventListener('click', (e) => e.target === box && close());
  document.body.append(box);
}
