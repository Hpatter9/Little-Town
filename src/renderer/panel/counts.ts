// The counts in the sections' headings (structure.ts `foldSections`): "In town 14 · 2 under way", "People 23 · 3 away", so a long
// tab reads as a table of contents first. Worked out from the snapshot, by the heading's words.

import type { Snapshot } from '../../shared/sim/snapshot';
import type { CountFor } from './structure';

export function countsFor(menu: string, s: Snapshot): CountFor | undefined {
  const away = s.people.filter((p) => p.away !== null).length;
  const underway = s.buildings.filter((b) => b.status === 'blueprint').length;
  const standing = s.buildings.filter((b) => b.status === 'done').length;
  const rules: [RegExp, () => string | undefined][] = [];
  if (menu === 'build') {
    rules.push(
      [/^In town/, () => `${standing} built`],
      [/^Being built/, () => (underway ? `${underway} under way` : 'nothing yet')],
      [/^Treasury/, () => `${s.coins} coins`],
      [/^Guards/, () => `${s.guards.n} of ${s.guards.wanted}`],
      [/^Daughter villages/, () => (s.villages.length ? String(s.villages.length) : undefined)],
    );
  } else if (menu === 'townsfolk') {
    rules.push(
      [/^People/, () => `${s.people.length}${away ? ` · ${away} away` : ''}`],
      [/^Guilds/, () => String(s.guilds.length)],
      [/^Prisoners/, () => undefined],
    );
  } else if (menu === 'expeditions') {
    rules.push([/^Out now/, () => (s.expeditions.length ? `${s.expeditions.length} parties` : 'nobody away')]);
  } else if (menu === 'research') {
    rules.push([/^Studying/, () => `${s.research.queue.length} of ${s.research.slots}`]);
  }
  if (!rules.length) return undefined;
  return (heading) => rules.find(([re]) => re.test(heading))?.[1]();
}
