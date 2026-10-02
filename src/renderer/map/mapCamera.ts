// A camera over the town's land: drags follow the finger exactly and keep some momentum on release, wheel scrolling
// eases toward a target, and following someone eases to keep them in the middle (unless the player is looking
// round). The view never leaves the land.

const EASE_RATE = 14; // easing, per second
const FRICTION = 5; // momentum decay, per second
const MIN_SPEED = 8; // px/s below which momentum stops

export interface Pt {
  x: number;
  y: number;
}

export class MapCamera {
  /** World position of the screen's top-left corner. */
  x = 0;
  y = 0;
  private target: Pt = { x: 0, y: 0 };
  private velocity: Pt = { x: 0, y: 0 };
  private drag: { start: Pt; startCam: Pt; last: Pt; lastT: number; speed: Pt } | null = null;
  private screen: Pt = { x: 1, y: 1 };
  /** When the player last moved the view themselves (ms, performance.now()): following waits a while after. */
  touchedAt = -Infinity;

  constructor(
    private readonly worldW: number,
    private readonly worldH: number,
  ) {}

  get dragging(): boolean {
    return this.drag !== null;
  }

  /** Ease toward keeping a point in the middle of the view (following someone), unless the player is looking round. */
  follow(p: Pt, screenW: number, screenH: number, now: number, waitMs: number): void {
    if (this.drag || this.velocity.x !== 0 || this.velocity.y !== 0 || now - this.touchedAt < waitMs) return;
    this.screen = { x: screenW, y: screenH };
    this.target = this.clamp({ x: p.x - screenW / 2, y: p.y - screenH / 2 });
  }

  centreOn(p: Pt, screenW: number, screenH: number): void {
    this.screen = { x: screenW, y: screenH };
    const at = this.clamp({ x: p.x - screenW / 2, y: p.y - screenH / 2 });
    this.x = this.target.x = at.x;
    this.y = this.target.y = at.y;
  }

  /** Move the view at once (keeping the middle still while the screen is resized). */
  shift(dx: number, dy: number): void {
    const at = this.clamp({ x: this.x + dx, y: this.y + dy });
    this.x = this.target.x = at.x;
    this.y = this.target.y = at.y;
  }

  scrollBy(dx: number, dy: number): void {
    this.touchedAt = performance.now();
    this.velocity = { x: 0, y: 0 };
    this.target = this.clamp({ x: this.target.x + dx, y: this.target.y + dy });
  }

  beginDrag(sx: number, sy: number, t: number): void {
    this.touchedAt = performance.now();
    this.velocity = { x: 0, y: 0 };
    this.drag = { start: { x: sx, y: sy }, startCam: { x: this.x, y: this.y }, last: { x: sx, y: sy }, lastT: t, speed: { x: 0, y: 0 } };
  }

  dragTo(sx: number, sy: number, t: number): void {
    const d = this.drag;
    if (!d) return;
    const dt = Math.max(1, t - d.lastT) / 1000;
    // smoothed pointer speed, for momentum on release
    d.speed = { x: d.speed.x * 0.6 + (-(sx - d.last.x) / dt) * 0.4, y: d.speed.y * 0.6 + (-(sy - d.last.y) / dt) * 0.4 };
    d.last = { x: sx, y: sy };
    d.lastT = t;
    this.touchedAt = performance.now();
    const at = this.clamp({ x: d.startCam.x - (sx - d.start.x), y: d.startCam.y - (sy - d.start.y) });
    this.x = this.target.x = at.x;
    this.y = this.target.y = at.y;
  }

  endDrag(t: number): void {
    const d = this.drag;
    if (!d) return;
    // a pause before letting go cancels the fling
    this.velocity = t - d.lastT < 80 ? { ...d.speed } : { x: 0, y: 0 };
    this.drag = null;
  }

  /** Advance easing and momentum. Returns true while the camera is still moving. */
  update(dt: number, screenW: number, screenH: number): boolean {
    this.screen = { x: screenW, y: screenH };
    if (this.drag) return true;
    if (this.velocity.x !== 0 || this.velocity.y !== 0) {
      const want = { x: this.target.x + this.velocity.x * dt, y: this.target.y + this.velocity.y * dt };
      this.target = this.clamp(want);
      this.x = this.target.x;
      this.y = this.target.y;
      const decay = Math.exp(-FRICTION * dt);
      this.velocity = { x: this.velocity.x * decay, y: this.velocity.y * decay };
      if (Math.hypot(this.velocity.x, this.velocity.y) < MIN_SPEED || (want.x !== this.target.x && want.y !== this.target.y)) this.velocity = { x: 0, y: 0 };
      if (want.x !== this.target.x) this.velocity.x = 0;
      if (want.y !== this.target.y) this.velocity.y = 0;
      return true;
    }
    this.target = this.clamp(this.target);
    const gx = this.target.x - this.x;
    const gy = this.target.y - this.y;
    if (Math.abs(gx) < 0.5 && Math.abs(gy) < 0.5) {
      this.x = this.target.x;
      this.y = this.target.y;
      return false;
    }
    const k = 1 - Math.exp(-EASE_RATE * dt);
    this.x += gx * k;
    this.y += gy * k;
    return true;
  }

  private clamp(p: Pt): Pt {
    const maxX = this.worldW - this.screen.x;
    const maxY = this.worldH - this.screen.y;
    return { x: maxX <= 0 ? maxX / 2 : Math.max(0, Math.min(maxX, p.x)), y: maxY <= 0 ? maxY / 2 : Math.max(0, Math.min(maxY, p.y)) };
  }
}
