// A small tooltip that floats above the cursor in the strip's transparent sky. Never captures the mouse.

export interface Tooltip {
  show(title: string, lines: string[], x: number, bottomY: number): void;
  hide(): void;
}

export function createTooltip(): Tooltip {
  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.hidden = true;
  document.body.append(tip);
  let key = '';

  return {
    show(title, lines, x, bottomY) {
      const k = title + '\n' + lines.join('\n');
      if (k !== key) {
        key = k;
        const h = document.createElement('div');
        h.className = 'tip-title';
        h.textContent = title;
        tip.replaceChildren(h, ...lines.map((l) => Object.assign(document.createElement('div'), { textContent: l })));
      }
      tip.hidden = false;
      const w = tip.offsetWidth;
      tip.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, x - w / 2)))}px`;
      tip.style.bottom = `${Math.round(Math.max(4, window.innerHeight - bottomY + 6))}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}
