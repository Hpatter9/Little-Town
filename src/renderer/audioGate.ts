// No sound while the game is in the background (the owner's complaint: it played on with the app out of sight). Every
// sound the game makes goes through here: the Web Audio contexts of the music and the land's sound (musicGen.ts,
// ambience.ts) and the recorded tracks (music.ts). When the page is hidden (the phone's app sent to the background, the
// tab changed, the screen locked) each context is suspended and each track paused at once; when it comes back they
// carry on. While it is away nothing may wake them (`wake` does nothing), so a timer that starts the next piece in the
// background stays silent.

const contexts = new Set<AudioContext>();
const tracks = new Set<HTMLMediaElement>();
const held = new Set<HTMLMediaElement>();
const backs = new Set<() => void>();

/** Is the page out of sight? */
export const pageAway = (): boolean => typeof document !== 'undefined' && document.hidden;

/** Put an audio context under the gate (suspended now if the page is away). */
export function gateContext(ctx: AudioContext): void {
  contexts.add(ctx);
  if (pageAway()) void ctx.suspend().catch(() => undefined);
}

/** Wake a context, unless the page is away. */
export function wake(ctx: AudioContext | null | undefined): void {
  if (ctx && !pageAway()) void ctx.resume().catch(() => undefined);
}

/** Put a recorded track under the gate (dropped again once it ends or is let go). */
export function gateTrack(a: HTMLMediaElement): void {
  tracks.add(a);
}
export function ungateTrack(a: HTMLMediaElement): void {
  tracks.delete(a);
  held.delete(a);
}

/** Called when the page comes back into sight. */
export function onBack(cb: () => void): () => void {
  backs.add(cb);
  return () => backs.delete(cb);
}

function away(): void {
  for (const ctx of contexts) void ctx.suspend().catch(() => undefined);
  for (const a of tracks)
    if (!a.paused) {
      a.pause();
      held.add(a);
    }
}

function back(): void {
  for (const ctx of contexts) void ctx.resume().catch(() => undefined);
  for (const a of held) void a.play().catch(() => undefined);
  held.clear();
  for (const cb of backs) cb();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
  // (a page frozen or closed without the visibility changing first)
  window.addEventListener('pagehide', away);
  window.addEventListener('freeze', away);
  window.addEventListener('pageshow', () => !pageAway() && back());
}
