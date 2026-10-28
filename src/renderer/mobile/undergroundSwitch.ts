// The Surface / Underground switch: a button in the top bar, always in the same place, that flips between the town
// and the underground it has (the Deep, the Underdark, a mine). With several, a small chooser opens. It remembers
// the last level picked. The views themselves are untouched (deep/, underdark/, fight/mineView.ts).
import type { Snapshot } from '../../shared/sim/snapshot';
import type { Command } from '../../shared/sim/commands';
import { NO_WAY_DOWN, surfaceCommands, undergroundNow, undergroundWays } from '../../shared/sim/underground';
import pickaxeIcon from '../ui/art/pickaxe.png';

const KEY = 'littletown.undergroundLast';

const remembered = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const remember = (k: string) => {
  try {
    localStorage.setItem(KEY, k);
  } catch {
    /* (the switch works without it) */
  }
};

export function startUndergroundSwitch(bridge: { command?: (c: Command) => void; onSnapshot: (f: (s: Snapshot) => void) => void }, bar: HTMLElement): void {
  const btn = document.createElement('button');
  btn.id = 'ug-btn';
  btn.className = 'top-btn';
  const menuBtn = bar.querySelector('#menu-btn');
  menuBtn?.parentElement?.insertBefore(btn, menuBtn);
  const chooser = document.createElement('div');
  chooser.id = 'ug-chooser';
  chooser.hidden = true;
  document.body.append(chooser);

  let snap: Snapshot | null = null;
  let last = remembered();
  // (a pickaxe from the mining icons for the way down, a sun for the way up; Clear land has a spade: main.ts)
  const pickaxe = document.createElement('img');
  pickaxe.src = pickaxeIcon;
  pickaxe.alt = '';
  let shown: 'up' | 'down' | null = null;

  const go = (key: string, command: Command) => {
    last = key;
    remember(key);
    chooser.hidden = true;
    bridge.command?.(command);
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!snap) return;
    const now = undergroundNow(snap);
    // (nothing to go down to: say why, in place of the chooser)
    if (!now && !undergroundWays(snap).length) {
      const why = document.createElement('p');
      why.textContent = NO_WAY_DOWN;
      chooser.replaceChildren(why);
      chooser.hidden = !chooser.hidden;
      return;
    }
    if (now) {
      chooser.hidden = true;
      for (const c of surfaceCommands(snap)) bridge.command?.(c);
      return;
    }
    const ways = undergroundWays(snap);
    if (!ways.length) return;
    if (ways.length === 1) return go(ways[0].key, ways[0].go);
    // (the last level picked comes first)
    const sorted = [...ways].sort((a, b) => Number(b.key === last) - Number(a.key === last));
    chooser.replaceChildren(
      ...sorted.map((w) => {
        const o = document.createElement('button');
        o.textContent = w.key === last ? `${w.label} (last)` : w.label;
        o.addEventListener('click', () => go(w.key, w.go));
        return o;
      }),
    );
    chooser.hidden = !chooser.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!chooser.hidden && !(e.target instanceof Node && chooser.contains(e.target))) chooser.hidden = true;
  });

  bridge.onSnapshot((s) => {
    snap = s;
    const now = undergroundNow(s);
    const ways = undergroundWays(s);
    const none = !now && !ways.length;
    if (shown !== (now ? 'up' : 'down')) {
      shown = now ? 'up' : 'down';
      if (now) btn.textContent = '☀';
      else btn.replaceChildren(pickaxe);
    }
    btn.classList.toggle('none', none);
    btn.title = btn.ariaLabel = none ? NO_WAY_DOWN : now ? 'Surface: back to the town' : 'Underground: go below the town';
    if (now) chooser.hidden = true;
  });
}
