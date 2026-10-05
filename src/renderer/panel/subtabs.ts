// Every menu in sub-tabs (the owner's ask): a menu's sections, each starting at a heading, are grouped under a few
// named tabs, and only the open one is shown. The grouping is by the headings' words (`GROUPS`), so the menus' own
// code stays as it was: a heading that starts a group opens it, and any other heading carries on in the group before.
// What comes before the first heading stays above the tabs, or joins a named group (`intro`). The open tab is kept per
// menu (`littletown.subtab.<menu>`); a menu with fewer than two groups to show is drawn as it was.

import { el } from './dom';

interface MenuTabs {
  /** Tab name, and the headings that open it. */
  groups: [string, RegExp][];
  /** Where what comes before the first heading goes: above the tabs (left out), or into the named tab. */
  intro?: string;
}

const GROUPS: Record<string, MenuTabs> = {
  build: {
    groups: [
      ['Direction', /^(Direction|Town size)/],
      ['Town status', /^Town status/],
      ['Powers', /^(Lichcraft|The seasonal round|.*: powers)/],
      ['Treasury', /^(Treasury|Tax|Guards)/],
      ['Buildings', /^(Being built|Buildings)/],
    ],
    // (the head's building slots, coins and storage go with the buildings)
    intro: 'Buildings',
  },
  research: { groups: [['Stations', /^Stations/], ['Tech tree', /^Tech tree/]] },
  expeditions: {
    groups: [
      ['Parties', /^(Parties|Boats)/],
      ['Places', /^(On the town's land|The pack|Destinations)/],
      ['Quests', /^(Quests|Unique weapons)/],
    ],
    intro: 'Places',
  },
  townsfolk: { groups: [['People', /^People/], ['Jobs', /^(Jobs|Prisoners)/]] },
  crafting: { groups: [['Inventory', /^Inventory/], ['Recipes', /^Recipes/]] },
  trade: { groups: [['Deals', /^Deals/], ['Horses', /^Horses/]] },
  // the shop, the inn and the stores (each venue keeps its own open tab)
  venue: {
    groups: [
      ['Now', /^(Guests|In the shop|Lately)/],
      ['Trade', /^(Menu|Rooms|Customers|On the shelves|Gear in stock|Spare to sell|Wants to buy|Asked for)/],
      ['The room', /^(Furnishings|Décor)/],
    ],
    intro: 'Now',
  },
};

const KEY = (menu: string) => `littletown.subtab.${menu}`;
const chosen = new Map<string, string>();
function openTab(menu: string): string | null {
  if (chosen.has(menu)) return chosen.get(menu)!;
  try {
    const v = localStorage.getItem(KEY(menu));
    if (v) chosen.set(menu, v);
    return v;
  } catch {
    return null;
  }
}
function setTab(menu: string, name: string): void {
  chosen.set(menu, name);
  try {
    localStorage.setItem(KEY(menu), name);
  } catch {}
}

/** A menu's elements, put in its tabs; `redraw` after a tab is chosen. */
export function inTabs(menu: string, els: HTMLElement[], redraw: () => void, kind = menu): HTMLElement[] {
  const cfg = GROUPS[kind];
  if (!cfg) return els;
  const above: HTMLElement[] = [];
  const parts = new Map<string, HTMLElement[]>(cfg.groups.map(([n]) => [n, []]));
  let current: string | null = cfg.intro ?? null;
  for (const e of els) {
    if (e.tagName === 'H2') {
      const g = cfg.groups.find(([, re]) => re.test(e.textContent ?? ''));
      if (g) current = g[0];
    }
    if (current === null) above.push(e);
    else parts.get(current)!.push(e);
  }
  const shown = cfg.groups.map(([n]) => n).filter((n) => parts.get(n)!.length);
  if (shown.length < 2) return els;
  const want = openTab(menu);
  const open = want && shown.includes(want) ? want : shown[0];
  const row = el('div', 'row inv-tabs menu-tabs');
  for (const n of shown) {
    const b = el('button', `inv-tab${n === open ? ' on' : ''}`, n);
    b.addEventListener('click', () => {
      if (n === open) return;
      setTab(menu, n);
      redraw();
      const body = document.getElementById('body');
      if (body) body.scrollTop = 0;
      for (const side of document.querySelectorAll('.shop-info')) side.scrollTop = 0;
    });
    row.append(b);
  }
  const content = parts.get(open)!;
  // (the open tab's own first heading only repeats the tab's name)
  if (content[0]?.tagName === 'H2' && content[0].textContent === open) content.shift();
  return [...above, row, ...content];
}

/** What the open tab is, for the menu's redraw key. */
export const tabKey = (menu: string) => openTab(menu) ?? '';
