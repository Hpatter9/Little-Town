// The phone held upright: the space over the town is a live feed of what the town is up to, since the town runs itself
// and the menus open over the whole screen anyway. At the top, anything that wants attention now (raiders coming or in
// the town, a disaster, a question waiting); then the hero being followed; then the latest happenings, newest first,
// each with a picture (the townsperson or building it's about, borrowed from the town strip, which draws them in the
// town's own style), or a mark for what kind of news it is.

import { BUILDINGS } from '../../shared/data/buildings';
import type { JournalEntryView, Snapshot } from '../../shared/sim/snapshot';
// (the small change of the day, left to the Journal: the feed keeps to what's worth telling)
import { CHATTER } from '../chatter';

type Picture = (p: { person?: number; building?: string }) => HTMLCanvasElement | null;
interface FeedBridge {
  onSnapshot(cb: (s: Snapshot) => void): void;
  getJournal(): Promise<JournalEntryView[]>;
  openPanel(id: string): void;
  command?(c: { type: 'watch'; expedition: number }): void;
}

/** How many happenings the feed lists. */
const SHOWN = 14;

/** Buildings by name, longest first (so "Stone Wall" is found before "Wall"). */
const BUILDING_NAMES = [...BUILDINGS].sort((a, b) => b.name.length - a.name.length).map((b) => ({ id: b.id, name: b.name.toLowerCase() }));

