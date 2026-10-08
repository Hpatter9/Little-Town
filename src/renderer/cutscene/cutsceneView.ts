// Playing a cutscene (data/cutscenes.ts; queued by sim/cutscenes.ts; the clock in sceneClock.ts). In the strip, over
// everything, like the fight screen: a painted backdrop from the packs (its layers drifting at their own pace as the
// camera pans), the actors on the stage (townsfolk as the map dresses them, foes from their sheets, bigger where the
// script says), the camera moving, cutting, pushing in and tilting as each shot asks, the effects over it (a flash, a
// fade, lightning, a red pall, a shake, a spell's sheet bursting over someone). In the page round it (DOM): the black
// bars of a film, a chapter card, the subtitles (the speaker's name over their line, typed out), Skip in the corner; a
// tap anywhere moves to the next line. Before it plays, a card offers it: Watch or Skip.

import { Container, Graphics, Sprite, TilingSprite, type Texture } from 'pixi.js';
import { CUTSCENES, FEET, fillLine, STAGE_H, STAGE_W, type Cutscene, type Shot } from '../../shared/data/cutscenes';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import type { BackdropId } from '../../shared/data/backdrops';
import { TOWN_BY_ERA } from '../../shared/data/eventScenes';
import type { Era } from '../../shared/data/eras';
import type { SceneView } from '../../shared/sim/snapshot';
import type { Command } from '../../shared/sim/commands';
import { BACKDROP_H, loadBackdrop } from '../art/backdropImages';
import { GROUND_OF, groundFilter, loadGround } from '../art/fightGround';
import { creatureFlip, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { stillTexture } from '../art/stills';
import { machineFrame, machineSize } from '../art/machines';
import { hkLayers, hkPose, hkWhoById, hkWhoOfLook } from '../art/hkFolk';
import { hkSprite } from '../art/hkTexture';
import { enemyLook } from '../art/rivals';
import { lookFilter } from '../fight/fightView';
import { glowTexture } from '../town/layer';
import { sheetOf } from '../town/spellsView';
import { actorsAt, cameraAt, lineNow, lookAt, next, shotLength, start, tick, TYPE_RATE, typedChars, type ActorNow, type Cursor } from './sceneClock';

/** A townsperson's height on the stage (art px), and how big a foe's sheet is drawn (as on the fight screen). */
const PERSON_H = 40;
const FOE_K = 1.0;
/** The bars of a film, as shares of the screen's height: thin at the top, deep at the foot for the subtitles. */
const BAR_TOP = 0.07;
const BAR_FOOT = { upright: 0.2, side: 0.17 } as const;
/** Held upright, the picture is this tall for its width. */
const UPRIGHT_FRAME = 1.05;

export class CutsceneScene {
  readonly root = new Container();
  private readonly cover = new Graphics();
  private readonly world = new Container();
  private readonly back = new Container();
  private photo: TilingSprite[] = [];
  private readonly ground = new TilingSprite({ width: STAGE_W * 4, height: 40 });
  private readonly actors = new Container();
  private readonly bursts = new Container();
  private readonly veil = new Graphics();
  private readonly glow = new Sprite(glowTexture());
  private readonly sprites = new Map<string, Sprite>();
  private lookKey = '';
  private w = 1;
  private h = 1;
  private bandTop = 0;
  private bandH = 1;

  /** The scene playing, where its clock stands, and the words its lines are filled with. */
  private run: SceneView | null = null;
  private script: Cutscene | null = null;
  private cursor: Cursor | null = null;
  private era: Era = 'neolithic';
  private readonly hud: Hud;

  constructor(
    private readonly send: (c: Command) => void,
    page: HTMLElement,
  ) {
    this.root.visible = false;
    this.ground.visible = false;
    this.ground.y = FEET - 8;
    this.ground.x = -STAGE_W * 1.5;
    this.world.addChild(this.back, this.ground, this.actors, this.bursts);
    this.actors.sortableChildren = true;
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.root.addChild(this.cover, this.world, this.glow, this.veil);
    this.hud = new Hud(page, {
      watch: (key) => this.send({ type: 'scene', op: 'watch', key }),
      skipOffer: (key) => this.send({ type: 'scene', op: 'skip', key }),
      tap: () => this.tap(),
      skip: () => this.finish(false),
    });
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Per snapshot: the scene waiting (offered) or playing, and the town's age (its own backdrop). `quiet`: a battle,
   *  a watched fight or a question has the screen, so nothing is offered meanwhile. */
  update(v: SceneView | null, era: Era, quiet: boolean): void {
    this.era = era;
    this.hud.offer(v && !v.playing && !quiet ? v : null);
    if (v?.playing) {
      if (this.run?.key !== v.key) {
        this.run = v;
        this.script = CUTSCENES[v.id] ?? null;
        this.cursor = start();
        this.clear();
      }
    } else if (this.run) {
      this.run = null;
      this.script = null;
      this.cursor = null;
      this.clear();
    }
    this.root.visible = !!this.script;
    this.hud.playing(!!this.script);
  }

  private clear(): void {
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    this.bursts.removeChildren();
    this.lookKey = '';
  }

  /** A tap: the line typed out in full, else the next line or shot. */
  private tap(): void {
    if (!this.script || !this.cursor) return;
    const line = lineNow(this.cursor, this.script);
    const text = line ? this.fill(line.text) : '';
    if (line && typedChars(text, this.cursor.t) < text.length) {
      // (still typing: the line shown whole, the beat going on from there)
      const t = text.length / TYPE_RATE;
      this.cursor = { ...this.cursor, shotT: this.cursor.shotT + (t - this.cursor.t), t };
      return;
    }
    const n = next(this.cursor, this.script);
    if (!n) return this.finish(true);
    this.cursor = n;
  }

  /** The scene is over: played through (`watched`), or skipped. */
  private finish(watched: boolean): void {
    if (!this.run) return;
    this.send({ type: 'scene', op: watched ? 'done' : 'skip', key: this.run.key });
    this.run = null;
    this.script = null;
    this.cursor = null;
    this.root.visible = false;
    this.hud.playing(false);
    this.clear();
  }

  private fill(text: string): string {
    return fillLine(text, this.run?.vars ?? {});
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const upright = h > w;
    const top = Math.round(h * BAR_TOP);
    const foot = Math.round(h * BAR_FOOT[upright ? 'upright' : 'side']);
    // (held upright, the picture is a near-square in the middle, as a film on a phone; the bars take the rest)
    const room = h - top - foot;
    this.bandH = upright ? Math.min(room, Math.round(w * UPRIGHT_FRAME)) : room;
    this.bandTop = top + Math.round((room - this.bandH) * 0.4);
    this.cover.clear().rect(0, 0, w, h).fill(0x000000);
  }

  render(now: number, dt: number): void {
    const script = this.script;
    if (!script || !this.cursor || !this.run) return;
    const moved = tick(this.cursor, script, dt);
    if (!moved) return this.finish(true);
    this.cursor = moved;
    const c = this.cursor;
    const shot = script.shots[c.shot];
    this.setLook(lookAt(script, c.shot));
    const actors = actorsAt(script, c);
    const cam = cameraAt(script, c, actors);
    // the camera: the stage scaled so the band holds its height (and its width, sideways), then the shot's zoom
    const base = Math.max(this.w / STAGE_W, this.bandH / STAGE_H);
    const k = base * cam.zoom;
    const halfH = this.bandH / 2 / k;
    const y = halfH * 2 >= STAGE_H ? STAGE_H / 2 : Math.max(halfH, Math.min(STAGE_H - halfH, cam.y));
    this.world.scale.set(k);
    this.world.pivot.set(cam.x, y);
    this.world.rotation = cam.tilt;
    let sx = 0;
    let sy = 0;
    const fx = shot.fx ?? [];
    if (fx.includes('shake') && c.shotT < 0.9) {
      const a = (1 - c.shotT / 0.9) * 7;
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    if (fx.includes('rumble')) {
      sx += Math.sin(now / 37) * 1.6;
      sy += Math.cos(now / 29) * 1.2;
    }
    this.world.position.set(this.w / 2 + sx, this.bandTop + this.bandH / 2 + sy);
    // (the layers drift at their own pace as the camera pans: far ones slower)
    this.photo.forEach((l, i) => (l.tilePosition.x = cam.x * (1 - (i + 1) / this.photo.length) * 0.6));
    this.drawActors(actors, now, c);
    this.drawBursts(shot, actors, c.shotT);
    this.drawVeil(shot, c.shotT, now);
    // the words
    const line = lineNow(c, script);
    const speaker = line ? (line.who === 'narrator' ? null : (this.run.cast[line.who]?.name ?? cap(line.who))) : null;
    this.hud.line(line ? { who: speaker, text: this.fill(line.text).slice(0, typedChars(this.fill(line.text), c.t)), tone: line.tone ?? null } : null);
    this.hud.caption(shot.caption && c.shotT < 4 ? this.fill(shot.caption) : null, c.shotT);
    // (the band between the bars, for the HUD to lay out by)
    this.hud.layout(this.bandTop, this.h - this.bandTop - this.bandH);
  }

  /** The backdrop: a painted one by id, or the town's own for its age. */
  private setLook(look: string): void {
    const pool = TOWN_BY_ERA[this.era] ?? TOWN_BY_ERA.neolithic;
    const id = (look === 'town' ? pool[(this.run?.key ?? 0) % pool.length] : look) as BackdropId;
    if (id === this.lookKey) return;
    this.lookKey = id;
    for (const l of this.photo) l.destroy();
    this.photo = [];
    this.ground.visible = false;
    const g = GROUND_OF[id];
    Promise.all([loadBackdrop(id), g ? loadGround(g.kind).catch(() => null) : null])
      .then(([textures, tile]) => {
        if (this.lookKey !== id) return;
        const s = STAGE_H / BACKDROP_H;
        this.photo = textures.map((t: Texture) => {
          const l = new TilingSprite({ texture: t, width: STAGE_W * 4, height: STAGE_H });
          l.tileScale.set(s);
          l.x = -STAGE_W * 1.5;
          return l;
        });
        this.back.addChild(...this.photo);
        if (g && tile) {
          this.ground.texture = tile;
          const f = groundFilter(g);
          this.ground.filters = f ? [f] : [];
          this.ground.height = STAGE_H - FEET + 8;
          this.ground.visible = true;
        }
      })
      .catch(() => undefined);
  }

  private drawActors(actors: Record<string, ActorNow>, now: number, c: Cursor): void {
    const script = this.script!;
    const speaking = lineNow(c, script)?.who;
    for (const [id, a] of Object.entries(actors)) {
      let s = this.sprites.get(id);
      if (!s) {
        s = this.actors.addChild(new Sprite());
        this.sprites.set(id, s);
      }
      const who = this.run!.cast[id];
      s.visible = a.visible && !!who;
      if (!s.visible || !who) continue;
      const scale = script.cast[id]?.scale ?? 1;
      // (whoever is speaking breathes a little)
      const bob = speaking === id && a.pose !== 'down' ? Math.round(Math.sin(now / 160)) : 0;
      if (who.foe) this.drawFoe(s, who.foe, a, now, scale, bob);
      else if (who.look) {
        const keys = hkLayers(hkWhoById(who.person ?? 0, who.look, who.gear), { fighting: a.pose === 'strike' || a.pose === 'cast', activity: 'idle' });
        const [col, row] = hkPose({
          facing: a.facing,
          moving: a.walking,
          walked: a.walked,
          working: a.pose === 'cheer',
          sinceBlow: a.pose === 'strike' || a.pose === 'cast' ? (now / 100) % 14 : 999,
          sinceHit: 999,
          down: a.pose === 'kneel' || a.pose === 'down',
          ranged: a.pose === 'cast',
          now,
        });
        if (!hkSprite(s, keys, col, row, a.x, FEET - bob, PERSON_H * scale)) s.visible = false;
        s.filters = [];
        s.tint = 0xffffff;
      }
      s.zIndex = FEET + (who.foe ? -1 : 0);
    }
  }

  /** A foe as the fight screen draws it: from its creature sheet, a still, a machine, or a person in its people's dress. */
  private drawFoe(s: Sprite, foe: string, a: ActorNow, now: number, scale: number, bob: number): void {
    const unit = ENEMIES[foe];
    if (!unit) {
      s.visible = false;
      return;
    }
    const filter = unit.look ? lookFilter(unit.look) : null;
    if ((s.filters?.[0] ?? null) !== filter) s.filters = filter ? [filter] : [];
    s.tint = unit.tint ?? 0xffffff;
    const acting = a.pose === 'strike' || a.pose === 'cast';
    const down = a.pose === 'down' || a.pose === 'kneel';
    const x = a.x;
    const y = FEET - bob;
    if ('sheet' in unit.sprite) {
      const sp = unit.sprite as { sheet: CreatureSheet; block: number; scale: number };
      s.anchor.set(0);
      s.texture = creatureFrame(sp.sheet, sp.block, a.facing, down ? 1 : Math.floor(now / 160), acting, down ? 'dead' : acting ? undefined : a.walking ? undefined : 'idle');
      const size = creatureSize(sp.sheet);
      const flip = creatureFlip(sp.sheet, a.facing);
      const k = sp.scale * FOE_K * scale;
      s.scale.set(k * flip, k);
      s.position.set(Math.round(x - ((size.w * k) / 2) * flip), Math.round(y - size.h * k));
      return;
    }
    if ('still' in unit.sprite) {
      const st = unit.sprite as StillSprite;
      s.anchor.set(0);
      s.texture = stillTexture(st.still);
      const k = st.scale * FOE_K * 1.3 * scale;
      const flip = a.facing === 'left' ? -1 : 1;
      s.scale.set(k * flip, k);
      s.position.set(Math.round(x - ((s.texture.width * k) / 2) * flip), Math.round(y - s.texture.height * k));
      return;
    }
    if ('machine' in unit.sprite) {
      const ms = unit.sprite as MachineSprite;
      s.anchor.set(0);
      s.texture = machineFrame(ms.machine, acting ? 3 : Math.floor(now / 160));
      const k = ms.scale * FOE_K * scale;
      const size = machineSize(ms.machine);
      const flip = a.facing === 'left' ? -1 : 1;
      s.scale.set(k * flip, k);
      s.position.set(Math.round(x - (size / 2) * k * flip), Math.round(y - size * k));
      return;
    }
    // (a person: in their people's dress, as the map's Himeko figures)
    const look = enemyLook((unit.sprite as HumanSprite).people, 3).look;
    const keys = hkLayers(hkWhoOfLook(900000, look), { fighting: acting, activity: 'idle' });
    const [col, row] = hkPose({ facing: a.facing, moving: a.walking, walked: a.walked, working: false, sinceBlow: acting ? (now / 100) % 14 : 999, sinceHit: 999, down, ranged: false, now });
    if (!hkSprite(s, keys, col, row, x, y, PERSON_H * scale)) s.visible = false;
  }

  /** A spell's or skill's sheet bursting over an actor, from the shot's start. */
  private drawBursts(shot: Shot, actors: Record<string, ActorNow>, t: number): void {
    const b = shot.burst;
    const a = b ? actors[b.on] : undefined;
    let sp = this.bursts.children[0] as Sprite | undefined;
    if (!b || !a) {
      if (sp) sp.visible = false;
      return;
    }
    const sh = sheetOf(b.fx);
    const tex = sh.frame(Math.max(0, t - 0.4) * sh.fps);
    if (!sp) sp = this.bursts.addChild(new Sprite());
    sp.visible = !!tex && t > 0.4;
    if (!tex) return;
    sp.texture = tex;
    sp.blendMode = sh.glow ? 'add' : 'normal';
    const k = (sh.scale ?? 1) * 0.9;
    sp.scale.set(k);
    sp.position.set(Math.round(a.x - (sh.size * k) / 2), Math.round(FEET - 14 + sh.foot * k - sh.size * k));
  }

  /** The effects over the picture: fades, flashes, lightning, a pall, a glow. */
  private drawVeil(shot: Shot, t: number, now: number): void {
    const fx = shot.fx ?? [];
    const v = this.veil.clear();
    const { w, h } = this;
    if (fx.includes('darken')) v.rect(0, 0, w, h).fill({ color: 0x000010, alpha: 0.32 });
    if (fx.includes('red')) v.rect(0, 0, w, h).fill({ color: 0xa01008, alpha: 0.16 + 0.06 * Math.sin(now / 300) });
    if (fx.includes('fadeIn') && t < 1.2) v.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 1 - t / 1.2 });
    if (fx.includes('fadeOut')) {
      const left = this.leftInShot();
      if (left < 1.4) v.rect(0, 0, w, h).fill({ color: 0x000000, alpha: Math.min(1, 1 - left / 1.4) });
    }
    if (fx.includes('flash') && t > 0.35 && t < 0.85) v.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.9 * (1 - (t - 0.35) / 0.5) });
    if (fx.includes('lightning')) {
      const f = t % 3.2;
      if (f < 0.12 || (f > 0.22 && f < 0.3)) v.rect(0, 0, w, h).fill({ color: 0xd8e4ff, alpha: 0.75 });
    }
    this.glow.visible = fx.includes('glow');
    if (this.glow.visible) {
      this.glow.position.set(w / 2, this.bandTop + this.bandH * 0.45);
      this.glow.width = w * 1.4;
      this.glow.height = this.bandH * 1.1;
      this.glow.tint = 0xffd8a0;
      this.glow.alpha = 0.22 + 0.1 * Math.sin(now / 500);
    }
  }

  /** Seconds left in the shot playing. */
  private leftInShot(): number {
    const s = this.script?.shots[this.cursor?.shot ?? 0];
    if (!s || !this.cursor) return 99;
    return shotLength(s) - this.cursor.shotT;
  }
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------ the page's part */

