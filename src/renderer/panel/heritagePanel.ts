// The Town menu's "Our ways" tab (sim/heritage.ts): each people's own system, for the town that has one. The town runs
// it itself; this is to watch: the druids' grove (its favour, guardians and rites), and the others as they come.

import type { HeritageView } from '../../shared/sim/heritage';
import type { Snapshot } from '../../shared/sim/snapshot';
import { expandable, facts } from './details';
import { el } from './dom';

export const heritageKey = (s: Snapshot) => JSON.stringify(s.heritage);

/** A bar from the middle: favour (−100..100) left in red, right in green. */
export function favourBar(v: number): HTMLElement {
  const bar = el('div', 'favour');
  const fill = el('div', `favour-fill ${v >= 0 ? 'up' : 'down'}`);
  fill.style.width = `${Math.min(100, Math.abs(v)) / 2}%`;
  fill.style[v >= 0 ? 'left' : 'right'] = '50%';
  bar.append(fill);
  return bar;
}

function logList(lines: string[]): HTMLElement {
  const ul = el('ul', 'log');
  for (const l of lines) ul.append(el('li', '', l));
  return ul;
}

export function heritageSection(s: Snapshot): HTMLElement[] {
  const h = s.heritage;
  if (!h) return [];
  return [...groveSection(h), ...courtSection(h), ...workSection(h), ...orderSection(h), ...foundrySection(h), ...frontierSection(h)];
}

function groveSection(h: HeritageView): HTMLElement[] {
  const g = h.grove;
  if (!g) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the grove')];
  out.push(el('div', 'hint', 'The grove is alive, and it remembers. Felling the wild angers it; letting the woods grow back, and keeping the rites at the turn of each season, pleases it. Pleased, it blesses the fields and sends beasts to guard the town; angered, its thorns cut and its wolves come.'));
  const c = el('div', `card grove${g.blessed ? ' blessed' : g.angry ? ' angry' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🌳 ${g.mood}`), el('span', 'card-size', `favour ${g.favour > 0 ? '+' : ''}${g.favour}`));
  c.append(top, favourBar(g.favour));
  c.append(el('div', 'purpose', g.blessed ? 'Its blessing is on the fields and the foraging today.' : g.angry ? 'Its anger is on the fields; its thorns wait in the woods.' : 'Neither blessing nor curse today.'));
  c.append(el('div', 'purpose', `Next rite: ${g.nextRite.name}, in ${g.nextRite.days} day${g.nextRite.days > 1 ? 's' : ''}.`));
  out.push(
    expandable(c, 'grove', () => [
      facts([
        ['Blessed at', '+35: fields and foraging 15% better, and a guardian now and then'],
        ['Angered at', '−35: fields worse, thorns, wolves'],
        ['Guardians leave at', '−20'],
      ]),
    ]),
  );
  out.push(el('h2', '', 'Our ways: the guardians'));
  if (!g.guardians.length) out.push(el('div', 'hint', 'No guardians yet. When the grove is pleased, it sends a beast to guard the town.'));
  const grid = el('div', 'cards');
  for (const q of g.guardians) {
    const gc = el('div', 'card');
    const t = el('div', 'card-top');
    t.append(el('span', 'card-name', `${q.beast === 'bear' ? '🐻' : q.beast === 'boar' ? '🐗' : '🐺'} ${q.name}`), el('span', 'card-size', `${q.days} day${q.days === 1 ? '' : 's'}`));
    gc.append(t, el('div', 'purpose', `A great ${q.beast} of the grove. It fights beside the town in every raid.`));
    grid.append(gc);
  }
  if (g.guardians.length) out.push(grid);
  if (g.log.length) out.push(logList(g.log));
  return out;
}

