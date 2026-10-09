// How loud the music and the sound effects are (the owner's ask: two sliders in the ☰ menu). Each is a share of its
// own full loudness, 0 to 1, kept in the browser (`littletown.musicVolume`, `littletown.sfxVolume`, as 0 to 100) so
// the phone remembers it; the ♪ button still turns both on and off.

export type VolumeKind = 'music' | 'sfx';

export const VOLUME_KEYS: Record<VolumeKind, string> = { music: 'littletown.musicVolume', sfx: 'littletown.sfxVolume' };

/** A stored level (0 to 100, else nothing) as a share, full when nothing sensible is stored. Pure. */
export function levelOf(stored: string | null | undefined): number {
  if (stored == null || stored === '') return 1;
  const n = Number(stored);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : 1;
}

export function readLevel(kind: VolumeKind): number {
  try {
    return levelOf(localStorage.getItem(VOLUME_KEYS[kind]));
  } catch {
    return 1;
  }
}

export function saveLevel(kind: VolumeKind, level: number): void {
  try {
    localStorage.setItem(VOLUME_KEYS[kind], String(Math.round(Math.max(0, Math.min(1, level)) * 100)));
  } catch {}
}
