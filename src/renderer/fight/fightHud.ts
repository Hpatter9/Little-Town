// The windows over a watched fight (fight/fightView.ts draws the scene), in the old games' blue: at the top, the name
// of what was just done (or where the party is going); along the bottom, the foes' names on the left, and the party on
// the right, each with health and the time gauge till their next turn. "Back to town" stops watching.

import type { ExpeditionView, MineView, Snapshot } from '../../shared/sim/snapshot';
import { guildMark } from '../art/guildMarks';
import { itemIcon } from '../art/icons';
import { ITEM_BY_ID } from '../../shared/data/items';
import { KIT_BY_ID } from '../../shared/data/kitItems';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { fightShare, tripLabel, tripShare } from './progress';

export interface FightHud {
  /** The watched fight (or trip), and how fast the fight plays (the speed button beside ✕). */
  update(v: ExpeditionView | null, speed?: number, guilds?: Snapshot['guilds']): void;
  /** Inside a mine (fight/mineView.ts): the top window names it and what its walls hold; the back button leaves. */
  mine(v: MineView | null): void;
  /** How much of the screen's top and bottom the windows cover (px). */
  insets(): [number, number];
}

const PHASE_WORDS: Record<string, string> = { out: 'On the way to', work: 'At', back: 'Heading home from' };

