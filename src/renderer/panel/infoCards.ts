// The small cards a tapped name opens (panel/infoCard.ts), for everything but items (itemCard.ts): a kind of building, a
// research topic, a power of the realm, a god, a guild, a calling, a saga, a festival, a place on the land and a line of
// the Chronicle. Each from the data and the snapshot, a few lines and the people in it as portraits to tap. They also
// tell infoCard.ts which names to find in a line of text (`registerNames`), so the Chronicle and the cards link them.

import { amount } from '../../shared/format';
import { BUILDING_BY_ID, BUILDINGS } from '../../shared/data/buildings';
import { CLASS_DEFS, type ClassId } from '../../shared/data/classes';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { TOPIC_BY_ID } from '../../shared/data/research';
import { topicName } from '../../shared/data/originResearch';
import { DOMAIN_DEFS, type Domain } from '../../shared/data/gods';
import { emblemCanvas } from '../art/emblems';
import { guildBadge } from '../art/guildMarks';
import { icon } from '../ui/icon';
import { el } from './dom';
import { cardBridge, cardLink, factRows, para, portrait, portraits, registerCard, registerNames, sec, type CardRef } from './infoCard';
import { topicCard } from './researchPanel';
import { thumb } from './structure';

const list = (lines: string[]): HTMLElement => {
  const ul = el('ul', 'ic-list');
  for (const l of lines) {
    const li = el('li');
    li.append(para(l));
    ul.append(li);
  }
  return ul;
};
const stockWords = (st: Partial<Record<Material, number>>) =>
  (Object.entries(st) as [Material, number][])
    .filter(([, n]) => n)
    .map(([m, n]) => `${amount(n)} ${MATERIAL_NAMES[m]?.toLowerCase() ?? m}`)
    .join(', ');

/* ---- a kind of building ---- */
registerCard('building', (ref, s) => {
  const def = BUILDING_BY_ID[ref.id as string];
  if (!def) return null;
  const standing = s.buildings.filter((b) => b.def === def.id);
  const done = standing.filter((b) => b.status === 'done');
  const workers = s.people.filter((p) => standing.some((b) => b.operator === p.id));
  const sleepers = s.people.filter((p) => standing.some((b) => b.id === p.bedId));
  return {
    key: JSON.stringify([standing.map((b) => [b.id, b.status]), workers.map((p) => p.id), sleepers.length]),
    kind: 'A building',
    title: def.name,
    lore: def.purpose,
    art: () => thumb(def.id, 76, s),
    body: () => {
      const out: HTMLElement[] = [];
      out.push(
        factRows([
          ['In the town', standing.length ? `${done.length} standing${standing.length > done.length ? `, ${standing.length - done.length} going up` : ''}` : 'none yet'],
          ['Costs', stockWords(def.cost) || null],
          ['Research', def.research ? cardLink(topicName(def.research, s.origin.id), { kind: 'topic', id: def.research }) : null],
        ]),
      );
      if (workers.length) out.push(sec('Who works there'), portraits(workers.slice(0, 12).map((p) => portrait(p, p.job?.title ?? 'works there'))));
      if (sleepers.length) out.push(sec('Who lives there'), portraits(sleepers.slice(0, 12).map((p) => portrait(p, 'lives there'))));
      return out;
    },
  };
});

/* ---- a research topic (the same card the tree shows) ---- */
registerCard('topic', (ref, s) => {
  const t = TOPIC_BY_ID[ref.id as string];
  if (!t) return null;
  const r = s.research;
  return {
    key: JSON.stringify([r.done.includes(t.id), r.queue.indexOf(t.id), r.picked.includes(t.id), Math.floor((r.progress[t.id] ?? 0) * 100)]),
    kind: 'A research topic',
    title: topicName(t.id, s.origin.id),
    art: () => icon('studying', 56),
    body: () => [topicCard(t, s, cardBridge())],
  };
});

