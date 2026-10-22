// The raid screens' juice (the owner's ask: a much flashier battle UI), shared by the tactics board
// (tactics/tacticsView.ts) and the trail battle on the map (main.ts, beside battle/battleHud.ts): impacts from the
// 5000 Pixel Effects pack where blows land, big popping numbers, the screen shaken by heavy blows and kills, kill and
// combo callouts, wave banners sliding across, and a victory flourish of light and confetti. The rules are in
// battle/juiceRules.ts. `world` goes in the scene's own world (moving with its camera), `screen` over everything.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { sheetOf } from '../town/spellsView';
import { reducedMotion } from '../ui/motion';
import { bannerMotion, blowTier, COMBO_WINDOW, comboText, fadePunch, fadeTrauma, HIT_STOP, IMPACT_CAP, killCallout, KILL_PUNCH, KILL_STOP, MULTI_WINDOW, NUMBER_COLOUR, NUMBER_SIZE, popScale, shakeOf, slamScale, SLOWMO_RATE, SLOWMO_SECS, SPARK_CAP, SPARKS, traumaFor, ZOOM_PUNCH } from './juiceRules';

const FONT = 'monospace';
const text = (s: string, size: number, fill: number, stroke = 5) =>
  new Text({ text: s, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: 'bold', stroke: { color: 0x120a06, width: stroke }, dropShadow: { color: 0x000000, alpha: 0.6, distance: 2, blur: 0, angle: Math.PI / 2 } } });

interface Impact { fx: string; x: number; y: number; born: number; scale: number }
interface Ring { x: number; y: number; born: number; col: number; size: number }
interface Num { t: Text; x: number; y: number; born: number; drift: number }
interface Callout { t: Text; born: number; life: number; y: number }
interface Banner { band: Graphics; t: Text; sub: Text | null; born: number; life: number; col: number }
interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; col: number; len: number }
interface Bit { x: number; y: number; vx: number; vy: number; spin: number; a: number; col: number; w: number; h: number }

export interface HitOpts {
  /** What's shown: the harm ("37"), or a word ("Miss"). */
  label: string;
  /** The blow's share of the target's health (0..1). */
  share: number;
  /** It landed on a raider (else on the town's own). */
  onFoe: boolean;
  heal?: boolean;
  kill?: boolean;
  ult?: boolean;
}

export class BattleJuice {
  readonly world = new Container();
  readonly screen = new Container();
  private ringG = new Graphics();
  private fxLayer = new Container();
  private flashG = new Graphics();
  private raysG = new Graphics();
  private bitsG = new Graphics();
  private trauma = 0;
  private flash = 0;
  private impacts: Impact[] = [];
  private rings: Ring[] = [];
  private nums: Num[] = [];
  private callouts: Callout[] = [];
  private banner: Banner | null = null;
  private combo = { n: 0, last: -99, t: null as Text | null, shown: 0 };
  private kills = { n: 0, last: -99 };
  private victory: { born: number; t: Text; sub: Text; won: boolean } | null = null;
  private bits: Bit[] = [];
  private sparks: Spark[] = [];
  private sparkG = new Graphics();
  private now = 0;
  /** The board's clock is held still until this (seconds): the hit-stop; and slowed until `slowUntil`. */
  private stopUntil = 0;
  private slowUntil = 0;
  /** The camera's punch-in (a share of the zoom) and where it aims, in the world's own coordinates. */
  punch = 0;
  focus = { x: 0, y: 0 };
  /** Where the screen's own words sit (below the top bar). */
  top = 64;

  constructor() {
    this.world.addChild(this.ringG, this.fxLayer, this.sparkG);
    this.screen.addChild(this.flashG, this.raysG, this.bitsG);
  }

  /** Seconds since the page began (the clock all of it runs on). */
  private get t(): number {
    return performance.now() / 1000;
  }

