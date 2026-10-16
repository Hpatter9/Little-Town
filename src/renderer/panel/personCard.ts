// The person card as a character sheet (the owner-approved UI overhaul): the portrait on the left with its guild badge and
// calling, the bars under it (health, mana for a caster, mood, hunger), the calling and titles as chips, then four tabs:
// Story (backstory, ambition, the day's diary, deeds), Skills (levels, the spellbook), Kin (family, partner, children,
// friends, rivals and the devoted as small portraits to tap) and Kit (what they wear and the pouch). The People menu draws
// it for the person inspected (townsfolkPanel.ts); "All details" there goes on to the older page, where stats are spent.

import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../../shared/data/items';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import type { PersonView, Snapshot } from '../../shared/sim/snapshot';
import type { KinNode } from '../../shared/sim/lineage';
import { itemIcon } from '../art/icons';
import { emblemCanvas } from '../art/emblems';
import { isMythic } from '../../shared/data/paths';
import { guildBadge, guildsOf } from '../art/guildMarks';
import { bleedLeft } from '../../shared/format';
import { el } from './dom';
import { addCardStyles } from './cardsStyles';
import { linked, openCard } from './infoCard';
import { tapLink } from './structure';

export type SheetTab = 'story' | 'skills' | 'kin' | 'kit';
const TABS: [SheetTab, string][] = [
  ['story', 'Story'],
  ['skills', 'Skills'],
  ['kin', 'Kin'],
  ['kit', 'Kit'],
];
let tab: SheetTab = 'story';
/** What was drawn last (the tab and the person), so the cross-fade plays on a change only, not on every redraw of the bars. */
let drawn = '';

/** The sheet's own state, for the menu's redraw key (a tap on a tab must redraw). */
export const personSheetKey = (): string => tab;

export interface SheetHooks {
  /** Someone's face (townsfolkPanel's `face`), drawn from the Himeko dolls. */
  face: (p: PersonView, s: Snapshot) => HTMLElement;
  /** Open another townsperson's sheet. */
  open: (id: number) => void;
  /** Go on to the older page with every detail. */
  more: () => void;
  rerender: () => void;
  /** The ♥: whether they're followed, whether another can be (sim/favourites.ts: three at most), and the tap. */
  favourite?: { on: boolean; full: boolean; toggle: () => void };
}

const bar = (cls: string, value: number, text: string): HTMLElement => {
  const b = el('div', `pc-bar ${cls}`);
  const fill = el('i');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  b.append(fill, el('span', '', text));
  return b;
};
const chip = (text: string, cls = ''): HTMLElement => el('span', `pc-chip ${cls}`.trim(), text);

/** A small tappable portrait with a caption: a relative, a friend, a rival. */
function relation(s: Snapshot, hooks: SheetHooks, who: { id?: number; name: string; alive?: boolean }, cls: string, note: string): HTMLElement {
  const p = who.id !== undefined ? s.people.find((q) => q.id === who.id) : s.people.find((q) => q.name === who.name);
  const b = el('button', `pc-rel ${cls}${p ? '' : ' gone'}`);
  if (p) {
    b.append(hooks.face(p, s));
    b.addEventListener('click', () => hooks.open(p.id));
  } else b.append(el('span', '', who.alive === false ? '✝' : '?'));
  b.append(el('span', '', who.name), el('small', '', note));
  return b;
}

