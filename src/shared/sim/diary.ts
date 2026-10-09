// "Today's diary" (the owner's ask: townsfolk with more inner life). Through the day each townsperson's doings are
// counted a quarter-hour at a time (`diaryTick`: what they're at, `doingOf`, and who was beside them at the same
// thing); the People tab's Background page has the day written up in their own words and their nature's voice
// (`diaryOf`: the facts gathered, `diaryFacts`, then written, `writeDiary`, which is pure): the work, the company,
// what they did of note (`remember`), how they feel and why, their hurts and grief, a raid, a feast, the town's talk,
// the weather. Nothing here changes the town: the count is kept on `Person.diary` and only read back.

import { BUILDING_BY_ID } from '../data/buildings';
import { DOINGS, HARD_WORK, NOT_WORK, VOICES } from '../data/diary';
import { PARTS } from '../data/injuries';
import { ITEM_BY_ID } from '../data/items';
import { natureOf, type NatureId } from '../data/natures';
import { FRIEND, RIVAL } from '../data/social';
import { gossipLine, sayingOf, townGossip, type Gossip } from './gossip';
import { isChild, opinion } from './social';
import { mood } from './townsfolk';
import { tireless, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR, type Season } from './time';
import { weatherAt, type Weather } from './weather';
import { CELL } from './land';

/** The day's doings are counted every so often (ticks): a quarter of an hour. */
export const DIARY_EVERY = TICKS_PER_HOUR / 4;
/** Someone this near (px) at the same thing is "beside me". */
export const DIARY_NEAR = 3 * CELL;

/** What someone is at now, as the diary counts it (a key of data/diary.ts `DOINGS`; a craft is `craft:<station>`). */
export function doingOf(s: GameState, p: Person): string {
  if (p.away !== null) return 'away';
  const t = p.task;
  if (!t) return 'idle';
  switch (t.type) {
    case 'gather':
      return p.activity === 'chop' || p.activity === 'mine' || p.activity === 'forage' || p.activity === 'fish' ? p.activity : 'gather';
    case 'build':
      return 'build';
    case 'repair':
      return 'repair';
    case 'craft': {
      const o = s.crafting.find((q) => q.id === t.order);
      const station = o ? ITEM_BY_ID[o.item]?.station : undefined;
      return station ? `craft:${station}` : 'craft';
    }
    case 'research':
      return 'research';
    case 'farm':
      return p.activity === 'reap' || p.activity === 'till' ? p.activity : 'farm';
    case 'store':
    case 'fetch':
    case 'deliver':
      return 'haul';
    case 'tend':
      return 'tend';
    case 'patrol':
      return 'guard';
    case 'defend':
      return 'fight';
    case 'shelter':
      return 'shelter';
    case 'sleep':
      return 'sleep';
    case 'eat':
      return 'eat';
    case 'relax':
      return 'relax';
    case 'drink':
      return 'drink';
    case 'wander':
    case 'idle':
      return t.pastime === 'carry' ? 'well' : (t.pastime ?? 'idle');
    case 'lesson':
      return 'lesson';
    case 'apprentice':
      return 'apprentice';
    case 'attend':
      return s.gathering?.kind ?? 'feast';
    case 'protest':
      return 'protest';
    case 'pave':
      return 'pave';
    case 'light':
      return 'light';
    case 'extinguish':
      return 'fire';
    case 'toil':
      return 'toil';
    case 'mine':
      return 'mineshaft';
    default:
      return 'idle';
  }
}

const dayOf = (tick: number) => calendar(tick).day;

