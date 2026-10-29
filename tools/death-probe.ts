// How often the townsfolk die, and of what (docs/notes/deaths-common.md): fresh settler towns played headless as the
// phone plays them (autopilot and the town's recommended builds on, a question answered with its first choice, a
// raid's fight holding the town), and the late-game fixture. Prints one JSON line a town: the deaths (day, cause,
// words, the founder's), the people each day, the raids, and person-hours without a bed, fevered, festering and cold.
// Run: node tools/death-probe.mjs <days> <seed>[,<seed>...]   (a seed "late" is the fixture; "x/tribe" picks a scenario)

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { newGame, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, clockTick } from '../src/shared/sim/time';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { foodPerHead } from '../src/shared/sim/townsfolk';
import { destinationOf } from '../src/shared/sim/expeditions';

const DAYS = Number(process.argv[2] ?? 30);
const SEEDS = (process.argv[3] ?? 'death-1').split(',');

/** A death's cause in a few words, by its text and what was going on when it came. */
export function causeOf(text: string, raid: boolean, doom: string | null): string {
  if (/hunger|starv/.test(text)) return 'hunger';
  if (/cold|froze|frost|freez/.test(text)) return 'cold';
  if (/old age/.test(text)) return 'old age';
  if (/plague|sick|fever|illness|disease|pox|blight/.test(text)) return 'sickness';
  if (/wound|bled/.test(text)) return raid ? 'raid' : 'wounds';
  if (/flood|earthquake|wildfire|tornado|lightning|cave-in|fire|storm|swept|crushed|came down/.test(text)) return 'disaster';
  if (raid) return 'raid';
  if (doom) return 'disaster';
  if (/killed|struck|slain|hands of|burned|eaten|torn|duel|murder/.test(text)) return 'fight';
  return 'other';
}

function lateTown(): GameState {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('the fixture would not load');
  return r.save.state;
}

function freshTown(seed: string): GameState {
  const [name, scenario] = seed.split('/');
  const s = newGame(name, { scenario: scenario ?? 'band' });
  s.autopilot = true;
  // (a player who builds what the town recommends: the old planner lays it)
  s.townBuilds = true;
  return s;
}

for (const seed of SEEDS) {
  const s = seed === 'late' ? lateTown() : freshTown(seed);
  const sim = new Sim(s);
  const day0 = Math.floor(clockTick(s) / TICKS_PER_DAY);
  const deaths: { day: number; cause: string; text: string; founder: boolean }[] = [];
  const pop: number[] = [s.people.length];
  let raids = 0;
  // (person-hours in town: all, without a bed, with a fever, a festering wound, cold on the winter ground)
  const hours = { home: 0, bedless: 0, fever: 0, fester: 0, cold: 0, sick: 0, starving: 0, hungry: 0 };
  let inRaid = false;
  // (to a day on the town's calendar, which stands still while a fight is on screen, so a 40-day run reaches the
  // end of winter; a town that stops going on for good stops the run)
  const end = clockTick(s) + DAYS * TICKS_PER_DAY;
  const winterFood: number[] = [];
  // (plagues struck, and the parties sent into a dungeon)
  let plagues = 0;
  const delves = new Set<number>();
  for (let all = 0; clockTick(s) < end && all < 3 * DAYS * TICKS_PER_DAY && !s.gameOver; all++) {
    if (waitingOnFounder(s)) for (const q of s.prompts) if (q.waits) sim.command({ type: 'answerPrompt', prompt: q.id, option: 0 });
    const fight = fightOnScreen(s);
    const before = new Map(s.people.map((p) => [p.id, p]));
    const main = s.mainId;
    const raid = !!s.raid && s.raid.phase !== 'warning';
    const doom = s.doom?.phase === 'active' ? s.doom.kind : null;
    for (const e of s.expeditions) if (destinationOf(s, e.dest)?.type === 'delve') delves.add(e.id);
    const fallen = (s.fallen ?? []).length;
    const tick = clockTick(s);
    sim.step(fight ? 'fight' : null);
    if (clockTick(s) !== tick && clockTick(s) % TICKS_PER_DAY === 0) {
      pop.push(s.people.length);
      // (the food put by, in days for the town, at the turn of each season)
      const d = Math.floor(clockTick(s) / TICKS_PER_DAY) - day0;
      if (d % 10 === 0) winterFood.push(Math.round(foodPerHead(s) * 10) / 10);
    }
    if (clockTick(s) !== tick && s.tick % TICKS_PER_HOUR === 0)
      for (const p of s.people) {
        if (p.away !== null) continue;
        hours.home++;
        if (p.bed === null) hours.bedless++;
        if (p.sick?.fever) hours.fever++;
        if (p.wounds?.some((w) => w.fester)) hours.fester++;
        if (p.cold) hours.cold++;
        if (p.sick && !p.sick.fever) hours.sick++;
        if (p.starving) hours.starving++;
        if (p.needs.food < 0.15) hours.hungry++;
      }
    if (s.raid && s.raid.phase !== 'warning' && !inRaid) raids++;
    if (s.doom?.kind === 'plague' && s.doom.phase === 'active' && doom !== 'plague') plagues++;
    inRaid = !!s.raid && s.raid.phase !== 'warning';
    if (s.people.length < before.size || (s.fallen ?? []).length > fallen) {
      const now = new Set(s.people.map((p) => p.id));
      for (const [id] of before) {
        if (now.has(id)) continue;
        const f = [...(s.fallen ?? [])].reverse().find((q) => q.id === id);
        if (!f) continue; // (left town, not dead)
        const raidNow = raid || (!!s.raid && s.raid.phase !== 'warning');
        deaths.push({ day: Math.floor(clockTick(s) / TICKS_PER_DAY) - day0, cause: causeOf(f.cause, raidNow, doom ?? (s.doom?.phase === 'active' ? s.doom.kind : null)), text: f.cause, founder: id === main });
      }
    }
  }
  console.log(JSON.stringify({ seed, days: DAYS, ended: s.gameOver ? Math.floor(clockTick(s) / TICKS_PER_DAY) - day0 : null, pop, deaths, raids, hours, foodDays: winterFood, plagues, delves: delves.size }));
}
