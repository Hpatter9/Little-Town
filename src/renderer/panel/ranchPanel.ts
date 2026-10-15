// The Market menu's Ranch tab (sim/ranch.ts `ranchView`, `snapshot.ranch`): the town's beasts, a card each (its
// picture from the creature sheets, name, kind, age, level, traits, what it's doing, its health), and tapped, where it
// came from, its parents, its record in the arena, what it eats and is worth, with a box to name it and Keep / Allow
// sale. The rest the town does itself.

import { ENEMIES } from '../../shared/data/enemies';
import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { creatureThumb } from '../art/creatureThumbs';
import { expandable, facts } from './details';
import { button, el } from './dom';

export const ranchKey = (s: Snapshot) =>
  JSON.stringify(s.ranch && [s.ranch.room, s.ranch.keeper?.name, s.ranch.log[0], s.ranch.beasts.map((b) => [b.id, b.name, b.level, b.job, b.rider?.id, Math.round(b.hp * 10), b.sick, b.keep, b.hunger, b.age, b.wins, b.losses])]);

const JOB_MARK: Record<string, string> = { guard: '🛡', haul: '🪵', hunt: '🏹', ride: '🐎', rest: '💤' };

export function ranchSection(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'The ranch')];
  const r = s.ranch;
  if (!r) {
    out.push(el('p', 'empty', 'No beasts yet. When a Beast Tamer wins a beast over in a raid, the town brings it home, and lays out a ranch to keep it (Domestication).'));
    return out;
  }
  out.push(
    el('div', 'hint', `${r.beasts.length} of ${r.room} places${r.ranches ? ` at ${r.ranches === 1 ? 'the ranch' : `${r.ranches} ranches`}` : ' (tethered by the fire: no ranch yet)'} · ${r.keeper ? `Beastmaster: ${r.keeper.name} (Animals ${r.keeper.animals})` : 'no Beastmaster yet'} · born ${r.bred}, sold ${r.sold}, died ${r.died}${r.lost ? `, ran off ${r.lost}` : ''}`),
    el('div', 'hint', 'The town feeds, breeds, trains and works its beasts itself, and sells what it cannot keep. You may name a beast, or forbid its sale.'),
  );
  const cards = el('div', 'cards');
  for (const b of r.beasts) {
    const c = el('div', `card beast${b.sick ? ' sick' : ''}`);
    const top = el('div', 'card-top');
    const def = ENEMIES[b.kind];
    const pic = (def && creatureThumb(def, 40)) ?? el('div', 'thumb mark', '🐾');
    top.append(pic, el('span', 'card-name', `${b.keep ? '🔒 ' : ''}${b.name}`), el('span', 'card-size', `${JOB_MARK[b.job] ?? ''} lv ${b.level}`));
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.round(b.hp * 100)}%`;
    bar.append(fill);
    const traits = el('div', 'kin-row');
    for (const t of b.traits) traits.append(el('span', `chip${t.bad ? ' bad' : ''}`, t.name));
    c.append(top, el('div', 'purpose', `${b.sex === 'f' ? '♀' : '♂'} ${b.kindName} · ${b.young ? 'a cub, ' : b.old ? 'old, ' : ''}${b.age} days · ${b.doing}${b.hunger ? ` · hungry ${b.hunger}d` : ''}`), bar, traits);
    cards.append(
      expandable(c, `beast:${b.id}`, () => {
        const name = el('input', 'beast-name') as HTMLInputElement;
        name.type = 'text';
        name.maxLength = 24;
        name.placeholder = 'A name';
        name.value = b.named ? b.name : '';
        const row = el('div', 'row');
        row.append(
          name,
          button('Name it', () => {
            const n = name.value.trim();
            if (n) bridge?.command({ type: 'ranch', id: b.id, op: 'name', name: n });
          }, { cls: 'place small' }),
          button(b.keep ? 'Allow its sale' : 'Keep: never sell', () => bridge?.command({ type: 'ranch', id: b.id, op: 'keep', keep: !b.keep }), { cls: 'place small' }),
        );
        return [
          facts([
            ['Came', b.from],
            ...(b.parents.length ? [['Parents', `${b.parents.join(' and ')} (generation ${b.gen})`] as [string, string]] : []),
            ['Lives', `about ${b.life} days`],
            ['Eats', b.eats],
            ['Level', `${b.level} (${Math.round(b.toNext * 100)}% to the next)`],
            ['Arena', b.wins + b.losses ? `${b.wins} won, ${b.losses} lost${b.crowns ? `, ${b.crowns} crown${b.crowns > 1 ? 's' : ''}` : ''}` : 'never fought'],
            ['Worth', `${b.price} coins`],
          ]),
          ...b.traits.map((t) => el('div', 'hint', `${t.name}: ${t.text}`)),
          row,
        ];
      }),
    );
  }
  if (r.beasts.length) out.push(cards);
  else out.push(el('p', 'empty', 'The pens stand empty.'));
  if (r.log.length) out.push(el('div', 'hint', r.log.slice(0, 5).join(' · ')));
  return out;
}