/** Count a quarter-hour of everyone's day (with the autopilot on, like every system of the town's own life). */
export function diaryTick(s: GameState): void {
  if (s.tick % DIARY_EVERY !== 0 || s.autopilot === false) return;
  const day = dayOf(s.tick);
  const at = s.people.map((p) => [p, doingOf(s, p)] as const);
  for (const [p, doing] of at) {
    if (p.diary?.day !== day) p.diary = { day, hours: {}, with: {} };
    const d = p.diary;
    d.hours[doing] = (d.hours[doing] ?? 0) + 0.25;
    if (NOT_WORK.has(doing) || doing === 'idle' || doing === 'sleep' || doing === 'away') continue;
    for (const [q, theirs] of at) {
      if (q === p || theirs !== doing || q.away !== null || Math.abs(q.x - p.x) > DIARY_NEAR || Math.abs(q.y - p.y) > DIARY_NEAR) continue;
      d.with[q.id] = (d.with[q.id] ?? 0) + 0.25;
    }
  }
}

/** What the diary is written from. */
export interface DiaryFacts {
  id: number;
  name: string;
  nature: NatureId;
  day: number;
  child: boolean;
  /** The day's doings, the most hours first (sleep and meals left out). */
  doing: [string, number][];
  /** Who was beside them at it, the most first (two at most), and what they are to them. */
  with: { name: string; tie: 'partner' | 'friend' | 'rival' | null }[];
  /** What they did of note today (their own `recent` lines). */
  done: string[];
  morale: number;
  /** The strongest thing lifting their spirits, and weighing on them (`mood`'s reasons). */
  up: string | null;
  down: string | null;
  /** The worst wound (in words), and how they are in body. */
  wound: string | null;
  hungry: boolean;
  tired: boolean;
  sick: boolean;
  /** Whom they mourn. */
  grief: string | null;
  partner: string | null;
  /** A raid today: whether they fought, how many they felled, and whether they were struck down. */
  raid: { fought: boolean; felled: number; fell: boolean; outcome: 'victory' | 'driven' | 'pillaged' } | null;
  /** The town's biggest talk of the day. */
  talk: Gossip | null;
  weather: Weather;
  season: Season;
  roughNights: number;
}

/** The facts of someone's day. */
export function diaryFacts(s: GameState, p: Person): DiaryFacts {
  const c = calendar(s.tick);
  const today = c.day;
  const d = p.diary?.day === today ? p.diary : null;
  const doing = d ? (Object.entries(d.hours).filter(([k]) => !NOT_WORK.has(k) && k !== 'sleep') as [string, number][]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)) : [];
  const tie = (q: Person): DiaryFacts['with'][number]['tie'] => {
    if (p.partner === q.id) return 'partner';
    const o = opinion(s, p.id, q.id);
    return o >= FRIEND ? 'friend' : o <= RIVAL ? 'rival' : null;
  };
  const withList = d
    ? Object.entries(d.with)
        .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
        .map(([id]) => s.people.find((q) => q.id === Number(id)))
        .filter((q): q is Person => !!q)
        .slice(0, 2)
        .map((q) => ({ name: q.name, tie: tie(q) }))
    : [];
  const dayStart = s.tick - Math.round((c.hour + c.minute / 60) * TICKS_PER_HOUR);
  const done = (p.recent ?? []).filter((r) => r.tick >= dayStart).map((r) => r.text);
  const m = mood(s, p);
  const ups = m.reasons.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const downs = m.reasons.filter((r) => r.value < 0).sort((a, b) => a.value - b.value);
  const worst = [...(p.wounds ?? [])].sort((a, b) => b.sev - a.sev)[0];
  const recap = s.raidRecap && s.raidRecap.tick >= dayStart ? s.raidRecap : null;
  const row = recap?.rows.find((r) => r.id === p.id);
  const partner = p.partner != null ? s.people.find((q) => q.id === p.partner) : undefined;
  const talk = townGossip(s.journal, s.tick).find((g) => g.who === undefined || !g.who.split(' and ').includes(p.name)) ?? null;
  return {
    id: p.id,
    name: p.name,
    nature: natureOf(p).id,
    day: today,
    child: isChild(p),
    doing,
    with: withList,
    done,
    morale: p.morale,
    up: ups[0]?.text ?? null,
    down: downs[0]?.text ?? null,
    wound: worst && worst.sev >= 0.15 ? `the ${worst.kind} on my ${PARTS[worst.part].name}` : null,
    hungry: !tireless(p) && p.needs.food < 0.25,
    tired: !tireless(p) && p.needs.rest < 0.2,
    sick: !!p.sick,
    grief: p.grief && p.grief.until > s.tick ? p.grief.text.replace(/^(Lost|Misses) /, '') : null,
    partner: partner?.name ?? null,
    raid: recap ? { fought: !!row, felled: row?.kills ?? 0, fell: !!row?.fell, outcome: recap.outcome } : null,
    talk,
    weather: weatherAt(s.seed, s.tick, s.doom?.phase === 'active' ? s.doom.kind : null).kind,
    season: c.season,
    roughNights: p.roughNights ?? 0,
  };
}

