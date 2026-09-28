// Load an image for drawing. decode() can be refused while a lot of images decode at once (on start-up, on a phone
// short of memory), though the image itself is fine: then wait for it to load the ordinary way instead.

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const im = new Image();
  const loaded = new Promise<void>((ok, fail) => {
    im.onload = () => ok();
    im.onerror = () => fail(new Error(`image failed to load (${url.slice(0, 40)}…)`));
  });
  im.src = url;
  try {
    await im.decode();
  } catch {
    if (!im.complete || !im.naturalWidth) await loaded;
  }
  return im;
}
