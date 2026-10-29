// The coins over a run (docs/notes/economy-balance.md), played as the phone plays them: fresh settler towns with
// `autopilot` left unset, the town's recommended builds on, a question answered with its first choice (and a raid's
// own: its toll, and a broken raid let go), a raid's fight holding the town. One JSON line a town, every ten days: the
// people (and the dead), the treasury, the purses (all, the median and the richest), who owes rent and the mood; over
// the run: the treasury's ledger summed (what came in and went out, by line), the battle items and tools bought, the
// tools broken and how many days each lasted (from its first hour of wear), the hours of wear a day, and how many
// fighters had a battle item at each raid.
// Run: node tools/economy-probe.mjs <days> <seed>[,<seed>...]   ("x/tribe" picks a scenario; SAVE=<dir> keeps each town)

import { Sim } from '../src/shared/sim/sim';
import { newGame, type Ledger } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { isChild } from '../src/shared/sim/social';
import { serialize } from '../src/shared/sim/save';
import { writeFileSync } from 'node:fs';
import { carriesKit } from '../src/shared/sim/kit';
import { KIT_BY_ID } from '../src/shared/data/kitItems';
import { ITEM_BY_ID } from '../src/shared/data/items';

const DAYS = Number(process.argv[2] ?? 40);
const SEEDS = (process.argv[3] ?? 'ap-1').split(',');
const EVERY = 10;

