// What the townsfolk do, measured (docs/notes/smarter-town.md): long headless towns, every grown-up's task logged
// tick by tick, and the town's slips counted: idling while work waits, hauling the long way, the hungry at work, the
// hurt at work, the town caught short of food in winter, and who turns out against a raid.
// Run: node tools/town-probe.mjs [days] [late|fresh|all]   (the same seeds every run, so before and after compare)

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseSave } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { buildingById, newGame, foodDaysFor, type GameState, type Person, type Task } from '../src/shared/sim/state';
import { calendarOf, TICKS_PER_DAY } from '../src/shared/sim/time';
import { HUNGRY } from '../src/shared/sim/townsfolk';
import { alarmRaised, bestGatherTile } from '../src/shared/sim/people';
import { buildableNow, distToBuilding, inWork, storages } from '../src/shared/sim/buildings';
import { CELL } from '../src/shared/sim/land';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { needsSickbed } from '../src/shared/sim/sickbeds';
import type { Material } from '../src/shared/data/materials';
import { FOOD_VALUE } from '../src/shared/data/people';

const DAYS = Number(process.argv[2] ?? 6);
const WHICH = process.argv[3] ?? 'all';

const WORK = new Set(['gather', 'store', 'fetch', 'deliver', 'build', 'pave', 'light', 'research', 'farm', 'mine', 'craft', 'repair', 'patrol']);
const FOODS = Object.keys(FOOD_VALUE) as Material[];

interface Tally {
  name: string;
  adultTicks: number;
  tasks: Record<string, number>;
  idleTicks: number;
  idleWithWork: number;
  hungryTicks: number;
  hungryWorking: number;
  hurtTicks: number;
  hurtWorking: number;
  fetches: number;
  fetchPx: number;
  fetchBestPx: number;
  stores: number;
  storePx: number;
  eats: number;
  eatPx: number;
  eatBestPx: number;
  raidTicks: number;
  defenders: number;
  ablebodied: number;
  deaths: Record<string, number>;
  starving: number;
  winterFoodDays: number[];
  peakShare: number;
  peopleEnd: number;
  beds: number;
  bedHungry: number;
  warnTicks: number;
  warnHungry: number;
}

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function foodStores(s: GameState) {
  return storages(s).filter((b) => FOODS.some((m) => (b.store[m] ?? 0) > 0));
}

/** Whether there's work this person could be doing: a marked cell with room for them, or a site with what it needs
 *  delivered and nobody building it. */
function workWaits(s: GameState, p: Person): boolean {
  if (p.priorities.gather !== 0 && bestGatherTile(s, p) !== null) return true;
  if (p.priorities.construct === 0) return false;
  return s.buildings.some((b) => inWork(b) && b.ring === undefined && buildableNow(b) && !s.people.some((q) => q.task?.type === 'build' && q.task.building === b.id));
}

