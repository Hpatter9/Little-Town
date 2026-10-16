// Motion for the menus (the owner's ask): a changed number ticks over to its new value, and a menu's sub-tab
// cross-fades in (the sheets' slide and the bars' ease are CSS: ui/uiCss.ts). Nothing over 250 ms; with the phone set
// to reduce motion, nothing moves.

const TICK_MS = 220;

export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The number a value starts with and what's round it ("2.8 days" -> 2.8, "", " days"), or null. */
export function leadingNumber(text: string): { n: number; pre: string; post: string; places: number } | null {
  const m = /^(\D*?)(-?\d+(?:\.\d+)?)(.*)$/s.exec(text);
  if (!m) return null;
  return { n: Number(m[2]), pre: m[1], post: m[3], places: (m[2].split('.')[1] ?? '').length };
}

/** The tiles' values last drawn, by their label: a redraw that changes one ticks it over from the old. */
const seen = new Map<string, string>();

/** Tick the Town tiles' numbers (and anything marked `data-tick="<key>"`) that changed since the last redraw. */
export function tickNumbers(root: ParentNode): void {
  const els: [string, HTMLElement][] = [];
  for (const t of Array.from(root.querySelectorAll<HTMLElement>('.glance-tile'))) {
    const v = t.querySelector<HTMLElement>('.glance-value');
    const k = t.querySelector('.glance-label')?.textContent;
    if (v && k) els.push([k, v]);
  }
  for (const v of Array.from(root.querySelectorAll<HTMLElement>('[data-tick]'))) els.push([v.dataset.tick!, v]);
  for (const [k, v] of els) {
    const now = v.textContent ?? '';
    const was = seen.get(k);
    seen.set(k, now);
    if (was === undefined || was === now) continue;
    const a = leadingNumber(was);
    const b = leadingNumber(now);
    v.classList.remove('ui-ticked');
    void v.offsetWidth; // (so the flash starts again)
    v.classList.add('ui-ticked');
    if (!a || !b || a.pre !== b.pre || a.post !== b.post || reducedMotion()) continue;
    const t0 = performance.now();
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / TICK_MS);
      if (!v.isConnected) return;
      v.textContent = f >= 1 ? now : `${b.pre}${(a.n + (b.n - a.n) * f).toFixed(b.places)}${b.post}`;
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
