// The game's logo (the owner's ask: "have a game logo"), drawn on a canvas from the packs and the game's own type:
// behind, the emblem: the sun's arc from the top bar (ui/topBar.ts) over a skyline of the town's own timber houses
// (Craftpix's Village tileset, as the map draws them) behind a palisade of the ring wall's stakes, the seat's banner
// on the hall; in front, the words "Chronos Settlement" in the town's display face (Alegreya SC) in the UI's gold, on
// the carved wood of the frame set (ui/art, from 0.133.0). The still layers are drawn once and kept; the life (the sun
// creeping along its arc, the windows lit, a shimmer on the gold) is laid over them a beat at a time. The square mark
// (the emblem on a wood plaque) is the phone's home-screen icon (tools/compose-logo.cjs) and the New Town screen's.
// DOM only, no Pixi: it's in the loading screen's own small script (mobile/loading.ts).

/** The pack pieces, as files beside the page (copied into loading/ by tools/build-web.mjs). */
export const PIECE_FILES = {
  house1: 'house1.png',
  house2: 'house2.png',
  house4: 'house4.png',
  stakes: 'palisade04.png',
  flag: 'flag.png',
  gui: 'gui0.png',
  wood: 'wood.png',
  stone: 'stone.png',
  tent: 'tent2.png',
  camp: 'tent.png',
  soil: 'soil01.png',
  goat: 'goat.png',
  firepit: 'firepit.png',
  flame: 'flame.png',
  log: 'log.png',
} as const;
export type PieceName = keyof typeof PIECE_FILES;
export type Pieces = Partial<Record<PieceName, HTMLImageElement>>;

/** Load the pieces from `base` (each one that fails is simply left out). */
export async function loadPieces(base: string): Promise<Pieces> {
  const out: Pieces = {};
  await Promise.all(
    (Object.keys(PIECE_FILES) as PieceName[]).map(
      (k) =>
        new Promise<void>((done) => {
          const im = new Image();
          im.onload = () => ((out[k] = im), done());
          im.onerror = () => done();
          im.src = `${base}${PIECE_FILES[k]}`;
        }),
    ),
  );
  return out;
}

/** The logo's art space (art px): the emblem over the words. */
export const LOGO_W = 480;
export const LOGO_H = 340;
/** The UI's gold (the headings' and the bubble's, ui/uiCss.ts), light to dark, and the ink it's edged in. */
const GOLD = ['#fbeec0', '#e8c88a', '#c8902e', '#8a5a1c'];
const INK = '#1e130a';
/** The display face (fonts.ts: the town's look). */
export const DISPLAY_FONT = "'Alegreya SC', 'Alegreya', Georgia, serif";

/** The arc the sun travels (art px). */
const ARC = { x: 240, y: 236, r: 196 };
/** The windows of the houses (source px, from map/packBuildings.ts `lamps`). */
const LAMPS: Partial<Record<PieceName, [number, number][]>> = {
  house1: [[81, 51], [39, 85], [81, 85]],
  house2: [[80, 74], [110, 74], [132, 74], [37, 106], [80, 106]],
  house4: [[97, 87], [114, 122]],
};
/** Where each house stands in the skyline: its left edge and the foot of it (art px). */
const SKYLINE: [PieceName, number, number][] = [
  ['house1', 70, 244],
  ['house2', 258, 244],
  ['house4', 163, 250],
];

/** A carved-wood plaque: the frame set's wood piece, nine-sliced to a size, at `k` art px to its px. */
function plaque(g: CanvasRenderingContext2D, wood: HTMLImageElement, x: number, y: number, w: number, h: number, k = 2): void {
  const c = 9;
  const sw = wood.naturalWidth;
  const sh = wood.naturalHeight;
  const ck = c * k;
  const cols: [number, number, number, number][] = [
    [0, c, x, ck],
    [c, sw - 2 * c, x + ck, w - 2 * ck],
    [sw - c, c, x + w - ck, ck],
  ];
  const rows: [number, number, number, number][] = [
    [0, c, y, ck],
    [c, sh - 2 * c, y + ck, h - 2 * ck],
    [sh - c, c, y + h - ck, ck],
  ];
  for (const [sx, sW, dx, dW] of cols) for (const [sy, sH, dy, dH] of rows) g.drawImage(wood, sx, sy, sW, sH, dx, dy, dW, dH);
}

