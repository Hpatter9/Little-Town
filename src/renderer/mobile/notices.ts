// Notifications on the phone (the owner's ask: no feed over the town; a bubble at the right while there's news not yet
// looked at, which opens a page to review it and act, the news told apart by colour as RimWorld's letters are).
//
// Three tones: **red** for threats and losses (a raid, a war host, a doom, deaths, fire, a town pillaged), **gold**
// for what wants the player (a question waiting, a stranger at the gate, a caravan, a quest, a place found on the land,
// what came of an answer), **blue** for the rest of the news (built, learned, a party home, a delve under way).
// Two sources: the standing situations of the snapshot (`situationNotices`) and the Journal's lines
// (`journalNotices`; the day's small change, `CHATTER`, is left to the Chronicle). Each has a key; the keys looked at
// are kept (`littletown.noticesRead`), and the bubble counts the rest, in the worst tone among them.
// The pure part (above `startNotices`) has no DOM, so the tests read it.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { CHATTER } from '../chatter';
import type { JournalEntryView, Snapshot } from '../../shared/sim/snapshot';

export type Tone = 'red' | 'gold' | 'blue';
const RANK: Record<Tone, number> = { red: 3, gold: 2, blue: 1 };
/** The worst of some tones (none: null). */
export const worst = (tones: Tone[]): Tone | null => tones.reduce<Tone | null>((w, t) => (!w || RANK[t] > RANK[w] ? t : w), null);

export interface NoticeAction {
  label: string;
  kind: 'watch' | 'panel' | 'recap' | 'map' | 'question';
  watch?: number;
  panel?: string;
  target?: { person?: number; building?: string };
}
export interface Notice {
  key: string;
  tone: Tone;
  mark: string;
  title: string;
  text: string;
  /** "Day 3 · 14:05" for a Journal line; a standing situation has none. */
  when?: string;
  /** Who or what it is about (a picture, and a way to it on the map). */
  about?: { person?: number; building?: string };
  action?: NoticeAction;
}

/** The tone of a Journal line, by what it tells. */
export function toneOf(text: string, key: boolean): Tone {
  const t = text.toLowerCase();
  if (/died|killed|slain|carried off|breaks apart|starv|bled out|lost at sea|drown|burned down|burnt down|pillaged|taken from us|is dead|has fallen|fell to|wiped out|falls? ill|plague|the black fever/.test(t)) return 'red';
  if (/raid|raiders|war host|coming from the|at the gate|in the town!|wildfire|flood|earthquake|tornado|dragon|the behemoth|siege/.test(t)) return 'red';
  if (/asks to join|at the gate|wants to settle|a caravan|caravan has come|offers a quest|a quest|found .* to the|bounty|envoy|demands|a stranger|wishes to|would like/.test(t)) return 'gold';
  void key; // (a milestone that is good news, built or learned, is blue like the rest: gold is for what wants the player)
  return 'blue';
}

/** A mark for a line with no picture (the feed's old marks). */
export function markFor(text: string): string {
  const t = text.toLowerCase();
  if (/died|killed|slain|carried off|breaks apart/.test(t)) return '☠';
  if (/raid|raider|attack|army|the dead are|horde/.test(t)) return '⚔';
  if (/research complete|learned|new age|era/.test(t)) return '✦';
  if (/born|couple|married|wedding|joined/.test(t)) return '♥';
  if (/blight|storm|freeze|plague|sick|drought|flood|fire/.test(t)) return '☁';
  if (/coins|sold|bought|traveller|tavern|shop|guest/.test(t)) return '●';
  if (/built|finished|upgrad|extended|set out/.test(t)) return '⌂';
  return '•';
}

/** What is going on now that wants attention: a raid, a host, a doom, parties out, places found, the last recap, the
 *  last answer's outcome, a question waiting. Each keyed so it counts as new once. */
