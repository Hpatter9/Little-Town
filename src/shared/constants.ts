// Layout of the strip and the world grid. All values are in CSS (DIP) pixels.

/** Height of the overlay strip in full view. */
export const STRIP_HEIGHT = 200;
/** Height of the strip in minimal (slim ticker) mode. */
export const TICKER_HEIGHT = 32;

/** Pop-up panels rise above the strip at its tab-button end. */
export const PANEL_WIDTH = 560;
export const PANEL_HEIGHT = 440;

/** Width of one building tile in the foreground and midground (in world pixels). */
export const TILE = 32;

/** Number of tile columns in the town world. */
export const WORLD_TILES = 96; // (the land's width in cells: sim/land.ts LAND_W)
export const WORLD_WIDTH = WORLD_TILES * TILE;

/** Background layer is drawn at this scale and scrolls at this parallax rate. */
export const BACK_SCALE = 0.6;

/**
 * Extra background columns beyond each end of the world. The background scrolls slower than the town,
 * so at the ends of the world it shows land beyond the town's edges (enough for a 4K-wide monitor).
 */
export const BACK_PAD_TILES = 48;

/** Tiles on each side of the camp that start already cleared. */
export const CAMP_CLEAR_RADIUS = 8;

// Screen y (from the top of the strip) of each layer's ground line.
export const BACK_GROUND_Y = 146;
export const MID_GROUND_Y = 170;
export const FORE_TOP_Y = 172;