/* ---- a power of the realm ---- */
registerCard('faction', (ref, s) => {
  const f = s.realm.factions.find((x) => x.id === ref.id);
  if (!f) return null;
  return {
    key: JSON.stringify([f.stance, f.attitude, f.troops, f.folk, f.host?.hours, f.rising?.stage]),
    kind: `A power of the realm${f.rising ? `: ${f.rising.stage}` : ''}`,
    title: f.name,
    lore: f.rising?.line ?? f.temper,
    art: () => icon(f.stance === 'war' ? 'raid' : 'people', 56),
    body: () => {
      const out: HTMLElement[] = [
        factRows([
          ['Ruled by', f.known ? f.lord : 'not yet known'],
          ['Its seat', f.stronghold],
          ['Towards us', `${f.stanceName}, ${f.mood}`],
          ['Its town', `${f.size}, ${f.folk} folk`],
          ['Under arms', f.troops],
          ['An old tie', f.kin ? f.kin.why : null],
          ['A host coming', f.host ? `${f.host.size} strong, in ${f.host.hours} h` : null],
        ]),
      ];
      if (f.rising?.deeds.length) out.push(sec('What it has done'), list(f.rising.deeds.slice(-5)));
      if (f.council) out.push(sec('The council of war'), para(f.council));
      return out;
    },
  };
});

/* ---- a god ---- */
registerCard('god', (ref, s) => {
  const g = s.faith.gods.find((x) => x.domain === ref.id);
  if (!g) return null;
  const def = DOMAIN_DEFS[g.domain as Domain];
  return {
    key: JSON.stringify([g.favour, g.mood, s.faith.signs.length]),
    kind: `A god of ${def.keeps}`,
    title: `${g.name}, ${g.title}`,
    art: () => icon('gods', 56),
    body: () => {
      const signs = s.faith.signs.filter((x) => x.text.includes(g.name)).slice(0, 4);
      return [
        factRows([
          ['Keeps', g.keeps],
          ['Favour', `${g.favour} (${g.mood})`],
          ['Pleased, it', g.blessing],
          ['Angered, it', g.wrath],
          ['Offerings', g.offer],
          ['Worshipped at', s.faith.places.length ? s.faith.places.join(', ') : 'no shrine yet'],
        ]),
        ...(signs.length ? [sec('Its signs'), list(signs.map((x) => `Day ${x.day}: ${x.text}`))] : []),
      ];
    },
  };
});

/* ---- a guild ---- */
registerCard('guild', (ref, s) => {
  const g = s.guilds.find((x) => x.id === ref.id);
  if (!g) return null;
  return {
    key: JSON.stringify([g.members.map((m) => [m.id, m.lead, m.level]), g.log.length]),
    kind: 'A guild',
    title: g.name,
    lore: g.what,
    art: () => guildBadge(g.role, 56, g.name),
    body: () => [
      factRows([
        ['Its gift', g.perk],
        ['Founded', `day ${g.founded}${g.by ? ` by ${g.by}` : ''}`],
      ]),
      sec(`Members (${g.members.length})`),
      portraits(g.members.slice(0, 16).map((m) => portrait(m, m.lead ? '★ leads' : `level ${m.level}`))),
      ...(g.log.length ? [sec('Lately'), list(g.log.slice(-4).reverse())] : []),
    ],
  };
});

/* ---- a calling ---- */
registerCard('calling', (ref, s) => {
  const c = CLASS_DEFS[ref.id as ClassId];
  if (!c) return null;
  const walking = s.people.filter((p) => p.cls === c.id);
  const road = walking.find((p) => p.roadId)?.roadId;
  return {
    key: JSON.stringify(walking.map((p) => [p.id, p.level, p.clsName])),
    kind: `A calling: ${c.role}`,
    title: c.stages[0],
    lore: c.description,
    art: () => (road ? emblemCanvas(road, 64) : icon('attack', 56)),
    body: () => [
      sec('Its road'),
      para(c.stages.join(' → ')),
      factRows([
        ['Fights', c.ranged ? 'from range' : 'up close'],
        ['Wears', c.armour.join(', ')],
        ['How rare', c.rarity >= 1 ? 'common' : c.rarity >= 0.5 ? 'uncommon' : c.rarity >= 0.2 ? 'rare' : 'very rare'],
      ]),
      ...(walking.length ? [sec('Who walks it'), portraits(walking.map((p) => portrait(p, `${p.clsName ?? ''} · Lv ${p.level}`)))] : [para('Nobody in the town walks it now.')]),
    ],
  };
});

