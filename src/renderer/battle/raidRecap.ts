// The recap after a raid (the owner's ask: a fight recap for the tower-defence raids): a blue window over the town, as
// the parties' victory screen is, with how it went (the raiders felled, fled and through, the waves), each defender's
// raiders felled, harm dealt and taken, experience and levels, the best of them starred, the fallen, the towers' share,
// and what was won and lost. It shows itself once when a raid ends (the last one seen is kept, `SEEN_KEY`), and
// `window.__showRecap` brings it back while it's fresh (the feed's card).

import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import type { Snapshot } from '../../shared/sim/snapshot';

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

export interface RaidRecapView {
  update(s: Snapshot): void;
  open(): boolean;
}

export function createRaidRecap(): RaidRecapView {
  const box = el('div', '');
  box.id = 'raid-recap';
  box.setAttribute('data-hit', '');
  box.hidden = true;
  document.body.append(box);
  let shownKey = '';
  let last: Snapshot['raidRecap'] = null;
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

  const draw = (c: NonNullable<Snapshot['raidRecap']>) => {
    const key = String(c.tick);
    box.hidden = false;
    if (key === shownKey) return;
    shownKey = key;
    box.className = c.outcome;
    box.replaceChildren();
    box.append(el('div', 'rr-title', c.boss && c.outcome === 'victory' ? `${c.boss} falls!` : TITLES[c.outcome]));
    const sum = [`${c.name}`, c.waves > 1 ? `${c.waves} waves` : '', `${c.killed} of ${c.came} felled`, c.fled ? `${c.fled} fled` : '', c.through ? `${c.through} got through` : ''].filter(Boolean).join(' · ');
    box.append(el('div', 'rr-sum', sum));
    // the defenders, the best first
    if (c.rows.length) {
      const table = el('div', 'rr-rows');
      const head = el('div', 'rr-row rr-head');
      head.append(el('span', 'rr-name', 'Defender'), el('span', 'rr-n', '⚔'), el('span', 'rr-n', 'Dealt'), el('span', 'rr-n', 'Took'), el('span', 'rr-xp', 'EXP'));
      table.append(head);
      for (const r of c.rows) {
        const row = el('div', `rr-row${r.died ? ' died' : r.fell ? ' fell' : ''}${r.id === c.best ? ' best' : ''}`);
        const name = el('span', 'rr-name', `${r.id === c.best ? '★ ' : ''}${r.name}`);
        if (r.died) name.append(el('span', 'rr-mark', ' slain'));
        else if (r.fell) name.append(el('span', 'rr-mark', ' fell'));
        const xp = el('span', 'rr-xp', r.died ? '—' : `+${r.xp}`);
        if (r.levelTo > r.levelFrom) xp.append(el('span', 'rr-up', ` LV ${r.levelTo}!`));
        row.append(name, el('span', 'rr-n', String(r.kills)), el('span', 'rr-n', String(r.dealt)), el('span', 'rr-n', String(r.taken)), xp);
        table.append(row);
      }
      if (c.towers) {
        const row = el('div', 'rr-row towers');
        row.append(el('span', 'rr-name', 'Towers and traps'), el('span', 'rr-n', String(c.towers.kills)), el('span', 'rr-n', String(c.towers.dealt)), el('span', 'rr-n', '—'), el('span', 'rr-xp', ''));
        table.append(row);
      }
      box.append(table);
    } else box.append(el('div', 'rr-sum', 'Nobody stood against them.'));
    // what was won and lost
    const lines: [string, string][] = [];
    const spoils = stockLine(c.spoils);
    if (spoils) lines.push(['Spoils', spoils]);
    if (c.prisoners) lines.push(['Prisoners', String(c.prisoners)]);
    const stolen = stockLine(c.stolen);
    if (stolen) lines.push(['Taken from us', stolen]);
    const dead = c.rows.filter((r) => r.died).map((r) => r.name);
    if (dead.length) lines.push(['Lost', dead.join(', ')]);
    if (lines.length) {
      const foot = el('div', 'rr-foot');
      for (const [k, v] of lines) {
        const l = el('div', `rr-line${k === 'Taken from us' || k === 'Lost' ? ' bad' : ''}`);
        l.append(el('b', '', `${k}: `), document.createTextNode(v));
        foot.append(l);
      }
      box.append(foot);
    }
    const ok = el('button', 'tab rr-close', 'Back to town');
    ok.addEventListener('click', close);
    box.append(ok);
  };

  return {
    update(s) {
      last = s.raidRecap;
      // (not over a battle still on; once a raid is over, shown once by itself)
      if (!last || s.battle || s.raid) {
        box.hidden = true;
        return;
      }
      if (last.tick > seen) draw(last);
      else if (!box.hidden) draw(last);
    },
    open() {
      if (!last) return false;
      shownKey = '';
      draw(last);
      return true;
    },
  };
}
