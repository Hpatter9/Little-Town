// The war remembered. Whoever dies in it (on a campaign, at the walls against a power's host, in the sack, on the
// garrison's gallows) is one of the town's war dead (`s.war.dead`), their partner a war widow and their children war
// orphans (`Person.warLoss`, in the family's story); once a war has taken `MEMORIAL_AT` of the town, a memorial to its
// fallen is raised in the square (sim/memorials.ts `warMemorial`, a statue like the famous dead's, their names on
// it). The year's chronicle tells the wars (sim/annals.ts).

import { FACTION_BY_ID } from '../../data/factions';
import { MEMORIAL_AT, WAR_DEAD_MOST } from '../../data/war';
import { warMemorial } from '../memorials';
import { kinOf } from '../lineage';
import { isChild } from '../social';
import type { GameState, Person } from '../state';
import { campaignOfTarget, isCampaignTarget } from './campaigns';
import { warMap } from './map';
import { warOf } from './state';

const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;

/** A death the war's own rules bring about (the sack, the gallows): set while they kill, so the death is the war's. */
let dyingOf: { war: string; where: string } | null = null;
export function inWar<T>(war: string, where: string, f: () => T): T {
  dyingOf = { war, where };
  try {
    return f();
  } finally {
    dyingOf = null;
  }
}

/** Which war a death is part of, if any: a campaign's party, the walls against a power's host, the war's own doings. */
function warOfDeath(s: GameState, p: Person): { war: string; where: string } | null {
  if (dyingOf) return dyingOf;
  if (p.away !== null && p.away !== undefined) {
    const e = s.expeditions.find((x) => x.id === p.away);
    const target = e?.dest.startsWith('assault:') ? e.dest.slice(7) : '';
    if (isCampaignTarget(target)) {
      const c = campaignOfTarget(s, target);
      if (!c) return null;
      const where = c.province !== null ? warMap(s)?.w.provinces[c.province]?.name : undefined;
      return { war: nameOf(c.against), where: where ?? FACTION_BY_ID[c.against]?.stronghold ?? 'the field' };
    }
    return null;
  }
  const host = s.raid?.host;
  if (host && FACTION_BY_ID[host]) return { war: nameOf(host), where: s.war?.occupation?.rising ? 'the streets of the town' : 'the walls of the town' };
  return null;
}

/** Someone has died (sim/annals.ts `recordFallen`, while they are still on the roll): one of the war dead? */
export function warFallen(s: GameState, p: Person): void {
  if (s.autopilot === false && !dyingOf) return;
  const at = warOfDeath(s, p);
  if (!at) return;
  const w = warOf(s);
  const widow = p.partner != null ? s.people.find((q) => q.id === p.partner && q !== p) : undefined;
  const orphans = s.people.filter((q) => q !== p && isChild(q) && q.parents?.includes(p.id));
  w.dead.push({ id: p.id, name: p.name, war: at.war, where: at.where, tick: s.tick, ...(widow ? { widow: widow.name } : {}), ...(orphans.length ? { orphans: orphans.map((q) => q.name) } : {}) });
  if (w.dead.length > WAR_DEAD_MOST) w.dead.splice(0, w.dead.length - WAR_DEAD_MOST);
  // (and in the family's record: sim/lineage.ts)
  for (const q of [...(widow ? [widow] : []), ...orphans]) {
    q.warLoss = { name: p.name, war: at.war, as: q === widow ? 'widow' : 'orphan', tick: s.tick };
    kinOf(s, q).war = warLossLine(q)!;
  }
  // a memorial to the war's fallen, once there are enough of them (and their names on it as more fall)
  const ofWar = w.dead.filter((d) => d.war === at.war).map((d) => d.name);
  const raised = (w.memorials ??= []).includes(at.war);
  if (raised || ofWar.length >= MEMORIAL_AT) {
    warMemorial(s, at.war, ofWar, p, !raised);
    if (!raised) w.memorials.push(at.war);
  }
}

/** A line a war-born grief takes in a townsperson's story. */
export function warLossLine(p: Pick<Person, 'warLoss'>): string | null {
  const l = p.warLoss;
  if (!l) return null;
  return l.as === 'widow' ? `Widowed by the war with ${l.war}: ${l.name} did not come home.` : `Orphaned by the war with ${l.war}: ${l.name} fell in it.`;
}

/** The year's wars, for the chronicle (sim/annals.ts `writeChronicle`). */
export function warYearLines(s: GameState, since: number): string[] {
  const w = s.war;
  if (!w) return [];
  const out: string[] = [];
  const told = w.news.filter((n) => n.tick >= since && /^(Victory|Defeat) at|have fallen|siege is (broken|lost)|town is free|hold the town|takes the war|torn up the treaty|brokered peace/.test(n.text));
  if (told.length) out.push(`Of the wars: ${told.slice(-3).map((n) => n.text.replace(/\.$/, '').split(/[.!:] /)[0]).join('; ')}.`);
  const dead = w.dead.filter((d) => d.tick >= since);
  if (dead.length) out.push(`${dead.length === 1 ? 'One of ours' : `${dead.length} of ours`} fell in the realm's wars: ${dead.slice(0, 3).map((d) => `${d.name} at ${d.where}`).join(', ')}${dead.length > 3 ? ', and more' : ''}.`);
  return out;
}