function run(name: string, s: GameState): Tally {
  const sim = new Sim(s);
  const t: Tally = { name, adultTicks: 0, tasks: {}, idleTicks: 0, idleWithWork: 0, hungryTicks: 0, hungryWorking: 0, hurtTicks: 0, hurtWorking: 0, fetches: 0, fetchPx: 0, fetchBestPx: 0, stores: 0, storePx: 0, eats: 0, eatPx: 0, eatBestPx: 0, raidTicks: 0, defenders: 0, ablebodied: 0, deaths: {}, starving: 0, winterFoodDays: [], peakShare: 0, peopleEnd: 0, beds: 0, bedHungry: 0, warnTicks: 0, warnHungry: 0 };
  const last = new Map<number, Task | null>();
  let lastSeason = calendarOf(s).season;
  const N = DAYS * TICKS_PER_DAY;
  // (the town's own ticks: those of a fight on screen don't count, and a fight that never ends stops the run)
  for (let i = 0, all = 0; i < N && all < 3 * N; i++, all++) {
    const before = new Set(s.people.map((p) => p.id));
    // (a question the founder must answer holds the game: the probe answers it with its first choice, as a player might)
    if (waitingOnFounder(s)) for (const q of s.prompts) if (q.waits) sim.command({ type: 'answerPrompt', prompt: q.id, option: 0 });
    // (a raid's fight on screen holds the town on the phone: only the battle steps, as the game loop does)
    if (fightOnScreen(s)) {
      sim.step('fight');
      i--;
      continue;
    }
    sim.step();
    for (const id of before) {
      if (s.people.some((p) => p.id === id)) continue;
      const f = [...(s.fallen ?? [])].reverse().find((q) => q.id === id);
      const cause = f ? (/hunger|starv/.test(f.cause) ? 'hunger' : f.cause.split(' ').slice(0, 3).join(' ')) : 'left town';
      t.deaths[cause] = (t.deaths[cause] ?? 0) + 1;
    }
    const cal = calendarOf(s);
    if (cal.season !== lastSeason) {
      if (cal.season === 'winter') t.winterFoodDays.push(+foodDaysFor(s, FOODS.reduce((n, m) => n + storages(s).reduce((k, b) => k + (b.store[m] ?? 0) * FOOD_VALUE[m]!, 0), 0)).toFixed(1));
      lastSeason = cal.season;
    }
    const alarm = alarmRaised(s);
    const counts: Record<string, number> = {};
    let adults = 0;
    for (const p of s.people) {
      if (p.bornTick != null || p.away !== null) continue;
      adults++;
      t.adultTicks++;
      const ty = p.task?.type ?? 'none';
      t.tasks[ty] = (t.tasks[ty] ?? 0) + 1;
      if (WORK.has(ty)) counts[ty] = (counts[ty] ?? 0) + 1;
      if (p.starving) t.starving++;
      const asleep = ty === 'sleep';
      if (!alarm && !asleep && (ty === 'none' || ty === 'wander' || ty === 'idle') && p.morale >= 15 && !p.breakdown) {
        t.idleTicks++;
        if ((s.tick + p.id) % 10 === 0 && workWaits(s, p)) t.idleWithWork += 10;
      }
      if (p.needs.food < HUNGRY) {
        t.hungryTicks++;
        if (WORK.has(ty)) t.hungryWorking++;
      }
      if (!p.downed && needsSickbed(p)) {
        t.hurtTicks++;
        if (WORK.has(ty)) t.hurtWorking++;
      }
      if (alarm && s.raid?.phase === 'warning') {
        t.warnTicks++;
        if (p.needs.food < HUNGRY) t.warnHungry++;
      }
      if (alarm) {
        if (!p.downed && p.priorities.defend !== 0) t.ablebodied++;
        if (ty === 'defend') t.defenders++;
      }
      // (a task begun this tick)
      const prev = last.get(p.id);
      if (p.task && p.task !== prev && p.task.type !== prev?.type) {
        const task = p.task;
        if (task.type === 'fetch') {
          const from = buildingById(s, task.from);
          const site = buildingById(s, task.building);
          if (from && site) {
            const need = Object.keys(task.amounts) as Material[];
            const leg = (st: typeof from) => distToBuilding(st, p) + d2({ x: (st.tile + 0.5) * CELL, y: (st.row + 0.5) * CELL }, { x: (site.tile + 0.5) * CELL, y: (site.row + 0.5) * CELL });
            t.fetches++;
            t.fetchPx += leg(from);
            t.fetchBestPx += Math.min(...storages(s).filter((st) => need.some((m) => (st.store[m] ?? 0) > 0) || st === from).map(leg));
          }
        } else if (task.type === 'store') {
          const st = buildingById(s, task.building);
          if (st) {
            t.stores++;
            t.storePx += distToBuilding(st, p);
          }
        } else if (task.type === 'sleep' && !task.sick && prev?.type !== 'sleep') {
          t.beds++;
          if (p.needs.food < HUNGRY && foodStores(s).length) t.bedHungry++;
        } else if (task.type === 'eat') {
          const st = buildingById(s, task.building);
          if (st) {
            t.eats++;
            t.eatPx += distToBuilding(st, p);
            t.eatBestPx += Math.min(...foodStores(s).map((b) => distToBuilding(b, p)), distToBuilding(st, p));
          }
        }
      }
      last.set(p.id, p.task);
    }
    if (alarm) t.raidTicks++;
    if (adults >= 4) {
      const top = Math.max(0, ...Object.values(counts));
      t.peakShare = Math.max(t.peakShare, top / adults);
    }
  }
  t.peopleEnd = s.people.length;
  return t;
}

function lateTown(): GameState {
  const r = parseSave(gunzipSync(readFileSync('test/fixtures/late-town.json.gz')).toString('utf8'));
  if (!r.ok) throw new Error('the fixture would not load');
  return r.save.state;
}

