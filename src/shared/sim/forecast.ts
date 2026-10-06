// Looking ahead (DESIGN §10): the sim is deterministic and nothing the player does can change it while the
// game is closed, so running a copy of it forward tells exactly when raids will hit and what else will
// happen. Used to schedule phone alerts on close.

import { runtime } from './watchAsk';
import { RAID_KIND_BY_ID } from '../data/raids';
import { Sim } from './sim';
import type { GameState } from './state';

/** `event`: a choice event, which pauses the town while you're away until you answer it (offline.ts), so it's where
 *  the forecast stops. */
export type ForecastKind = 'raid' | 'death' | 'expedition' | 'choice' | 'event' | 'hero' | 'delve' | 'war';

export interface ForecastEvent {
  kind: ForecastKind;
  /** Game tick it happens (a raid: when the raiders reach town). */
  tick: number;
  title: string;
  text: string;
}

/** A look ahead under way, run in slices (a game day ahead takes seconds on a phone: it's worked out while the game is
 *  open, so the alerts can be sent the moment it goes to the background). */
export interface ForecastJob {
  /** The tick it started from. */
  readonly from: number;
  readonly events: ForecastEvent[];
  /** Run up to `ticks` more. Returns true once it's done. */
  run(ticks: number): boolean;
}

export function startForecast(state: GameState, ticks: number, max = 12): ForecastJob {
  const s: GameState = JSON.parse(JSON.stringify(state));
  const sim = new Sim(s);
  const out: ForecastEvent[] = [];
  const seenRaids = new Set<number>();
  const seenPrompts = new Set(s.prompts.map((p) => p.id));
  const hero = state.hero !== undefined ? state.people.find((p) => p.id === state.hero)?.name : undefined;
  let lastNotice = s.notices.at(-1)?.id ?? 0;
  let left = ticks;
  // (a question already open when you leave pauses the town at once: offline.ts)
  let stopped = !!s.event;
  const done = () => stopped || left <= 0 || out.length >= max || !!s.gameOver || s.paused;
  return {
    from: state.tick,
    events: out,
    run(n) {
      for (let i = 0; i < n && !done(); i++, left--) {
        runtime.quiet = true; // (the look ahead never stops to ask about watching a fight: sim/watchAsk.ts)
        try {
          sim.step();
        } finally {
          runtime.quiet = false;
        }
        if (s.raid && !seenRaids.has(s.raid.id)) {
          seenRaids.add(s.raid.id);
          const kind = RAID_KIND_BY_ID[s.raid.kind];
          out.push({ kind: 'raid', tick: s.raid.arrivesTick, title: `${kind.name} at the gate!`, text: `${s.raid.raiders.length} raiders are reaching your town. It waits for you: open the game to watch the fight.` });
        }
        for (const p of s.prompts) {
          if (seenPrompts.has(p.id)) continue;
          seenPrompts.add(p.id);
          if (p.kind === 'event') {
            // (the town stops here and waits for an answer: nothing past it happens while you're away)
            out.push({ kind: 'event', tick: s.tick, title: p.title, text: `${p.text} The town is paused: open the game to choose.` });
            stopped = true;
          } else if (p.kind !== 'raid') out.push({ kind: 'choice', tick: s.tick, title: p.title, text: `${p.text} (it will choose for you in an hour)` });
        }
        for (const n of s.notices) {
          if (n.id <= lastNotice) continue;
          // (the hero's big moments: anything that makes the journal's milestones with their name in it)
          if (hero && n.text.includes(hero) && s.journal.some((j) => j.id === n.id && j.key)) out.push({ kind: 'hero', tick: n.tick, title: hero, text: n.text });
          else if (/has died|carried off|camp breaks apart/.test(n.text)) out.push({ kind: 'death', tick: n.tick, title: 'Bad news', text: n.text });
          // (a delve's big moments: the boss reached, the dungeon cleared, a unique found, a dungeon woken again)
          else if (/rises to meet them|is cleared!|a unique (weapon|treasure)|one of a kind|has woken/.test(n.text)) out.push({ kind: 'delve', tick: n.tick, title: 'Down the dungeon', text: n.text });
          // (the realm: a war host mustered, war declared, a vassal risen: sim/factions.ts)
          else if (/mustered a war host|declared war|thrown off the town's yoke/.test(n.text)) out.push({ kind: 'war', tick: n.tick, title: 'War', text: n.text });
          else if (/party is back|No one came back/.test(n.text)) out.push({ kind: 'expedition', tick: n.tick, title: 'Expedition', text: n.text });
        }
        lastNotice = s.notices.at(-1)?.id ?? lastNotice;
      }
      if (out.length > max) out.length = max;
      return done();
    },
  };
}

/** Run a copy of the game `ticks` ahead and list what's coming (up to `max` events). */
export function forecast(state: GameState, ticks: number, max = 12): ForecastEvent[] {
  const job = startForecast(state, ticks, max);
  job.run(ticks);
  return job.events;
}
