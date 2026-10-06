// The Bestiary (the Chronicle's last tab): every foe in the world, by family, the ones the town has met in colour and
// the rest as shadows. The menagerie's (data/menagerie.ts) by their families, then the rest (bosses first).

import { ENEMIES, natureOf, type EnemyDef } from '../../shared/data/enemies';
import { BEAST_BY_ID, BEASTS, type Family, type Habitat } from '../../shared/data/menagerie';
import { creatureThumb } from '../art/creatureThumbs';
import { el } from './dom';
import { facts, pickable, pickedIn, stockLine } from './details';

const FAMILY_NAMES: Record<Family, string> = {
  deep: 'Of the water',
  birds: 'Birds and bats',
  cats: 'The great cats',
  demons: 'Demons and the damned',
  hounds: 'Dogs, foxes and wolves',
  elementals: 'Spirits and golems',
  folk: 'Monstrous folk',
  oddities: 'Odd beasts and clockwork',
  crawlers: 'Things that crawl',
  plants: 'The walking green',
  herds: 'Hoof and horn',
  serpents: 'Serpents and lizards',
  dragons: 'Dragonkind',
  vermin: 'Vermin',
  slimes: 'Oozes',
  dead: 'The restless dead',
};
const HABITAT_NAMES: Record<Habitat, string> = {
  wild: 'the open land', forest: 'the woods', swamp: 'the marshes', sea: 'the sea', cave: 'caves', snow: 'the ice', desert: 'the dunes',
  fire: 'burning places', sky: 'the high places', crypt: 'crypts', fae: 'the fae woods', arcane: 'towers of magic', works: 'workshops and mines',
};
const NATURE_MARK: Record<string, string> = { beast: '🐾', undead: '☠', machine: '⚙', person: '⚔' };

/** (the family open, kept while the panel redraws; null: the summary) */
let open: Family | 'rest' | null = null;

export function renderBestiary(met: readonly string[], redraw: () => void): HTMLElement[] {
  const seen = new Set(met);
  const all = Object.values(ENEMIES);
  const head = el('p', 'hint', `Met ${all.filter((e) => seen.has(e.id)).length} of ${all.length} kinds of foe. Those not yet met are shadows; raids, hunts, delves and the land's lairs bring them.`);
  const groups: [Family | 'rest', string, EnemyDef[]][] = [
    ...(Object.keys(FAMILY_NAMES) as Family[]).map((f): [Family, string, EnemyDef[]] => [f, FAMILY_NAMES[f], BEASTS.filter((b) => b.family === f).sort((a, b) => a.tier - b.tier).map((b) => ENEMIES[b.id])]),
    ['rest', 'Lords, bosses and the rest', all.filter((e) => !BEAST_BY_ID[e.id]).sort((a, b) => Number(!!b.boss) - Number(!!a.boss) || a.hp - b.hp)],
  ];
  const out: HTMLElement[] = [head];
  for (const [id, name, list] of groups) {
    const n = list.filter((e) => seen.has(e.id)).length;
    const top = el('button', `bestiary-head${open === id ? ' on' : ''}`, `${name} · ${n}/${list.length}`);
    top.addEventListener('click', () => {
      open = open === id ? null : id;
      redraw();
    });
    out.push(top);
    if (open !== id) continue;
    const grid = el('div', 'bestiary-grid');
    for (const e of list) grid.append(pickable(card(e, seen.has(e.id)), `beast:${id}`, e.id));
    out.push(grid);
    // (tap a creature: what's known of it, under the grid)
    const pick = pickedIn(`beast:${id}`);
    if (pick && ENEMIES[pick]) out.push(beastDetails(ENEMIES[pick], seen.has(pick)));
  }
  return out;
}

function card(e: EnemyDef, met: boolean): HTMLElement {
  const c = el('div', `beast${met ? '' : ' unmet'}${e.boss ? ' boss' : ''}`);
  const pic = creatureThumb(e, 40) ?? el('div', 'thumb mark', NATURE_MARK[natureOf(e.id)] ?? '?');
  const b = BEAST_BY_ID[e.id];
  const where = b ? `Tier ${b.tier} · ${HABITAT_NAMES[b.habitat]}` : e.boss ? 'A boss' : '';
  c.append(pic, el('div', 'beast-name', e.name), el('div', 'beast-line', `${e.hp} health${e.ranged ? ' · ranged' : ''}`));
  if (where) c.append(el('div', 'beast-line', where));
  return c;
}

/** A creature's details (tap it): all its ways once the town has met it; before then, only where it's found. */
function beastDetails(e: EnemyDef, met: boolean): HTMLElement {
  const c = el('div', 'card picked-card');
  const top = el('div', 'card-top');
  const b = BEAST_BY_ID[e.id];
  top.append(el('span', 'card-name', met ? e.name : `${e.name}?`), el('span', 'card-size', met ? (e.boss ? 'A boss' : 'Met') : 'Not met yet'));
  c.append(top);
  if (!met) {
    c.append(el('div', 'more-line', `Nobody in town has faced one yet: its ways are unknown.${b ? ` It is found ${HABITAT_NAMES[b.habitat].toLowerCase()}.` : ''}`));
    return c;
  }
  const kit = e.kit;
  c.append(
    facts([
      ['Health', e.hp],
      ['A blow', `${e.damage[0]}–${e.damage[1]}, every ${e.interval} s`],
      ['Aim', `${Math.round(e.accuracy * 100)}%`],
      ['Dodges', `${Math.round(e.dodge * 100)}%`],
      ['Armour', e.armor ? `${Math.round(e.armor * 100)}%` : null],
      ['Fights', e.ranged ? 'from range' : 'up close'],
      ['Nature', natureOf(e.id)],
      ['Tier', b ? b.tier : null],
      ['Found', b ? HABITAT_NAMES[b.habitat] : null],
      ['Drops', stockLine(e.loot) || null],
      ['Roars', kit?.roar ?? null],
      ['When enraged', kit?.enrage ?? null],
      ['Its sweep', kit?.area ? `${kit.area.name}, at ${kit.area.targets} at once` : null],
      ['Calls up', kit?.summon ? `${kit.summon.count} more` : null],
    ]),
  );
  return c;
}
