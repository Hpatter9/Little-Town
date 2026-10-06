// The battle's bars, over the map (renderer/battle/battleView.ts draws the map): at the top, what's happening (placing,
// the wave, the count), "Fight now" and auto-watch; at the bottom, while placing, the fighters to place (tap one, then
// a ring on the map), and while fighting, the spells to aim (tap one, then the trail).

import type { BattleView } from '../../shared/sim/battle';
import { raidShare } from '../fight/progress';

export interface BattleHud {
  update(b: BattleView | null, raidName: string): void;
  /** The fighter picked to place, and the spell picked to aim (null: none). */
  picked: number | null;
  aiming: string | null;
  /** How much of the screen's top and bottom the bars cover (px). */
  insets(): [number, number];
}

export function createBattleHud(on: { go(): void; auto(on: boolean): void; speed(n: number): void; pick(person: number | null): void; spell(id: string | null): void }): BattleHud {
  const top = document.createElement('div');
  top.id = 'battle-top';
  top.setAttribute('data-hit', '');
  const title = document.createElement('div');
  title.className = 'battle-title';
  const status = document.createElement('div');
  status.className = 'battle-status';
  const go = document.createElement('button');
  go.className = 'tab battle-go';
  go.textContent = 'Fight now';
  go.addEventListener('click', () => on.go());
  const auto = document.createElement('button');
  auto.className = 'tab battle-auto';
  auto.addEventListener('click', () => on.auto(!last?.auto));
  const row = document.createElement('div');
  row.className = 'battle-row';
  // how fast it plays: each tap goes up a step, round from 3x to 1x
  const speed = document.createElement('button');
  speed.className = 'tab battle-speed';
  speed.addEventListener('click', () => on.speed(((last?.speed ?? 1) % 3) + 1));
  row.append(go, speed, auto);
  // how much of the raid is decided: the raiders beaten (green) and got through (red), of all that came
  const progress = document.createElement('div');
  progress.className = 'battle-progress';
  const beaten = document.createElement('i');
  beaten.className = 'beaten';
  const past = document.createElement('i');
  past.className = 'past';
  progress.append(beaten, past);
  top.append(title, status, progress, row);

  const bar = document.createElement('div');
  bar.id = 'battle-bar';
  bar.setAttribute('data-hit', '');
  const hint = document.createElement('div');
  hint.className = 'battle-hint';
  const chips = document.createElement('div');
  chips.className = 'battle-chips';
  bar.append(hint, chips);
  document.body.append(top, bar);
  top.hidden = bar.hidden = true;

  let last: BattleView | null = null;
  let chipsKey = '';
  const hud: BattleHud = {
    picked: null,
    aiming: null,
    insets() {
      if (top.hidden) return [0, 0];
      const t = Math.round(top.getBoundingClientRect().bottom);
      return [t, bar.hidden ? 0 : Math.round(window.innerHeight - bar.getBoundingClientRect().top)];
    },
    update(b, raidName) {
      last = b;
      document.body.classList.toggle('in-battle', !!b);
      top.hidden = !b;
      if (!b) {
        bar.hidden = true;
        hud.picked = null;
        hud.aiming = null;
        chipsKey = '';
        return;
      }
      const placing = b.phase === 'placing' || b.phase === 'breather';
      document.body.style.setProperty('--battle-top-h', `${Math.round(top.getBoundingClientRect().bottom)}px`);
      title.textContent = raidName;
      const wave = b.waves > 1 ? `Wave ${b.wave + 1} of ${b.waves}` : 'The raid';
      // (the count, then, while anyone placed is still walking to their spot, how many: the raiders wait for them)
      // (on auto the raid comes as soon as everyone stands ready, so the count says nothing: just who's still walking)
      const time = b.secondsLeft && !b.auto ? ` · ${Math.ceil(b.secondsLeft)}s` : b.onTheWay ? ` · ${b.onTheWay} still on the way` : '';
      const doing = b.phase === 'placing' ? (b.auto || !b.secondsLeft ? 'Taking positions' : 'Place your fighters') : b.phase === 'breather' ? 'Regroup' : 'Fighting';
      status.textContent = `${wave} · ${doing}${time} · ${b.killed} down${b.through ? ` · ${b.through} through` : ''}${b.coming ? ` · ${b.coming} to come` : ''}`;
      const done = raidShare(b.killed, b.through, b.total);
      const killedShare = b.total > 0 ? b.killed / b.total : 0;
      beaten.style.width = `${Math.round(killedShare * 100)}%`;
      past.style.width = `${Math.max(0, Math.round((done - killedShare) * 100))}%`;
      progress.title = `${b.killed} of ${b.total} beaten${b.through ? `, ${b.through} through` : ''}`;
      go.hidden = !placing;
      auto.textContent = b.auto ? 'Auto: on' : 'Auto: off';
      speed.textContent = `${b.speed}×`;
      speed.title = 'Battle speed: tap for 1×, 2× or 3×';
      speed.classList.toggle('on', b.speed > 1);
      auto.classList.toggle('on', b.auto);
      // (a placed fighter who's gone, or a spell no more: let go of them)
      if (hud.picked !== null && !b.roster.some((r) => r.id === hud.picked)) hud.picked = null;
      if (!placing) hud.picked = null;
      if (placing || b.auto) hud.aiming = null;
      // the bottom bar: fighters while placing, spells while fighting (none if the town is doing it all)
      const key = JSON.stringify([placing, b.auto, hud.picked, hud.aiming, b.roster.map((r) => [r.id, r.spot, Math.round((r.hp / r.maxHp) * 10)]), b.spells.map((s) => [s.id, Math.ceil(s.readyIn), s.affordable])]);
      if (key === chipsKey) return;
      chipsKey = key;
      bar.hidden = false;
      if (placing && !b.auto) {
        const left = b.roster.filter((r) => r.spot === null).length;
        hint.textContent = hud.picked !== null ? 'Tap a ring on the map to put them there (tap their spot again to take them off).' : left ? `${left} to place: tap a fighter, then a ring on the map. Whoever's left is placed for you.` : 'Everyone is placed. Tap a fighter to move them, or Fight now.';
        chips.replaceChildren(
          ...b.roster.map((r) => {
            const c = document.createElement('button');
            c.className = `battle-chip${r.spot !== null ? ' placed' : ''}${hud.picked === r.id ? ' on' : ''}`;
            const mark = r.hero ? '★' : r.mage ? '✦' : r.ranged ? '🏹' : '⚔';
            c.textContent = `${mark} ${r.name.split(' ')[0]}`;
            const hp = document.createElement('span');
            hp.className = 'battle-hp';
            const fill = document.createElement('span');
            fill.style.width = `${Math.round((r.hp / Math.max(1, r.maxHp)) * 100)}%`;
            hp.append(fill);
            c.append(hp);
            c.addEventListener('click', () => {
              hud.picked = hud.picked === r.id ? null : r.id;
              on.pick(hud.picked);
              chipsKey = '';
            });
            return c;
          }),
        );
      } else if (!b.auto && b.spells.length) {
        hint.textContent = hud.aiming ? 'Tap the trail where it should land.' : 'Spells: tap one, then where on the trail.';
        chips.replaceChildren(
          ...b.spells.map((s) => {
            const c = document.createElement('button');
            const ready = s.readyIn <= 0 && s.affordable;
            c.className = `battle-chip spell${hud.aiming === s.id ? ' on' : ''}`;
            c.disabled = !ready;
            c.textContent = ready ? s.name : s.affordable ? `${s.name} ${fmt(s.readyIn)}` : `${s.name} (can't pay)`;
            c.addEventListener('click', () => {
              hud.aiming = hud.aiming === s.id ? null : s.id;
              on.spell(hud.aiming);
              chipsKey = '';
            });
            return c;
          }),
        );
      } else {
        // (nothing to pick: the bar goes, and the map has its room)
        hint.textContent = '';
        chips.replaceChildren();
        bar.hidden = true;
      }
    },
  };
  return hud;
}

const fmt = (secs: number) => (secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${Math.ceil(secs)}s`);