function freshTown(seed: string, scenario: string): GameState {
  const s = newGame(seed, { scenario });
  s.autopilot = true;
  // (a player who builds what the town recommends: the old planner lays it)
  s.townBuilds = true;
  return s;
}

const towns: [string, () => GameState][] = [];
if (WHICH === 'late' || WHICH === 'all') {
  towns.push(['late-town', lateTown]);
  // (the fixture's raid at the gate left out: the town's ordinary days)
  towns.push(['late-town, no raid at the gate', () => {
    const s = lateTown();
    s.raid = null;
    s.nextRaidTick = s.tick + 3 * TICKS_PER_DAY;
    return s;
  }]);
}
if (WHICH === 'fresh' || WHICH === 'all')
  for (const [seed, sc] of [['probe-a', 'band'], ['probe-b', 'tribe'], ['probe-c', 'supplied'], ['probe-d', 'tribe']] as const) towns.push([`${seed}/${sc}`, () => freshTown(seed, sc)]);

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const avg = (a: number, b: number) => (b ? (a / b / CELL).toFixed(1) : '-');
const total: Record<string, number> = {};
for (const [name, make] of towns) {
  const t0 = performance.now();
  const t = run(name, make());
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  const top = Object.entries(t.tasks).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => `${k} ${pct(v, t.adultTicks)}`).join(', ');
  console.log(`\n== ${name}: ${DAYS} days, ${t.peopleEnd} people at the end (${secs} s)`);
  console.log(`  tasks: ${top}`);
  console.log(`  idle (awake, not sulking) ${pct(t.idleTicks, t.adultTicks)} of grown-up time; idle with work waiting ${pct(t.idleWithWork, t.adultTicks)}`);
  console.log(`  hungry ${pct(t.hungryTicks, t.adultTicks)}, of that at work ${pct(t.hungryWorking, t.hungryTicks)}; starving person-ticks ${t.starving}`);
  console.log(`  badly hurt ${pct(t.hurtTicks, t.adultTicks)}, of that at work ${pct(t.hurtWorking, t.hurtTicks)}`);
  console.log(`  fetches ${t.fetches}: ${avg(t.fetchPx, t.fetches)} cells a trip, best store ${avg(t.fetchBestPx, t.fetches)} · stores ${t.stores}: ${avg(t.storePx, t.stores)} cells · meals ${t.eats}: ${avg(t.eatPx, t.eats)} cells (best ${avg(t.eatBestPx, t.eats)})`);
  console.log(`  to bed ${t.beds} times, hungry with food in the stores ${pct(t.bedHungry, t.beds)} · raid warnings: ${t.warnTicks} person-ticks, hungry ${pct(t.warnHungry, t.warnTicks)}`);
  console.log(`  raid ticks ${t.raidTicks}: defending ${pct(t.defenders, t.ablebodied)} of the able`);
  console.log(`  peak share of grown-ups on one job ${(100 * t.peakShare).toFixed(0)}% · food days at winter's start ${JSON.stringify(t.winterFoodDays)} · deaths ${JSON.stringify(t.deaths)}`);
  for (const k of ['adultTicks', 'idleTicks', 'idleWithWork', 'hungryTicks', 'hungryWorking', 'hurtTicks', 'hurtWorking', 'fetches', 'fetchPx', 'fetchBestPx', 'starving', 'beds', 'bedHungry', 'warnTicks', 'warnHungry'] as const) total[k] = (total[k] ?? 0) + t[k];
  total.hunger = (total.hunger ?? 0) + (t.deaths.hunger ?? 0);
}
console.log(`\n== all: idle ${pct(total.idleTicks, total.adultTicks)}, idle with work waiting ${pct(total.idleWithWork, total.adultTicks)}, hungry ${pct(total.hungryTicks, total.adultTicks)} (at work ${pct(total.hungryWorking, total.hungryTicks)}), hurt at work ${pct(total.hurtWorking, total.hurtTicks)}, fetch ${avg(total.fetchPx, total.fetches)} vs best ${avg(total.fetchBestPx, total.fetches)} cells, to bed hungry ${pct(total.bedHungry, total.beds)}, hungry in raid warnings ${pct(total.warnHungry, total.warnTicks)}, starving person-ticks ${total.starving}, hunger deaths ${total.hunger}`);
