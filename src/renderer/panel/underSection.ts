// The Trips tab's section on the Underdark ("Below the town"; sim/underdark.ts `underSummary`): how deep the town has
// gone and what each depth holds, the cave towns and how they stand, what has come up the shaft and what it has cost,
// the last news from below, and the trips below a party may take. The goods each place gives are shown with their
// pack icons. Its own module, so the Trips panel only calls it (panel/expeditionsPanel.ts).
import type { Destination } from '../../shared/data/expeditions';
import type { Material } from '../../shared/data/materials';
import type { Bridge } from '../../shared/ipc';
import type { DestinationView, Snapshot } from '../../shared/sim/snapshot';
import { stockIcon } from '../art/materialIcons';
import { button, el } from './dom';

type Card = (d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined) => HTMLElement;

/** What the section shows changes with (for the panel's redraw key). */
export const underKey = (s: Snapshot) => {
  const u = s.underdark;
  return u ? [u.through, u.found.length, u.depths.map((d) => [d.n, d.scouted, d.slain, d.found.length]), u.tally, u.seeking, u.village, u.flooded, u.searching, u.finds.length && u.finds[u.finds.length - 1]] : null;
};

const STANCE: Record<string, string> = { peace: 'at peace', friend: 'friends: trading', war: 'at war', fallen: 'fallen' };

/** A row of pack icons for some goods. */
function icons(mats: Material[]): HTMLElement {
  const box = el('span', 'under-icons');
  for (const m of mats) {
    const i = stockIcon(m, 16);
    if (i) box.append(i);
  }
  return box;
}

export function underSection(s: Snapshot, bridge: Bridge | undefined, card: Card): HTMLElement[] {
  const u = s.underdark;
  if (!u) return [];
  if (!document.getElementById('under-section-style')) {
    const st = el('style');
    st.id = 'under-section-style';
    st.textContent = UNDER_SECTION_STYLE;
    document.head.append(st);
  }
  const out: HTMLElement[] = [el('h2', '', 'Below the town')];
  const box = el('div', 'under-box ui-frame');
  const line = (label: string, text: string, mats?: Material[]) => {
    const r = el('div', 'under-row');
    r.append(el('b', '', `${label} `), document.createTextNode(text));
    if (mats?.length) r.append(icons(mats));
    box.append(r);
  };
  if (!u.through) line('The miners', `are cutting down toward the caves (${u.dug} cells cut).`);
  else {
    line('The upper caves', `${u.found.length} place${u.found.length === 1 ? '' : 's'} found.${u.flooded ? ' The tunnels are flooded: the miners are driven out until it drains.' : ''}`);
    for (const f of u.found) line(`· ${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}:`, f.gives, f.mats);
    if (u.seeking !== null) line('The stair', u.seeking > 0 ? `The scouts are searching the ruins for a way on down (${u.seeking} h).` : 'There is a stair down under the ruins, but the town is too small to send scouts down it.');
    for (const d of u.depths) {
      line(d.name.charAt(0).toUpperCase() + d.name.slice(1), `${d.scouted}% scouted. ${d.slain ? `${d.dweller} is slain.` : d.n >= 3 ? `${d.dweller} sleeps on its hoard.` : `${d.dweller} guards the way on down.`}`);
      for (const f of d.found) line(`· ${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}:`, f.gives, f.mats);
    }
    if (u.village) line(u.village.name, `the town's own village below: ${u.village.pop} folk.`);
    for (const t of u.towns) line(t.name.charAt(0).toUpperCase() + t.name.slice(1), `${t.kind}, ${STANCE[t.stance] ?? t.stance}${t.feud ? `, at feud with ${t.feud}` : ''}. They sell ${t.goods} for ${t.price} coins.`, t.mats);
    if (u.searching) line('Searching', `for ${u.searching}, with torches.`);
  }
  const t = u.tally;
  line('Up the shaft so far:', `${t.goods} goods, ${t.coins} coins, ${t.trades} trade${t.trades === 1 ? '' : 's'}. Lost below: ${t.deaths}${t.caveIns ? `; ${t.caveIns} cave-in${t.caveIns === 1 ? '' : 's'}` : ''}${t.floods ? `; ${t.floods} flood${t.floods === 1 ? '' : 's'}` : ''}${t.rises ? `; ${t.rises} raid${t.rises === 1 ? '' : 's'} up the shaft` : ''}.`);
  for (const f of u.finds.slice(-3).reverse()) box.append(el('div', 'under-find', f));
  if (bridge) box.append(button('Look below', () => bridge.command({ type: 'watchUnder', on: true })));
  out.push(box);
  const dests = u.dests.filter((d) => s.destinations.some((v) => v.id === d.id));
  if (dests.length) {
    const cards = el('div', 'cards wide');
    for (const d of dests) cards.append(card(d, s.destinations.find((v) => v.id === d.id)!, s, bridge));
    out.push(cards);
  }
  return out;
}

/** The section's own styles (kept out of the shared blocks). */
export const UNDER_SECTION_STYLE = `
.under-box { margin: 4px 0 10px; padding: 8px 10px; border-radius: 8px; background: rgba(20,16,22,0.35); }
.under-row { margin: 2px 0; line-height: 1.35; }
.under-row b { font-weight: 700; }
.under-icons { display: inline-flex; gap: 2px; margin-left: 4px; vertical-align: middle; }
.under-find { font-size: 0.92em; font-style: italic; opacity: 0.8; margin-top: 2px; }
.under-box button { margin-top: 6px; }
`;