function courtSection(h: HeritageView): HTMLElement[] {
  const c = h.court;
  if (!c) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the Court')];
  out.push(el('div', 'hint', 'Every few nights at moonrise the Fae Court comes with a bargain: a boon now, a price later. The fair folk always collect, and a price that can\'t be paid is taken another way. Refused, they sulk. Cold iron in the stores hurts them all; a charmed Court holds revels under the full moon.'));
  const card = el('div', `card court${c.revels ? ' blessed' : c.favour < -20 ? ' angry' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🧚 ${c.mood}`), el('span', 'card-size', `favour ${c.favour > 0 ? '+' : ''}${c.favour}`));
  card.append(top, favourBar(c.favour));
  card.append(el('div', 'purpose', `${c.struck} bargain${c.struck === 1 ? '' : 's'} struck, ${c.refused} refused. The next comes in about ${c.nextDays} day${c.nextDays === 1 ? '' : 's'}.`));
  if (c.ironHurts) card.append(el('div', 'lock short', `${c.iron} cold iron in the stores: the fair folk feel it.`));
  if (c.revels) card.append(el('div', 'purpose', 'Charmed: the Court holds revels under the full moon.'));
  out.push(card);
  if (c.debts.length) {
    out.push(el('h2', '', 'Our ways: what we owe'));
    for (const d of c.debts) {
      const dc = el('div', 'card');
      const t = el('div', 'card-top');
      t.append(el('span', 'card-name', d.title), el('span', 'card-size', d.days ? `due in ${d.days} day${d.days > 1 ? 's' : ''}` : 'due today'));
      dc.append(t, el('div', 'purpose', `The price: ${d.price}.`));
      out.push(dc);
    }
  }
  if (c.taken.length) out.push(el('div', 'hint', `Taken by the fair folk: ${c.taken.join(', ')}.`));
  if (c.log.length) out.push(logList(c.log));
  return out;
}

function workSection(h: HeritageView): HTMLElement[] {
  const w = h.work;
  if (!w) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the Great Work')];
  out.push(el('div', 'hint', 'Each morning the Crucible\'s best mind runs an experiment: a transmutation of base matter, or a potion for the town. Some explode. Each that works brings the Great Work on, through five stages, each opened by an offering, to the Philosopher\'s Stone: the Elixir of Life, and the game won.'));
  const c = el('div', 'card work');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `⚗ ${w.stageName}`), el('span', 'card-size', `stage ${w.stage} of 5`));
  c.append(top);
  if (w.next) {
    const row = el('div', 'bar-row');
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.round(Math.min(1, w.progress / w.next.at) * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'bar-label', 'Next'), bar, el('span', 'bar-text', `${w.next.name}: ${w.progress}/${w.next.at}`));
    c.append(row, el('div', 'purpose', `Offering: ${w.next.offering}. ${w.next.gift}`));
  } else c.append(el('div', 'purpose', 'The Great Work is complete.'));
  c.append(el('div', 'purpose', `${w.alchemist ? `${w.alchemist} works the athanor (${w.odds}% odds)` : 'Nobody at the athanor'} · ${w.worked} of ${w.tried} experiments worked, ${w.blasts} blew up`));
  out.push(c);
  if (w.homunculi.length) out.push(el('div', 'hint', `Homunculi at work: ${w.homunculi.join(', ')}.`));
  if (w.log.length) out.push(logList(w.log));
  return out;
}

function orderSection(h: HeritageView): HTMLElement[] {
  const o = h.order;
  if (!o) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the Order')];
  out.push(el('div', 'hint', 'The Order lives by its code. Its people swear vows and are honoured or shamed by how they keep them; the worthy are knighted; a tournament is held each week; the liege calls for service; and an Order rich in honour rides out after the Holy Grail, which wins the game.'));
  const c = el('div', 'card order');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🛡 ${o.name}`), el('span', 'card-size', `honour ${o.honour}`));
  c.append(top, favourBar(o.honour));
  c.append(el('div', 'purpose', `${o.kept} vows kept, ${o.broken} broken · next tournament in ${o.tourneyDays} day${o.tourneyDays === 1 ? '' : 's'}`));
  if (o.knights.length) c.append(el('div', 'purpose', `Knights of the Order: ${o.knights.join(', ')}`));
  if (o.liege) c.append(el('div', 'purpose', `In the liege's service: ${o.liege.names.join(' and ')} (home in ${o.liege.hours}h).`));
  out.push(c);
  const g = el('div', 'card grail');
  const gt = el('div', 'card-top');
  gt.append(el('span', 'card-name', '🏆 The Holy Grail'), el('span', 'card-size', `${o.grail.stage} of ${o.grail.of}`));
  g.append(gt, el('div', 'purpose', o.grail.rider ? `${o.grail.rider} rides to ${o.grail.next}.` : o.grail.next ? (o.honour >= o.grail.needs ? `Next: ${o.grail.next}. The Order's best will ride out.` : `The quest waits for the Order's honour to reach ${o.grail.needs}.`) : 'The Grail is found.'));
  out.push(g);
  if (o.vows.length) {
    out.push(el('h2', '', 'Our ways: vows sworn'));
    for (const v of o.vows) {
      const vc = el('div', 'card');
      const vt = el('div', 'card-top');
      vt.append(el('span', 'card-name', v.who), el('span', 'card-size', `${v.days} day${v.days === 1 ? '' : 's'} left`));
      vc.append(vt, el('div', 'purpose', `Has sworn ${v.vow}: ${v.text}.`));
      out.push(vc);
    }
  }
  if (o.log.length) out.push(logList(o.log));
  return out;
}

