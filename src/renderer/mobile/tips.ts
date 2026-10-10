// The first hour (the owner's ask: a light guided start). The town runs itself, but a new player doesn't know what
// there is to watch or which few things are theirs to decide. Each tip waits for the first time the town meets its
// thing (a stranger at the gate, the first raid, a party setting out, a power's envoy...) and comes once, as a gold
// notice in the news bubble with a button to the menu and tab where it lives. Nothing to do: every tip only explains.
// Tips met are kept (`littletown.tipsMet`); at most `TIPS_AT_ONCE` show at a time, the earliest met first; the ☰ menu
// turns them off (`littletown.tips`). The pure part (`TIPS`, `tipsDue`) has no DOM, so the tests read it.

import type { Snapshot } from '../../shared/sim/snapshot';

export interface Tip {
  id: string;
  /** Met the first time this is true. */
  when: (s: Snapshot) => boolean;
  title: string;
  text: string;
  /** The menu and the tab it lives in. */
  panel?: string;
  tab?: string;
  label?: string;
}


export const TIPS: readonly Tip[] = [
  { id: 'welcome', when: () => true, title: 'Your town runs itself', text: 'Like an ant farm: the townsfolk gather, build, study and trade on their own. Watch them, tap anyone or anything on the map to see what it is, and pinch to zoom. The news gathers here in this bubble.' },
  { id: 'direction', when: (s) => s.calendar.day >= 1 && s.calendar.hour >= 10, title: 'The one lever: the town\'s direction', text: 'Growth, Defence, Trade or Knowledge. It steers what the town builds and studies first. Everything else it decides for itself.', panel: 'build', tab: 'Overview', label: 'Direction' },
  { id: 'question', when: (s) => s.prompts.some((p) => p.kind === 'event'), title: 'Choices', text: 'Now and then something happens that the town can\'t decide alone. Answer it, or leave it: when the time runs out, the town takes the choice marked as its own.' },
  { id: 'visitor', when: (s) => !!s.visitor, title: 'A stranger at the gate', text: 'Newcomers only join with your leave. Take them in or send them on (on their card, or in the People menu). Left too long, the town decides by its food.', panel: 'townsfolk', tab: 'People', label: 'People' },
  { id: 'raid', when: (s) => !!s.raid, title: 'A raid!', text: 'The town fights it out on its own. You can watch, take the battle off Auto to place fighters yourself, or skip straight to the recap. Deaths are real.' },
  { id: 'recap', when: (s) => !!s.raidRecap && !s.raid, title: 'After a raid', text: 'The recap tells how it went: who fought hardest, who fell, what was taken. A wall all round the town keeps the night\'s prowlers out.' },
  { id: 'trip', when: (s) => s.expeditions.length > 0, title: 'A party has set out', text: 'Adventurers lead parties out on their own. You can watch any of them, forbid a place, or post a bounty to steer them, in the Trips menu.', panel: 'expeditions', tab: 'Parties', label: 'Trips' },
  { id: 'place', when: (s) => s.places.some((p) => !!p.dest), title: 'Something found on the land', text: 'Lairs, caves and ruins turn up as the town spreads. A party may go after them; post a bounty to make it likelier, or raise a party yourself.', panel: 'expeditions', tab: 'Places', label: 'Places' },
  { id: 'realm', when: (s) => s.realm.factions.some((f) => f.known), title: 'Other powers', text: 'The land has other powers: some want trade, some want war. Their envoys come to the gate; the Realm tab lets you send gifts, make treaties, or go to war.', panel: 'expeditions', tab: 'Realm', label: 'The Realm' },
  { id: 'rising', when: (s) => s.realm.factions.some((f) => f.known && !!f.rising), title: 'A rising power', text: 'Some powers grow as the town does: the bigger the town, the bigger their hosts. Watch them on the Realm tab, and keep the town ready.', panel: 'expeditions', tab: 'Realm', label: 'The Realm' },
  { id: 'evolve', when: (s) => s.prompts.some((p) => p.kind === 'evolve') || s.people.some((p) => p.freePts > 0), title: 'Callings and levels', text: 'As townsfolk level up their callings branch: you may choose their road, or let them. Their stat points are spent their own way unless you ask to choose (Town menu).', panel: 'townsfolk', tab: 'People', label: 'People' },
  { id: 'quest', when: (s) => (s.quests ?? []).length > 0, title: 'The quest board', text: 'Strangers in the tavern offer quests. Accept one and its clock starts; a party goes out for it on its own, or raise one yourself.', panel: 'expeditions', tab: 'Quest board', label: 'Quest board' },
  { id: 'shop', when: (s) => !!s.shop, title: 'The shop', text: 'The town sells what it can spare to travellers and buys what it lacks. Tap the shop to step inside and watch the keeper at work.', panel: 'trade', tab: 'Shops', label: 'Market' },
  { id: 'caravan', when: (s) => !!s.caravan, title: 'A caravan', text: 'Caravans bring goods and horses. The town trades with them on its own after a while; take a deal yourself first if you like.', panel: 'trade', tab: 'Caravan', label: 'Caravan' },
  { id: 'death', when: (s) => s.annals.fallen.length > 0, title: 'The fallen', text: 'Raids, hunger, sickness and old age take people. Every one is remembered in the Chronicle\'s hall of heroes.', panel: 'journal', label: 'Chronicle' },
  { id: 'age', when: (s) => s.era !== 'neolithic', title: 'A new age', text: 'New studies, buildings, weapons and dangers. The tech tree shows what comes next.', panel: 'research', tab: 'Tech tree', label: 'Tech tree' },
  { id: 'treasury', when: (s) => (s.coins ?? 0) >= 60 && s.people.length >= 4, title: 'The treasury', text: 'The townsfolk earn their own coins; the treasury is the town\'s, from tax and trade. The tax rate and the guards it pays are in the Town menu.', panel: 'build', tab: 'Treasury', label: 'Treasury' },
];

/** At most this many tips show at once. */
export const TIPS_AT_ONCE = 2;

/** The tips met so far (in order), given those already met: every tip whose moment has come is added. */
export function meet(s: Snapshot, met: readonly string[]): string[] {
  const out = [...met];
  for (const t of TIPS) if (!out.includes(t.id) && t.when(s)) out.push(t.id);
  return out;
}

/** The tips to show now: met, not yet read, the earliest first, at most `TIPS_AT_ONCE`. */
export function tipsDue(met: readonly string[], read: (key: string) => boolean): Tip[] {
  return met
    .map((id) => TIPS.find((t) => t.id === id))
    .filter((t): t is Tip => !!t && !read(`tip:${t.id}`))
    .slice(0, TIPS_AT_ONCE);
}

const MET_KEY = 'littletown.tipsMet';
const ON_KEY = 'littletown.tips';
export function tipsOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) !== '0';
  } catch {
    return true;
  }
}
export function setTipsOn(on: boolean): void {
  try {
    localStorage.setItem(ON_KEY, on ? '1' : '0');
  } catch {
    /* (no storage) */
  }
}
export function loadMet(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MET_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function saveMet(met: string[]): void {
  try {
    localStorage.setItem(MET_KEY, JSON.stringify(met));
  } catch {
    /* (no storage) */
  }
}