/** The still part of the emblem (art space): the arc and its hours, the houses, the stakes and the banner. */
function drawEmblemStill(g: CanvasRenderingContext2D, P: Pieces): void {
  g.imageSmoothingEnabled = false;
  // (the arc: an inked line with a gold one on it, and a tick at each hour)
  g.lineCap = 'round';
  for (const [w, c] of [
    [7, INK],
    [3, GOLD[2]],
    [1, GOLD[0]],
  ] as const) {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.arc(ARC.x, ARC.y, ARC.r, Math.PI, 0);
    g.stroke();
  }
  for (let h = 1; h < 12; h++) {
    const a = Math.PI + (h / 12) * Math.PI;
    const big = h % 3 === 0;
    const r0 = ARC.r - (big ? 10 : 6);
    g.strokeStyle = INK;
    g.lineWidth = big ? 5 : 4;
    g.beginPath();
    g.moveTo(ARC.x + Math.cos(a) * r0, ARC.y + Math.sin(a) * r0);
    g.lineTo(ARC.x + Math.cos(a) * ARC.r, ARC.y + Math.sin(a) * ARC.r);
    g.stroke();
    g.strokeStyle = GOLD[1];
    g.lineWidth = big ? 2 : 1.5;
    g.stroke();
  }
  // (the town: the seat's hall in front, a cottage and the row houses either side)
  for (const [k, x, foot] of SKYLINE) {
    const im = P[k];
    if (im) g.drawImage(im, x, foot - im.naturalHeight);
  }
  if (P.flag) g.drawImage(P.flag, 0, 0, 32, 64, 300, 104, 32, 64);
  // (the ring wall's stakes along the front)
  if (P.stakes) for (let x = 24; x < LOGO_W - 40; x += 30) g.drawImage(P.stakes, x, 222);
}

/** The words, on a wood plaque, in gold edged with ink (art space; `k` the canvas px to an art px, for crisp type). */
function drawWords(g: CanvasRenderingContext2D, P: Pieces, k: number, shimmer: number | null): void {
  const top = 252;
  if (P.wood) {
    g.imageSmoothingEnabled = false;
    plaque(g, P.wood, 34, top, LOGO_W - 68, 84);
  }
  g.save();
  g.scale(1 / k, 1 / k);
  const text = (s: string, size: number, y: number, track: number) => {
    g.font = `700 ${size * k}px ${DISPLAY_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${track * k}px`;
    const x = (LOGO_W / 2) * k;
    const yy = y * k;
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 5 * k;
    g.strokeText(s, x, yy);
    const grad = g.createLinearGradient(0, yy - size * 0.8 * k, 0, yy);
    grad.addColorStop(0, GOLD[0]);
    grad.addColorStop(0.45, GOLD[1]);
    grad.addColorStop(0.8, GOLD[2]);
    grad.addColorStop(1, GOLD[3]);
    g.fillStyle = grad;
    g.fillText(s, x, yy);
    // (the shimmer: a pale band passing over the gold, a step a beat)
    if (shimmer !== null) {
      const w = g.measureText(s).width;
      const sx = x - w / 2 + shimmer * w;
      const band = g.createLinearGradient(sx - 30 * k, 0, sx + 30 * k, 0);
      band.addColorStop(0, 'rgba(255,250,225,0)');
      band.addColorStop(0.5, 'rgba(255,250,225,0.75)');
      band.addColorStop(1, 'rgba(255,250,225,0)');
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = band;
      g.fillText(s, x, yy);
      g.restore();
    }
  };
  text('Chronos', 52, top + 48, 3);
  text('Settlement', 25, top + 74, 7);
  g.restore();
}

/** The sun on its arc (0 rising .. 1 setting), as the top bar has it: the GUI sheet's sun mark, three times over. */
function drawSun(g: CanvasRenderingContext2D, P: Pieces, at: number, glow: number): void {
  const a = Math.PI + Math.max(0, Math.min(1, at)) * Math.PI;
  const x = ARC.x + Math.cos(a) * ARC.r;
  const y = ARC.y + Math.sin(a) * ARC.r;
  const halo = g.createRadialGradient(x, y, 2, x, y, 30 + glow * 6);
  halo.addColorStop(0, 'rgba(255,226,140,0.9)');
  halo.addColorStop(0.4, 'rgba(255,196,90,0.35)');
  halo.addColorStop(1, 'rgba(255,196,90,0)');
  g.fillStyle = halo;
  g.fillRect(x - 40, y - 40, 80, 80);
  g.imageSmoothingEnabled = false;
  if (P.gui) g.drawImage(P.gui, 80, 80, 16, 16, Math.round(x - 24), Math.round(y - 24), 48, 48);
}

