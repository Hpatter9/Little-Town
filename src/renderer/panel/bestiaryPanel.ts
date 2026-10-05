// The Bestiary (the Chronicle's last tab): every foe in the world, by family, the ones the town has met in colour and
// the rest as shadows. The menagerie's (data/menagerie.ts) by their families, then the rest (bosses first).

import { ENEMIES, natureOf, type EnemyDef } from '../../shared/data/enemies';
import { BEAST_BY_ID, BEASTS, type Family, type Habitat } from '../../shared/data/menagerie';
import { creatureThumb } from '../art/creatureThumbs';
import { el } from './dom';

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
    for (const e of list) grid.append(card(e, seen.has(e.id)));
    out.push(grid);
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
