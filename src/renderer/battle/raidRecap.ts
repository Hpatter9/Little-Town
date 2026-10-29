// The recap after a raid (the owner's ask: a fight recap for the tower-defence raids): a blue window over the town, as
// the parties' victory screen is, with how it went (the raiders felled, fled and through, the waves), each defender's
// raiders felled, harm dealt and taken, experience and levels, the best of them starred, the fallen, the towers' share,
// and what was won and lost. It is the raid's one summary card (sim/summaries.ts): the highlights, the toll, the loot, the
// firsts and the founder's chapter show first, and the full tally is a tap away ("Full recap"). It shows itself once
// when a raid ends (the last one seen is kept, `SEEN_KEY`), and `window.__showRecap` brings it back while it's fresh
// (the feed's card).

import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import type { Snapshot } from '../../shared/sim/snapshot';
import { holdWhileUp } from '../mobile/popupHold';
import { guildMarkOrFallen } from '../art/guildMarks';
import { RAID_KINDS } from '../../shared/data/raids';
import { paintPortrait } from '../art/folkPortrait';
import { hkDraw, hkLayers, hkWhoOf } from '../art/hkFolk';
import { playScene } from '../panel/scenePlayer';
import { raiderSprites, recapScript, type RecapPanel } from '../panel/sceneScripts';
import { addCardStyles } from '../panel/cardsStyles';
import { icon } from '../ui/icon';

const SEEN_KEY = 'littletown.recapSeen';

const TITLES = { victory: 'Victory!', driven: 'Driven off', pillaged: 'Pillaged' } as const;

