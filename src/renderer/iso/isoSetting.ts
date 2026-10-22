// Whether the town is drawn isometrically (iso/isoView.ts): Settings' "Isometric view", the default since 0.182.0,
// kept with the phone's other settings. The strip reads it as it starts (the ☰ menu reloads the page when it changes).

export const ISO_KEY = 'littletown.iso';
// (set once iso became the default: a phone that had the old top-down view chosen is moved over once, then the
// player's own choice stands)
const DEFAULT_KEY = 'littletown.isoDefault';

export function isoViewOn(): boolean {
  try {
    if (localStorage.getItem(DEFAULT_KEY) !== '1') {
      localStorage.setItem(DEFAULT_KEY, '1');
      localStorage.setItem(ISO_KEY, '1');
    }
    return localStorage.getItem(ISO_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setIsoView(on: boolean): void {
  try {
    localStorage.setItem(DEFAULT_KEY, '1');
    localStorage.setItem(ISO_KEY, on ? '1' : '0');
  } catch {}
}