for (const seed of SEEDS) {
  const [name, scenario] = seed.split('/');
  const s = newGame(name, { scenario: scenario ?? 'band' });
  delete s.autopilot; // (as a real game leaves it)
  s.townBuilds = true;
  const sim = new Sim(s);
  const out = {
    seed, days: 0, people: 0, peopleBy: [] as number[], deaths: 0, stuckDays: 0, inArrears: [] as string[], morale: [] as number[], treasury: [] as number[], purses: [] as number[], perHead: [] as number[], richest: [] as number[],
    ledgerIn: {} as Ledger, ledgerOut: {} as Ledger, toolsBroken: 0, wearPerDay: 0, toolDays: [] as number[], wearUsers: 0, wearMedian: 0, wearTop: 0, toolHands: [] as string[], toolsBought: 0, toolCoins: 0, kitBought: 0, kitCoins: 0,
    pouchItems: 0, raids: 0, raidPouches: [] as string[],
  };
  let lastToday: Ledger | undefined;
  let lastNotice = 0;
  let wear = 0;
  let toolHours = 0;
  let inRaid = false;
  let raidAtDawn: number | undefined;
  const wearWas = new Map<number, number>();
  const worn = new Map<number, { wear: number; hours: number }>();
  const wearFrom = new Map<number, number>();
  const lasted: number[] = [];
  const book = (l: Ledger | undefined) => {
    for (const [k, v] of Object.entries(l ?? {}) as [keyof Ledger, number][]) {
      const side = v >= 0 ? out.ledgerIn : out.ledgerOut;
      side[k] = Math.round((side[k] ?? 0) + v);
    }
  };
  const end = s.tick + DAYS * TICKS_PER_DAY;
  for (let all = 0; s.tick < end && all < 3 * DAYS * TICKS_PER_DAY && !s.gameOver; all++) {
    if (waitingOnFounder(s)) for (const q of s.prompts) if (q.waits) sim.command({ type: 'answerPrompt', prompt: q.id, option: 0 });
    // (a raid's own questions wait on the founder's word: a toll asked at the gate, a broken raid let go or hunted)
    for (const id of [s.raid?.parley, s.raid?.mercy ? undefined : s.raid?.mercyAsk])
      if (id !== undefined && s.prompts.some((q) => q.id === id)) sim.command({ type: 'answerPrompt', prompt: id, option: 0 });
    const tick = s.tick;
    sim.step(fightOnScreen(s) ? 'fight' : null);
    if (s.ledger && s.ledger.today !== lastToday) {
      book(lastToday);
      lastToday = s.ledger.today;
    }
    for (const n of s.notices) {
      if (n.id <= lastNotice) continue;
      lastNotice = n.id;
      if (/wore out and broke/.test(n.text)) out.toolsBroken++;
    }
    if (s.raid?.tactics && !inRaid) {
      inRaid = true;
      out.raids++;
      const armed = s.people.filter((p) => p.away === null && carriesKit(p));
      if (out.raidPouches.length < 12) out.raidPouches.push(`${armed.filter((p) => p.kit?.length).length}/${armed.length}`);
    }
    if (!s.raid) inRaid = false;
    if (s.tick !== tick && s.tick % TICKS_PER_HOUR === 0) {
      for (const p of s.people) {
        const w = p.toolWear ?? 0;
        const was = wearWas.get(p.id) ?? 0;
        const add = w > was ? w - was : w < was ? 1 : 0; // (w < was: broke this hour, the wear reset)
        wear += add;
        wearWas.set(p.id, w);
        if (was === 0 && w > 0) wearFrom.set(p.id, s.tick);
        if (w < was && wearFrom.has(p.id)) lasted.push((s.tick - wearFrom.get(p.id)!) / TICKS_PER_DAY);
        const mine = worn.get(p.id) ?? { wear: 0, hours: 0 };
        mine.wear += add;
        if (p.gear.tool) {
          toolHours++;
          mine.hours++;
        }
        worn.set(p.id, mine);
        for (const m of p.recent ?? []) {
          if (m.tick !== s.tick || !m.text.startsWith('Bought a')) continue;
          const c = Number(/for (\d+) coins/.exec(m.text)?.[1] ?? 0);
          const low = m.text.toLowerCase();
          if (Object.keys(KIT_BY_ID).some((k) => low.includes(ITEM_BY_ID[k]?.name.toLowerCase()))) {
            out.kitBought++;
            out.kitCoins += c;
          } else if (Object.values(ITEM_BY_ID).some((i) => i.slot === 'tool' && low.includes(i.name.toLowerCase()))) {
            out.toolsBought++;
            out.toolCoins += c;
          }
        }
      }
    }
    if (s.tick !== tick && s.tick % TICKS_PER_DAY === 0) {
      // (a raid still on a day later is one stuck on a question the probe doesn't answer)
      if (s.raid && s.raid.id === raidAtDawn) out.stuckDays++;
      raidAtDawn = s.raid?.id;
    }
    if (s.tick !== tick && s.tick % (EVERY * TICKS_PER_DAY) === 0) {
      const grown = s.people.filter((p) => !isChild(p));
      const purses = grown.map((p) => p.coins ?? 0).sort((a, b) => a - b);
      out.treasury.push(Math.round(s.coins ?? 0));
      out.peopleBy.push(s.people.length);
      out.inArrears.push(`${grown.filter((p) => (p.debt ?? 0) > 0).length}/${grown.length} owing ${grown.reduce((n, p) => n + (p.debt ?? 0), 0)}`);
      out.morale.push(Math.round(grown.reduce((n, p) => n + p.morale, 0) / Math.max(1, grown.length)));
      out.purses.push(Math.round(purses.reduce((a, b) => a + b, 0)));
      out.perHead.push(Math.round(purses[Math.floor(purses.length / 2)] ?? 0));
      out.richest.push(Math.round(purses[purses.length - 1] ?? 0));
      const home = grown.filter((p) => p.away === null);
      out.toolHands.push(`${home.filter((p) => p.gear.tool).length}/${home.length}`);
    }
  }
  book(lastToday);
  out.wearPerDay = Math.round((wear / Math.max(1, toolHours / 24)) * 100) / 100;
  // (the wear a day of the ones who wore a tool at all, held a week or more: the median and the hardest-working quarter)
  const rates = [...worn.values()].filter((w) => w.wear > 0 && w.hours >= 7 * 24).map((w) => w.wear / (w.hours / 24)).sort((a, b) => a - b);
  out.wearUsers = rates.length;
  out.wearMedian = Math.round((rates[Math.floor(rates.length / 2)] ?? 0) * 100) / 100;
  out.wearTop = Math.round((rates[Math.floor(rates.length * 0.75)] ?? 0) * 100) / 100;
  lasted.sort((a, b) => a - b);
  out.toolDays = lasted.length ? [lasted[0], lasted[Math.floor(lasted.length / 2)], lasted[lasted.length - 1]].map((d) => Math.round(d * 10) / 10) : [];
  out.pouchItems = s.people.reduce((n, p) => n + (p.kit?.length ?? 0), 0);
  out.days = Math.floor(s.tick / TICKS_PER_DAY);
  out.people = s.people.length;
  out.deaths = s.fallen?.length ?? 0;
  console.log(JSON.stringify(out));
  // (SAVE=<dir>: the town at the end, as a save the phone build can load, for screenshots of its menus)
  if (process.env.SAVE) writeFileSync(`${process.env.SAVE}/${seed.replace('/', '_')}.json`, serialize(s, Date.now()));
}
