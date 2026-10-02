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

  const bottom = document.createElement('div');
  bottom.id = 'fight-bottom';
  bottom.setAttribute('data-hit', '');
  const foes = document.createElement('div');
  foes.className = 'ff-window ff-foes';
  const party = document.createElement('div');
  party.className = 'ff-window ff-party';
  bottom.append(foes, party);
  document.body.append(top, bottom);
  top.hidden = bottom.hidden = true;

  let lastMessage = '';
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
