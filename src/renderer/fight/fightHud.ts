// The windows over a watched fight (fight/fightView.ts draws the scene), in the old games' blue: at the top, the name
// of what was just done (or where the party is going); along the bottom, the foes' names on the left, and the party on
// the right, each with health and the time gauge till their next turn. "Back to town" stops watching.

import type { ExpeditionView } from '../../shared/sim/snapshot';

export interface FightHud {
  update(v: ExpeditionView | null): void;
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
  document.body.append(top, banner, bottom);
  top.hidden = bottom.hidden = true;

  let lastMessage = '';
  let bannerKey = '';
  let bannerUntil = 0;
  const POOL_NAMES = { mp: 'MP', sp: 'SP', limit: 'LIMIT' } as const;
  return {
    insets() {
      if (top.hidden) return [0, 0];
      return [Math.round(top.getBoundingClientRect().bottom), Math.round(window.innerHeight - bottom.getBoundingClientRect().top)];
    },
    update(v) {
      document.body.classList.toggle('in-fight', !!v);
      top.hidden = bottom.hidden = !v;
      if (!v) return;
      const fight = v.battle?.length ? v.battle : null;
      // the latest action, held a moment; else where they are
      const act = v.acts.find((a) => a.age < 25);
      if (act) lastMessage = act.name;
      // (the banner: the latest spell, skill or ultimate, held about a second and a half, longer for an ultimate)
      const shown = [...v.acts].reverse().find((a) => a.pool && a.age < 40);
      const key = shown ? `${shown.side}:${shown.ref}:${shown.name}:${shown.age - (shown.age % 100)}` : '';
      (window as unknown as { __banner?: unknown }).__banner = { key: bannerKey, until: bannerUntil, now: performance.now(), acts: v.acts.map((a) => [a.name, a.age, a.pool]) }; // (for previews)
      if (shown && key !== bannerKey) {
        bannerKey = key;
        bannerUntil = performance.now() + (shown.ult ? 2600 : 1500);
        banner.className = shown.ult ? 'ult' : shown.spell ? 'spell' : 'skill';
        banner.replaceChildren();
        const who = document.createElement('span');
        who.className = 'ff-who';
        who.textContent = shown.ult ? `${shown.who} unleashes` : shown.who;
        const name = document.createElement('span');
        name.className = 'ff-act';
        name.textContent = shown.name;
        const cost = document.createElement('span');
        cost.className = 'ff-cost';
        cost.textContent = shown.ult ? 'ULTIMATE' : `${shown.cost} ${POOL_NAMES[shown.pool!]}`;
        banner.append(who, name, cost);
        banner.hidden = false;
        banner.classList.remove('show');
        void banner.offsetWidth; // (restart the animation)
        banner.classList.add('show');
      }
      if (performance.now() > bannerUntil) banner.hidden = true;
      // (a delve's fight: what they ran into, as the log has it)
      else if (fight && v.delve && v.phase === 'work') lastMessage = v.delve.log.at(-1) ?? lastMessage;
      else if (!fight && v.delve && v.phase === 'work') lastMessage = v.delve.log.at(-1) ?? `Into ${v.destName}`;
      else if (!fight) lastMessage = `${PHASE_WORDS[v.phase] ?? ''} ${v.destName}`.trim();
      message.textContent = lastMessage || (fight ? 'Fight!' : v.destName);
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
      foes.replaceChildren(...(left.size ? [...left].map(([n, k]) => line('', k > 1 ? `${n} ×${k}` : n)) : [line('ff-dim', 'Beaten!')]));
      party.replaceChildren(
        ...fight
          .filter((f) => f.side === 'party')
          .map((f) => {
            const row = document.createElement('div');
            row.className = 'ff-row' + (f.down ? ' down' : f.hp < f.maxHp * 0.25 ? ' low' : '');
            const name = document.createElement('span');
            name.className = 'ff-name';
            name.textContent = f.name;
            if (f.clsName) name.title = `${f.clsName} · Lv ${f.level ?? 1}`;
            const hp = document.createElement('span');
            hp.className = 'ff-hp';
            hp.textContent = `${Math.max(0, Math.round(f.hp))}/${Math.round(f.maxHp)}`;
            const gauge = document.createElement('span');
            gauge.className = 'ff-atb';
            const fill = document.createElement('i');
            fill.style.width = `${Math.round((f.down ? 0 : f.atb) * 100)}%`;
            if (f.atb >= 0.99 && !f.down) fill.className = 'full';
            gauge.append(fill);
            row.append(name, hp, gauge);
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
              row.append(pools);
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
