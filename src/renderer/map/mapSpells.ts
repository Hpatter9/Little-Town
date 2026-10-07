// Spells on the top-down map: the town's powers and rival lords' spells (sim/powers.ts, sim/rivals.ts; `snapshot.spells`)
// play their effect sheets from the packs (town/spellsView.ts SHEETS and spellLooks.ts LOOKS: the Pixel Magic, pvfx
// and Alenia sheets) over whoever they touched, or over the caster, each cast ringed with a magic circle on the ground
// under the caster and its name floating up. Targets are followed while the sim still has them (people by id,
// raiders by id); the rest stand where the cast put them (older casts without a land position: the camp's row).

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { SpellView } from '../../shared/sim/snapshot';
import type { SpellTarget } from '../../shared/sim/state';
import { TICK_MS } from '../../shared/sim/time';
import { fontStacks } from '../fonts';
import { currentTheme } from '../theme';
import { LOOKS, type SpriteFx } from '../town/spellLooks';
import { sheetOf } from '../town/spellsView';

const CIRCLE_SECS = 1.3;
const NAME_SECS = 1.9;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const envelope = (t: number, total: number, rise: number, fall: number) => clamp01(Math.min(t / rise, (total - t) / fall));
const lighten = (c: number) => {
  const ch = (sh: number) => Math.min(255, Math.round(((c >> sh) & 255) * 0.6 + 255 * 0.4)) << sh;
  return ch(16) | ch(8) | ch(0);
};

interface Pt {
  x: number;
  y: number;
}
interface Live {
  view: SpellView;
  start: number;
  at: Pt[];
  by: Pt;
  name: Text;
  sprites: Sprite[];
  fx: SpriteFx;
  onCaster: boolean;
}

export class MapSpells {
  private readonly under = new Graphics();
  private readonly glow = new Graphics();
  private readonly live = new Map<number, Live>();
  private camp: Pt = { x: 0, y: 0 };

  /** `whereIs` finds a person or raider now (null once the sim has lost them). */
  constructor(
    private readonly layer: Container,
    private readonly whereIs: (t: SpellTarget) => Pt | null,
  ) {
    this.glow.blendMode = 'add';
    layer.addChild(this.under, this.glow);
  }

  update(spells: readonly SpellView[], camp: Pt, now: number): void {
    this.camp = camp;
    for (const sp of spells) {
      if (this.live.has(sp.n)) continue;
      const look = LOOKS[sp.spell];
      const fx: SpriteFx = look?.sprite ?? 'cast';
      const colour = look?.color ?? 0xf0e0a0;
      const name = new Text({
        text: sp.name,
        style: { fontFamily: fontStacks(currentTheme())[0].replace(/'/g, '').split(', '), fontSize: 11, fontWeight: 'bold', fill: lighten(colour), stroke: { color: 0x10080c, width: 4 } },
        resolution: 3,
      });
      name.anchor.set(0.5, 1);
      this.layer.addChild(name);
      const onCaster = !!look?.onCaster || sp.targets.length === 0;
      const n = onCaster ? 1 : Math.min(4, sp.targets.length);
      const sprites = Array.from({ length: n }, () => {
        const s = this.layer.addChild(new Sprite());
        s.anchor.set(0.5, 1);
        return s;
      });
      this.live.set(sp.n, { view: sp, start: now - sp.since * TICK_MS, at: sp.targets.map((t) => this.place(t)), by: this.place(sp.by ?? { x: sp.x, y: sp.y ?? undefined }), name, sprites, fx, onCaster });
    }
    // follow the caster and whoever it touched
    for (const l of this.live.values()) {
      l.at = l.view.targets.map((t, i) => this.whereIs(t) ?? l.at[i]);
      if (l.view.by) l.by = this.whereIs(l.view.by) ?? l.by;
    }
  }

  private place(t: SpellTarget): Pt {
    return this.whereIs(t) ?? { x: t.x, y: t.y ?? this.camp.y };
  }

  render(now: number): void {
    this.under.clear();
    this.glow.clear();
    for (const [n, l] of this.live) {
      const t = (now - l.start) / 1000;
      const secs = Math.max(l.view.secs, CIRCLE_SECS, NAME_SECS);
      if (t > secs + 0.3) {
        l.name.destroy();
        for (const s of l.sprites) s.destroy();
        this.live.delete(n);
        continue;
      }
      const colour = LOOKS[l.view.spell]?.color ?? 0xf0e0a0;
      this.circle(l, t, colour);
      const a = envelope(t, NAME_SECS, 0.15, 0.6);
      l.name.visible = a > 0.01;
      l.name.alpha = a;
      l.name.position.set(Math.round(l.by.x), Math.round(l.by.y - 54 - t * 8));
      l.name.zIndex = 1e6;
      // the effect sheet over each target (staggered a little), or over the caster
      const sh = sheetOf(l.fx);
      const k = sh.scale ?? 1;
      l.sprites.forEach((sp, i) => {
        const at = l.onCaster ? l.by : (l.at[i] ?? l.by);
        const f = sh.frame((t - i * 0.12) * sh.fps);
        sp.visible = !!f && t - i * 0.12 >= 0;
        if (!f || !sp.visible) return;
        sp.texture = f;
        sp.blendMode = sh.glow ? 'add' : 'normal';
        sp.scale.set(k);
        sp.position.set(Math.round(at.x), Math.round(at.y + sh.foot * k));
      });
    }
  }

  /** The magic circle under the caster: two rings and six runes turning, and a faint column of light. */
  private circle(l: Live, t: number, color: number): void {
    if (t > CIRCLE_SECS) return;
    const a = envelope(t, CIRCLE_SECS, 0.12, 0.4);
    const r = 12 + 6 * clamp01(t * 5);
    const { x: cx, y: cy } = l.by;
    this.under.ellipse(cx, cy, r, r * 0.45).stroke({ width: 1.5, color, alpha: a * 0.9 });
    this.under.ellipse(cx, cy, r * 0.65, r * 0.3).stroke({ width: 1, color, alpha: a * 0.7 });
    for (let k = 0; k < 6; k++) {
      const ang = t * 3 + (k * Math.PI) / 3;
      this.glow.rect(cx + Math.cos(ang) * r * 0.83 - 1, cy + Math.sin(ang) * r * 0.38 - 1, 2, 2).fill({ color, alpha: a });
    }
    this.glow.rect(cx - 5, cy - 40, 10, 40).fill({ color, alpha: a * 0.12 });
    this.glow.rect(cx - 2, cy - 48, 4, 48).fill({ color, alpha: a * 0.18 });
  }
}
