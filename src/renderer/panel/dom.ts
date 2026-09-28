// Tiny DOM helpers for the panels.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(label: string, onClick: () => void, opts: { cls?: string; disabled?: boolean; title?: string } = {}): HTMLButtonElement {
  const b = el('button', opts.cls ?? 'place', label);
  b.disabled = !!opts.disabled;
  if (opts.title) b.title = opts.title;
  b.addEventListener('click', onClick);
  return b;
}

/** 95 -> "1m 35s", 40 -> "40s", 4000 -> "1h 7m". */
export function duration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}
