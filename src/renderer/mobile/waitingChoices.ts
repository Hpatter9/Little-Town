// The choices closed unanswered wait behind a small button under the news bubble, with how many there are. Tapping it
// opens the oldest again to answer (the sim's `openPrompt`). The town is not held for them (sim/popups.ts `parkPrompt`),
// except a choice that holds it until answered, which the button marks red. An unanswered choice settles itself after
// a wait in game time, and the button goes with it.

import type { Snapshot } from '../../shared/sim/snapshot';

interface WaitingBridge {
  command?: (c: { type: 'openPrompt'; prompt: number }) => void;
  onSnapshot(fn: (s: Snapshot) => void): void;
}

/** The waiting choices, oldest first (the oldest has the lowest id). */
export const waitingOf = (s: Pick<Snapshot, 'prompts'>) => s.prompts.filter((p) => p.parked).sort((a, b) => a.id - b.id);

export function startWaitingChoices(bridge: WaitingBridge): HTMLElement {
  const b = document.createElement('button');
  b.id = 'choices-bubble';
  b.hidden = true;
  let oldest = -1;
  b.addEventListener('click', () => oldest >= 0 && bridge.command?.({ type: 'openPrompt', prompt: oldest }));
  bridge.onSnapshot((snap) => {
    const w = waitingOf(snap);
    b.hidden = !w.length;
    oldest = w[0]?.id ?? -1;
    if (!w.length) return;
    b.textContent = `❓ ${w.length}`;
    b.classList.toggle('holding', w.some((p) => p.waits));
    b.title = w.some((p) => p.waits)
      ? 'A choice is waiting, and the town waits for your answer. Tap to answer.'
      : `${w.length} ${w.length === 1 ? 'choice is' : 'choices are'} waiting. Tap to answer the oldest; unanswered, they settle themselves in time.`;
  });
  return b;
}
