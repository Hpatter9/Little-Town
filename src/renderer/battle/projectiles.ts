// Shots in the air on every battle screen (the owner's ask: arrows flying, spells flying to their targets). The sim
// resolves a shot at once and names what flew (shared/data/projectiles.ts); the views fly it from the shooter to the mark
// over `flightTicks`, and let the blow's number and effect land when it arrives. Stateless: a view gives each frame the
// shot's age and gets the sprite placed (and a trail behind it), so it needs nothing kept between frames. Art is the
// packs' own: arrows, bolts, spears, pebbles and shot from DawnLike's ammunition sheet (items/Ammo.png, 16px a cell,
// drawn pointing up and to the right), and an orb or a bolt of each element from the pixel effects atlas.

import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { ARC, flightTicks, shotParse, type Ammo, type ShotLook } from '../../shared/data/projectiles';
import { pixelFxFrame, pixelFxFrames, pixelFxHas } from '../art/effects';
import { loadImage } from '../art/loadImage';
import ammoUrl from '../art/items/Ammo.png';

/** The cell of the ammunition sheet each kind uses (column, row), and how big it is drawn (px at a scale of one). */
const CELL: Partial<Record<Ammo, { at: [number, number]; size: number }>> = {
  arrow: { at: [0, 2], size: 26 },
  bolt: { at: [1, 4], size: 26 },
  spear: { at: [5, 2], size: 32 },
  stone: { at: [6, 0], size: 16 },
  bullet: { at: [7, 0], size: 14 },
  ball: { at: [5, 0], size: 22 },
};
const cells = new Map<Ammo, Texture>();
let loading: Promise<void> | null = null;
/** Load the ammunition sheet (once; the shots are drawn without it until it is there). */
export function loadShotArt(): Promise<void> {
  loading ??= loadImage(ammoUrl)
    .then((im) => {
      const src = Texture.from(im).source;
      src.scaleMode = 'nearest';
      for (const [k, c] of Object.entries(CELL)) cells.set(k as Ammo, new Texture({ source: src, frame: new Rectangle(c.at[0] * 16, c.at[1] * 16, 16, 16) }));
    })
    .catch(() => undefined);
  return loading;
}

/** An element's orb or bolt strip in the pixel effects atlas, by what it flies as. */
function strip(look: ShotLook): string | null {
  const el = look.el ?? 'star';
  for (const id of look.ammo === 'beam' ? [`${el}-bolt`, 'lightning-bolt'] : [`${el}-orb`, `${el}-bolt`, 'star-orb'] as string[]) if (pixelFxHas(id)) return id;
  return null;
}

/** Whether the shot is a sprite turned to face its way (a missile) or one that tumbles or glows as it goes. */
const turns = (a: Ammo) => a === 'arrow' || a === 'bolt' || a === 'spear';

/** The tiles' px between two points, read as tiles for the flight time (a tile is about this many px across). */
const TILE_PX = 40;

/** A shot's flight in ticks between two points (px), from its kind: a wide board's arrows are in the air longer. */
export function shotTicks(code: string | undefined, from: readonly [number, number], to: readonly [number, number], tilePx = TILE_PX): number {
  return flightTicks(shotParse(code).ammo, Math.hypot(to[0] - from[0], to[1] - from[1]) / tilePx);
}

/** Paints shots into a container: `begin()`, then `put()` for each shot in the air, then `end()`. The sprites are
 *  kept and reused (a frame of many arrows makes no garbage). */
export class ShotPainter {
  readonly container = new Container();
  private pool: Sprite[] = [];
  private used = 0;

  constructor() {
    void loadShotArt();
  }

  begin(): void {
    this.used = 0;
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  private sprite(tex: Texture): Sprite {
    let s = this.pool[this.used];
    if (!s) {
      s = new Sprite(tex);
      s.anchor.set(0.5);
      this.pool.push(s);
      this.container.addChild(s);
    }
    this.used++;
    s.texture = tex;
    s.visible = true;
    s.blendMode = 'normal';
    s.tint = 0xffffff;
    s.alpha = 1;
    s.rotation = 0;
    return s;
  }

  /** One shot at `age` ticks of its `dur`: from and to in px (the sprite's centre), lifted `lift` px off the ground at
   *  both ends. Returns whether it has landed (age at or past `dur`), when nothing is drawn. `scale` sizes it for the
   *  screen (the fight screen's figures are larger than the board's). */
  put(code: string | undefined, from: readonly [number, number], to: readonly [number, number], age: number, dur: number, scale = 1): boolean {
    if (age >= dur) return true;
    if (age < 0) return false;
    const look = shotParse(code);
    const p = age / dur;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dist = Math.hypot(dx, dy);
    const at = (q: number): [number, number] => [from[0] + dx * q, from[1] + dy * q - Math.sin(q * Math.PI) * ARC[look.ammo] * dist];
    // (the way it points: along the curve it flies)
    const [bx, by] = at(Math.max(0, p - 0.04));
    const [fx, fy] = at(Math.min(1, p + 0.04));
    const angle = Math.atan2(fy - by, fx - bx);
    // orbs and bolts of the pixel effects: an animated bright core, and a trail of fainter ones behind
    const id = look.ammo === 'orb' || look.ammo === 'beam' ? strip(look) : null;
    if (id) {
      const n = Math.max(1, pixelFxFrames(id));
      const size = (look.ammo === 'beam' ? 46 : 40) * scale;
      const trail = look.ammo === 'beam' ? 6 : 4;
      for (let k = trail; k >= 0; k--) {
        const q = p - k * 0.05;
        if (q < 0) continue;
        const tex = pixelFxFrame(id, Math.floor((age + k * -0.5) * 1.3 + 100 * n) % n);
        if (!tex) continue;
        const s = this.sprite(tex);
        const [tx, ty] = at(q);
        s.position.set(tx, ty);
        s.width = s.height = size * (1 - k * 0.1);
        s.alpha = k === 0 ? 1 : 0.45 * (1 - k / (trail + 1));
        s.blendMode = 'add';
        if (look.ammo === 'beam') s.rotation = angle;
      }
      return false;
    }
    const tex = cells.get(look.ammo === 'orb' || look.ammo === 'beam' ? 'bullet' : look.ammo);
    if (!tex) return false;
    const c = CELL[look.ammo === 'orb' || look.ammo === 'beam' ? 'bullet' : look.ammo]!;
    // (a faint streak behind: the last few places it was)
    for (let k = look.ammo === 'bullet' ? 3 : 2; k >= 0; k--) {
      const q = p - k * 0.04;
      if (q < 0) continue;
      const s = this.sprite(tex);
      const [tx, ty] = at(q);
      s.position.set(tx, ty);
      s.width = s.height = c.size * scale * (k ? 0.8 : 1);
      if (k) s.alpha = 0.3 / k;
      // (the sheet draws them pointing up and to the right: a quarter-turn of the diagonal)
      s.rotation = turns(look.ammo) ? angle + Math.PI / 4 : (age + k) * 0.6;
    }
    return false;
  }
}
