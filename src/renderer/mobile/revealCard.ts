// A stand-in for the reveal card claude/reveals is building at this same path (`showReveal(card)`, the same
// `RevealCard`): the merge takes theirs. A card over the whole page: a picture, the title, its lore; one tap closes it.

export interface RevealCard {
  kind: string;
  title: string;
  lore?: string;
  rarity?: string;
  img?: string;
  icon?: string;
  tone?: 'mythic' | 'unique' | 'legend' | 'dark' | 'gold';
  key?: string;
}

const STYLE = `
#reveal-stub { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(6, 4, 2, 0.72); }
#reveal-stub .rv-card { width: min(360px, 100%); max-height: calc(100% - 32px); overflow-y: auto; padding: 18px 16px 14px; border-radius: 10px; background: #1d150e; border: 1px solid #6a4e2e; color: #f4e6cc; font: 14px/1.4 Georgia, serif; text-align: center; box-shadow: 0 10px 40px #000a; }
#reveal-stub.tone-dark .rv-card { border-color: #a04848; }
#reveal-stub.tone-gold .rv-card { border-color: #d8b048; }
#reveal-stub .rv-art { display: flex; justify-content: center; margin-bottom: 8px; }
#reveal-stub .rv-art img { width: 96px; height: 96px; image-rendering: pixelated; border-radius: 8px; background: #0008; }
#reveal-stub .rv-kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.7; }
#reveal-stub .rv-title { font-size: 20px; font-weight: 700; margin: 2px 0 8px; }
#reveal-stub p { margin: 0 0 6px; }
#reveal-stub p.said { font-style: italic; color: #f0d8a8; }
#reveal-stub .rv-tap { margin-top: 10px; font-size: 11px; opacity: 0.55; }
`;

const queue: RevealCard[] = [];
let open = false;

export function showReveal(card: RevealCard): void {
  if (card.key !== undefined && queue.some((c) => c.key === card.key)) return;
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
  if (card.img) {
    const a = document.createElement('div');
    a.className = 'rv-art';
    a.append(Object.assign(document.createElement('img'), { src: card.img, alt: '' }));
    c.append(a);
  }
  c.append(Object.assign(document.createElement('div'), { className: 'rv-kicker', textContent: `${card.icon ? `${card.icon} ` : ''}${card.kind}` }));
  c.append(Object.assign(document.createElement('div'), { className: 'rv-title', textContent: card.title }));
  for (const l of (card.lore ?? '').split('\n').filter(Boolean)) c.append(Object.assign(document.createElement('p'), { className: l.startsWith('“') ? 'said' : '', textContent: l }));
  c.append(Object.assign(document.createElement('div'), { className: 'rv-tap', textContent: 'Tap to close' }));
  box.append(c);
  box.addEventListener('click', () => {
    box.remove();
    open = false;
    next();
  });
  document.body.append(box);
}
