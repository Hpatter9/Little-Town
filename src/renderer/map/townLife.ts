// The townsfolk being themselves (the owner's ask): the rules behind what the map shows of their small moments, with
// no Pixi here so the tests can check them. Habits by nature in an idle moment (data/natures.ts `habitOfNature`), the
// weaving walk home from the tavern (sim/nightOut.ts `walkingHome`) with a song or a tumble, a stretch on waking and a
// yawn on the way to bed, the windows going dark house by house as each household sleeps, the children's winter
// (snowball fights, a snowman by the door, skating on the ice), and the watch: the guard changing at shift time and a
// lookout on every tower. mapPeople.ts and mapTownLife.ts draw them; none of it changes the town.

import { habitOfNature, type Habit, type NatureId } from '../../shared/data/natures';

/* ------------------------------------------------------------ habits */

/** How long someone stands idle before falling into their habit (ms), and how long a bout lasts in each cycle. */
export const HABIT_AFTER = 2500;
export const HABIT_CYCLE = 16000;
export const HABIT_FOR = 10000;

export interface HabitWho {
  id: number;
  nature: NatureId;
  elder: boolean;
  activity: string;
  child: boolean;
  tireless: boolean;
}
export interface HabitScene {
  hour: number;
  weather: string;
  season: string;
  raid: boolean;
  /** A building's front close by (the curious peer in at its window). */
  nearBuilding: boolean;
}

/** The habit someone is at now, if any: idle (or sat by the fire, for an elder's pipe) and standing still a while, in
 *  the bout of each cycle that falls to them (by their id), and the scene allowing it (no cloud-watching in the rain,
 *  the dark or the snow; nobody at play in a raid). */
export function habitNow(v: HabitWho, stillFor: number, now: number, sc: HabitScene): Habit | null {
  if (sc.raid || v.child || v.tireless || stillFor < HABIT_AFTER) return null;
  const idle = v.activity === 'idle' || (v.elder && v.activity === 'sit');
  if (!idle) return null;
  const h = habitOfNature(v.nature, v.elder);
  if (!h) return null;
  // (the pipe is smoked the whole while; the rest come and go)
  if (h !== 'pipe' && (now + v.id * 2711) % HABIT_CYCLE >= HABIT_FOR) return null;
  if (h === 'cloudgaze' && (sc.hour < 8 || sc.hour >= 18 || sc.season === 'winter' || (sc.weather !== 'clear' && sc.weather !== 'cloudy'))) return null;
  if (h === 'peer' && !sc.nearBuilding) return null;
  return h;
}

/** Where the juggled fruit are (px from the hands, up being negative): three in a cascade. */
export function juggleBalls(now: number, id: number): { x: number; y: number }[] {
  const t = now / 620 + id;
  return [0, 1, 2].map((k) => {
    const p = (t + k / 3) % 1; // 0..1 through one throw, hand to hand
    const left = Math.floor(t + k / 3) % 2 === 0;
    const x = (left ? -1 : 1) * (5 - p * 10);
    return { x, y: -Math.sin(p * Math.PI) * 18 };
  });
}

/** The kicked stone: how far it's rolled (px ahead of the foot) and how high it hops; a kick every couple of
 *  seconds, the foot swung (`kicking`) just as it goes. */
export function kickedStone(now: number, id: number): { x: number; y: number; kicking: boolean } {
  const t = ((now + id * 977) % 2400) / 2400;
  const roll = t < 0.15 ? 0 : (t - 0.15) / 0.85;
  return { x: 4 + Math.sqrt(roll) * 22, y: -Math.abs(Math.sin(roll * Math.PI * 2)) * 4 * (1 - roll), kicking: t < 0.15 };
}