class Hud {
  private readonly offerEl: HTMLElement;
  private readonly el: HTMLElement;
  private readonly who: HTMLElement;
  private readonly text: HTMLElement;
  private readonly cap: HTMLElement;
  private readonly top: HTMLElement;
  private readonly foot: HTMLElement;
  private offered: number | null = null;

  constructor(
    page: HTMLElement,
    on: { watch: (key: number) => void; skipOffer: (key: number) => void; tap: () => void; skip: () => void },
  ) {
    this.offerEl = document.createElement('div');
    this.offerEl.id = 'scene-offer';
    this.offerEl.innerHTML = '<div class="so-reel">🎬</div><div class="so-body"><div class="so-kicker">A scene</div><div class="so-title"></div></div><button class="so-watch">Watch</button><button class="so-skip">Skip</button>';
    this.el = document.createElement('div');
    this.el.id = 'cutscene';
    this.el.innerHTML = '<div class="cs-bar cs-top"><button class="cs-skip">Skip ▸▸</button></div><div class="cs-caption"></div><div class="cs-bar cs-foot"><div class="cs-who"></div><div class="cs-text"></div><div class="cs-more">▾</div></div>';
    page.append(this.offerEl, this.el);
    this.who = this.el.querySelector('.cs-who')!;
    this.text = this.el.querySelector('.cs-text')!;
    this.cap = this.el.querySelector('.cs-caption')!;
    this.top = this.el.querySelector('.cs-top')!;
    this.foot = this.el.querySelector('.cs-foot')!;
    this.offerEl.querySelector('.so-watch')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.offered !== null) on.watch(this.offered);
    });
    this.offerEl.querySelector('.so-skip')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.offered !== null) on.skipOffer(this.offered);
      this.offerEl.classList.remove('on');
    });
    this.el.querySelector('.cs-skip')!.addEventListener('click', (e) => {
      e.stopPropagation();
      on.skip();
    });
    this.el.addEventListener('click', () => on.tap());
  }

  offer(v: SceneView | null): void {
    this.offered = v?.key ?? null;
    this.offerEl.classList.toggle('on', !!v);
    if (v) (this.offerEl.querySelector('.so-title') as HTMLElement).textContent = v.title;
  }

  playing(on: boolean): void {
    this.el.classList.toggle('on', on);
    document.body.classList.toggle('scene-on', on);
  }

  layout(top: number, foot: number): void {
    this.top.style.height = `${top}px`;
    this.foot.style.height = `${foot}px`;
  }

  line(l: { who: string | null; text: string; tone: string | null } | null): void {
    this.who.textContent = l?.who ?? '';
    this.who.hidden = !l?.who;
    this.text.textContent = l?.text ?? '';
    this.text.dataset.tone = l?.tone ?? (l && !l.who ? 'narrator' : '');
  }

  caption(text: string | null, t: number): void {
    this.cap.textContent = text ?? '';
    this.cap.style.opacity = text ? String(Math.min(1, t / 0.8, (4 - t) / 0.8)) : '0';
  }
}