/** The windows' glow: `lit` of the houses' windows, in order (art space). */
function drawWindows(g: CanvasRenderingContext2D, lit: number, flicker: number): void {
  let n = 0;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [k, x, foot] of SKYLINE) {
    const h = k === 'house1' ? 112 : k === 'house2' ? 135 : 149;
    for (const [lx, ly] of LAMPS[k] ?? []) {
      if (n++ >= lit) break;
      const cx = x + lx;
      const cy = foot - h + ly;
      const r = 13 + ((n + flicker) % 3);
      const glow = g.createRadialGradient(cx, cy, 1, cx, cy, r);
      glow.addColorStop(0, 'rgba(255,214,120,0.85)');
      glow.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = glow;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  g.restore();
}
/** How many windows the skyline has. */
export const WINDOWS = SKYLINE.reduce((n, [k]) => n + (LAMPS[k]?.length ?? 0), 0);

/** The logo, kept: its still layers drawn once at a size, the life laid over them a beat at a time. */
export class Logo {
  readonly canvas = document.createElement('canvas');
  private still: HTMLCanvasElement | null = null;
  private k = 1;

  constructor(private readonly P: Pieces) {}

  /** Size it to `cssW` CSS px wide (the art's pixels land on whole screen pixels where they can). */
  size(cssW: number, dpr: number): void {
    const want = (cssW * dpr) / LOGO_W;
    const k = want >= 1 ? Math.floor(want * 2) / 2 : want;
    if (k === this.k && this.still) return;
    this.k = k;
    this.canvas.width = Math.round(LOGO_W * k);
    this.canvas.height = Math.round(LOGO_H * k);
    this.canvas.style.width = `${this.canvas.width / dpr}px`;
    this.canvas.style.height = `${this.canvas.height / dpr}px`;
    const s = document.createElement('canvas');
    s.width = this.canvas.width;
    s.height = this.canvas.height;
    const g = s.getContext('2d')!;
    g.scale(k, k);
    g.imageSmoothingEnabled = k < 1;
    drawEmblemStill(g, this.P);
    this.still = s;
  }

  /** One beat: the sun at `sun` (0..1) along its arc, `lit` windows, the shimmer's place (null: none). */
  draw(sun: number, lit: number, shimmer: number | null, beat: number): void {
    if (!this.still) return;
    const g = this.canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.scale(this.k, this.k);
    drawSun(g, this.P, sun, beat % 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.still, 0, 0);
    g.scale(this.k, this.k);
    drawWindows(g, lit, beat);
    drawWords(g, this.P, this.k, shimmer);
  }
}

/** The square mark: the emblem on a wood plaque, the sun high, every window lit (the icon, the New Town screen). */
export function drawMark(P: Pieces, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const k = size / 512;
  g.scale(k, k);
  g.imageSmoothingEnabled = k < 1;
  // (a night sky inside the carved frame)
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#16203f');
  sky.addColorStop(0.6, '#3a2a3a');
  sky.addColorStop(1, '#5a3a24');
  if (P.wood) plaque(g, P.wood, 0, 0, 512, 512, 3);
  g.fillStyle = sky;
  g.fillRect(27, 27, 458, 458);
  // (the ground below the stakes)
  g.fillStyle = '#2a1d12';
  g.fillRect(27, 392, 458, 93);
  // (the emblem in the middle: the arc's top to the stakes' foot)
  g.save();
  g.beginPath();
  g.rect(27, 27, 458, 458);
  g.clip();
  g.translate(256 - ARC.x * 1.15, 106);
  g.scale(1.15, 1.15);
  drawSun(g, P, 0.62, 0);
  drawEmblemStill(g, P);
  drawWindows(g, WINDOWS, 0);
  g.restore();
  return c;
}
