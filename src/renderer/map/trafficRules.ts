// Where a cart on the road goes next (map/roadTraffic.ts). Pure, so it is tested.

/** The next road cell from `at` (four ways, never straight back to `from`), picked by `r` (0..1); null at a dead end. */
export function nextRoadCell(road: (x: number, y: number) => boolean, at: { x: number; y: number }, from: { x: number; y: number } | null, r: number): { x: number; y: number } | null {
  const ways = [
    { x: at.x + 1, y: at.y },
    { x: at.x - 1, y: at.y },
    { x: at.x, y: at.y + 1 },
    { x: at.x, y: at.y - 1 },
  ].filter((c) => road(c.x, c.y) && !(from && c.x === from.x && c.y === from.y));
  if (!ways.length) return null;
  // (straight on is likeliest, as carts go)
  if (from) {
    const straight = ways.find((c) => c.x - at.x === at.x - from.x && c.y - at.y === at.y - from.y);
    if (straight && r < 0.7) return straight;
  }
  return ways[Math.floor(r * ways.length) % ways.length];
}
