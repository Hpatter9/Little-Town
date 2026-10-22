// Whether the town is drawn isometrically (iso/isoView.ts): Settings' "Isometric view (in progress)", off unless
// turned on, kept with the phone's other settings. The strip reads it as it starts (the ☰ menu reloads the page when
// it changes).

export const ISO_KEY = 'littletown.iso';

export function isoViewOn(): boolean {
  try {
    return localStorage.getItem(ISO_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIsoView(on: boolean): void {
  try {
    localStorage.setItem(ISO_KEY, on ? '1' : '0');
  } catch {}
}