/* ---- a saga ---- */
registerCard('saga', (ref, s) => {
  const open = s.sagas.open.find((g) => g.title === ref.id);
  const done = s.sagas.done.find((g) => g.title === ref.id);
  if (!open && !done) return null;
  return {
    key: JSON.stringify([open?.log.length, open?.now, done?.outcome]),
    kind: done ? `A saga, ended: ${done.outcome}` : 'A saga under way',
    title: ref.id as string,
    lore: (open ?? done)!.blurb,
    tone: done?.outcome === 'ruin' ? 'dark' : undefined,
    art: () => icon('quests', 56),
    body: () =>
      open
        ? [factRows([['Began', `day ${open.began}`], ['Now', open.now]]), sec('The story so far'), list(open.story)]
        : [factRows([['Ended', `day ${done!.day}`], ['Its hero', done!.hero]])],
  };
});

/* ---- a festival ---- */
registerCard('festival', (ref, s) => {
  const f = s.festivals.calendar.find((x) => x.id === ref.id);
  if (!f) return null;
  return {
    key: JSON.stringify([f.last, s.festivals.next.id, s.festivals.next.days]),
    kind: `A festival of ${f.season}`,
    title: f.name,
    lore: f.lore,
    art: () => icon('spirits', 56),
    body: () => [
      factRows([
        ['When', `day ${f.day} of ${f.season}${s.festivals.next.id === f.id ? ` (in ${s.festivals.next.days} days)` : ''}`],
        ['Its food', f.food],
        ['Its ware', f.ware],
        ['For', f.god],
        ['Its gift', f.boon],
        ['Its song', f.song],
        ['Last time', f.last ? `year ${f.last.year}: ${f.last.outcome}` : null],
      ]),
    ],
  };
});

/* ---- a place on the land ---- */
registerCard('place', (ref, s) => {
  const p = s.places.find((x) => x.id === ref.id);
  if (!p) return null;
  return {
    key: JSON.stringify([p.state, p.foes, p.mine?.depth]),
    kind: `A place on the land${p.state === 'done' ? ', cleared' : ''}`,
    title: p.name,
    lore: p.text,
    art: () => icon(p.foes ? 'skull' : 'quests', 56),
    body: () => [factRows([['Waiting there', p.foes], ['A mine', p.mine ? `dug to level ${p.mine.depth}, ${p.mine.diggers} digging` : null]])],
  };
});

/* ---- a line of the Chronicle ---- */
registerCard('event', (ref, s) => {
  if (ref.kind !== 'event') return null;
  const named = s.people.filter((p) => new RegExp(`(?<![\\w'])${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(`${ref.text} ${(ref.lines ?? []).join(' ')}`));
  return {
    key: JSON.stringify(named.map((p) => p.id)),
    kind: 'From the Chronicle',
    title: ref.when,
    art: () => icon('news', 56),
    body: () => [para(ref.text), ...(ref.lines?.length ? [list(ref.lines)] : []), ...(named.length ? [sec('Who it tells of'), portraits(named.map((p) => portrait(p, p.doing)))] : [])],
  };
});

/* ---- the names a line of text may hold ---- */
registerNames((s) => {
  const out: [string, CardRef][] = [];
  for (const f of s.realm.factions) if (f.known) out.push([f.name, { kind: 'faction', id: f.id }]);
  for (const g of s.faith.gods) out.push([g.name, { kind: 'god', id: g.domain }]);
  for (const g of s.guilds) out.push([g.name, { kind: 'guild', id: g.id }]);
  for (const g of [...s.sagas.open, ...s.sagas.done]) out.push([g.title, { kind: 'saga', id: g.title }]);
  for (const f of s.festivals.calendar) out.push([f.name, { kind: 'festival', id: f.id }]);
  for (const p of s.places) if (p.found) out.push([p.name, { kind: 'place', id: p.id }]);
  // (buildings the town has: long names only, so a "Well" in a sentence is left alone)
  const have = new Set(s.buildings.map((b) => b.def));
  for (const b of BUILDINGS) if (have.has(b.id) && b.name.length >= 6) out.push([b.name, { kind: 'building', id: b.id }]);
  for (const id of s.research.done) {
    const n = topicName(id, s.origin.id);
    if (n.length >= 6) out.push([n, { kind: 'topic', id }]);
  }
  return out;
});