function head(p: PersonView, s: Snapshot, hooks: SheetHooks): HTMLElement {
  const top = el('div', 'pc-head');
  const col = el('div', 'pc-portrait-col');
  const port = el('div', 'pc-portrait');
  port.append(hooks.face(p, s));
  const guilds = guildsOf(s, p.id);
  if (guilds.length) {
    const badge = el('span', 'pc-badge');
    badge.append(guildBadge(guilds[0].role, 18, guilds[0].name));
    port.append(badge);
  }
  if (p.cls) {
    const c = el('span', 'pc-calling');
    if (p.roadId) c.append(emblemCanvas(p.roadId, 20));
    else c.textContent = `L${p.level}`;
    port.append(c);
  }
  // (a mythic calling, data/mythic.ts: its emblem glows, and a chip says what it is)
  const mythic = isMythic(p.roadId);
  if (mythic) port.classList.add('mythic');
  const bars = el('div', 'pc-bars');
  const hurt = p.downed === 'bleeding' ? `bleeding out: ${bleedLeft(p.bleedMinutes)}` : p.downed ? 'down, recovering' : `${Math.round(p.hp)}/${p.maxHp}`;
  bars.append(bar('hp', p.hp / p.maxHp, `Health ${hurt}`));
  if (p.mana) bars.append(bar('mp', p.mana[1] ? p.mana[0] / p.mana[1] : 0, `Mana ${Math.round(p.mana[0])}/${Math.round(p.mana[1])}`));
  bars.append(bar('mood', p.morale / 100, `Mood ${Math.round(p.morale)}`), bar('food', p.needs.food, `Fed ${Math.round(p.needs.food * 100)}%`));
  col.append(port, bars);
  if (mythic) {
    const chip = el('span', 'ui-chip pc-mythic', '✨ Mythic');
    chip.dataset.tip = 'A mythic calling|One of the rarest callings there are: a town may see one in a long lifetime.';
    col.append(chip);
  }

  const who = el('div', 'pc-who');
  const name = el('div', 'pc-name', `${p.name}${p.id === s.mainId ? ' (you)' : ''}`);
  // (the ♥: follow them, a view preference only: sim/favourites.ts)
  const fav = hooks.favourite;
  if (fav) {
    const heart = el('button', `pc-fav${fav.on ? ' on' : ''}`, fav.on ? '♥\uFE0E' : '♡');
    heart.title = fav.on ? 'Following: tap to stop' : fav.full ? 'You follow three already: unfollow one first' : 'Follow them';
    heart.disabled = !fav.on && fav.full;
    heart.addEventListener('click', fav.toggle);
    name.append(heart);
  }
  who.append(name, el('div', 'pc-doing', p.away !== null ? `Away on an expedition: ${p.away}` : p.doing));
  const chips = el('div', 'pc-chips');
  if (p.clsName) chips.append(p.cls ? tapLink(chip(`${p.clsName} · Lv ${p.level}`, 'calling'), () => openCard({ kind: 'calling', id: p.cls! })) : chip(`${p.clsName} · Lv ${p.level}`, 'calling'));
  else chips.append(chip(p.typeName));
  chips.append(chip(`${p.ageYears} years${p.elder ? ', an elder' : ''}`), chip(p.natureName));
  if (p.job) chips.append(chip(`${p.job.title} at ${p.job.at}`));
  for (const t of p.titles) chips.append(chip(t, 'title'));
  for (const g of guilds) {
    const c = tapLink(chip(`${g.lead ? '★ ' : ''}${g.name}`), () => openCard({ kind: 'guild', id: g.id }));
    c.prepend(guildBadge(g.role, 14));
    chips.append(c);
  }
  if (p.sick) chips.append(chip('Sick', 'warn'));
  if (p.grieving) chips.append(chip('Grieving', 'warn'));
  if (p.shaken) chips.append(chip('Shaken', 'warn')); // (a close call a little while ago: sim/closeCalls.ts)
  if (p.breakdown) chips.append(chip(p.breakdown, 'warn'));
  if (p.freePts > 0) chips.append(chip(`${p.freePts} stat ${p.freePts === 1 ? 'point' : 'points'} to spend`, 'title'));
  who.append(chips);
  top.append(col, who);
  return top;
}

function storyTab(p: PersonView, out: HTMLElement): void {
  if (p.story) out.append(el('div', 'pc-text', p.story));
  if (p.natureLine) out.append(el('div', 'pc-text', p.natureLine));
  if (p.ambition) out.append(el('div', 'pc-sec', 'Ambition'), el('div', 'pc-text', `${p.ambition.name}: ${p.ambition.line}`));
  if (p.creed) out.append(el('div', 'pc-text', p.creed));
  if (p.secret) out.append(el('div', 'pc-sec', 'A secret'), el('div', 'pc-text', `${p.secret.name}: ${p.secret.text}`));
  if (p.diary.length) {
    out.append(el('div', 'pc-sec', 'Today, in their words'));
    for (const l of p.diary) out.append(linked(l, 'div', 'pc-diary'));
  }
  if (p.recent.length) {
    out.append(el('div', 'pc-sec', 'Lately'));
    for (const l of p.recent.slice(0, 5)) out.append(linked(l, 'div', 'pc-diary'));
  }
  const deeds = p.deeds.filter((d) => d.n > 0);
  if (deeds.length) {
    out.append(el('div', 'pc-sec', 'Deeds'));
    const row = el('div', 'pc-chips');
    for (const d of deeds) row.append(chip(`${d.label} ×${d.n}${d.next ? ` → ${d.next}` : ''}`));
    out.append(row);
  }
  if (!out.children.length) out.append(el('div', 'pc-text', 'Nothing is told of them yet.'));
}

function skillsTab(p: PersonView, out: HTMLElement): void {
  if (p.cls) out.append(el('div', 'pc-text', `${p.clsName}, level ${p.level}${p.clsPast.length ? ` (once ${p.clsPast.join(', then ')})` : ''}. ${p.clsText}`));
  const ranked = SKILLS.map((k) => [k, p.skills[k]] as const).sort((a, b) => b[1].level - a[1].level);
  for (const [k, v] of ranked) {
    const row = el('div', 'pc-skill');
    row.append(el('span', '', `${SKILL_NAMES[k]}${v.passion ? ' ★' : ''}`), bar('', v.progress, ''), el('b', '', String(v.level)));
    out.append(row);
  }
  const casts = p.kit.filter((k) => k.spell);
  if (casts.length || p.arcana) {
    out.append(el('div', 'pc-sec', 'Spellbook'));
    for (const k of casts) {
      const r = el('div', 'pc-spell');
      r.append(el('b', '', k.name), document.createTextNode(` · ${k.cost} ${k.pool} · ${k.text}`));
      out.append(r);
    }
    if (!casts.length) out.append(el('div', 'pc-text', 'No spells ready.'));
  }
  const others = p.kit.filter((k) => !k.spell);
  if (others.length || p.passives.length) {
    out.append(el('div', 'pc-sec', 'Ways of fighting'));
    for (const k of others) {
      const r = el('div', 'pc-spell');
      r.append(el('b', '', k.name), document.createTextNode(` · ${k.text}`));
      out.append(r);
    }
    for (const k of p.passives) {
      const r = el('div', 'pc-spell');
      r.append(el('b', '', k.name), document.createTextNode(` · ${k.text}`));
      out.append(r);
    }
  }
}