/** A puff of the pipe now and then: how far up its smoke has drifted (0..1) for each puff still showing. */
export function pipePuffs(now: number, id: number): number[] {
  const t = (now + id * 1301) / 1000;
  const out: number[] = [];
  for (let k = 0; k < 3; k++) {
    const p = ((t + k * 1.1) % 3.3) / 3.3;
    if (p < 0.9) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------ the walk home */

/** The weave of a walk home from the tavern: how far aside (px) at this point of the walk, and the lean. */
export function tipsyWeave(id: number, walked: number, now: number): { x: number; lean: number } {
  const a = walked / 22 + id;
  return { x: Math.sin(a) * 7 + Math.sin(a * 2.3) * 2, lean: Math.sin(a + 0.6) * 0.14 + Math.sin(now / 700 + id) * 0.04 };
}
/** The walk home is long; now and then someone sits down hard (a fall), every so often by their own clock (ms). */
export const FALL_EVERY = 13000;
export const FALL_FOR = 1600;
export const fallenNow = (id: number, now: number): boolean => (now + id * 3907) % (FALL_EVERY + (id % 5) * 1700) < FALL_FOR;
/** And now and then they sing (a line of an old song: their slot by the clock). */
export const SING_EVERY = 9000;
export const SING_FOR = 3200;
export const SONGS = [
  '♪ Oh the ale was fine and the night was long ♪',
  '♪ Roll the barrel, roll it home ♪',
  '♪ My love she lives by the mill-race ♪',
  '♪ Fill my cup, fill it up ♪',
  '♪ Hey nonny, hey nonny no ♪',
  '♪ Three jolly woodcutters came over the hill ♪',
  '♪ The moon is out and so am I ♪',
  '♪ We\'ll drink to the harvest ♪',
];
export function songNow(id: number, now: number): string | null {
  const t = now + id * 5501;
  const slot = Math.floor(t / SING_EVERY);
  if (t - slot * SING_EVERY >= SING_FOR || (slot + id) % 3 === 0) return null;
  return SONGS[(slot * 7 + id) % SONGS.length];
}

/* ------------------------------------------------------------ waking and bedtime */

/** A stretch on waking (ms after they're up, in the morning hours). */
export const STRETCH_FOR = 2400;
export const wakingHour = (hour: number) => hour >= 4 && hour < 10;
/** On the way to bed, a yawn every so often (ms). */
export const YAWN_EVERY = 7000;
export const YAWN_FOR = 1500;
export const yawningNow = (id: number, now: number): boolean => (now + id * 2203) % YAWN_EVERY < YAWN_FOR;

/** The homes whose windows have gone dark: every one of its household that's at home is asleep (and an empty house
 *  with nobody home is dark too). Homes are the buildings someone sleeps in; each household goes to bed on its own
 *  clock, so the windows go out one house at a time. */
export function darkHomes(people: { bedId: number | null; activity: string; indoors: boolean; away?: string | null }[]): Set<number> {
  const awake = new Set<number>();
  const homes = new Set<number>();
  for (const p of people) {
    if (p.bedId === null) continue;
    homes.add(p.bedId);
    if (p.away) continue;
    if (!(p.activity === 'sleep' && p.indoors)) awake.add(p.bedId);
  }
  return new Set([...homes].filter((h) => !awake.has(h)));
}

/* ------------------------------------------------------------ the children's winter */

/** How much of a snowman stands (0 gone, 1 whole): all winter; melting away through spring's first day (as the
 *  ground's snow does: map/groundRules.ts `snowCover`). */
export function snowmanLeft(season: string, dayOfSeason: number, hour: number): number {
  if (season === 'winter') return 1;
  if (season === 'spring' && dayOfSeason === 1) return Math.max(0, 1 - hour / 20);
  return 0;
}
/** Which homes have a snowman by the door: those a child sleeps in, and a third of the rest (by the home's id). */
export function snowmanHomes(people: { bedId: number | null; child: boolean }[]): number[] {
  const homes = new Set<number>();
  const kids = new Set<number>();
  for (const p of people) {
    if (p.bedId === null) continue;
    homes.add(p.bedId);
    if (p.child) kids.add(p.bedId);
  }
  return [...homes].filter((h) => kids.has(h) || h % 3 === 0).sort((a, b) => a - b);
}

/** Children at play in the snow pair off for a snowball fight: each with the nearest other child at play within
 *  `SNOWBALL_REACH` px (each child in one pair at most), nearest first. */
export const SNOWBALL_REACH = 150;
export function snowballPairs(kids: { id: number; x: number; y: number }[]): [number, number][] {
  const pairs: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < kids.length; i++)
    for (let j = i + 1; j < kids.length; j++) {
      const d = Math.hypot(kids[i].x - kids[j].x, kids[i].y - kids[j].y);
      if (d <= SNOWBALL_REACH && d > 12) pairs.push({ a: kids[i].id, b: kids[j].id, d });
    }
  pairs.sort((p, q) => p.d - q.d || p.a - q.a);
  const used = new Set<number>();
  const out: [number, number][] = [];
  for (const p of pairs) {
    if (used.has(p.a) || used.has(p.b)) continue;
    used.add(p.a);
    used.add(p.b);
    out.push([p.a, p.b]);
  }
  return out;
}
/** A snowball's flight: thrown every `THROW_EVERY` ms by one side and then the other, `FLIGHT` ms in the air. Who
 *  throws (0: the first of the pair), how far along (0..1), or null between throws. */
export const THROW_EVERY = 1500;
export const FLIGHT = 700;
export function snowballNow(now: number, seed: number): { from: 0 | 1; along: number } | null {
  const t = now + seed * 613;
  const n = Math.floor(t / THROW_EVERY);
  const into = t - n * THROW_EVERY;
  if (into >= FLIGHT) return null;
  return { from: (n % 2) as 0 | 1, along: into / FLIGHT };
}

/** A child skating: a loop round the ice cell's middle (px from it), and which way they're going. */
export function skateLoop(now: number, id: number): { x: number; y: number; dir: 1 | -1 } {
  const a = now / 1400 + id * 1.9;
  // (a figure of eight, wider across than down: the map is seen at a slant)
  const x = Math.sin(a) * 26;
  const y = Math.sin(a * 2) * 9;
  return { x, y, dir: Math.cos(a) >= 0 ? 1 : -1 };
}
/** How far (cells) a child at play looks for ice to skate on. */
export const SKATE_REACH = 4;

/* ------------------------------------------------------------ the watch */

/** The watch changes at six and at eighteen (sim/people.ts `onShift`); for the first `CHANGE_MINUTES` of those hours
 *  the guard coming on and the one going off say so. */
export const CHANGE_MINUTES = 25;
export const changingWatch = (hour: number, minute: number) => (hour === 6 || hour === 18) && minute < CHANGE_MINUTES;
export const WATCH_ON = ['My watch now.', 'I have the watch.', 'Go and get some sleep.'];
export const WATCH_OFF = ['All quiet. Your watch.', 'Nothing stirring. She\'s yours.', 'Keep your eyes open.'];
/** Night, when a guard on watch carries a torch. */
export const torchHours = (hour: number) => hour >= 19 || hour < 6;
/** The towers a lookout stands on. */
export const LOOKOUT_TOWERS = new Set(['lookout', 'watchtower', 'guard_tower']);
