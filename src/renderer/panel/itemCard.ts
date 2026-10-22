// The item card (the owner: "I went to look at the legendary unique weapon we made and I can't click on it. I want to know
// all about it. Like who made it, what makes it unique, and who's using it"). A unique gets the whole story: its picture
// large, its lore, what makes it unique in plain words, its numbers, who made or won it and where, everyone who has borne
// it (portraits to tap), its deeds and where it is now (from the snapshot's `uniques`: sim/provenance.ts). Anything else
// gets a lighter card: what it is for, how many the town has, who carries one, where it's made. Opened from anywhere an
// item is named (the Shelf, a person's Kit, the stores and shops, the Market, the crafting queue, a haul, the news).

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CLASS_DEFS } from '../../shared/data/classes';
import { ENEMIES } from '../../shared/data/enemies';
import { ITEM_BY_ID, ITEMS, SLOT_NAMES, type ItemDef, type ItemEffects } from '../../shared/data/items';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { RARE_SET } from '../../shared/data/chains';
import { topicName } from '../../shared/data/originResearch';
import { pieceLabel, qualityOf, gradeOf, plusOf, COMMON } from '../../shared/data/quality';
import { FORGED, SAGA, UNIQUE_EDGE, UNIQUE_FROM } from '../../shared/data/uniques';
import { FAMILIES, quirkWords } from '../../shared/data/weapons';
import { WEIGHT_NAMES } from '../../shared/data/armour';
import type { UniqueView } from '../../shared/sim/provenance';
import type { Snapshot } from '../../shared/sim/snapshot';
import { itemIcon } from '../art/icons';
import { uniqueLore } from '../mobile/reveals';
import { itemStats } from './details';
import { el } from './dom';
import { cardLink, factRows, para, personLink, portrait, portraits, registerCard, registerNames, sec, type CardDraw } from './infoCard';

/** Who drops a unique, as words: its bosses' names, a quest, a saga, the guild's forge. */
function sourceLine(id: string): string {
  const from = UNIQUE_FROM[id] ?? [];
  if (from.includes(FORGED)) return 'Forged once, at the Monster Hunters\' Guild, from the parts of great beasts.';
  if (from.includes(SAGA)) return 'Won only at the end of a saga.';
  if (!from.length) return 'Kept for a quest: found at the end of one, never dropped.';
  const names = from.map((b) => ENEMIES[b]?.name ?? b);
  return `Carried by ${names.join(' or ')}: one of a kind, it drops once in all the world.`;
}

