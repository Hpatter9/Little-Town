// Load an image for drawing. decode() can be refused while a lot of images decode at once (on start-up, on a phone
// short of memory), though the image itself is fine: then wait for it to load the ordinary way instead.
//
// The loading screen (loading/stripLoad.ts) warms the pictures the first view will draw before the town is shown:
// `warmImage` loads one and keeps it, and a later `loadImage` of the same picture is handed the one already loading
// (so the map's own ask finds it ready, and the code-drawn stand-in never shows). Every load is counted
// (`imageTally`), so the loading bar can be honest about what is still on its way.

const warm = new Map<string, Promise<HTMLImageElement>>();
const tally = { asked: 0, done: 0 };

/** How many pictures have been asked for, and how many of those have arrived (or failed: either way, settled). */
export const imageTally = (): { asked: number; done: number } => ({ ...tally });

function fresh(url: string): Promise<HTMLImageElement> {
  tally.asked++;
  const im = new Image();
  const loaded = new Promise<void>((ok, fail) => {
    im.onload = () => ok();
    im.onerror = () => fail(new Error(`image failed to load (${url.slice(0, 40)}…)`));
  });
  im.src = url;
  const p = (async () => {
    try {
      await im.decode();
    } catch {
      if (!im.complete || !im.naturalWidth) await loaded;
    }
    return im;
  })();
  p.then(
    () => tally.done++,
    () => tally.done++,
  );
  return p;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return warm.get(url) ?? fresh(url);
}

/** Load a picture ahead of its first use and keep it, for whoever asks for it next (`loadImage`). */
export function warmImage(url: string): Promise<HTMLImageElement> {
  let p = warm.get(url);
  if (!p) {
    p = fresh(url);
    warm.set(url, p);
    p.catch(() => warm.delete(url)); // (a picture that failed is asked for afresh)
  }
  return p;
}