export function situationNotices(s: Snapshot): Notice[] {
  const out: Notice[] = [];
  if (s.raid) {
    const foes = s.raid.raiders.filter((r) => !r.ally);
    const standing = foes.filter((r) => !r.down && !r.fleeing && !r.gone).length;
    out.push(
      s.raid.phase === 'warning'
        ? { key: `raid:${s.raid.name}:w`, tone: 'red', mark: '⚔', title: `${s.raid.name} coming`, text: `${foes.length} of them, arriving soon. The town is making ready.` }
        : { key: `raid:${s.raid.name}:a`, tone: 'red', mark: '⚔', title: `${s.raid.name} in the town!`, text: `${standing} still fighting. Tap a defender on the map to rally them.` },
    );
  }
  for (const f of s.realm.factions)
    if (f.host)
      out.push({ key: `host:${f.name}`, tone: 'red', mark: '⚔', title: `${f.name}'s war host`, text: `${f.host.size} strong, ${f.lord} at its head: here in ${f.host.hours} hour${f.host.hours === 1 ? '' : 's'}. Make ready, sue for peace, or call on allies.`, action: { label: 'The Realm', kind: 'panel', panel: 'expeditions' } });
  if (s.doom) out.push({ key: `doom:${s.doom.name}`, tone: 'red', mark: '☁', title: s.doom.name, text: s.doom.phase === 'signs' ? `Signs of it: about ${Math.ceil(s.doom.hoursLeft)} hours off.` : s.doom.hoursLeft < 1 ? 'Under way, and nearly over.' : `Under way: ${Math.ceil(s.doom.hoursLeft)} hours to go.` });
  for (const e of s.expeditions) {
    if (e.assault) {
      const where = e.phase === 'out' ? 'Marching' : e.phase === 'back' ? 'Coming home' : e.assault.wave ? `Wave ${e.assault.wave} of ${e.assault.total}` : 'At the walls';
      out.push({ key: `trip:${e.id}`, tone: 'blue', mark: '⚔', title: `${e.destName}: ${where}`, text: `${e.members.length} of the town`, action: { label: 'Watch', kind: 'watch', watch: e.id } });
    } else if (e.delve) {
      const d = e.delve;
      const where = e.phase === 'out' ? 'On the way' : e.phase === 'back' ? (d.cleared ? 'Cleared it! Coming home' : 'Coming home') : d.room ? `Room ${d.room} of ${d.rooms} · ${d.torches} torches` : 'At the door';
      out.push({ key: `trip:${e.id}`, tone: 'blue', mark: '⛏', title: `${e.destName}: ${where}`, text: `${e.battle?.length ? 'Fighting! ' : ''}${(e.phase === 'work' && d.log.at(-1)) || e.members.map((m) => m.name).join(', ')}`, action: { label: 'Watch', kind: 'watch', watch: e.id } });
    } else if (e.hunt) {
      const where = e.phase === 'out' ? 'Running out into the hills' : e.phase === 'back' ? 'Coming home with the kill' : 'Hunting';
      out.push({ key: `trip:${e.id}`, tone: 'blue', mark: '☾', title: `The full-moon hunt: ${where}`, text: `${e.battle?.length ? 'Fighting! ' : ''}${e.members.map((m) => m.name).join(', ')}`, action: { label: 'Watch', kind: 'watch', watch: e.id } });
    }
  }
  // (the fights waiting on the land, alike ones as one: "Beast's Lair found ×2")
  const waiting = new Map<string, { name: string; foes: string; n: number; ids: number[] }>();
  for (const p of s.places)
    if (p.dest) {
      const k = `${p.name}|${p.foes ?? ''}`;
      const w = waiting.get(k);
      if (w) {
        w.n++;
        w.ids.push(p.id);
      } else waiting.set(k, { name: p.name, foes: p.foes ?? 'Something', n: 1, ids: [p.id] });
    }
  for (const w of waiting.values()) out.push({ key: `place:${w.ids.join(',')}`, tone: 'gold', mark: '⚑', title: `${w.name} found${w.n > 1 ? ` ×${w.n}` : ''}`, text: `${w.foes} there. A party may go after it; post a bounty or raise a party.`, action: { label: 'Trips', kind: 'panel', panel: 'expeditions' } });
  const rr = s.raidRecap;
  if (rr && !s.raid) {
    const word = rr.outcome === 'victory' ? 'Victory' : rr.outcome === 'driven' ? 'Driven off' : 'Pillaged';
    out.push({ key: `recap:${rr.tick}`, tone: rr.outcome === 'pillaged' ? 'red' : 'blue', mark: '⚔', title: `${rr.name}: ${word}`, text: rr.story?.slice(1).find((l) => !/^The towers/.test(l)) ?? `${rr.killed} of ${rr.came} felled`, action: { label: 'The report', kind: 'recap' } });
  }
  const o = s.eventOutcome;
  if (o) out.push({ key: `outcome:${o.tick}`, tone: 'gold', mark: '✓', title: o.choice ? `${o.title}: ${o.choice}` : o.title, text: o.text.charAt(0).toUpperCase() + o.text.slice(1) + '.' });
  const q = s.prompts[0];
  if (q && !(s.raid && q.title.includes(s.raid.name))) out.push({ key: `ask:${q.id}`, tone: 'gold', mark: q.kind === 'evolve' ? '★' : '?', title: q.title, text: q.kind === 'evolve' ? `${q.text}: choose their road, or let them.` : 'A choice waits for you.', action: { label: 'Answer', kind: 'question' } });
  // (stat points waiting to be spent: the People menu's Character tab)
  const pts = s.people.filter((p) => p.freePts > 0);
  if (pts.length && s.statsAsk) out.push({ key: `pts:${pts.map((p) => `${p.id}:${p.freePts}`).join(',')}`, tone: 'gold', mark: '+', title: pts.length === 1 ? `${pts[0].name} has ${pts[0].freePts} stat ${pts[0].freePts === 1 ? 'point' : 'points'} to spend` : `${pts.length} townsfolk have stat points to spend`, text: 'Strength, Dexterity, Vitality, Intellect, Wisdom or Charisma: on their Character tab. Left two days, they spend them their own way.', action: { label: 'People', kind: 'panel', panel: 'townsfolk' } });
  return out;
}

