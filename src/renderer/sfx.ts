// What the town sounds like from one snapshot to the next (the owner's ask: many more sound effects). Pure: compares
// the last snapshot with the new one and says which cues (ambience.ts) to play, where across the screen, and when:
// blows struck and landing, raiders falling, spells cast, coins in, a level gained, a question asked, a raid won or
// lost, the rooster at dawn and the bell at noon and dusk, doors as people go in, a feast's cheer and a funeral's
// bell, a birth's cry, the ground shaking, the forge and the sawpit at work. A few of each at most, so a big fight
// isn't a wall of noise.

import type { Cue } from './ambience';
import type { Snapshot } from '../shared/sim/snapshot';

export interface Sound {
  cue: Cue;
  pan: number;
  delay: number;
}

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The most of one kind a snapshot plays. */
const MOST = 2;
/** Ticks: a blow struck or landed since the last snapshot. */
const FRESH = 3;

const inView = (v: View, x: number, y: number) => x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
const panOf = (v: View, x: number) => Math.max(-0.9, Math.min(0.9, ((x - v.x) / Math.max(1, v.w)) * 1.6 - 0.8));

/** `r` for the chances (Math.random in the game; a fixed stream in tests). */
export function soundsBetween(prev: Snapshot | null, next: Snapshot, v: View, r: () => number = Math.random): Sound[] {
  const out: Sound[] = [];
  const count: Partial<Record<Cue, number>> = {};
  const play = (cue: Cue, pan = 0, delay = 0) => {
    if ((count[cue] ?? 0) >= MOST) return;
    count[cue] = (count[cue] ?? 0) + 1;
    out.push({ cue, pan, delay: delay + r() * 0.05 });
  };
  if (!prev) return out;
  const before = new Map(prev.people.map((p) => [p.id, p]));
  const dark = next.theme === 'lich' || next.theme === 'robot';

  // the townsfolk: blows struck and taken, levels, doors, births
  for (const p of next.people) {
    if (p.away !== null) continue;
    const was = before.get(p.id);
    const seen = inView(v, p.x, p.y) && !p.indoors;
    const pan = panOf(v, p.x);
    if (seen && p.sinceBlow >= 0 && p.sinceBlow < FRESH && (!was || was.sinceBlow > p.sinceBlow)) {
      const shoots = p.activity === 'fight' && p.cls != null && ['archer', 'ranger', 'hunter'].includes(p.cls);
      play(shoots ? 'arrow' : 'clash', pan);
    }
    if (seen && p.sinceHit >= 0 && p.sinceHit < FRESH && (!was || was.sinceHit > p.sinceHit)) play(r() < 0.5 ? 'hurt' : 'thud', pan);
    if (was && p.level > was.level) play('levelup', 0, 0.1);
    if (was && seen && p.indoors !== was.indoors && r() < 0.25) play('door', pan);
    if (!was && p.ageYears < 1 && prev.people.length) play('baby', seen ? pan : 0);
  }
  // the raiders: struck, and falling
  const raidersBefore = new Map((prev.raid?.raiders ?? []).map((x) => [x.id, x]));
  for (const x of next.raid?.raiders ?? []) {
    const was = raidersBefore.get(x.id);
    if (!inView(v, x.x, x.y)) continue;
    if (x.down && was && !was.down) play('fall', panOf(v, x.x));
    else if (x.sinceHit >= 0 && x.sinceHit < FRESH && (!was || was.sinceHit > x.sinceHit)) play('thud', panOf(v, x.x));
  }
  // spells cast
  const lastSpell = prev.spells.reduce((m, sp) => Math.max(m, sp.n), -1);
  for (const sp of next.spells) if (sp.n > lastSpell) play(/heal|mend|bless|cure|life/i.test(sp.name) ? 'heal' : 'spell', panOf(v, sp.x));
  // coins in
  if (next.coins - prev.coins >= 5) play('coin', 0.3);
  // a question for the player
  const asked = new Set(prev.prompts.map((p) => p.id));
  if (next.prompts.some((p) => !asked.has(p.id))) play('chime');
  // a raid ends
  if (next.raidRecap && next.raidRecap.tick !== prev.raidRecap?.tick) play(next.raidRecap.outcome === 'pillaged' ? 'dirge' : 'fanfare', 0, 0.3);
  // the day's hours
  const h0 = prev.calendar.hour;
  const h1 = next.calendar.hour;
  if (h1 !== h0) {
    if (h1 === 6 && !dark) play('rooster', r() * 1.2 - 0.6);
    if ((h1 === 12 || h1 === 18) && next.people.length >= 6) play('bell', r() * 1.2 - 0.6);
  }
  // gatherings
  if (next.gathering && next.gathering.key !== prev.gathering?.key) {
    const k = next.gathering.kind;
    play(k === 'funeral' || k === 'great_funeral' ? 'dirge' : 'cheer', inView(v, next.gathering.x, next.gathering.y) ? panOf(v, next.gathering.x) : 0);
  }
  // disasters: the ground shaking, the fire's rush
  if (next.disaster && next.disaster.kind !== prev.disaster?.kind) play(next.disaster.kind === 'quake' ? 'rumble' : next.disaster.kind === 'wildfire' ? 'whoosh' : 'rumble');
  // the workshops at work in view, now and then
  for (const id of next.workingAt) {
    const b = next.buildings.find((q) => q.id === id);
    if (!b || r() > 0.03) continue;
    const bx = (b.tile + 0.5) * 32;
    const by = (b.row + 0.5) * 32;
    if (!inView(v, bx, by)) continue;
    const forge = /smith|forge|bloomery|armour|weapon|foundry|steel/.test(b.def);
    const wood = /saw|carpent|cooper|joiner|workbench|boat/.test(b.def);
    if (forge) play('anvil', panOf(v, bx));
    else if (wood) play('saw', panOf(v, bx));
  }
  // horses on the road, now and then
  if (next.travellers?.some((t) => inView(v, t.x, t.y)) && r() < 0.01) play('gallop', r() * 1.2 - 0.6);
  return out;
}