const pick = <T>(list: readonly T[], roll: number): T => list[Math.min(list.length - 1, Math.floor(Math.max(0, roll) * list.length))];
/** A small hash of numbers to 0..1, for the page's choices (so it reads the same all day). */
const roll01 = (...n: number[]): number => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ (v | 0), 16777619);
  return ((h >>> 0) % 10007) / 10007;
};

/** The past-tense words a card's lines start with that don't end in -ed. */
const PAST = /^(Took|Bought|Sold|Had|Made|Got|Gave|Saw|Met|Fell|Caught|Won|Lost|Found|Fought|Ate|Drank|Went|Came|Built|Taught|Brought|Couldn't|Didn't|Wasn't|Knew|Kept|Left|Paid|Ran|Sang|Spent|Struck|Wove|Wrote)$/;

/** A line they wrote down in their card's words ("Bought a spear...") as their own ("I bought a spear..."). */
export function firstPerson(line: string): string {
  const t = line.trim().replace(/\.$/, '');
  if (/^(Hired|Asked to|Taken|Sent|Talked into)\b/.test(t)) return `I was ${t[0].toLowerCase()}${t.slice(1)}.`;
  if (/^Was\b/.test(t)) return `I ${t[0].toLowerCase()}${t.slice(1)}.`;
  const first = t.split(' ')[0];
  if (/^[A-Z][a-z]+ed$/.test(first) || PAST.test(first)) return `I ${t[0].toLowerCase()}${t.slice(1)}.`;
  return `${t}.`;
}

/** How long, in words. */
const span = (h: number) => (h >= 7 ? 'the whole day' : h >= 4 ? 'most of the day' : h >= 2 ? 'a few hours' : 'an hour or so');
const doingWords = (k: string): string => {
  if (k.startsWith('craft:')) {
    const b = BUILDING_BY_ID[k.slice(6)];
    return b ? `at the ${b.name.toLowerCase()}` : DOINGS.craft;
  }
  return DOINGS[k] ?? DOINGS.idle;
};
/** The words a told line may begin with that go lower-case mid-sentence (a name keeps its capital). */
const COMMON_START = /^(The|A|An|Our|We|They|Everyone|Someone|Somebody|Nobody|It|There|Some|Old|Poor|Word|News)\b/;
const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const lowerFirst = (s: string) => (s && COMMON_START.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** The day written up in their own words: a few short paragraphs. Pure. */
export function writeDiary(f: DiaryFacts): string[] {
  const v = VOICES[f.nature];
  const r = (salt: number) => roll01(f.id, f.day, salt);
  const out: string[] = [];
  const open = pick(v.open, r(1)).replace('{day}', String(f.day));
  // the weather, then the day's work, and who was beside them
  const weather =
    f.weather === 'rain' ? 'It rained.' : f.weather === 'storm' ? 'A storm raged.' : f.weather === 'snow' ? 'Snow fell.' : f.weather === 'fog' ? 'Fog all day.' : f.season === 'summer' ? 'A warm day.' : f.season === 'winter' ? 'Cold.' : '';
  const work = f.doing.filter(([k]) => k !== 'idle' && k !== 'away');
  let body = `${open}${weather ? ` ${weather}` : ''}`;
  const away = f.doing.find(([k]) => k === 'away')?.[1] ?? 0;
  if (away >= 1) body += ` I was away from town ${away >= 7 ? 'all day' : `for ${span(away)}`}.`;
  if (!work.length) body += away >= 1 ? '' : f.doing.length ? ` I spent the day ${doingWords(f.doing[0][0])}.` : ' The day has hardly begun.';
  else {
    const [k, h] = work[0];
    const tail = pick(HARD_WORK.has(k) ? v.workHard : v.workGood, r(2));
    body += ` I spent ${span(h)} ${doingWords(k)}, ${tail}`;
    if (work[1] && work[1][1] >= 1) body += ` Later I was ${doingWords(work[1][0])}.`;
  }
  if (f.with.length) {
    const names = f.with.map((w) => w.name).join(' and ');
    const w = f.with[0];
    const feel = w.tie === 'partner' ? ' I like having them near.' : w.tie === 'friend' ? ' Good company.' : w.tie === 'rival' ? ` ${w.name}, of all people.` : '';
    body += ` ${names} ${f.with.length > 1 ? 'were' : 'was'} beside me.${feel}`;
  }
  out.push(body);
  // what they did of note, the raid and the town's talk
  const events: string[] = [];
  for (const line of f.done.slice(-2)) events.push(firstPerson(line));
  if (f.raid) {
    if (f.raid.fought) events.push(`Raiders came. I fought${f.raid.felled ? ` and felled ${f.raid.felled}` : ''}${f.raid.fell ? ', and was struck down' : ''}.${f.raid.outcome === 'pillaged' ? ' They took what they came for.' : ' We drove them off.'}`);
    else events.push(`Raiders came today.${f.raid.outcome === 'pillaged' ? ' They took what they came for.' : ' The others drove them off.'}`);
  }
  const gathered = f.doing.find(([k]) => k === 'feast' || k === 'wedding' || k === 'funeral' || k === 'great_funeral' || k === 'rite')?.[0];
  if (gathered === 'feast') events.push('There was a feast, and I ate well.');
  else if (gathered === 'wedding') events.push('There was a wedding, and we danced.');
  else if (gathered === 'funeral' || gathered === 'great_funeral') events.push('We buried our dead today.');
  else if (gathered === 'rite') events.push('We kept the rite together.');
  if (f.talk) {
    const said = r(5) < 0.5 ? sayingOf(f.talk, r(6)) : null;
    events.push(said ? `Everyone's talking about it: ${lowerFirst(said)}` : gossipLine(f.talk, f.nature, r(6)));
  }
  if (events.length) out.push(events.join(' '));
  // how they feel, and why; the body; grief and love
  const feel: string[] = [];
  feel.push(pick(f.morale >= 65 ? v.happy : f.morale >= 35 ? v.fine : v.low, r(7)));
  if (f.up && f.morale >= 35) feel.push(`What lifted me: ${lower(f.up)}.`);
  if (f.down && (f.morale < 65 || r(8) < 0.5)) feel.push(`What weighs on me: ${lower(f.down)}.`);
  if (f.grief) feel.push(`I keep thinking of ${f.grief}.`);
  if (f.wound) feel.push(`${f.wound[0].toUpperCase()}${f.wound.slice(1)} still hurts.`);
  if (f.sick) feel.push('I feel feverish.');
  else if (f.hungry) feel.push('My belly is empty.');
  else if (f.tired) feel.push('I can barely keep my eyes open.');
  if (f.roughNights >= 2) feel.push(`${f.roughNights} nights on the ground now.`);
  if (f.partner && !f.with.some((w) => w.tie === 'partner') && r(9) < 0.6) feel.push(`I thought of ${f.partner}.`);
  out.push(feel.join(' '));
  out.push(pick(v.close, r(10)));
  return out;
}

/** Someone's diary for today, in their own words (the snapshot works it out now and then, not every tick). */
export function diaryOf(s: GameState, p: Person): string[] {
  return writeDiary(diaryFacts(s, p));
}
