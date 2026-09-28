// Horizontal camera over the town: wheel scrolling eases toward a target, drag follows the pointer
// exactly and keeps some momentum on release.

const EASE_RATE = 14; // wheel easing, per second
const FRICTION = 5; // momentum decay, per second
const MIN_SPEED = 8; // px/s below which momentum stops

export class Camera {
  /** World x of the screen's left edge. */
  x = 0;
  private target = 0;
  private velocity = 0;
  private drag: { startX: number; startCam: number; lastX: number; lastT: number; speed: number } | null = null;
  private screenW = 1;

  constructor(private readonly worldWidth: number) {}

  get dragging(): boolean {
    return this.drag !== null;
  }

  centreOn(worldX: number, screenW: number): void {
    this.screenW = screenW;
    this.x = this.target = this.clamp(worldX - screenW / 2);
  }

  /** Move the view at once (keeping the middle of the view still while the screen is resized, as when zooming). */
  shift(dx: number): void {
    this.x = this.target = this.clamp(this.x + dx);
  }

  scrollBy(dx: number): void {
    this.velocity = 0;
    this.target = this.clamp(this.target + dx);
  }

  beginDrag(screenX: number, t: number): void {
    this.velocity = 0;
    this.drag = { startX: screenX, startCam: this.x, lastX: screenX, lastT: t, speed: 0 };
  }

  dragTo(screenX: number, t: number): void {
    const d = this.drag;
    if (!d) return;
    const dt = Math.max(1, t - d.lastT) / 1000;
    // smoothed pointer speed, for momentum on release
    d.speed = d.speed * 0.6 + (-(screenX - d.lastX) / dt) * 0.4;
    d.lastX = screenX;
    d.lastT = t;
    this.x = this.target = this.clamp(d.startCam - (screenX - d.startX));
  }

  endDrag(t: number): void {
    const d = this.drag;
    if (!d) return;
    // a pause before letting go cancels the fling
    this.velocity = t - d.lastT < 80 ? d.speed : 0;
    this.drag = null;
  }

  /** Advance easing and momentum. Returns true while the camera is still moving. */
  update(dt: number, screenW: number): boolean {
    this.screenW = screenW;
    if (this.drag) return true;
    if (this.velocity !== 0) {
      this.target = this.clamp(this.target + this.velocity * dt);
      this.x = this.target;
      this.velocity *= Math.exp(-FRICTION * dt);
      if (Math.abs(this.velocity) < MIN_SPEED || this.target === this.clamp(this.target + Math.sign(this.velocity))) this.velocity = 0;
      return true;
    }
    this.target = this.clamp(this.target);
    const gap = this.target - this.x;
    if (Math.abs(gap) < 0.5) {
      this.x = this.target;
      return false;
    }
    this.x += gap * (1 - Math.exp(-EASE_RATE * dt));
    return true;
  }

  private clamp(x: number): number {
    const max = this.worldWidth - this.screenW;
    if (max <= 0) return max / 2;
    return Math.max(0, Math.min(max, x));
  }
}