function foundrySection(h: HeritageView): HTMLElement[] {
  const f = h.foundry;
  if (!f) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the foundry')];
  out.push(el('div', 'hint', 'The colony builds its own: a production line turns parts into new units. Everything runs on power, from the sun, burned cells and coal, or a power station; short of it, the colony slows and units shut down. Units wear out and are mended with parts, or break down. Spare circuits become modules. Once the colony\'s seat grows into a Mind, it gives directives, and it does not like being overruled.'));
  const c = el('div', `card foundry ${f.state}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `⚡ Power ${f.power}`), el('span', 'card-size', f.state === 'running' ? 'running' : f.state === 'brownout' ? 'brown-out' : 'BLACKOUT'));
  c.append(top);
  const bar = el('div', 'bar');
  const fill = el('div', `bar-fill${f.power < 25 ? ' low' : ''}`);
  fill.style.width = `${f.power}%`;
  bar.append(fill);
  c.append(bar, el('div', 'purpose', `${f.units} units (room for ${f.room}) · ${f.building !== null ? `a unit on the line, ready in ${f.building} day${f.building === 1 ? '' : 's'}` : 'the line is idle'} · ${f.built} built, ${f.faults} faults`));
  if (f.mind.awake) c.append(el('div', 'purpose', `The Mind is awake. Overruled ${f.mind.dissent} of ${f.mind.most} times.`));
  out.push(c);
  if (f.worn.length) out.push(el('div', 'hint', `Wearing out: ${f.worn.map((w) => `${w.name} (${w.wear}%)`).join(', ')}.`));
  if (f.modules.length) out.push(el('div', 'hint', `Modules: ${f.modules.map((m) => `${m.name}: ${m.fitted.join(', ')}`).join('; ')}.`));
  if (f.log.length) out.push(logList(f.log));
  return out;
}

function frontierSection(h: HeritageView): HTMLElement[] {
  const f = h.frontier;
  if (!f) return [];
  const out: HTMLElement[] = [el('h2', '', 'Our ways: the frontier')];
  out.push(el('div', 'hint', 'Plain folk with no magic of their own, the settlers learn: a trick from every people they meet and trade with, a trade from every stranger who settles among them. And they claim the land, a stretch at a time, and work it, though claim-jumpers may come for it.'));
  const c = el('div', 'card frontier');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `🪓 ${f.claims.length} claim${f.claims.length === 1 ? '' : 's'} staked`), el('span', 'card-size', `next in ${f.nextClaimDays} day${f.nextClaimDays === 1 ? '' : 's'}`));
  c.append(top, el('div', 'purpose', `${f.tricks.length} of ${f.tricks.length + f.unmet.length} peoples' tricks learned · ${f.taught} lessons from strangers · ${f.jumped} claim-jumpings`));
  if (f.claims.length) c.append(el('div', 'purpose', `Claims: ${f.claims.map((q) => q.name).join(', ')}`));
  out.push(c);
  if (f.tricks.length) {
    out.push(el('h2', '', 'Our ways: what we\'ve learned'));
    for (const t of f.tricks) {
      const tc = el('div', 'card');
      tc.append(el('div', 'card-name', t.people), el('div', 'purpose', `Taught us ${t.what}.`));
      out.push(tc);
    }
  }
  if (f.unmet.length) out.push(el('div', 'hint', `Not met yet: ${f.unmet.join(', ')}. A stranger of theirs in town, or their caravan at the market, would teach us their trick.`));
  if (f.log.length) out.push(logList(f.log));
  return out;
}