  /** A blow landed at world (x, y): its impact, sparks, number, the shake, hit-stop and zoom, and the combo or kill it makes. */
  hit(x: number, y: number, o: HitOpts): void {
    const t = this.t;
    const tier = blowTier(o.share, o.kill, o.ult);
    const heavy = tier !== 'normal';
    const calm = reducedMotion();
    const word = !/^[\d+]/.test(o.label);
    if (!word && !o.heal) {
      if (!calm) this.trauma = Math.min(1, this.trauma + traumaFor(o.share, o.kill, o.ult) * (o.onFoe ? 0.7 : 1));
      this.impact({ fx: o.kill ? 'px:blood-explosion' : heavy ? (o.onFoe ? 'px:gold-burst' : 'px:fire-explosion') : 'px:white-hit', x, y: y - 14, born: t, scale: tier === 'crit' ? 1.9 : heavy ? 1.5 : 1.05 });
      if (tier === 'crit') this.impact({ fx: 'px:white-cross', x, y: y - 14, born: t, scale: 2.2 });
      this.rings.push({ x, y: y - 14, born: t, col: o.onFoe ? (heavy ? NUMBER_COLOUR[tier] : 0xffffff) : 0xff4030, size: tier === 'crit' ? 50 : heavy ? 34 : 20 });
      if (!calm) {
        this.throwSparks(x, y - 14, SPARKS[tier] + (o.kill ? 4 : 0), o.onFoe ? NUMBER_COLOUR[tier] : 0xff5040, t);
        // (hit-stop and the zoom punch: a big blow holds the screen a moment and leans in)
        const stop = HIT_STOP[tier] + (o.kill ? KILL_STOP : 0) + (o.ult ? 0.05 : 0);
        if (stop > 0) this.stopUntil = Math.max(this.stopUntil, t + stop);
        const punch = ZOOM_PUNCH[tier] + (o.kill ? KILL_PUNCH : 0);
        if (punch > this.punch) {
          this.punch = punch;
          this.focus = { x, y: y - 14 };
        }
        if (heavy || o.kill) this.flash = Math.max(this.flash, o.kill || tier === 'crit' ? 0.22 : 0.12);
      }
    }
    if (o.heal) this.impact({ fx: 'px:gold-sparkle', x, y: y - 14, born: t, scale: 1.2 });
    // (the number: big, popped; gold when heavy, orange and biggest when a crit, red when the town's own is hurt, green when mended)
    const size = word ? 15 : o.heal ? 22 : NUMBER_SIZE[tier];
    const col = o.heal ? 0x7cff8a : word ? 0xdddddd : !o.onFoe ? (tier === 'crit' ? 0xff2a20 : 0xff5040) : NUMBER_COLOUR[tier];
    const n = text(`${o.label}${heavy && !word && !o.heal ? (tier === 'crit' ? '!!' : '!') : ''}`, size, col, tier === 'crit' ? 8 : heavy ? 6 : 5);
    n.anchor.set(0.5, 1);
    this.world.addChild(n);
    this.nums.push({ t: n, x, y: y - 36, born: t, drift: (Math.random() - 0.5) * 18 });
    // (the combo: the town's blows on the raiders, close together; the town's own hurt breaks it)
    if (!word && !o.heal) {
      if (o.onFoe) {
        this.combo.n = t - this.combo.last <= COMBO_WINDOW ? this.combo.n + 1 : 1;
        this.combo.last = t;
      } else this.combo.n = 0;
    }
    if (o.kill && o.onFoe) this.killed(1);
  }

  /** An impact sprite, the oldest dropped when too many are alive (the cap keeps a phone smooth). */
  private impact(i: Impact): void {
    this.impacts.push(i);
    if (this.impacts.length > IMPACT_CAP) this.impacts.splice(0, this.impacts.length - IMPACT_CAP);
  }