/** The Journal's latest lines as notices (the newest first), the day's small change left out. */
export function journalNotices(entries: JournalEntryView[], snap: Snapshot | null, most = 40): Notice[] {
  const told = entries.filter((e) => !CHATTER.test(e.text)).slice(-most).reverse();
  return told.map((e) => {
    const about = aboutOf(e, snap);
    const onMap = !!about && (about.person != null ? !!snap?.people.some((p) => p.id === about.person) : !!snap?.buildings.some((b) => b.def === about.building));
    return {
      key: `j:${e.id}`,
      tone: toneOf(e.text, e.key),
      mark: markFor(e.text),
      title: e.text,
      text: '',
      when: e.when.replace(/ · \w+ · /, ' · '),
      about: about ?? undefined,
      ...(onMap ? { action: { label: about!.person != null ? 'Show them' : 'Show it', kind: 'map' as const, target: about! } } : {}),
    };
  });
}

/** Who or what a line is about: the highlight it names, a townsperson named in it, or a building. */
export function aboutOf(e: JournalEntryView, snap: Snapshot | null): { person?: number; building?: string } | null {
  const h = e.highlights?.[0];
  if (h && (h.person != null || h.building)) return { person: h.person, building: h.building };
  const text = e.text;
  const people = [...(snap?.people ?? [])].sort((a, b) => b.name.length - a.name.length);
  const who = people.find((p) => new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
  if (who) return { person: who.id };
  const lower = text.toLowerCase();
  const b = BUILDING_NAMES.find((q) => lower.includes(q.name));
  return b ? { building: b.id } : null;
}
const BUILDING_NAMES = Object.values(BUILDING_BY_ID)
  .map((d) => ({ id: d.id, name: d.name.toLowerCase() }))
  .sort((a, b) => b.name.length - a.name.length);

/* ------------------------------------------------------------------------------------------------ the page */

const READ_KEY = 'littletown.noticesRead';
const READ_MOST = 400;

interface NoticeBridge {
  openPanel(id: string): void;
  command?: (c: { type: 'watch'; expedition: number }) => void;
  getJournal(): Promise<JournalEntryView[]>;
  onSnapshot(fn: (s: Snapshot) => void): void;
}
type Picture = (p: { person?: number; building?: string }) => HTMLCanvasElement | null;

/** The bubble and the review page. `bubble` and `sheet` go on the page; the strip is asked for pictures and to show
 *  things on the map. */
export function startNotices(bridge: NoticeBridge, strip: HTMLIFrameElement): { bubble: HTMLElement; sheet: HTMLElement } {
  const read = new Set<string>();
  try {
    for (const k of JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) read.add(k);
  } catch {
    /* (no storage) */
  }
  const keep = () => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...read].slice(-READ_MOST)));
    } catch {
      /* (no storage) */
    }
  };

  const bubble = document.createElement('button');
  bubble.id = 'notice-bubble';
  bubble.hidden = true;
  bubble.title = 'News: tap to review';
  const count = document.createElement('span');
  count.className = 'notice-count';
  bubble.append(count);
  const sheet = document.createElement('div');
  sheet.id = 'notice-sheet';
  sheet.hidden = true;
  const head = document.createElement('div');
  head.className = 'notice-head';
  const title = document.createElement('span');
  title.className = 'notice-title';
  title.textContent = 'News';
  const close = document.createElement('button');
  close.className = 'notice-close';
  close.textContent = '✕';
  close.title = 'Close';
  head.append(title, close);
  const list = document.createElement('div');
  list.className = 'notice-list';
  const foot = document.createElement('div');
  foot.className = 'notice-foot';
  const chronicle = document.createElement('button');
  chronicle.className = 'notice-btn';
  chronicle.textContent = 'The Chronicle';
  chronicle.addEventListener('click', () => {
    hide();
    bridge.openPanel('journal');
  });
  foot.append(chronicle);
  sheet.append(head, list, foot);

  let snap: Snapshot | null = null;
  let entries: JournalEntryView[] = [];
  let shown: Notice[] = [];
  let listKey = '';

  const picture = (p: { person?: number; building?: string }, w: number, h: number): HTMLElement | null => {
    const fn = (strip.contentWindow as unknown as { __picture?: Picture } | null)?.__picture;
    const src = fn?.(p);
    if (!src) return null;
    const [sx, sy, sw, sh] = p.person != null ? [src.width * 0.25, src.height * 0.12, src.width * 0.5, src.height * 0.5] : [0, 0, src.width, src.height];
    const c = document.createElement('canvas');
    const k = Math.min(w / sw, h / sh);
    c.width = Math.round(sw * k);
    c.height = Math.round(sh * k);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const copy = () => {
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    };
    copy();
    if (p.person != null) for (const ms of [400, 1200, 3000]) setTimeout(copy, ms);
    return c;
  };

  const act = (a: NoticeAction) => {
    const w = strip.contentWindow as (Window & { __showOnMap?: (x: { person?: number; building?: number }) => boolean; __showRecap?: () => boolean }) | null;
    hide();
    switch (a.kind) {
      case 'watch':
        bridge.command?.({ type: 'watch', expedition: a.watch! });
        break;
      case 'panel':
        bridge.openPanel(a.panel!);
        break;
      case 'recap':
        w?.__showRecap?.();
        break;
      case 'map': {
        const t = a.target!;
        const b = t.building ? (snap?.buildings.find((q) => q.def === t.building && q.status === 'done') ?? snap?.buildings.find((q) => q.def === t.building)) : undefined;
        w?.__showOnMap?.(t.person != null ? { person: t.person } : b ? { building: b.id } : {});
        break;
      }
      case 'question':
        break; // (the question's card is on the town)
    }
  };

  const all = (): Notice[] => (snap ? [...situationNotices(snap), ...journalNotices(entries, snap)] : []);
  const unread = (ns: Notice[]) => ns.filter((n) => !read.has(n.key));

  const drawBubble = () => {
    const u = unread(all());
    const tone = worst(u.map((n) => n.tone));
    bubble.hidden = !u.length || !sheet.hidden;
    if (!u.length) return;
    count.textContent = String(u.length);
    bubble.className = `tone-${tone}`;
  };
  const drawList = () => {
    shown = all();
    const key = shown.map((n) => `${n.key}|${n.title}|${n.text}|${read.has(n.key)}`).join('\n');
    if (key === listKey) return;
    listKey = key;
    list.replaceChildren(
      ...(shown.length
        ? shown.map((n) => {
            const row = document.createElement('div');
            row.className = `notice-row tone-${n.tone}${read.has(n.key) ? '' : ' new'}`;
            const pic = document.createElement('div');
            pic.className = 'notice-pic';
            const art = n.about ? picture(n.about, 40, 40) : null;
            if (art) pic.append(art);
            else pic.textContent = n.mark;
            const body = document.createElement('div');
            body.className = 'notice-body';
            const t = document.createElement('div');
            t.className = 'notice-text';
            t.textContent = n.title;
            body.append(t);
            if (n.text) {
              const x = document.createElement('div');
              x.className = 'notice-more';
              x.textContent = n.text;
              body.append(x);
            }
            if (n.when) {
              const w = document.createElement('div');
              w.className = 'notice-when';
              w.textContent = n.when;
              body.append(w);
            }
            row.append(pic, body);
            if (n.action) {
              const b = document.createElement('button');
              b.className = 'notice-act';
              b.textContent = n.action.label;
              b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                act(n.action!);
              });
              row.append(b);
              row.addEventListener('click', () => act(n.action!));
            }
            return row;
          })
        : [Object.assign(document.createElement('div'), { className: 'notice-empty', textContent: 'Nothing new. The town runs itself.' })]),
    );
  };

  const show = () => {
    drawList();
    sheet.hidden = false;
    sheet.scrollTop = 0;
    document.body.classList.add('notices-open');
    bubble.hidden = true;
  };
  const hide = () => {
    // (everything shown has been looked at)
    for (const n of shown) read.add(n.key);
    keep();
    sheet.hidden = true;
    document.body.classList.remove('notices-open');
    drawBubble();
  };
  bubble.addEventListener('click', show);
  close.addEventListener('click', hide);

  let head0 = -1;
  let fetching = false;
  let lastFetch = 0;
  const refresh = () => {
    if (fetching) return;
    fetching = true;
    lastFetch = performance.now();
    void bridge
      .getJournal()
      .then((j) => {
        entries = j;
        drawBubble();
        if (!sheet.hidden) drawList();
      })
      .finally(() => (fetching = false));
  };
  bridge.onSnapshot((s) => {
    snap = s;
    if (s.journalHead !== head0 && performance.now() - lastFetch > 1500) {
      head0 = s.journalHead;
      refresh();
    }
    drawBubble();
    if (!sheet.hidden) drawList();
  });
  return { bubble, sheet };
}