/** A mark for what kind of news it is, when there's no picture. */
function markFor(text: string): string {
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

export function startFeed(feed: HTMLElement, bridge: FeedBridge, strip: HTMLIFrameElement): void {
  const now = document.createElement('div');
  now.className = 'feed-now';
  const hero = document.createElement('div');
  hero.className = 'feed-hero';
  const head = document.createElement('div');
  head.className = 'feed-head';
  head.textContent = 'Lately';
  const list = document.createElement('div');
  list.className = 'feed-list';
  feed.append(now, hero, head, list);
  head.addEventListener('click', () => bridge.openPanel('journal'));

  const picture = (p: { person?: number; building?: string }, w: number, h: number): HTMLElement | null => {
    const fn = (strip.contentWindow as unknown as { __picture?: Picture } | null)?.__picture;
    const src = fn?.(p);
    if (!src) return null;
    // (a townsperson's picture is a whole character frame: just their head and shoulders)
    const [sx, sy, sw, sh] = p.person != null ? [src.width * 0.25, src.height * 0.12, src.width * 0.5, src.height * 0.5] : [0, 0, src.width, src.height];
    const c = document.createElement('canvas');
    const k = Math.min(w / sw, h / sh);
    c.width = Math.round(sw * k);
    c.height = Math.round(sh * k);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  };
  const pic = (p: { person?: number; building?: string } | null, text: string): HTMLElement => {
    const box = document.createElement('div');
    box.className = 'feed-pic';
    const art = p ? picture(p, 40, 40) : null;
    if (art) box.append(art);
    else box.textContent = markFor(text);
    return box;
  };

  let snap: Snapshot | null = null;
  /** Who or what a line is about: the highlight it names, a townsperson named in it, or a building. */
  const about = (e: JournalEntryView): { person?: number; building?: string } | null => {
    const h = e.highlights?.[0];
    if (h && (h.person != null || h.building)) return { person: h.person, building: h.building };
    const text = e.text;
    const people = [...(snap?.people ?? [])].sort((a, b) => b.name.length - a.name.length);
    const who = people.find((p) => new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
    if (who) return { person: who.id };
    const lower = text.toLowerCase();
    const b = BUILDING_NAMES.find((q) => lower.includes(q.name));
    return b ? { building: b.id } : null;
  };

  // anything that wants attention now
  let nowKey = '';
  const drawNow = (s: Snapshot) => {
    const cards: { cls: string; mark: string; title: string; text: string; watch?: number }[] = [];
    if (s.raid) {
      const foes = s.raid.raiders.filter((r) => !r.ally);
      const standing = foes.filter((r) => !r.down && !r.fleeing && !r.gone).length;
      cards.push(
        s.raid.phase === 'warning'
          ? { cls: 'alarm', mark: '⚔', title: `${s.raid.name} coming`, text: `${foes.length} of them, arriving soon. The town is making ready.` }
          : { cls: 'alarm', mark: '⚔', title: `${s.raid.name} in the town!`, text: `${standing} still fighting. Tap a defender to rally them.` },
      );
    }
    if (s.doom) cards.push({ cls: 'doom', mark: '☁', title: s.doom.name, text: s.doom.phase === 'signs' ? `Signs of it: about ${Math.ceil(s.doom.hoursLeft)} hours off.` : s.doom.hoursLeft < 1 ? 'Under way, and nearly over.' : `Under way: ${Math.ceil(s.doom.hoursLeft)} hours to go.` });
    // a delve under way: where they are down there (tap to watch them)
    for (const e of s.expeditions) {
      const d = e.delve;
      if (!d) continue;
      const where = e.phase === 'out' ? 'On the way' : e.phase === 'back' ? (d.cleared ? 'Cleared it! Coming home' : 'Coming home') : d.room ? `Room ${d.room} of ${d.rooms} · ${d.torches} torches` : 'At the door';
      cards.push({ cls: 'delve', mark: '⛏', title: `${e.destName}: ${where}`, text: `${e.battle?.length ? 'Fighting! ' : ''}${(e.phase === 'work' && d.log.at(-1)) || e.members.map((m) => m.name).join(', ')} · tap to watch`, watch: e.id });
    }
    const q = s.prompts[0];
    // (the raid's own question is the raid card already)
    if (q && !(s.raid && q.title.includes(s.raid.name))) cards.push({ cls: 'ask', mark: '?', title: q.title, text: 'A choice waits for you on the town below.' });
    const key = JSON.stringify(cards);
    if (key === nowKey) return;
    nowKey = key;
    now.replaceChildren(
      ...cards.map((c) => {
        const d = document.createElement('div');
        d.className = `feed-card ${c.cls}`;
        const m = document.createElement('div');
        m.className = 'feed-pic';
        m.textContent = c.mark;
        const body = document.createElement('div');
        body.className = 'feed-body';
        const t = document.createElement('div');
        t.className = 'feed-title';
        t.textContent = c.title;
        const x = document.createElement('div');
        x.className = 'feed-text';
        x.textContent = c.text;
        body.append(t, x);
        d.append(m, body);
        if (c.watch != null) d.addEventListener('click', () => bridge.command?.({ type: 'watch', expedition: c.watch! }));
        return d;
      }),
    );
  };

  // the hero being followed
  let heroKey = '';
  const drawHero = (s: Snapshot) => {
    const p = s.hero != null ? s.people.find((q) => q.id === s.hero) : undefined;
    const key = p ? `${p.id}|${p.doing}|${Math.round((p.hp / p.maxHp) * 20)}` : '';
    if (key === heroKey) return;
    heroKey = key;
    if (!p) return hero.replaceChildren();
    const d = document.createElement('div');
    d.className = 'feed-card hero';
    const body = document.createElement('div');
    body.className = 'feed-body';
    const t = document.createElement('div');
    t.className = 'feed-title';
    t.textContent = `Following ${p.name}`;
    const x = document.createElement('div');
    x.className = 'feed-text';
    x.textContent = p.doing;
    const bar = document.createElement('div');
    bar.className = 'feed-hp';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    bar.append(fill);
    body.append(t, x, bar);
    d.append(pic({ person: p.id }, ''), body);
    hero.replaceChildren(d);
  };

  // the latest happenings (fetched again whenever the journal grows, at most every couple of seconds)
  let head0 = -1;
  let fetching = false;
  let lastFetch = 0;
  const drawList = (entries: JournalEntryView[]) => {
    const told = entries.filter((e) => e.key || !CHATTER.test(e.text));
    const shown = told.slice(-SHOWN).reverse();
    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'feed-empty';
      empty.textContent = 'The town runs itself. Tap people and buildings to see them, drag to look along the town, and pinch to zoom.';
      return list.replaceChildren(empty);
    }
    list.replaceChildren(
      ...shown.map((e) => {
        const row = document.createElement('div');
        row.className = e.key ? 'feed-row key' : 'feed-row';
        const body = document.createElement('div');
        body.className = 'feed-body';
        const t = document.createElement('div');
        t.className = 'feed-text';
        t.textContent = e.text;
        const w = document.createElement('div');
        w.className = 'feed-when';
        w.textContent = e.when.replace(/ · \w+ · /, ' · ');
        body.append(t, w);
        row.append(pic(about(e), e.text), body);
        return row;
      }),
    );
  };
  const refresh = () => {
    if (fetching) return;
    fetching = true;
    lastFetch = performance.now();
    void bridge
      .getJournal()
      .then(drawList)
      .finally(() => (fetching = false));
  };

  bridge.onSnapshot((s) => {
    snap = s;
    if (!feed.getClientRects().length) return; // (not shown: a phone on its side, or a menu open)
    drawNow(s);
    drawHero(s);
    if (s.journalHead !== head0 && performance.now() - lastFetch > 1500) {
      head0 = s.journalHead;
      refresh();
    }
  });
  // (pictures come from the town strip: once it has loaded, draw the list again with them)
  strip.addEventListener('load', () => setTimeout(() => ((head0 = -1), (heroKey = '')), 1500));
}