/** The quirks a unique has of its own, beyond those of every weapon of its family. */
function ownQuirks(def: ItemDef): string[] {
  const fam = def.family ? FAMILIES[def.family] : undefined;
  const own: ItemEffects = {};
  for (const [k, v] of Object.entries(def.effects) as [keyof ItemEffects, unknown][]) {
    if (['damage', 'accuracy', 'range', 'ranged', 'ammo'].includes(k)) continue;
    if (fam && (fam.fx as Record<string, unknown>)[k] === v) continue;
    (own as Record<string, unknown>)[k] = v;
  }
  return quirkWords(own);
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const dayWord = (d: number) => `day ${d}`;

function uniqueBody(def: ItemDef, u: UniqueView | undefined, s: Snapshot): HTMLElement[] {
  const out: HTMLElement[] = [];
  const r = u?.story;
  // what makes it unique
  out.push(sec('What makes it unique'));
  const why = el('ul', 'ic-list');
  why.append(el('li', '', 'There is no other like it in all the world.'));
  if (def.family) why.append(el('li', '', `It hits about ${Math.round((UNIQUE_EDGE - 1) * 100)}% harder than any ${FAMILIES[def.family].name.toLowerCase()} a smith can make, and aims truer.`));
  for (const w of ownQuirks(def)) why.append(el('li', '', `${cap(w)}.`));
  why.append(el('li', '', sourceLine(def.id)));
  out.push(why);
  // its numbers, as it is now
  out.push(sec(`Its numbers${u?.qn !== undefined && (gradeOf(u.qn) !== COMMON || plusOf(u.qn)) ? `: ${pieceLabel(def.name, u.qn)}` : ''}`));
  const nums = el('ul', 'ic-list');
  for (const l of itemStats(def, u?.qn)) nums.append(el('li', '', l));
  out.push(nums);
  // made or found by
  const forged = r?.how === 'forged' || (!r?.how && (UNIQUE_FROM[def.id] ?? []).includes(FORGED));
  out.push(sec(forged ? 'Made by' : 'Found by'));
  if (!r?.how) out.push(para(forged ? 'Forged before the chronicles: nobody wrote down whose hands made it.' : 'Found before the chronicles: nobody wrote down how it came to the town.'));
  else {
    const where = r.where;
    const how = r.how === 'forged' ? `Forged at the ${where ?? 'forge'} on ${dayWord(r.day)}` : r.how === 'quest' ? `Won at the end of a quest${where ? ` at ${where}` : ''} on ${dayWord(r.day)}` : r.how === 'saga' ? `The prize of ${where ?? 'a saga'}, ended on ${dayWord(r.day)}` : `Taken from ${where ?? 'a great foe'} on ${dayWord(r.day)}`;
    out.push(para(`${how}.`));
    if (r.by?.length) out.push(portraits(r.by.map((b) => portrait(b, r.how === 'forged' ? 'its maker' : r.how === 'saga' ? 'the hero' : 'won it'))));
    if (r.qn !== undefined) out.push(para(`It came out ${qualityOf(r.qn).name.toLowerCase()}${plusOf(r.qn) ? `, +${plusOf(r.qn)}` : ''}.`));
  }
  // borne by
  const bearers = r?.bearers ?? [];
  out.push(sec('Borne by'));
  if (!bearers.length) out.push(para(u?.holder ? `${u.holder}, who has it now.` : 'Nobody has carried it yet.'));
  else
    out.push(
      portraits(
        bearers.map((b, i) => portrait(b, i === bearers.length - 1 && u?.holderId === b.id ? `now, since ${dayWord(b.day)}` : `from ${dayWord(b.day)}`)),
      ),
    );
  // deeds
  const deeds: string[] = [];
  if (r?.felled) deeds.push(`${r.felled} raider${r.felled === 1 ? '' : 's'} felled with it.`);
  for (const b of r?.bosses ?? []) deeds.push(`${b} brought down by its bearer.`);
  out.push(sec('Deeds'));
  if (deeds.length) {
    const list = el('ul', 'ic-list');
    for (const d of deeds) {
      const li = el('li');
      li.append(para(d));
      list.append(li);
    }
    out.push(list);
  } else out.push(para('None yet: its story is still to be written.'));
  // where it is now
  out.push(sec('Where it is now'));
  const now = el('div', 'pc-text');
  if (u?.at === 'hand' && u.holder) now.append('In the hand of ', personLink(u.holder, u.holderId), '.');
  else if (u?.at === 'away' && u.holder) {
    const trip = s.expeditions.find((e) => e.members.some((m) => m.id === u.holderId));
    now.append('Away with ', personLink(u.holder, u.holderId), trip ? `, on the trip to ${trip.destName}.` : ', out on the road.');
  } else if (u?.at === 'armoury') now.append('In the town\'s armoury, waiting for a hand worthy of it.');
  else if (r?.gone) now.append(`${cap(r.gone.how)}${r.gone.with ? ` with ${r.gone.with}` : ''} on ${dayWord(r.gone.day)}. Its story ends there, for now.`);
  else now.append(u ? 'Gone from the town.' : 'Somewhere in the world, waiting to be found.');
  out.push(now);
  return out;
}

/** Everything an ordinary item's card says. */
function plainBody(def: ItemDef, s: Snapshot): HTMLElement[] {
  const out: HTMLElement[] = [];
  const stats = def.slot ? itemStats(def) : [];
  if (stats.length) {
    out.push(sec('What it does'));
    const list = el('ul', 'ic-list');
    for (const l of stats) list.append(el('li', '', l));
    out.push(list);
  }
  const worn = s.people.filter((p) => Object.values(p.gear).includes(def.id));
  const pouched = s.people.filter((p) => p.pouch.includes(def.id) && !worn.includes(p));
  const stored = s.items[def.id] ?? 0;
  const trophy = Object.values(ENEMIES).find((e) => e.kit?.trophy === def.id);
  const station = BUILDING_BY_ID[def.station];
  const made = !def.unique && !def.relic;
  const takes = made ? [...(Object.entries(def.cost) as [Material, number][]).filter(([, n]) => n).map(([m, n]) => `${n} ${MATERIAL_NAMES[m]?.toLowerCase() ?? m}`), ...Object.entries(def.items ?? {}).map(([id, n]) => `${n} ${ITEM_BY_ID[id]?.name ?? id}`)].join(', ') : '';
  const callings = def.family
    ? Object.values(CLASS_DEFS).filter((c) => c.weapons.includes(def.family as never)).map((c) => c.stages[0])
    : def.weight
      ? Object.values(CLASS_DEFS).filter((c) => c.armour.includes(def.weight as never)).map((c) => c.stages[0])
      : [];
  const goesInto = ITEMS.filter((i) => i.items?.[def.id]);
  const into = el('span');
  goesInto.slice(0, 8).forEach((i, n) => into.append(...(n ? [', '] : []), cardLink(i.name, { kind: 'item', id: i.id })));
  const research = el('span');
  def.research.filter((r) => !r.startsWith('__')).forEach((r, n) => research.append(...(n ? [', '] : []), cardLink(topicName(r, s.origin.id), { kind: 'topic', id: r })));
  out.push(
    factRows([
      ['Kind', def.slot ? `${SLOT_NAMES[def.slot]}${def.family ? `, a ${FAMILIES[def.family].name.toLowerCase()} of tier ${def.tier ?? 1}` : ''}` : def.furnish ? 'A furnishing' : def.ware ? 'A ware, to sell' : def.fare ? 'Fare, for the tavern' : def.makes ? 'Made into the stores' : 'For the town'],
      ['Weight', def.weight ? (WEIGHT_NAMES[def.weight] ?? def.weight) : null],
      ['The town has', `${stored + worn.length} (${stored} in the stores${worn.length ? `, ${worn.length} worn` : ''})`],
      ['Made at', made && station ? cardLink(station.name, { kind: 'building', id: station.id }) : trophy ? `never made: a trophy, won from ${trophy.name}` : 'never made: found, or won'],
      ['Takes', takes && !Object.keys(def.items ?? {}).length ? takes : null],
      ['Research', research.childNodes.length ? research : null],
      ['Sells for', def.ware ? `${def.ware.price} coins` : def.fare ? `${def.fare.price} coins` : null],
      ['Goes into', goesInto.length ? into : null],
      ['Callings that use it', callings.length ? callings.join(', ') : null],
    ]),
  );
  if (made && Object.keys(def.items ?? {}).length) out.push(...takesBody(def, s));
  if (worn.length || pouched.length) {
    out.push(sec('Who carries one'));
    out.push(portraits([...worn.slice(0, 12).map((p) => portrait(p, 'wears it')), ...pouched.slice(0, 6).map((p) => portrait(p, 'in the pouch'))]));
  }
  return out;
}

/** What an item made through parts takes (data/chains.ts): each material, part and rare input with what the town has
 *  of it, where each part is made and from what, and what's missing. */
function takesBody(def: ItemDef, s: Snapshot): HTMLElement[] {
  const list = el('ul', 'ic-list');
  const missing: string[] = [];
  for (const [m, n] of Object.entries(def.cost) as [Material, number][]) {
    const have = Math.floor(s.stock[m] ?? 0);
    const name = MATERIAL_NAMES[m]?.toLowerCase() ?? m;
    const rare = RARE_SET.has(m);
    if (have < n) missing.push(name);
    list.append(el('li', have < n ? 'short' : '', `${n} ${name} (${have} in store)${rare ? ': rare, from the mines, quests and trade' : ''}`));
  }
  for (const [id, n] of Object.entries(def.items ?? {})) {
    const p = ITEM_BY_ID[id];
    if (!p) continue;
    const have = s.items[id] ?? 0;
    if (have < n) missing.push(p.name.toLowerCase());
    const from = (Object.entries(p.cost) as [Material, number][]).map(([m, k]) => `${k} ${MATERIAL_NAMES[m]?.toLowerCase() ?? m}`).join(', ');
    const li = el('li', have < n ? 'short' : '');
    li.append(`${n} × `, cardLink(p.name, { kind: 'item', id }), ` (${have} in hand)${p.part ? `: made at the ${BUILDING_BY_ID[p.station]?.name ?? p.station} from ${from}` : ''}`);
    list.append(li);
  }
  return [sec('What it takes'), list, para(missing.length ? `Missing: ${missing.join(', ')}.` : 'The town has all it takes.')];
}

registerCard('item', (ref, s): CardDraw | null => {
  const def = ITEM_BY_ID[ref.id as string];
  if (!def) return null;
  const desc = def.description ?? '';
  if (def.unique) {
    const u = s.uniques.find((x) => x.id === def.id);
    const r = u?.story;
    return {
      key: JSON.stringify([u?.holderId, u?.at, u?.qn, r?.bearers?.length, r?.felled, r?.bosses?.length, r?.gone?.day, s.expeditions.length]),
      kind: `A unique ${def.family ? `${FAMILIES[def.family].name.toLowerCase()}` : def.slot ? SLOT_NAMES[def.slot].toLowerCase() : 'treasure'}${u ? '' : ' · not yet found'}`,
      title: def.name,
      lore: uniqueLore(def.id) || desc,
      tone: 'unique',
      art: () => itemIcon(def, 4),
      body: () => uniqueBody(def, u, s),
    };
  }
  const worn = s.people.filter((p) => Object.values(p.gear).includes(def.id)).length;
  return {
    key: JSON.stringify([s.items[def.id] ?? 0, worn, s.people.length, Object.keys(def.items ?? {}).map((id) => s.items[id] ?? 0), Object.keys(def.items ?? {}).length ? Object.keys(def.cost).map((m) => Math.floor(s.stock[m as Material] ?? 0)) : 0]),
    kind: def.relic ? 'A trophy' : def.slot ? SLOT_NAMES[def.slot] : 'An item',
    title: def.name,
    lore: desc,
    tone: def.relic ? 'unique' : undefined,
    art: () => itemIcon(def, 4),
    body: () => plainBody(def, s),
  };
});

// (a unique or a trophy named in a line of text opens its card)
registerNames((s) => {
  const out: [string, { kind: 'item'; id: string }][] = [];
  for (const u of s.uniques) if (ITEM_BY_ID[u.id]) out.push([ITEM_BY_ID[u.id].name, { kind: 'item', id: u.id }]);
  for (const [id, n] of Object.entries(s.items)) if (n > 0 && ITEM_BY_ID[id]?.relic && !ITEM_BY_ID[id].unique) out.push([ITEM_BY_ID[id].name, { kind: 'item', id }]);
  return out;
});

/** A tappable item name (its card). */
export const itemLink = (id: string, text = ITEM_BY_ID[id]?.name ?? id): HTMLElement => cardLink(text, { kind: 'item', id });
