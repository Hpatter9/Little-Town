// The systems that ran only with the autopilot set (docs/notes/autopilot-guard.md), played as the phone plays them:
// fresh settler towns with `autopilot` left unset (a real game), the town's recommended builds on (a player who builds
// what it suggests), a question answered with its first choice, a raid's fight holding the town, a chase given when
// one is offered. One JSON line a town: battle items handed out and bought, pouches, raids fought on a hand-made board,
// chases and what they caught, heartwood and rare finds, delves down a drawn floor, tools broken and tools in hand,
// and the treasury over the run.
// Run: node tools/autopilot-probe.mjs <days> <seed>[,<seed>...]   ("x/tribe" picks a scenario)

import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { canChase } from '../src/shared/sim/chase';
import { KIT_BY_ID } from '../src/shared/data/kitItems';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { isChild } from '../src/shared/sim/social';

const DAYS = Number(process.argv[2] ?? 30);
const SEEDS = (process.argv[3] ?? 'ap-1').split(',');

for (const seed of SEEDS) {
  const [name, scenario] = seed.split('/');
  const s = newGame(name, { scenario: scenario ?? 'band' });
  delete s.autopilot; // (as a real game leaves it)
  s.townBuilds = true;
  const sim = new Sim(s);
  const out = {
    seed, days: 0, people: 0, raids: 0, handBoards: 0, chaseOffers: 0, chases: 0, kitBought: 0, kitBoughtCoins: 0,
    pouchItems: 0, heartwood: 0, delves: 0, handFloors: 0, toolsBroken: 0, toolHands: [] as string[],
    coins: [] as number[], purses: [] as number[],
  };
  let inRaid = false;
  const delves = new Set<number>();
  let lastNotice = 0;
  const end = s.tick + DAYS * TICKS_PER_DAY;
  for (let all = 0; s.tick < end && all < 3 * DAYS * TICKS_PER_DAY && !s.gameOver; all++) {
    if (waitingOnFounder(s)) for (const q of s.prompts) if (q.waits) sim.command({ type: 'answerPrompt', prompt: q.id, option: 0 });
    if (s.chaseOffer && !s.raid && canChase(s)) {
      out.chases++;
      sim.command({ type: 'giveChase' } as never);
    }
    const offer = s.chaseOffer;
    const fight = fightOnScreen(s);
    const tick = s.tick;
    sim.step(fight ? 'fight' : null);
    if (s.chaseOffer && s.chaseOffer !== offer) out.chaseOffers++;
    if (s.raid?.tactics && !inRaid) {
      inRaid = true;
      if (!s.raid.chase) out.raids++;
      if (s.raid.tactics.board && !s.raid.chase) out.handBoards++;
    }
    if (!s.raid) inRaid = false;
    for (const e of s.expeditions ?? []) if (e.delve && !delves.has(e.id)) {
      delves.add(e.id);
      out.delves++;
      if (e.delve.floor) out.handFloors++;
    }
    for (const n of s.notices) {
      if (n.id <= lastNotice) continue;
      lastNotice = n.id;
      if (/wore out and broke/.test(n.text)) out.toolsBroken++;
      if (/heartwood at its core/.test(n.text)) out.heartwood++;
    }
    if (s.tick !== tick && s.tick % TICKS_PER_HOUR === 0)
      for (const p of s.people) for (const m of p.recent ?? []) {
        if (m.tick !== s.tick || !m.text.startsWith('Bought a')) continue;
        const id = Object.keys(KIT_BY_ID).find((k) => m.text.toLowerCase().includes(ITEM_BY_ID[k]?.name.toLowerCase()));
        if (id) {
          out.kitBought++;
          out.kitBoughtCoins += Number(/for (\d+) coins/.exec(m.text)?.[1] ?? 0);
        }
      }
    if (s.tick !== tick && s.tick % TICKS_PER_DAY === 0) {
      out.coins.push(Math.round(s.coins ?? 0));
      out.purses.push(Math.round(s.people.reduce((n, p) => n + (p.coins ?? 0), 0)));
      const grown = s.people.filter((p) => !isChild(p) && p.away === null);
      out.toolHands.push(`${grown.filter((p) => p.gear.tool).length}/${grown.length}`);
    }
  }
  out.days = Math.floor(s.tick / TICKS_PER_DAY);
  out.people = s.people.length;
  out.pouchItems = s.people.reduce((n, p) => n + (p.kit?.length ?? 0), 0);
  console.log(JSON.stringify(out));
}