  /** Sparks flung from a blow, the live ones capped at `SPARK_CAP`. */
  private throwSparks(x: number, y: number, n: number, col: number, t: number): void {
    for (let i = 0; i < n && this.sparks.length < SPARK_CAP; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 110;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, born: t, life: 0.25 + Math.random() * 0.3, col: i % 3 ? col : 0xffffff, len: 3 + Math.random() * 4 });
    }
  }

  /** The speed the board's clock should run at now: 0 in a hit-stop, slow on the final blow, else 1. */
  timeRate(): number {
    const t = this.t;
    return t < this.stopUntil ? 0 : t < this.slowUntil ? SLOWMO_RATE : 1;
  }

  /** The final blow: the board slows to a crawl for a moment (not under reduced motion). */
  slowmo(): void {
    if (reducedMotion()) return;
    this.slowUntil = this.t + SLOWMO_SECS;
    this.punch = Math.max(this.punch, 0.1);
    this.flash = Math.max(this.flash, 0.3);
  }

  /** A jolt of shake (an ultimate let loose). */
  jolt(n: number): void {
    if (reducedMotion()) return;
    this.trauma = Math.min(1, this.trauma + n);
    this.flash = Math.max(this.flash, 0.25);
  }

  /** Raiders fell (when the caller can't tell which blow did it): the multi-kill callouts. */
  killed(n: number): void {
    const t = this.t;
    for (let i = 0; i < n; i++) {
      this.kills.n = t - this.kills.last <= MULTI_WINDOW ? this.kills.n + 1 : 1;
      this.kills.last = t;
    }
    if (!reducedMotion()) this.trauma = Math.min(1, this.trauma + 0.2 * n);
    const say = killCallout(this.kills.n);
    if (say) this.callout(say, this.kills.n >= 5 ? 0xff5030 : 0xffa030);
  }

  /** Big words over the screen, punched in. */
  callout(s: string, col = 0xffa030): void {
    // (one at a time: a newer one takes the place of the last)
    for (const c of this.callouts) c.t.destroy();
    const t = text(s, 36, col, 8);
    t.anchor.set(0.5);
    this.screen.addChild(t);
    this.callouts = [{ t, born: this.t, life: 1.5, y: 0.3 }];
  }

  /** A banner across the screen ("Wave 2 of 4", "Reinforcements!"), slid in and out. */
  showBanner(s: string, sub: string | null = null, col = 0xffe070, life = 2.2): void {
    this.banner?.band.destroy();
    this.banner?.t.destroy();
    this.banner?.sub?.destroy();
    const band = new Graphics();
    const t = text(s, 28, col, 6);
    t.anchor.set(0.5);
    const st = sub ? text(sub, 13, 0xf0e6d0, 4) : null;
    st?.anchor.set(0.5);
    this.screen.addChild(band, t);
    if (st) this.screen.addChild(st);
    this.banner = { band, t, sub: st, born: this.t, life, col };
  }

  /** The fight is won (or lost): a flourish of rays, the word, and confetti. */
  win(won: boolean, sub: string): void {
    if (this.victory) return;
    const t = text(won ? 'VICTORY!' : 'DEFEAT', 46, won ? 0xffd84a : 0xff5040, 8);
    t.anchor.set(0.5);
    const st = text(sub, 15, 0xf6ecd0, 4);
    st.anchor.set(0.5);
    this.screen.addChild(t, st);
    this.victory = { born: this.t, t, sub: st, won };
    if (won) {
      const cols = [0xffd84a, 0xff6a50, 0x6ad0ff, 0x8aff7a, 0xff9ae0, 0xffffff];
      for (let i = 0; i < 90; i++)
        this.bits.push({ x: Math.random(), y: -0.05 - Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.12, vy: 0.18 + Math.random() * 0.25, spin: Math.random() * 6, a: Math.random() * 6, col: cols[i % cols.length], w: 4 + Math.random() * 4, h: 2 + Math.random() * 3 });
      for (let i = 0; i < 6; i++) this.impacts.push({ fx: i % 2 ? 'px:gold-star' : 'px:gold-sparkle', x: Number.NaN, y: i, born: this.t + i * 0.18, scale: 1.6 });
    }
  }

  /** Back to nothing (a new battle). */
  reset(): void {
    for (const n of this.nums) n.t.destroy();
    for (const c of this.callouts) c.t.destroy();
    this.banner?.band.destroy();
    this.banner?.t.destroy();
    this.banner?.sub?.destroy();
    this.victory?.t.destroy();
    this.victory?.sub.destroy();
    this.combo.t?.destroy();
    this.nums = [];
    this.callouts = [];
    this.banner = null;
    this.victory = null;
    this.combo = { n: 0, last: -99, t: null, shown: 0 };
    this.kills = { n: 0, last: -99 };
    this.impacts = [];
    this.rings = [];
    this.bits = [];
    this.sparks = [];
    this.stopUntil = this.slowUntil = this.punch = 0;
    this.trauma = 0;
    this.flash = 0;
  }

  /** The screen's shake now, in px (the caller moves its world by it). */
  shake(): [number, number] {
    const a = reducedMotion() ? 0 : shakeOf(this.trauma);
    if (a < 0.3) return [0, 0];
    const t = performance.now() / 1000;
    return [Math.round(a * Math.sin(t * 71.3) * 0.8 + a * (Math.random() - 0.5) * 0.4), Math.round(a * Math.cos(t * 63.7) * 0.6)];
  }

  render(now: number, w: number, h: number): void {
    const dt = this.now ? Math.min(0.1, (now - this.now) / 1000) : 0;
    this.now = now;
    const t = now / 1000;
    // (the world's bits never smaller on the screen than drawn: a zoomed-out map scales them back up)
    const inv = 1 / Math.min(1, Math.max(0.2, this.world.worldTransform.a || 1));
    this.trauma = fadeTrauma(this.trauma, dt);
    this.punch = fadePunch(this.punch, dt);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    // the impacts: the pack's sheets where blows landed (and the victory's sparkles, on the screen)
    for (const c of this.fxLayer.removeChildren()) c.destroy();
    for (const c of this.screen.children.filter((c) => c.label === 'spark')) c.destroy();
    this.impacts = this.impacts.filter((i) => t - i.born < 1.2);
    for (const i of this.impacts) {
      const age = t - i.born;
      if (age < 0) continue;
      const sh = sheetOf(i.fx);
      const frame = sh?.frame(age * sh.fps);
      if (!frame) continue;
      const s = new Sprite(frame);
      s.anchor.set(0.5);
      const size = sh.size * (sh.scale ?? 1) * i.scale * (Number.isNaN(i.x) ? 1 : inv);
      s.width = s.height = size;
      s.blendMode = 'add';
      if (Number.isNaN(i.x)) {
        // (a victory sparkle: across the word)
        s.label = 'spark';
        s.width = s.height = size * 1.6;
        s.position.set(w / 2 + (i.y - 2.5) * 46, h * 0.36 + Math.sin(i.y * 2.1) * 26);
        this.screen.addChild(s);
      } else {
        s.position.set(i.x, i.y);
        this.fxLayer.addChild(s);
      }
    }
    // sparks flung from the blows: short bright lines under gravity
    this.sparkG.clear();
    this.sparks = this.sparks.filter((p) => t - p.born < p.life);
    for (const p of this.sparks) {
      const age = t - p.born;
      const px = p.x + p.vx * age, py = p.y + p.vy * age + 220 * age * age;
      const vx = p.vx, vy = p.vy + 440 * age;
      const n = Math.hypot(vx, vy) || 1;
      this.sparkG.moveTo(px, py).lineTo(px - (vx / n) * p.len * inv, py - (vy / n) * p.len * inv).stroke({ color: p.col, width: 2 * inv, alpha: 1 - age / p.life });
    }
    // rings of light spreading from each blow
    this.ringG.clear();
    this.rings = this.rings.filter((r) => t - r.born < 0.35);
    for (const r of this.rings) {
      const p = (t - r.born) / 0.35;
      this.ringG.circle(r.x, r.y, (4 + r.size * p) * inv).stroke({ color: r.col, width: (3 * (1 - p) + 1) * inv, alpha: 1 - p });
    }
    // the numbers: popped big, rising, drifting, fading
    this.nums = this.nums.filter((n) => {
      const age = t - n.born;
      if (age > 1.5) {
        n.t.destroy();
        return false;
      }
      n.t.scale.set(popScale(age) * inv);
      n.t.position.set(n.x + n.drift * inv * Math.min(1, age * 2), n.y - (age * 26 + (age < 0.25 ? Math.sin((age / 0.25) * Math.PI) * 12 : 0)) * inv);
      n.t.alpha = age > 1 ? 1 - (age - 1) / 0.5 : 1;
      return true;
    });
    // the flash
    this.flashG.clear();
    if (this.flash > 0) this.flashG.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: this.flash });
    // the callouts
    this.callouts = this.callouts.filter((c) => {
      const age = t - c.born;
      if (age > c.life) {
        c.t.destroy();
        return false;
      }
      c.t.scale.set(slamScale(age) * Math.min(1, (w - 40) / Math.max(1, c.t.width / c.t.scale.x)));
      c.t.position.set(w / 2, this.top + 70 + Math.sin(age * 30) * Math.max(0, 0.2 - age) * 20);
      c.t.alpha = age > c.life - 0.3 ? (c.life - age) / 0.3 : 1;
      c.t.rotation = -0.06 + (age < 0.3 ? Math.sin(age * 90) * 0.05 * (1 - age / 0.3) : 0);
      return true;
    });
    // the combo, down the right
    const comboOn = t - this.combo.last <= COMBO_WINDOW ? comboText(this.combo.n) : null;
    if (comboOn) {
      if (!this.combo.t || this.combo.shown !== this.combo.n) {
        this.combo.t?.destroy();
        this.combo.t = text(comboOn, this.combo.n >= 10 ? 22 : 18, this.combo.n >= 10 ? 0xff6040 : this.combo.n >= 6 ? 0xffb040 : 0xffe070, 5);
        this.combo.t.anchor.set(0, 0.5);
        this.screen.addChild(this.combo.t);
        this.combo.shown = this.combo.n;
      }
      const age = t - this.combo.last;
      this.combo.t.scale.set(popScale(age));
      this.combo.t.position.set(12, this.top + 110);
      this.combo.t.alpha = age > COMBO_WINDOW - 0.5 ? (COMBO_WINDOW - age) / 0.5 : 1;
    } else if (this.combo.t) {
      this.combo.t.destroy();
      this.combo.t = null;
    }
    // the banner
    const b = this.banner;
    if (b) {
      const age = t - b.born;
      if (age > b.life) {
        b.band.destroy();
        b.t.destroy();
        b.sub?.destroy();
        this.banner = null;
      } else {
        const m = bannerMotion(age, b.life);
        const y = h * 0.3;
        const bh = b.sub ? 64 : 48;
        b.band.clear();
        b.band.rect(0, y - bh / 2, w, bh).fill({ color: 0x0a0604, alpha: 0.72 * m.alpha });
        b.band.rect(0, y - bh / 2, w, 2).fill({ color: b.col, alpha: m.alpha });
        b.band.rect(0, y + bh / 2 - 2, w, 2).fill({ color: b.col, alpha: m.alpha });
        // (a streak of light running along the band as it comes in)
        const streak = ((age * 1.6) % 1.4) - 0.2;
        b.band.rect(streak * w, y - bh / 2 + 2, 40, bh - 4).fill({ color: 0xffffff, alpha: 0.12 * m.alpha });
        const fit = Math.min(1, (w - 30) / Math.max(1, b.t.width / b.t.scale.x));
        b.t.scale.set(m.scale * fit * slamScale(age * 1.2) * 0.9);
        b.t.alpha = m.alpha;
        b.t.position.set(w / 2 + m.x * w, y - (b.sub ? 8 : 0));
        if (b.sub) {
          b.sub.alpha = m.alpha;
          b.sub.position.set(w / 2 + m.x * w * 1.2, y + 18);
        }
      }
    }
    // the victory: rays turning behind the word, which pops and breathes; confetti falling
    this.raysG.clear();
    const v = this.victory;
    if (v) {
      const age = t - v.born;
      const a = Math.min(1, age * 3);
      const cx = w / 2, cy = h * 0.36;
      if (v.won) {
        const R = Math.max(w, h);
        for (let i = 0; i < 16; i++) {
          const th = (i / 16) * Math.PI * 2 + age * 0.4;
          this.raysG.poly([cx, cy, cx + Math.cos(th - 0.09) * R, cy + Math.sin(th - 0.09) * R, cx + Math.cos(th + 0.09) * R, cy + Math.sin(th + 0.09) * R]).fill({ color: 0xffe080, alpha: 0.13 * a });
        }
        this.raysG.circle(cx, cy, 70 + Math.sin(age * 4) * 6).fill({ color: 0xfff0b0, alpha: 0.18 * a });
      } else this.raysG.rect(0, 0, w, h).fill({ color: 0x300000, alpha: 0.3 * a });
      const fit = Math.min(1, (w - 30) / Math.max(1, v.t.width / v.t.scale.x));
      v.t.scale.set(popScale(age) * fit * (1 + Math.sin(age * 3) * 0.03));
      v.t.position.set(cx, cy);
      v.t.alpha = a;
      v.sub.position.set(cx, cy + 40);
      v.sub.alpha = Math.max(0, Math.min(1, (age - 0.4) * 3));
    }
    this.bitsG.clear();
    this.bits = this.bits.filter((p) => p.y < 1.1);
    for (const p of this.bits) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.spin * dt;
      const wd = Math.abs(Math.cos(p.a)) * p.w + 1;
      this.bitsG.rect(p.x * w - wd / 2, p.y * h, wd, p.h).fill({ color: p.col });
    }
  }
}
