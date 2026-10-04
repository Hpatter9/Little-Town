// The windows over a watched fight (fight/fightView.ts draws the scene), in the old games' blue: at the top, the name
// of what was just done (or where the party is going); along the bottom, the foes' names on the left, and the party on
// the right, each with health and the time gauge till their next turn. "Back to town" stops watching.

import type { ExpeditionView, MineView } from '../../shared/sim/snapshot';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';

export interface FightHud {
  update(v: ExpeditionView | null): void;
  /** Inside a mine (fight/mineView.ts): the top window names it and what its walls hold; the back button leaves. */
  mine(v: MineView | null): void;
  /** How much of the screen's top and bottom the windows cover (px). */
  insets(): [number, number];
}

const PHASE_WORDS: Record<string, string> = { out: 'On the way to', work: 'At', back: 'Heading home from' };

export function createFightHud(on: { back(): void }): FightHud {
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
  document.body.append(top, banner, leave, result, bottom);
  top.hidden = bottom.hidden = true;

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
    result.className = `ff-window ${r.outcome}`;
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
    banner.style.transform = `translate(calc(-50% + ${jolt}px), calc(-50% - ${lift}px)) scale(${scale})`;
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
      top.classList.add('mine');
      top.hidden = false;
      bottom.hidden = true;
      leave.hidden = true;
      result.hidden = true;
      const left = (Object.entries(v.left) as [Material, number][]).filter(([m, n]) => m !== 'stone' && n > 0).map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`);
      const key = `${v.id}:${v.depth}:${left.join(',')}:${v.miners.length}`;
      if (key === mineKey) return;
      mineKey = key;
      const digging = v.miners.filter((m) => m.digging).length;
      message.textContent = `${v.name} · level ${v.depth}${v.last ? ' (the last)' : ''} · ${left.length ? `in the walls: ${left.join(', ')}` : 'dug out to the rock'} · ${digging ? `${digging} digging` : v.miners.length ? `${v.miners.length} on the way` : 'nobody here'}`;
    },
    insets() {
      if (top.hidden) return [0, 0];
      return [Math.round(top.getBoundingClientRect().bottom), bottom.hidden ? 0 : Math.round(window.innerHeight - bottom.getBoundingClientRect().top)];
    },
    update(v) {
      document.body.classList.toggle('in-fight', !!v);
      top.hidden = bottom.hidden = !v;
      if (!v) {
        leave.hidden = true;
        return;
      }
      const fight = v.battle?.length ? v.battle : null;
      top.hidden = !!fight;
      leave.hidden = !fight;
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
      const shown = [...v.acts].reverse().find((a) => a.pool && a.age < 40);
      const key = shown ? `${shown.side}:${shown.ref}:${shown.name}:${shown.age - (shown.age % 100)}` : '';
      if (shown && key !== bannerKey) {
        bannerKey = key;
        bannerShown = performance.now();
        bannerUntil = bannerShown + (shown.ult ? 2600 : 1500);
        banner.className = shown.ult ? 'ult' : shown.spell ? 'spell' : 'skill';
        banner.replaceChildren();
        const name = document.createElement('span');
        name.className = 'ff-act';
        name.textContent = shown.name;
        const cost = document.createElement('span');
        cost.className = 'ff-cost';
        cost.textContent = shown.ult ? `${shown.who} · ULTIMATE` : `${shown.who} · ${shown.cost} ${POOL_NAMES[shown.pool!]}`;
        banner.append(name, cost);
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
        party.replaceChildren(...v.members.map((m) => line('', m.name)));
        return;
      }
      // foes: each kind once, with how many are left standing
      const left = new Map<string, number>();
      for (const f of fight) if (f.side === 'enemy' && !f.down) left.set(f.name, (left.get(f.name) ?? 0) + 1);
      // foes: each kind once, how many are left, and how near the next of them is to acting
      const foeRows: HTMLElement[] = [];
      for (const [n, k] of left) {
        const row = line('', k > 1 ? `${n} ×${k}` : n);
        const soon = Math.max(...fight.filter((f) => f.side === 'enemy' && !f.down && f.name === n).map((f) => f.atb));
        const gauge = document.createElement('span');
        gauge.className = 'ff-turn foe';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round(soon * 100)}%`;
        if (soon >= 0.99) fill.className = 'full';
        gauge.append(fill);
        row.append(gauge);
        foeRows.push(row);
      }
      foes.replaceChildren(...(foeRows.length ? foeRows : [line('ff-dim', 'Beaten!')]));
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
            if (f.clsName) name.title = `${f.clsName} · Lv ${f.level ?? 1}`;
            const hp = document.createElement('span');
            hp.className = 'ff-hp';
            hp.textContent = `${Math.max(0, Math.round(f.hp))}/${Math.round(f.maxHp)}`;
            head.append(name, hp);
            // the turn gauge: fills as their turn comes round (the quick fill faster), lit when it's full
            const under = document.createElement('div');
            under.className = 'ff-under';
            const gauge = document.createElement('span');
            gauge.className = 'ff-turn';
            gauge.title = 'Their next turn';
            const fill = document.createElement('i');
            fill.style.width = `${Math.round((f.down ? 0 : f.atb) * 100)}%`;
            if (f.atb >= 0.99 && !f.down) fill.className = 'full';
            gauge.append(fill);
            under.append(gauge);
            row.append(head, under);
            // mana, stamina and the limit gauge (a person's)
            if (f.maxMp !== null && f.maxSp !== null) {
              const pools = document.createElement('span');
              pools.className = 'ff-pools';
              const bar = (cls: string, share: number, title: string) => {
                const b = document.createElement('span');
                b.className = `ff-bar ${cls}`;
                b.title = title;
                const i = document.createElement('i');
                i.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
                if (cls === 'limit' && share >= 1) i.className = 'full';
                b.append(i);
                return b;
              };
              pools.append(bar('mp', (f.mp ?? 0) / Math.max(1, f.maxMp), `MP ${Math.round(f.mp ?? 0)}/${f.maxMp}`), bar('sp', (f.sp ?? 0) / Math.max(1, f.maxSp), `SP ${Math.round(f.sp ?? 0)}/${f.maxSp}`), bar('limit', f.limit ?? 0, `Limit ${Math.round((f.limit ?? 0) * 100)}%`));
              under.append(pools);
            }
            return row;
          }),
      );
    },
  };
}

function line(cls: string, text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'ff-row ' + cls;
  d.textContent = text;
  return d;
}