function kinTab(p: PersonView, s: Snapshot, hooks: SheetHooks, out: HTMLElement): void {
  const nodes: KinNode[] = s.families.flatMap((f) => f.members);
  const me = nodes.find((n) => n.id === p.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const group = (title: string, items: HTMLElement[]) => {
    if (!items.length) return;
    out.append(el('div', 'pc-sec', title));
    const box = el('div', 'pc-kin');
    box.append(...items);
    out.append(box);
  };
  const partner = me?.partner != null ? byId.get(me.partner) : undefined;
  group('Partner', partner ? [relation(s, hooks, partner, 'friend', p.married ? 'married' : 'partner')] : p.partner ? [relation(s, hooks, { name: p.partner }, 'friend', p.married ? 'married' : 'partner')] : []);
  group('Parents', (me?.parents ?? []).flatMap((id) => (byId.get(id) ? [relation(s, hooks, byId.get(id)!, '', byId.get(id)!.alive ? '' : 'passed on')] : [])));
  group('Children', nodes.filter((n) => n.parents.includes(p.id)).map((n) => relation(s, hooks, n, '', n.alive ? (n.child ? 'a child' : '') : 'passed on')));
  group('Friends', p.friends.map((n) => relation(s, hooks, { name: n }, 'friend', 'friend')));
  group('Devoted', p.devoted.map((n) => relation(s, hooks, { name: n }, 'devoted', 'devoted')));
  group('Rivals and enemies', [...p.rivals.map((n) => relation(s, hooks, { name: n }, 'enemy', 'rival')), ...p.enemies.map((n) => relation(s, hooks, { name: n }, 'enemy', 'enemy'))]);
  if (!out.children.length) out.append(el('div', 'pc-text', 'No family or close ties are known yet.'));
}

function kitTab(p: PersonView, out: HTMLElement): void {
  let any = false;
  for (const slot of SLOTS) {
    const id = p.gear[slot];
    const def = id ? ITEM_BY_ID[id] : undefined;
    if (!def) continue;
    any = true;
    const row = el('div', `pc-slot${def.unique ? ' unique' : ''}`);
    row.append(itemIcon(def, 1), tapLink(el('span', '', def.name), () => openCard({ kind: 'item', id: def.id })), el('small', '', SLOT_NAMES[slot]));
    // (the whole row opens its card: a unique's whole story)
    row.addEventListener('click', () => openCard({ kind: 'item', id: def.id }));
    out.append(row);
  }
  if (!any) out.append(el('div', 'pc-text', 'Nothing worn or carried in hand.'));
  if (p.cls) {
    out.append(el('div', 'pc-sec', `Pouch (${p.pouch.length}/${p.pouchCap})`));
    const box = el('div', 'pc-pouch');
    for (let i = 0; i < p.pouchCap; i++) {
      const slot = el('span');
      const def = p.pouch[i] ? ITEM_BY_ID[p.pouch[i]] : undefined;
      if (def) {
        slot.append(itemIcon(def, 1));
        slot.title = def.name;
        slot.addEventListener('click', () => openCard({ kind: 'item', id: def.id }));
      }
      box.append(slot);
    }
    out.append(box);
  }
  if (p.coins !== null) out.append(el('div', 'pc-text', `${p.coins} coins${p.owns.length ? ` · owns ${p.owns.join(', ')}` : ''}`));
}

/** The whole sheet for one townsperson. */
export function personSheet(p: PersonView, s: Snapshot, hooks: SheetHooks): HTMLElement {
  addCardStyles();
  const sheet = el('div', 'pc-sheet card person');
  sheet.append(head(p, s, hooks));
  const tabs = el('div', 'pc-tabs');
  for (const [k, name] of TABS) {
    const b = el('button', `pc-tab${tab === k ? ' on' : ''}`, name);
    b.addEventListener('click', () => {
      tab = k;
      hooks.rerender();
    });
    tabs.append(b);
  }
  const body = el('div', 'pc-body');
  const now = `${p.id}|${tab}`;
  if (now !== drawn) body.classList.add('card-fade');
  drawn = now;
  if (tab === 'story') storyTab(p, body);
  else if (tab === 'skills') skillsTab(p, body);
  else if (tab === 'kin') kinTab(p, s, hooks, body);
  else kitTab(p, body);
  const more = el('button', 'place small quiet', 'All details…');
  more.addEventListener('click', hooks.more);
  sheet.append(tabs, body, more);
  return sheet;
}
