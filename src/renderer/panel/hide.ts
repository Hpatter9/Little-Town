// "Hide:" toggles at the top of a menu (Research, Build, Crafting): each hides one kind of card, such as what's
// already done or what can't be had yet. Remembered per phone in localStorage (a per-viewer convenience: without
// storage, everything simply shows).

import { button, el } from './dom';

export class HidePrefs<K extends string> {
  private on: Record<K, boolean>;

  constructor(
    private readonly storageKey: string,
    keys: readonly K[],
  ) {
    this.on = Object.fromEntries(keys.map((k) => [k, false])) as Record<K, boolean>;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<Record<K, boolean>>;
      for (const k of keys) if (typeof saved[k] === 'boolean') this.on[k] = saved[k]!;
    } catch {
      // (no storage: show everything)
    }
  }

  has(k: K): boolean {
    return this.on[k];
  }

  /** Changes when a toggle does (for the panel's redraw key). */
  get key(): string {
    return JSON.stringify(this.on);
  }

  toggle(k: K, rerender: () => void): void {
    this.on = { ...this.on, [k]: !this.on[k] };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.on));
    } catch {
      // (it just won't be remembered)
    }
    rerender();
  }

  /** The row of toggles: [key, label, tooltip]. */
  row(items: readonly [K, string, string][], rerender: () => void): HTMLElement {
    const row = el('div', 'row hide-row');
    row.append(el('span', 'hint', 'Hide:'));
    for (const [k, label, title] of items) row.append(button(label, () => this.toggle(k, rerender), { cls: `place small${this.on[k] ? ' on' : ' quiet'}`, title }));
    return row;
  }
}

/** A note at the foot of a list saying how much is hidden (nothing when none is). */
export const hiddenNote = (n: number): HTMLElement[] => (n ? [el('div', 'hint', `${n} hidden.`)] : []);