export function createFightHud(on: { back(): void; speed(n: number): void }): FightHud {
  const top = document.createElement('div');
  top.id = 'fight-top';
  top.className = 'ff-window';
  top.setAttribute('data-hit', '');
  const message = document.createElement('div');
  message.className = 'ff-message';
  const back = document.createElement('button');
  back.className = 'ff-back';
  back.textContent = 'Back to town';
  back.addEventListener('click', () => on.back());
  top.append(message, back);
  // (in a fight the top window gives way to the floating banner; a small corner button leads back to town)
  const leave = document.createElement('button');
  leave.id = 'fight-leave';
  leave.setAttribute('data-hit', '');
  leave.title = 'Back to town';
  leave.textContent = '✕';
  leave.addEventListener('click', () => on.back());
  leave.hidden = true;
  // (and beside it how fast the fight plays: 1×, 2×, 3×; every fight starts at 1×)
  let speedNow = 1;
  const fast = document.createElement('button');
  fast.id = 'fight-speed';
  fast.setAttribute('data-hit', '');
  fast.title = 'Fight speed';
  fast.textContent = '1×';
  fast.addEventListener('click', () => on.speed((speedNow % 3) + 1));
  fast.hidden = true;
  // the banner: who uses what (a skill or spell, with its cost), big and brief; an ultimate bigger still
  const banner = document.createElement('div');
  banner.id = 'fight-banner';
  banner.hidden = true;

  const bottom = document.createElement('div');
  bottom.id = 'fight-bottom';
  bottom.setAttribute('data-hit', '');
  const foes = document.createElement('div');
  foes.className = 'ff-window ff-foes';
  const party = document.createElement('div');
  party.className = 'ff-window ff-party';
  bottom.append(foes, party);
  // the victory screen: how the fight went, each member's experience and levels, the spoils
  const result = document.createElement('div');
  result.id = 'fight-result';
  result.className = 'ff-window';
  result.hidden = true;
  // the progress bars: the whole trip (out, there, home; a delve by its rooms), and in a fight the foes' health gone
  const progress = document.createElement('div');
  progress.id = 'fight-progress';
  const tripRow = document.createElement('div');
  tripRow.className = 'fp-row';
  const tripBar = document.createElement('div');
  tripBar.className = 'fp-bar trip';
  const tripFill = document.createElement('i');
  tripBar.append(tripFill, document.createElement('b'), document.createElement('b'));
  const tripText = document.createElement('span');
  tripText.className = 'fp-text';
  tripRow.append(tripBar, tripText);
  const fightRow = document.createElement('div');
  fightRow.className = 'fp-row';
  const fightBar = document.createElement('div');
  fightBar.className = 'fp-bar fight';
  const fightFill = document.createElement('i');
  fightBar.append(fightFill);
  const fightText = document.createElement('span');
  fightText.className = 'fp-text';
  fightRow.append(fightBar, fightText);
  progress.append(tripRow, fightRow);
  document.body.append(top, progress, banner, leave, fast, result, bottom);
  top.hidden = bottom.hidden = progress.hidden = true;
  /** The bars, under the top window (or at the top in a fight, beside the corner button). */
  const showProgress = (v: ExpeditionView, fight: ExpeditionView['battle']) => {
    progress.hidden = false;
    progress.classList.toggle('in-fight', !!fight);
    progress.style.top = `${top.hidden ? 6 : Math.round(top.getBoundingClientRect().bottom) + 4}px`;
    tripFill.style.width = `${Math.round(tripShare(v) * 100)}%`;
    tripText.textContent = tripLabel(v, v.destName);
    fightRow.hidden = !fight;
    if (fight) {
      const foesOf = fight.filter((f) => f.side === 'enemy');
      const share = fightShare(foesOf, v.assault?.wave ?? 0, v.assault?.total ?? 0);
      fightFill.style.width = `${Math.round(share * 100)}%`;
      fightText.textContent = v.assault && v.assault.total > 1 ? `Wave ${v.assault.wave} of ${v.assault.total} · ${Math.round(share * 100)}%` : `Foes beaten · ${Math.round(share * 100)}%`;
    }
  };

  /** The town's guilds (the snapshot's), for the badge beside a party member's name. */
  let guildList: Snapshot['guilds'] = [];
  const badge = (id: number) => guildMark({ guilds: guildList }, id);
  let resultKey = '';
  /** The victory screen, built once per fight and shown while the result is fresh. */
  const showResult = (r: ExpeditionView['result']) => {
    if (!r || r.age > 70) {
      result.hidden = true;
      resultKey = '';
      return;
    }
    const key = `${r.outcome}:${r.members.map((m) => `${m.id}:${m.xp}`).join(',')}`;
    if (key === resultKey) return;
    resultKey = key;
    result.replaceChildren();
    result.className = r.outcome;
    const title = document.createElement('div');
    title.className = 'ff-result-title';
    title.textContent = r.outcome === 'won' ? (r.boss ? `${r.boss} falls!` : 'Victory!') : r.outcome === 'retreated' ? 'Fell back' : 'Defeat';
    result.append(title);
    const rows = document.createElement('div');
    rows.className = 'ff-result-rows';
    for (const m of r.members) {
      const row = document.createElement('div');
      row.className = 'ff-result-row' + (m.down ? ' down' : '');
      const name = document.createElement('span');
      name.className = 'ff-name';
      name.textContent = m.name;
      const gm = badge(m.id);
      if (gm) name.append(' ', gm);
      const xp = document.createElement('span');
      xp.className = 'ff-xp';
      xp.textContent = m.down ? 'fallen' : `+${m.xp} EXP`;
      row.append(name, xp);
      if (m.levelTo > m.levelFrom) {
        const up = document.createElement('span');
        up.className = 'ff-levelup';
        up.textContent = `LEVEL UP! ${m.levelFrom} → ${m.levelTo}`;
        row.append(up);
      }
      rows.append(row);
    }
    result.append(rows);
    const spoils = Object.entries(r.loot).filter(([, n]) => (n ?? 0) > 0).map(([m, n]) => `${n} ${MATERIAL_NAMES[m as Material] ?? m}`);
    if (r.coins > 0) spoils.unshift(`${r.coins} coins`);
    if (r.outcome === 'won') {
      const got = document.createElement('div');
      got.className = 'ff-result-loot';
      got.textContent = spoils.length ? `Spoils: ${spoils.join(', ')}` : 'No spoils';
      result.append(got);
    }
    result.hidden = false;
  };
  let lastMessage = '';
  let bannerKey = '';
  let bannerShown = 0;
  let bannerUntil = 0;
  /** The banner's rise and fade, by the clock (called each update and each frame while it shows). */
  const fadeBanner = () => {
    const now = performance.now();
    if (now > bannerUntil || banner.hidden) {
      banner.hidden = true;
      return;
    }
    const life = bannerUntil - bannerShown;
    const t = (now - bannerShown) / life;
    const ult = banner.classList.contains('ult');
    const inK = Math.min(1, t / (ult ? 0.08 : 0.1));
    const outK = t > 0.8 ? (t - 0.8) / 0.2 : 0;
    banner.style.opacity = String(Math.min(inK, 1 - outK));
    const scale = ult ? 1.25 - 0.25 * inK : 0.85 + 0.15 * inK;
    const lift = outK * 10;
    const jolt = ult && t < 0.25 ? Math.sin(now / 18) * 2 * (1 - t / 0.25) : 0;
    banner.style.transform = `translate(calc(-50% + ${jolt}px), ${-lift}px) scale(${scale})`;
    banner.style.transformOrigin = '50% 0';
    requestAnimationFrame(fadeBanner);
  };
  const POOL_NAMES = { mp: 'MP', sp: 'SP', limit: 'LIMIT' } as const;
  let mineKey = '';
  return {
    mine(v) {
      if (!v) {
        if (mineKey) {
          mineKey = '';
          document.body.classList.remove('in-fight');
          top.classList.remove('mine');
          top.hidden = true;
        }
        return;
      }
      document.body.classList.add('in-fight');
      progress.hidden = true;
      top.classList.add('mine');
      top.hidden = false;
      bottom.hidden = true;
      leave.hidden = true;
      fast.hidden = true;
      result.hidden = true;
      const left = (Object.entries(v.left) as [Material, number][]).filter(([m, n]) => m !== 'stone' && n > 0).map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`);
      const key = `${v.id}:${v.depth}:${left.join(',')}:${v.miners.length}`;
      if (key === mineKey) return;
      mineKey = key;
      const digging = v.miners.filter((m) => m.digging).length;
      message.textContent = `${v.name} · level ${v.depth}${v.last ? ' (the last)' : ''} · ${left.length ? `in the walls: ${left.join(', ')}` : 'dug out to the rock'} · ${digging ? `${digging} digging` : v.miners.length ? `${v.miners.length} on the way` : 'nobody here'}`;
    },
    insets() {
      // (in a fight the top window gives way to the corner button, but the party's window along the bottom stays: the
      // scene must stand above it, or the fighters stand behind it)
      const t = Math.max(top.hidden ? 0 : Math.round(top.getBoundingClientRect().bottom), progress.hidden ? 0 : Math.round(progress.getBoundingClientRect().bottom));
      const b = bottom.hidden ? 0 : Math.round(window.innerHeight - bottom.getBoundingClientRect().top);
      return [t, b];
    },
    update(v, speed = 1, guilds = []) {
      guildList = guilds;
      document.body.classList.toggle('in-fight', !!v);
      top.hidden = bottom.hidden = !v;
      if (!v) {
        leave.hidden = true;
        fast.hidden = true;
        progress.hidden = true;
        return;
      }
      const fight = v.battle?.length ? v.battle : null;
      top.hidden = !!fight;
      leave.hidden = !fight;
      fast.hidden = !fight;
      speedNow = speed;
      if (fast.textContent !== `${speed}×`) fast.textContent = `${speed}×`;
      fast.classList.toggle('active', speed > 1);
      showProgress(v, fight);
      showResult(v.result);
      // the latest action, held a moment; else where they are
      const act = v.acts.find((a) => a.age < 25);
      if (act) lastMessage = act.name;
      // (a delve's fight: what they ran into, as the log has it)
      else if (fight && v.delve && v.phase === 'work') lastMessage = v.delve.log.at(-1) ?? lastMessage;
      else if (!fight && v.delve && v.phase === 'work') lastMessage = v.delve.log.at(-1) ?? `Into ${v.destName}`;
      else if (!fight) lastMessage = `${PHASE_WORDS[v.phase] ?? ''} ${v.destName}`.trim();
      message.textContent = lastMessage || (fight ? 'Fight!' : v.destName);
      // (the floating window naming the latest spell, skill or ultimate, as the old games had it: lower in the scene,
      // held about a second and a half, an ultimate longer and in gold; faded by hand each frame, since the strip's
      // CSS animations don't run while the fight scene is drawing)
      // (a drink is quick, so the blow or spell it came with follows at once: the item keeps the window for its first moments)
      const recent = v.acts.filter((a) => a.pool && a.age < 40);
      const shown = [...recent].reverse().find((a) => a.item && a.age < 15) ?? recent[recent.length - 1];
      const key = shown ? `${shown.side}:${shown.ref}:${shown.name}:${shown.age - (shown.age % 100)}` : '';
      if (shown && key !== bannerKey) {
        bannerKey = key;
        bannerShown = performance.now();
        bannerUntil = bannerShown + (shown.ult ? 2600 : 1500);
        banner.className = shown.ult ? 'ult' : shown.item ? 'item' : shown.spell ? 'spell' : 'skill';
        banner.replaceChildren();
        const name = document.createElement('span');
        name.className = 'ff-act';
        // (a battle item from a pouch: its icon before the name, and what was done with it for the cost)
        const kit = shown.item ? KIT_BY_ID[shown.item] : undefined;
        const def = kit ? ITEM_BY_ID[kit.id] : undefined;
        if (def) {
          const icon = itemIcon(def, 2);
          icon.classList.add('ff-item-icon');
          name.append(icon);
        }
        name.append(shown.name);
        const cost = document.createElement('span');
        cost.className = 'ff-cost';
        cost.textContent = shown.ult ? `${shown.who} · ULTIMATE` : kit ? `${shown.who} ${kit.use === 'throw' ? 'throws' : kit.use === 'escape' || kit.use === 'buff' ? 'uses' : 'drinks'}` : `${shown.who} · ${shown.cost} ${POOL_NAMES[shown.pool!]}`;
        banner.append(name, cost);
        // (what it does, in a line)
        if (shown.text) {
          const what = document.createElement('span');
          what.className = 'ff-what';
          what.textContent = shown.text;
          banner.append(what);
          bannerUntil += 700;
        }
        banner.hidden = false;
      }
      fadeBanner();
      (window as unknown as { __banner?: unknown }).__banner = { key: bannerKey, until: bannerUntil, now: performance.now(), hidden: banner.hidden, acts: v.acts.map((a) => [a.name, a.age, a.pool]) }; // (for previews)
      if (!fight) {
        // (down a dungeon: how deep, and how much light is left)
        const d = v.delve && v.phase === 'work' ? v.delve : null;
        foes.replaceChildren(
          ...(d
            ? [line('', d.room ? `Room ${d.room} of ${d.rooms}` : 'At the door'), line(d.torches <= 2 ? 'ff-dim' : '', `${d.torches} torch${d.torches === 1 ? '' : 'es'} left`), ...(d.twist ? [line('ff-dim', d.twist)] : [])]
            : [line('ff-dim', 'No foes in sight')]),
        );
        party.replaceChildren(
          ...v.members.map((m) => {
            const row = line('', m.name);
            const gm = badge(m.id);
            if (gm) row.append(' ', gm);
            return row;
          }),
        );
        return;
      }
      // foes: a row for each one still standing, in the order the battle has them; a kind with more than one is numbered
      // (Wolf 1, Wolf 2) by its place in the battle, so a number stays with its foe as the others fall
      const kinds = new Map<string, number>();
      for (const f of fight) if (f.side === 'enemy') kinds.set(f.name, (kinds.get(f.name) ?? 0) + 1);
      const seen = new Map<string, number>();
      const foeRows: HTMLElement[] = [];
      for (const f of fight) {
        if (f.side !== 'enemy') continue;
        const place = (seen.get(f.name) ?? 0) + 1;
        seen.set(f.name, place);
        if (f.down) continue;
        const row = document.createElement('div');
        row.className = 'ff-row ff-foe';
        const head = document.createElement('div');
        head.className = 'ff-head';
        const name = document.createElement('span');
        name.className = 'ff-name';
        name.textContent = (kinds.get(f.name) ?? 1) > 1 ? `${f.name} ${place}` : f.name;
        // how near their next turn is, and their life: what's left over what they began with
        head.append(name, turnGauge(f.atb, true, 'Next turn'));
        row.append(head, meter('hp foe', f.hp / Math.max(1, f.maxHp), '', `${Math.max(0, Math.round(f.hp))}/${Math.round(f.maxHp)}`, `${name.textContent} · life left`));
        foeRows.push(row);
      }
      const foeCount = foeRows.length;
      // (an assault: which wave this is)
      if (v.assault && v.assault.wave > 0) foeRows.unshift(line('ff-wave', `Wave ${v.assault.wave} of ${v.assault.total}`));
      // (more than three foes: one line each; more than six: tighter still; more than ten: the list scrolls)
      foes.classList.toggle('crowd', foeCount > 3);
      foes.classList.toggle('tight', foeCount > 6);
      foes.classList.toggle('packed', foeCount > 10);
      foes.replaceChildren(...(foeRows.length ? foeRows : [line('ff-dim', 'Beaten!')]));
      party.classList.toggle('many', fight.filter((f) => f.side === 'party').length > 6);
      party.replaceChildren(
        ...fight
          .filter((f) => f.side === 'party')
          .map((f) => {
            const row = document.createElement('div');
            row.className = 'ff-row ff-member' + (f.down ? ' down' : f.hp < f.maxHp * 0.25 ? ' low' : '') + (f.atb >= 0.99 && !f.down ? ' ready' : '');
            const head = document.createElement('div');
            head.className = 'ff-head';
            const name = document.createElement('span');
            name.className = 'ff-name';
            name.textContent = f.name;
            const gm = badge(f.ref);
            if (gm) name.append(' ', gm);
            if (f.clsName) name.title = `${f.clsName} · Lv ${f.level ?? 1}`;
            head.append(name, turnGauge(f.down ? 0 : f.atb, !f.down, 'Their next turn'));
            row.append(head, meter('hp', f.down ? 0 : f.hp / Math.max(1, f.maxHp), 'HP', `${Math.max(0, Math.round(f.hp))}/${Math.round(f.maxHp)}`, 'Health'));
            // mana, stamina and the limit gauge (a person's), each named
            if (f.maxMp !== null && f.maxSp !== null) {
              const pools = document.createElement('div');
              pools.className = 'ff-pools';
              pools.append(
                meter('mp', (f.mp ?? 0) / Math.max(1, f.maxMp), 'MP', '', `Mana ${Math.round(f.mp ?? 0)}/${f.maxMp}`),
                meter('sp', (f.sp ?? 0) / Math.max(1, f.maxSp), 'SP', '', `Stamina ${Math.round(f.sp ?? 0)}/${f.maxSp}`),
                meter('limit', f.limit ?? 0, 'Limit', '', `Limit ${Math.round((f.limit ?? 0) * 100)}%`),
              );
              row.append(pools);
            }
            return row;
          }),
      );
    },
  };
}

/** A short turn gauge, named "Turn" (it fills as their next turn comes round; lit when full). */
function turnGauge(share: number, live: boolean, title: string): HTMLElement {
  const g = document.createElement('span');
  g.className = 'ff-turnwrap';
  g.title = title;
  const lab = document.createElement('span');
  lab.className = 'ff-lab';
  lab.textContent = 'Turn';
  const bar = document.createElement('span');
  bar.className = 'ff-turn';
  const fill = document.createElement('i');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  if (live && share >= 0.99) fill.className = 'full';
  bar.append(fill);
  g.append(lab, bar);
  return g;
}

/** A labelled meter: a name on the left (when given), the bar, and its numbers over it (when given). */
function meter(cls: string, share: number, label: string, nums: string, title: string): HTMLElement {
  const m = document.createElement('div');
  m.className = `ff-meter ${cls}`;
  m.title = title;
  if (label) {
    const lab = document.createElement('span');
    lab.className = 'ff-lab';
    lab.textContent = label;
    m.append(lab);
  }
  const bar = document.createElement('span');
  bar.className = 'ff-gauge';
  const fill = document.createElement('i');
  const s = Math.max(0, Math.min(1, share));
  fill.style.width = `${Math.round(s * 100)}%`;
  if (cls === 'limit' && s >= 1) fill.className = 'full';
  if (cls.startsWith('hp') && s < 0.25) fill.classList.add('low');
  bar.append(fill);
  if (nums) {
    const n = document.createElement('b');
    n.textContent = nums;
    bar.append(n);
  }
  m.append(bar);
  return m;
}

function line(cls: string, text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'ff-row ' + cls;
  d.textContent = text;
  return d;
}
