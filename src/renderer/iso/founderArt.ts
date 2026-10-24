// Finds the founder's own looks (folkRules.ts FOUNDER_LOOKS) in the build: each look's index.json is asked for once,
// and a look that's there joins the settlers' drawn looks, so the founder wears it from then on. A build without them
// (or a look not drawn yet) leaves the founder in an everyday look, as before. The URL is relative to the page, as in
// folkLoader.ts and art/folkCanvas.ts. No Pixi here.

import { FOLK_LOOKS, FOUNDER_LOOKS } from './folkRules';

let probe: Promise<boolean> | null = null;

/** Look for the founder's looks (once; every later call gets the same answer). Resolves true if any was found. */
export function findFounderArt(): Promise<boolean> {
  probe ??= Promise.all(
    Object.values(FOUNDER_LOOKS).map((look) =>
      fetch(`iso/folk/settlers/${look}/index.json`).then(
        (r) => r.ok,
        () => false,
      ),
    ),
  ).then((found) => {
    const looks = Object.values(FOUNDER_LOOKS).filter((l, i) => found[i] && !FOLK_LOOKS.settlers.includes(l));
    if (looks.length) FOLK_LOOKS.settlers = [...FOLK_LOOKS.settlers, ...looks];
    return looks.length > 0;
  });
  return probe;
}