const stockLine = (st: Stock) =>
  Object.entries(st)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m as Material] ?? m}`)
    .join(', ');

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

type Recap = NonNullable<Snapshot['raidRecap']>;

/** A small face for a chip: their isometric look as the map draws it (art/folkPortrait.ts); until it loads, the Himeko doll
 *  (blank until its layers load; the strip is drawn once, so a later redraw fills it). */
function miniFace(p: Snapshot['people'][number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  paintPortrait(c, p, {
    mode: 'face',
    stand: (g) => {
      g.imageSmoothingEnabled = false;
      hkDraw(g, hkLayers(hkWhoOf(p), { fighting: false, activity: 'idle' }), 0, 0, 20, 84, 92);
    },
  });
  return c;
}

/** The raid told in four panels: the warning, the clash, the turning point and the aftermath. The turning point is read
 *  from the recap: the boss falling, the best defender's tally, the town's mercy, or the breach. */
function strip(c: Recap, snap: Snapshot | null): HTMLElement {
  addCardStyles();
  const kind = RAID_KINDS.find((k) => k.name === c.name);
  const sprites = raiderSprites(kind?.id ?? '');
  const best = c.rows.find((r) => r.id === c.best);
  const fought = c.rows.filter((r) => !r.died);
  const order = [...(best ? [best] : []), ...fought.filter((r) => r.id !== c.best)];
  const people = snap?.people ?? [];
  const cast = order.map((r) => people.find((p) => p.id === r.id)).filter((p): p is Snapshot['people'][number] => !!p);
  const filler = people.filter((p) => !cast.includes(p) && p.indoors === false && p.away === null && !p.growsUpIn).slice(0, 3);
  const four = [...cast, ...filler].slice(0, 4);
  const dolls = four.map((p) => hkLayers(hkWhoOf(p), { fighting: true, activity: 'idle' }));
  const night = !!snap && snap.calendar.daylight < 0.3;
  const turn = c.boss && c.outcome === 'victory'
    ? `${c.boss} falls!`
    : c.outcome === 'pillaged'
      ? (c.through ? `They broke through: ${c.through} got past the defences.` : 'They broke through and pillaged the town.')
      : c.beast && c.beastBest && c.beast.kills > 0
        ? `${c.beast.name} felled ${c.beast.kills}, and the line held.`
      : best && best.kills > 0
        ? `${best.name} felled ${best.kills}, and the line held.`
        : c.towers && c.towers.kills > 0
          ? `The towers and traps took ${c.towers.kills}.`
          : c.mercy === 'turned'
            ? 'They saw the town and turned back.'
            : `${c.killed} of ${c.came} were felled.`;
  const lost = c.rows.filter((r) => r.died).length;
  const after = c.outcome === 'pillaged' ? 'The town was pillaged.' : lost ? `${lost} did not come home.` : stockLine(c.stolen) ? 'Driven off, with something taken.' : c.outcome === 'victory' ? 'Nobody was lost. The town stands.' : 'They fled, and took nothing.';
  const panels: [RecapPanel, string][] = [
    ['warning', c.watched ? `Spotted by the watch ${c.watched}: ${c.name}, ${c.came} strong.` : `${c.name} came: ${c.came} strong${c.waves > 1 ? `, in ${c.waves} waves` : ''}.`],
    ['clash', fought.length ? `${fought.length} stood against them.` : 'Nobody stood against them.'],
    ['turn', turn],
    ['after', after],
  ];
  const box = el('div', 'rs-strip');
  for (const [which, cap] of panels) {
    const panel = el('div', 'rs-panel');
    playScene(panel, recapScript(which, sprites, c.outcome, night, !!c.boss), dolls, {}, four); // (in their isometric looks)
    panel.append(el('div', 'rs-cap', cap));
    box.append(panel);
  }
  const wrap = el('div', '');
  wrap.append(box);
  // who fell and who shone
  const chips = el('div', 'rs-chips');
  for (const r of c.rows.filter((q) => q.died || q.fell)) {
    const chip = el('span', 'rs-chip fell');
    const p = people.find((q) => q.id === r.id);
    if (p && !r.died) chip.append(miniFace(p));
    chip.append(`${r.died ? '✝ ' : ''}${r.name} ${r.died ? 'slain' : 'fell'}`);
    chips.append(chip);
  }
  for (const r of c.rows.filter((q) => !q.died && (q.id === c.best || q.levelTo > q.levelFrom))) {
    const chip = el('span', 'rs-chip shone');
    const p = people.find((q) => q.id === r.id);
    if (p) chip.append(miniFace(p));
    chip.append(`${r.id === c.best ? '★ ' : ''}${r.name}${r.levelTo > r.levelFrom ? ` Lv ${r.levelTo}!` : r.kills > 0 ? ` felled ${r.kills}` : ` dealt ${r.dealt}`}`);
    chips.append(chip);
  }
  if (c.beast && (c.beastBest || c.beast.fell)) chips.append(el('span', `rs-chip ${c.beast.fell ? 'fell' : 'shone'}`, `${c.beast.died ? '✝ ' : c.beastBest ? '★ ' : ''}${c.beast.name}${c.beast.died ? ' slain' : c.beast.fell ? ' fell' : c.beast.kills ? ` felled ${c.beast.kills}` : ` dealt ${c.beast.dealt}`}`));
  if (chips.childElementCount) wrap.append(chips);
  return wrap;
}

export interface RaidRecapView {
  update(s: Snapshot): void;
  open(): boolean;
  /** A raid fought while the player was away is told on the return card, not by its own recap: marked seen. */
  seenNow(s: Snapshot): void;
}

export function createRaidRecap(giveChase: () => void = () => {}): RaidRecapView {
  const box = el('div', '');
  box.id = 'raid-recap';
  box.setAttribute('data-hit', '');
  box.hidden = true;
  document.body.append(box);
  holdWhileUp(box); // (the recap holds the town while it's up: mobile/popupHold.ts)
  let shownKey = '';
  let last: Snapshot['raidRecap'] = null;
  /** The latest snapshot, for the badges by the names. */
  let snap: Snapshot | null = null;
  let seen = 0;
  try {
    seen = Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    /* (no storage: shown each time) */
  }

  const close = () => {
    box.hidden = true;
    if (!last) return;
    seen = last.tick;
    try {
      localStorage.setItem(SEEN_KEY, String(seen));
    } catch {
      /* (no storage) */
    }
  };

  /** The full tally: the defenders, the best first, the God creature as a defender is, and the towers. */
  const table = (c: Recap): HTMLElement => {
    if (!c.rows.length && !c.beast) return el('div', 'rr-sum', 'Nobody stood against them.');
    const table = el('div', 'rr-rows');
    const head = el('div', 'rr-row rr-head');
    head.append(el('span', 'rr-name', 'Defender'), el('span', 'rr-n', '⚔'), el('span', 'rr-n', 'Dealt'), el('span', 'rr-n', 'Took'), el('span', 'rr-xp', 'EXP'));
    table.append(head);
    for (const r of c.rows) {
      const row = el('div', `rr-row${r.died ? ' died' : r.fell ? ' fell' : ''}${r.id === c.best ? ' best' : ''}`);
      const name = el('span', 'rr-name', `${r.id === c.best ? '★ ' : ''}${r.name}`);
      const gm = snap ? guildMarkOrFallen(snap, r.id) : null;
      if (gm) name.append(' ', gm);
      if (r.died) name.append(el('span', 'rr-mark', ' slain'));
      else if (r.fell) name.append(el('span', 'rr-mark', ' fell'));
      const xp = el('span', 'rr-xp', r.died ? '—' : `+${r.xp}`);
      if (r.levelTo > r.levelFrom) xp.append(el('span', 'rr-up', ` LV ${r.levelTo}!`));
      row.append(name, el('span', 'rr-n', String(r.kills)), el('span', 'rr-n', String(r.dealt)), el('span', 'rr-n', String(r.taken)), xp);
      table.append(row);
    }
    // (the God creature, as a defender is: what it felled, the harm it did, its wounds)
    const bt = c.beast;
    if (bt) {
      const row = el('div', `rr-row beast${bt.died ? ' died' : bt.fell ? ' fell' : ''}${c.beastBest ? ' best' : ''}`);
      const name = el('span', 'rr-name', `${c.beastBest ? '★ ' : ''}${bt.name}`);
      if (bt.died) name.append(el('span', 'rr-mark', ' slain'));
      else if (bt.fell) name.append(el('span', 'rr-mark', ' fell'));
      if (bt.felled) name.title = `Felled ${bt.felled}`;
      row.append(name, el('span', 'rr-n', String(bt.kills)), el('span', 'rr-n', String(bt.dealt)), el('span', 'rr-n', String(bt.taken)), el('span', 'rr-xp', ''));
      table.append(row);
      if (bt.felled) table.append(el('div', 'rr-felled', `Felled ${bt.felled}.`));
    }
    if (c.towers) {
      const row = el('div', 'rr-row towers');
      row.append(el('span', 'rr-name', 'Towers and traps'), el('span', 'rr-n', String(c.towers.kills)), el('span', 'rr-n', String(c.towers.dealt)), el('span', 'rr-n', '—'), el('span', 'rr-xp', ''));
      table.append(row);
    }
    return table;
  };

  /** The full tally is open (each raid's card starts with only the summary). */
  let full = false;
  const draw = (c: NonNullable<Snapshot['raidRecap']>) => {
    const key = `${c.tick}${snap?.chase ? 'c' : ''}${full ? 'f' : ''}`;
    box.hidden = false;
    if (key === shownKey) return;
    shownKey = key;
    box.className = c.outcome;
    box.replaceChildren();
    box.append(el('div', 'rr-title', c.boss && c.outcome === 'victory' ? `${c.boss} falls!` : TITLES[c.outcome]));
    const sum = [`${c.name}`, c.waves > 1 ? `${c.waves} waves` : '', `${c.killed} of ${c.came} felled`, c.fled ? `${c.fled} fled` : '', c.through ? `${c.through} got through` : ''].filter(Boolean).join(' · ');
    box.append(el('div', 'rr-sum', sum));
    box.append(strip(c, snap));
    // the raid's one summary card (sim/summaries.ts): the outcome and the highlights above, then what was won and lost,
    // the firsts it earned and the founder's chapter; the full tally a tap away
    const lines: [string, string][] = [];
    const dead = c.rows.filter((r) => r.died).map((r) => r.name);
    if (c.beast?.died) dead.push(c.beast.name);
    if (dead.length) lines.push(['Lost', dead.join(', ')]);
    const hurt = c.rows.filter((r) => r.fell && !r.died).map((r) => r.name);
    if (c.beast?.fell && !c.beast.died) hurt.push(c.beast.name);
    if (hurt.length) lines.push(['Wounded', hurt.join(', ')]);
    const spoils = stockLine(c.spoils);
    if (spoils) lines.push(['Spoils', spoils]);
    if (c.prisoners) lines.push(['Prisoners', String(c.prisoners)]);
    const stolen = stockLine(c.stolen);
    if (stolen) lines.push(['Taken from us', stolen]);
    if (lines.length) {
      const foot = el('div', 'rr-foot');
      for (const [k, v] of lines) {
        const l = el('div', `rr-line${k === 'Taken from us' || k === 'Lost' ? ' bad' : ''}`);
        l.append(el('b', '', `${k}: `), document.createTextNode(v));
        foot.append(l);
      }
      box.append(foot);
    }
    for (const f of c.firsts ?? []) {
      const b = el('div', 'rr-first');
      const ic = icon(f.icon, 20);
      if (ic) b.append(ic);
      const words = el('span', '');
      words.append(el('b', '', `A first: ${f.title}. `), f.line);
      b.append(words);
      box.append(b);
    }
    if (c.chapter) box.append(el('div', 'rr-chapter', `Written in ${c.chapter.replace(/: /, ': “')}”.`));
    if (full) {
      // what happened, told
      if (c.story?.length) box.append(el('div', 'rr-story', c.story.join(' ')));
      box.append(table(c));
    } else {
      const more = el('button', 'tab rr-more', 'Full recap ›');
      more.addEventListener('click', () => {
        full = true;
        shownKey = '';
        draw(c);
      });
      box.append(more);
    }
    // raiders who got away: the town may ride after them (sim/chase.ts)
    if (snap?.chase) {
      const go = el('button', 'tab rr-close', `Give chase! (${snap.chase.count} fled)`);
      go.addEventListener('click', () => {
        close();
        giveChase();
      });
      box.append(go);
    }
    const ok = el('button', 'tab rr-close', 'Back to town');
    ok.addEventListener('click', close);
    const x = el('button', 'rr-x', '✕');
    x.title = 'Close';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    box.append(ok, x);
  };

  return {
    update(s) {
      snap = s;
      last = s.raidRecap;
      // (not over a battle still on; once a raid is over, shown once by itself)
      if (!last || s.battle || s.raid || s.tactics) {
        box.hidden = true;
        return;
      }
      if (last.tick > seen) {
        if (!shownKey.startsWith(String(last.tick))) full = false;
        draw(last);
      }
      else if (!box.hidden) draw(last);
    },
    seenNow(s) {
      last = s.raidRecap;
      close();
    },
    open() {
      if (!last) return false;
      shownKey = '';
      draw(last);
      return true;
    },
  };
}
