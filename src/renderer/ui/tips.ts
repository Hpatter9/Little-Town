// Long-press tips (the owner's ask): hold a finger on a stat, an icon or a button and a small sheet names it and says
// what moves it. One handler a page reads `data-tip` ("Title|What it is and what moves it"), or a plain `title`, from
// whatever is held; a held tap shows the tip and the tap itself is let go. `dressStats` gives the Town menu's tiles
// their icon and tip after each redraw, so the panels needn't.

import { icon, statOf } from './icon';

/** What each stat is and what moves it. */
export const STAT_TIPS: Record<string, string> = {
  people: 'People|Everyone living in town. Births, newcomers and visitors who stay raise it; raids, hunger, sickness and old age bring it down.',
  beds: 'Beds|Room to sleep. Homes and their upgrades add beds; without one, folk sleep rough and tire.',
  food: 'Food|How many days the stored food lasts everyone who eats, at a meal a day. Fields, herds, hunting and trade fill it.',
  spirits: 'Spirits|How the town feels on the whole. Food, beds, leisure, faith and good news lift it; deaths, hunger and raids sink it.',
  coins: 'Treasury|The town’s coins. Taxes, rent, the shops and trade bring them in; wages, upkeep and building take them out.',
  stores: 'Stores|What’s stored against room for it. Storehouses and their upgrades add room; a full store wastes what’s gathered.',
  building: 'Building|Building sites under way. Builders and carried materials finish them; the town picks what to build itself.',
  studying: 'Studying|The topic being learned. Scholars, the seat and libraries speed it; the direction you set steers what comes next.',
  workshops: 'Workshops|Orders in the workshops against how many the stations can take. More stations take more orders.',
  quests: 'Quests|Parties out on the road. Send one from the Quests tab; they come home with loot, lore or bad news.',
  shops: 'Shops|Shops and taverns open for trade. Wares made in the workshops and visitors with coin keep them busy.',
  gods: 'Gods|The gods’ mood. Shrines, rites and feasts please them; neglect and cruelty anger them.',
  age: 'Age|The town’s age of learning. The seat opens each age’s studies; finishing them moves the town on.',
  raid: 'Raid|Raiders at the gate or in town. Walls, towers, trained fighters and gear decide how it goes.',
  blood: 'Blood|The Blood Court’s store. Thralls and the farm’s cells fill it each dusk; the court drinks it.',
  skull: 'Danger|A threat that grows if left alone.',
  deep: 'The Deep|The shaft’s deepest level. Miners dig it deeper; each level has its own finds and dangers.',
  health: 'Health|Hit points. Blows and wounds take them; rest, healers and potions give them back.',
  attack: 'Attack|How hard a blow lands. Weapons, levels and stat points raise it.',
  defence: 'Defence|How much of a blow is turned. Armour, shields and levels raise it.',
  mana: 'Mana|What spells and skills cost. It comes back a little each turn.',
  speed: 'Speed|How soon a turn comes round. Light armour and quick callings are faster.',
  xp: 'Experience|Earned in fights and work; enough of it is a level.',
  turn: 'Turn|Whose turn it is in the fight.',
  day: 'Day and season|The town’s calendar: ten days a season, four seasons a year. Danger grows with the days.',
  news: 'What’s happening|The latest about the town, in turn: what’s being built and learned, and anything urgent first.',
};

/** The fight screen's meters (fight/fightHud.ts), by their class: what each is and what moves it. */
export const FIGHT_TIPS: Record<string, [string, string]> = {
  hp: ['health', 'Health|Blows take it; at none they’re down and may bleed out. Healers, potions and rest give it back.'],
  mp: ['mana', 'Mana|What spells cost. It comes back a little each turn; a mage’s calling holds more.'],
  sp: ['speed', 'Stamina|What skills and hard blows cost. It comes back a little each turn; a fighter’s calling holds more.'],
  limit: ['xp', 'Limit|Fills as they take and deal blows; full, their calling’s great move is ready.'],
  turn: ['turn', 'Turn|Fills as their next turn comes round, faster for the quick; lit when it’s theirs.'],
};

/** Give a fight meter its tip (its own title, the numbers, stays as the tip's last line). */
export function fightTip(el: HTMLElement, kind: string): void {
  const t = FIGHT_TIPS[kind];
  if (!t) return;
  el.dataset.tip = el.title && !t[1].includes(el.title) ? `${t[1]} (${el.title})` : t[1];
  el.dataset.tipIcon = t[0];
}

let tipEl: HTMLElement | null = null;
const tip = (): HTMLElement => {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'ui-tip';
    tipEl.hidden = true;
    tipEl.setAttribute('role', 'tooltip');
    document.body.append(tipEl);
  }
  return tipEl;
};

/** Show a tip ("Title|text"; an icon by its stat name). */
export function showTip(text: string, mark?: string | null): void {
  const t = tip();
  const [head, ...rest] = text.split('|');
  const body = rest.join('|');
  t.replaceChildren();
  const m = mark ? icon(mark, 32) : null;
  if (m) t.append(m);
  if (body) {
    const b = document.createElement('b');
    b.textContent = head;
    t.append(b, body);
  } else t.append(head);
  t.hidden = false;
}
export const hideTip = (): void => {
  if (tipEl) tipEl.hidden = true;
};

const HOLD_MS = 450;

/** The page's one long-press handler. */
export function wireTips(): void {
  let timer = 0;
  let start: { x: number; y: number } | null = null;
  let shown = false;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
    start = null;
  };
  document.addEventListener('pointerdown', (e) => {
    cancel();
    if (shown) {
      hideTip();
      shown = false;
    }
    const t = e.target instanceof Element ? e.target.closest('[data-tip], [title]:not(iframe):not(canvas)') : null;
    if (!t) return;
    const text = t.getAttribute('data-tip') || t.getAttribute('title');
    if (!text) return;
    start = { x: e.clientX, y: e.clientY };
    timer = window.setTimeout(() => {
      timer = 0;
      shown = true;
      showTip(text, t.getAttribute('data-tip-icon'));
    }, HOLD_MS);
  }, { capture: true, passive: true });
  document.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  }, { capture: true, passive: true });
  for (const ev of ['pointerup', 'pointercancel'] as const) document.addEventListener(ev, cancel, { capture: true, passive: true });
  // (a held tap that showed a tip doesn't also press what it was held on; the tip goes with the next touch)
  document.addEventListener('click', (e) => {
    if (!shown) return;
    e.preventDefault();
    e.stopPropagation();
    window.setTimeout(() => {
      hideTip();
      shown = false;
    }, 2500);
  }, { capture: true });
  // (a long press on a phone also asks for the page's own menu)
  document.addEventListener('contextmenu', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-tip], [title]')) e.preventDefault();
  });
}

/** Set an element's tip (and its icon) by its stat. */
export function tipFor(el: HTMLElement, stat: string): HTMLElement {
  const text = STAT_TIPS[stat];
  if (text) {
    el.dataset.tip = text;
    el.dataset.tipIcon = stat;
  }
  return el;
}

/** The Town menu's tiles (and any `.glance-tile` in the page): an icon before each label and its tip. */
export function dressStats(root: ParentNode): void {
  for (const t of Array.from(root.querySelectorAll<HTMLElement>('.glance-tile'))) {
    const label = t.querySelector<HTMLElement>('.glance-label');
    if (!label || label.querySelector('.ui-icon')) continue;
    const stat = statOf(label.textContent ?? '');
    if (!stat) continue;
    const mark = icon(stat);
    if (mark) label.prepend(mark);
    tipFor(t, stat);
  }
}
