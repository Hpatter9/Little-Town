// Watching a party away (an expedition, later a delve), in the manner of the old Final Fantasy games: between fights
// the party walks to the right through scenery that suits where they're going; when a fight starts the foes stand on
// the left and the party on the right, facing them, stepping forward to strike or cast, numbers popping up over whoever
// is hit or mended, a flash of the spell's colour where it lands. The sim does the fighting (combat.ts, actions.ts);
// this only shows it. The bars over and under it (the action's name, the names, health and time gauges) are in
// fightHud.ts.

import { boatArt } from '../art/boatArt';
import { airshipTexture, DECK, loadAirshipArt } from '../art/airshipArt';
import { ColorMatrixFilter, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { ABILITY_BY_ID } from '../../shared/data/abilities';
import type { Element } from '../../shared/data/effects';
import { actFx, PX_ELEMENT } from '../../shared/data/actFx';
import { KIT_BY_ID, KIT_FX } from '../../shared/data/kitItems';
import { castsMagic } from '../../shared/data/classes';
import { ITEM_BY_ID } from '../../shared/data/items';
import { shotCode, shotOf } from '../../shared/data/projectiles';
import { ShotPainter, shotTicks } from '../battle/projectiles';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import { SPELL_BY_ID } from '../../shared/data/spells';
import type { ExpeditionView, FighterView } from '../../shared/sim/snapshot';
import { creatureFeet, creatureFlip, creatureFrame, creaturePoseFrames, creatureSize, type CreatureSheet } from '../art/creatures';
import { corpseAlpha, FALL_TICKS, HEAVY, MELEE_LAND, motionOf, moveSprite, TickClock } from './fightMotion';
import { impactFrame, IMPACT_SIZE, SPLAT_SIZE, splatFrame } from '../art/effects';
import { bleeds } from '../map/bloodPools';
import { ELITES, type EliteAffix } from '../../shared/data/dungeons';
import { loadDelveProps, propFrame, propLoop, type DelveProp } from '../art/delveProps';
import { sheetOf } from '../town/spellsView';
import { actSprite } from './actLooks';
import { heldWeapon, wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { machineFrame, machineSize } from '../art/machines';
import { BACK_H, BACK_HORIZON, BACK_W, fightBackdrop, FRONT_H, sceneFor, type Backdrop, type SceneId } from '../art/fightBackdrop';
import { BACKDROP_H, loadBackdrop } from '../art/backdropImages';
import { GROUND_OF, groundFilter, loadGround } from '../art/fightGround';
import { lookFor, type SceneLook } from '../../shared/data/scenes';
import type { BackdropId } from '../../shared/data/backdrops';
import type { Biome } from '../../shared/data/biomes';
import { attackAnim, enemyLook } from '../art/rivals';
import { fightAnim, heroFrame, heroScale, heroSheet, skeletonSheet, WOLF_FORMS } from '../art/combatPoses';
import { stillTexture } from '../art/stills';
import { HK_FIGURE, hkLayers, hkPose, hkWhoById } from '../art/hkFolk';
import { TAIL_W, tailTexture, WAIST } from '../art/merTail';
import { hkSprite } from '../art/hkTexture';
/** A townsperson's height on the fight screen, in the Himeko look (as the side-on figures were at 0.75). */
const HK_HEIGHT = 36;

/** How much of the scene is seen at least (art px): it's scaled so this fits, and shows more where there's room. */
const SEE_W = 170;
const SEE_H = 150;
/** How much land shows below the horizon at most (the rest is sky). */
const LAND = 110;
const MARCH = 30;
/** Where the ground strip starts below the horizon line (art px): its grass or cap tops out just over the front feet. */
const GROUND_LIFT = 8;
/** Down a dungeon, the share of each room's time the party stands at its thing before walking on. */
const STOP = 0.3;

/** The element of a spell or skill (for the effect gathering round its caster), by id. */
function elementOf(id: string): Element {
  const effects = SPELL_BY_ID[id]?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? KIT_FX[id] ?? [];
  return effects.find((e) => e.element)?.element ?? (effects.some((e) => e.kind === 'heal' || e.kind === 'revive') ? 'holy' : 'arcane');
}

/** Ticks a shot waits before it leaves the hand (the draw or the cast), and the px a tile counts as when timing its flight
 *  (the fight screen's figures are small and close). */
const LEAD = 1;
const SHOT_TILE = 24;
/** How big the shots are drawn against their usual size. */
const SHOT_SCALE = 0.55;
/** The families of effect a skill (not a spell) flies as: a thrown bolt of power, not a blow up close. */
const FLYING_FAMILY = ['bolt', 'orb', 'explosion', 'flame', 'splash', 'spread'];
const FOE_TARGETS = ['foe', 'foes', 'random_foes'];

/** A spell or skill's flying shot (`orb:<element>`), or null when it does not fly: friends and self (heals, wards), blows
 *  up close, and the big sheets of an ultimate. The element is the pixel effect's own (data/actFx.ts: `px:<element>-<family>`). */
function flyingAct(id: string): string | null {
  const spell = SPELL_BY_ID[id];
  const effects = spell?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? KIT_FX[id] ?? [];
  if (!effects.some((e) => FOE_TARGETS.includes(e.target) && e.kind !== 'heal' && e.kind !== 'revive')) return null;
  const fx = actFx(id);
  if (!fx.startsWith('px:')) return null;
  const dash = fx.indexOf('-');
  const el = fx.slice(3, dash);
  if (el === 'white') return null;
  if (!spell && !FLYING_FAMILY.includes(fx.slice(dash + 1))) return null;
  return shotCode({ ammo: 'orb', el });
}

/** What a fighter looses with a plain ranged blow, by the weapon in a townsperson's hand (their calling's bolt if they
 *  cast) or by the foe's kind (the same idea as the tactics board's `shotFor`). */
function blowShot(f: FighterView): string {
  if (f.kind === 'person') {
    const magic = castsMagic(f.cls);
    return shotOf((f.gear.weapon ? ITEM_BY_ID[f.gear.weapon]?.name : undefined) ?? (magic ? 'staff' : 'sling'), { magic, caster: f.cls ?? '' });
  }
  const d = ENEMIES[f.kind];
  if (!d) return 'arrow';
  const w = 'weapon' in d.sprite && d.sprite.weapon ? d.sprite.weapon : '';
  return shotOf(`${d.name} ${w}`, { caster: `${f.kind} ${d.name}` });
}

/** A shot in the air on the fight screen, and the blow it carries: who it lands on and how old the act is (ticks, as the
 *  sim counts), so that the number, the flinch and the spark of that blow wait for it to arrive. */
interface Flight {
  age: number;
  wait: number;
}

const NO_MERS: ReadonlySet<number> = new Set();
/** The waist cut of a fight sprite's frame (cached per frame), and each sprite's tail child. */
const waistCuts = new Map<Texture, Texture>();
const tails = new WeakMap<Sprite, Sprite>();
const HK_WAIST = 0.67;

interface Figure {
  sprite: Sprite;
  pop: Text;
  spark: Sprite;
}

export class FightScene {
  readonly root = new Container();
  /** The whole screen behind the scene, so nothing of the town shows round it. */
  private readonly cover = new Graphics();
  private readonly clip = new Graphics();
  /** The scenery's layers, back to front, and how fast each scrolls by as the party walks. */
  private readonly layers = [new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: BACK_H }), new TilingSprite({ width: BACK_W, height: FRONT_H })];
  private backdrop: Backdrop | null = null;
  /** What's seen (art px), and where the horizon is in it. */
  private vw = SEE_W;
  private vh = SEE_H;
  private hy = SEE_H - LAND;
  private readonly world = new Container();
  private worldTop = 0;
  private readonly figures = new Container();
  private readonly fx = new Graphics();
  /** Open water over the ground while a boat is at sea (the scene's own ground is the shore). */
  private readonly sea = new Graphics();
  /** Whether the fight is in or under water, and which of the party are merfolk (they fight on a tail there). */
  private wet = false;
  private mers: ReadonlySet<number> = NO_MERS;
  /** Down a dungeon: what's in the room (a chest, a door, a trap...), torches along the walls, and the dark closing in as
   *  the party's own torches run low. */
  private readonly roomProp = new Sprite();
  private readonly wallTorches = new Container();
  private readonly dark = new Graphics();
  /** Where the party stopped for the room's thing (the scroll then), so it slides away as they walk on. */
  private propAt = 0;
  private propRoom = -1;
  /** The spells' and skills' effects playing where they landed (a pool, reused frame to frame), and when each act was
   *  first seen (ms: the sim's ages are whole ticks, so the frames are timed here). */
  private readonly effects = new Container();
  /** Arrows and spells in the air (battle/projectiles.ts), and each shooter's last plain shot: when it began (ms) and where. */
  private readonly shots = new ShotPainter();
  private readonly blows = new Map<string, { last: number; start: number; code: string; from: string; to: string | null; wait: number }>();
  private readonly fxPool: Sprite[] = [];
  private readonly actSeen = new Map<string, number>();
  private readonly figs = new Map<string, Figure>();
  /** Her hull under the party at sea (art/boatArt.ts). */
  private readonly hull = new Sprite();
  private sceneKey = '';
  /** A painted backdrop from the packs, when the trip's look is one: its layers, far to near, and whether it is the
   *  whole scene (`full`) or only the sky over the painted land (`sky`). */
  private readonly photo = new Container();
  private photoLayers: TilingSprite[] = [];
  private photoMode: 'full' | 'sky' | null = null;
  /** Ground under their feet where the backdrop has none at foot height (art/fightGround.ts). */
  private readonly ground = new TilingSprite({ width: 10, height: 10 });
  private scroll = 0;
  private drift = 0;
  private view: ExpeditionView | null = null;
  /** Spell and skill ids by name (the sim logs names; the flash wants the element). */
  private readonly idByName = new Map<string, string>();

  constructor() {
    this.root.visible = false;
    this.world.addChild(this.photo, this.ground, ...this.layers.slice(0, 3), this.wallTorches, this.roomProp, this.layers[3], this.sea, this.figures, this.fx, this.shots.container, this.effects, this.dark);
    this.ground.visible = false;
    this.figures.addChild(this.hull);
    this.hull.anchor.set(0.5, 1);
    this.hull.zIndex = -10;
    this.hull.visible = false;
    this.world.mask = this.clip;
    this.root.addChild(this.clip);
    this.root.addChild(this.cover, this.world);
    for (const s of Object.values(SPELL_BY_ID)) this.idByName.set(s.name, s.id);
    for (const a of Object.values(ABILITY_BY_ID)) this.idByName.set(a.name, a.id);
    for (const k of Object.values(KIT_BY_ID)) this.idByName.set(k.name, k.id);
  }

  get shown(): boolean {
    return this.root.visible;
  }

  /** Fit the scene to its room: the width, above the panel along the bottom (px). */
  resize(w: number, h: number, top: number, bottom: number): void {
    const room = Math.max(40, h - top - bottom);
    this.cover.clear().rect(0, 0, w, h).fill(0x08081e);
    const k = Math.max(1, Math.min(w / SEE_W, room / SEE_H));
    this.vw = w / k;
    this.vh = room / k;
    // (indoors, a little more of the wall shows: that's where the torches and banners are)
    this.hy = Math.round(this.vh - Math.min(this.vh * (this.backdrop?.indoor ? 0.5 : 0.6), LAND));
    // (a painted backdrop has its own ground along its foot: the fighters stand down there)
    if (this.photoMode === 'full') this.hy = Math.round(this.vh - Math.min(72, this.vh * 0.32));
    this.placePhoto();
    this.world.scale.set(k);
    this.world.position.set(0, top);
    this.worldTop = top;
    this.clip.clear().rect(0, top, w, room).fill(0xffffff);
    for (const l of this.layers) l.width = this.vw + 2;
    for (const l of this.layers.slice(0, 3)) l.y = this.hy - BACK_HORIZON;
    this.layers[3].y = Math.round(this.vh - FRONT_H + 8);
  }

  update(v: ExpeditionView | null, biome?: Biome, season?: string, sea = false, mers?: ReadonlySet<number>): void {
    this.root.visible = !!v;
    this.view = v;
    if (!v) return;
    // (on the road it's the land on the way; arrived at a dungeon, it's inside)
    // (`window.__scene` shows any scene, for previews)
    const scene = (window as unknown as { __scene?: SceneId }).__scene ?? sceneFor(v.dest, v.scenery, v.phase, biome);
    // (and painted by hand, or a painted backdrop from the packs: `window.__look` forces one, for previews)
    const look = (window as unknown as { __look?: SceneLook }).__look ?? lookFor(scene, v.id, season, sea && !this.aloft(v), this.aloft(v));
    // (fought in or under the water: merfolk fight in their tail form, not on legs)
    this.wet = /underwater|ocean/.test(look) && !this.afloat(v) && !this.aloft(v);
    this.mers = mers ?? NO_MERS;
    const key = `${v.id}|${scene}|${look}`;
    if (key !== this.sceneKey) {
      this.sceneKey = key;
      this.setLook(look, key);
      const art = fightBackdrop(scene, v.id);
      this.backdrop = art;
      [art.far, art.mid, art.near, art.front].forEach((a, i) => (this.layers[i].texture = a.texture));
      for (const f of this.figs.values()) f.sprite.destroy();
      this.figures.removeChildren();
      this.figures.addChild(this.hull); // (her hull stays: it's shown or hidden each frame)
      this.figs.clear();
    }
  }

  /** Show the trip's look: the painted scene, or a backdrop from the packs over (or instead of) it, once loaded. */
  private setLook(look: SceneLook, key: string): void {
    for (const l of this.photoLayers) l.destroy();
    this.photoLayers = [];
    this.photoMode = null;
    this.ground.visible = false;
    this.showPainted();
    if (look === 'painted') return;
    const sky = look.startsWith('sky:');
    const id = (sky ? look.slice(4) : look) as BackdropId;
    const ground = sky ? undefined : GROUND_OF[id];
    Promise.all([loadBackdrop(id), ground ? loadGround(ground.kind).catch(() => null) : null])
      .then(([textures, tile]) => {
        if (this.sceneKey !== key) return;
        if (ground && tile) {
          this.ground.texture = tile;
          const f = groundFilter(ground);
          this.ground.filters = f ? [f] : [];
          this.ground.visible = true;
        }
        this.photoLayers = textures.map((t) => new TilingSprite({ texture: t, width: 10, height: BACKDROP_H }));
        this.photo.addChild(...this.photoLayers);
        this.photoMode = sky ? 'sky' : 'full';
        this.showPainted();
        this.placePhoto();
      })
      .catch(() => {}); // (offline and never fetched: the painted scene stays)
  }

  private showPainted(): void {
    const mode = this.photoMode;
    this.layers.forEach((l, i) => (l.visible = mode === 'full' ? false : mode === 'sky' ? i > 0 : true));
  }

  /** Lay the backdrop's layers over the view: a whole scene covers it, a sky sits down on the horizon. */
  private placePhoto(): void {
    const { vw, vh, hy } = this;
    for (const l of this.photoLayers) {
      const s = this.photoMode === 'full' ? vh / BACKDROP_H : Math.max(0.4, (hy + 6) / BACKDROP_H);
      l.tileScale.set(s);
      l.width = vw + 2;
      l.height = BACKDROP_H * s;
      l.y = this.photoMode === 'full' ? 0 : Math.round(hy + 6 - BACKDROP_H * s);
    }
    // (the strip's grass or cap stands a little over the line the fighters' feet start at)
    this.ground.y = hy + GROUND_LIFT;
    this.ground.width = vw + 2;
    this.ground.height = Math.max(8, vh - hy - GROUND_LIFT + 2);
  }

  /** The drama of an ultimate: the screen shakes and flashes white when one is loosed. */
  private ultSeen = '';
  private ultAt = -1e9;
  /** A heavy hit or a fall on the screen: when it landed (ms), how hard it shakes, and the flash's colour. */
  private hitAt = -1e9;
  private hitK = 0;
  private flashColour = 0xffffff;
  /** Smoothed tick counters (fractions of a tick between the sim's), each fighter's last pop and who was down. */
  private readonly clock = new TickClock();
  private readonly popAge = new Map<string, number>();
  private readonly wasDown = new Set<string>();

  render(now: number, dt: number): void {
    const v = this.view;
    if (!v) return;
    const fighting = !!v.battle?.length;
    // an ultimate just loosed: a shake and a flash (the banner is the HUD's)
    const ult = v.acts.find((a) => a.ult && a.age < 30);
    if (ult) {
      const key = `${ult.side}:${ult.ref}:${ult.name}:${ult.age - (ult.age % 100)}`;
      if (key !== this.ultSeen) {
        this.ultSeen = key;
        this.ultAt = now;
      }
    }
    const since = (now - this.ultAt) / 1000;
    // (and a shorter, smaller shake for a heavy blow or a fall)
    const hs = (now - this.hitAt) / 1000;
    const k = Math.max(since < 0.8 ? (1 - since / 0.8) * 7 : 0, hs < 0.28 ? (1 - hs / 0.28) * this.hitK : 0);
    if (k > 0.3) this.world.position.set(Math.round((Math.random() - 0.5) * k), this.worldTop + Math.round((Math.random() - 0.5) * k));
    else this.world.position.set(0, this.worldTop);
    // down a dungeon they walk on between rooms, and stop a while at each room's thing (a chest, a trap, a shrine...)
    const delve = v.delve && v.phase === 'work' ? v.delve : null;
    const stops = !!delve && !!delve.kind && !['fight', 'boss'].includes(delve.kind) && delve.progress < STOP;
    // the ground scrolls under a party on the move (not while they fight or work)
    const walking = !fighting && (v.phase === 'out' || v.phase === 'back' || (!!delve && !stops));
    if (walking) this.scroll += MARCH * dt;
    // (the clouds drift a little even while they stand)
    this.drift += dt * 1.5;
    const b = this.backdrop;
    if (b) this.layers.forEach((l, i) => (l.tilePosition.x = -Math.round((this.scroll * b.pace[i] + (i === 0 && !b.indoor ? this.drift : 0)) % BACK_W)));
    // (the backdrop's layers: the far ones barely move, the near ones as fast as the ground)
    const n = this.photoLayers.length;
    this.photoLayers.forEach((l, i) => {
      const pace = this.photoMode === 'sky' ? 0.08 : 0.08 + (0.92 * i) / Math.max(1, n - 1);
      l.tilePosition.x = -Math.round((this.scroll * pace + (i === 0 ? this.drift : 0)) / l.tileScale.x);
    });
    if (this.ground.visible) this.ground.tilePosition.x = -Math.round(this.scroll);
    this.drawDelve(delve, fighting, now);
    this.fx.clear();
    const seen = new Set<string>();
    // (at sea the scroll keeps going: she sails on, fight or no fight)
    if (this.aboard(v) && !walking) this.scroll += MARCH * dt * 0.5;
    this.drawSea(this.afloat(v), now);
    this.shots.begin();
    if (fighting) this.drawFight(v.battle!, v, now, seen);
    else {
      this.blows.clear();
      this.drawMarch(v, now, walking, seen);
    }
    this.shots.end();
    for (const [k, f] of this.figs) {
      if (seen.has(k)) continue;
      f.sprite.destroy();
      f.pop.destroy();
      f.spark.destroy();
      this.figs.delete(k);
    }
  }

  private fig(key: string): Figure {
    let f = this.figs.get(key);
    if (!f) {
      const sprite = new Sprite();
      const pop = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', fill: 0xffffff, stroke: { color: 0x101020, width: 2 } } });
      pop.anchor.set(0.5, 1);
      pop.resolution = 4;
      const spark = new Sprite();
      this.figures.addChild(sprite, spark, pop);
      f = { sprite, pop, spark };
      this.figs.set(key, f);
    }
    return f;
  }

  /** A delve: the room's thing ahead of the party (it stays where they stopped, sliding off as they walk on), wall torches
   *  burning along the corridor, and the dark closing in as their own torches run low. */
  private drawDelve(d: ExpeditionView['delve'] | null, fighting: boolean, now: number): void {
    this.dark.clear();
    this.wallTorches.visible = this.roomProp.visible = !!d;
    if (!d) return;
    loadDelveProps();
    const k = 0.75;
    // (wall torches every so far along, at the ground's pace)
    const gap = 110;
    const want = Math.ceil(this.vw / gap) + 2;
    while (this.wallTorches.children.length < want) this.wallTorches.addChild(new Sprite());
    const off = ((this.scroll % gap) + gap) % gap;
    this.wallTorches.children.forEach((c, i) => {
      const t = c as Sprite;
      const tex = propLoop('torch', now / 110 + i * 2);
      t.visible = !!tex && i < want;
      if (!tex) return;
      t.texture = tex;
      t.scale.set(k);
      t.position.set(Math.round(i * gap - off - 20), Math.round(this.hy - 44));
    });
    // the room's thing: placed as the party reaches the room, then left behind as they walk on
    if (d.room !== this.propRoom) {
      this.propRoom = d.room;
      this.propAt = this.scroll;
    }
    const kind = d.kind ?? '';
    const t = Math.min(1, d.progress / STOP);
    const solved = d.log.at(-1)?.includes('works it out') ?? false;
    const show: [DelveProp, number] | null =
      kind === 'treasure' ? ['chest', t * 6]
      : kind === 'puzzle' ? ['door', solved ? t * 6 : 0]
      : kind === 'fork' ? ['gate', t * 6]
      : kind === 'trap' ? ['blade', now / 70]
      : kind === 'shrine' ? ['skull', now / 160]
      : kind === 'camp' ? ['brazier', now / 110]
      : null;
    const loops = kind === 'trap' || kind === 'shrine' || kind === 'camp';
    const tex = show ? (loops ? propLoop(show[0], show[1]) : propFrame(show[0], show[1])) : null;
    this.roomProp.visible = !!tex && !fighting;
    if (tex) {
      this.roomProp.texture = tex;
      const size = kind === 'treasure' || kind === 'puzzle' || kind === 'fork' ? 1.3 : kind === 'camp' ? 1.5 : 1;
      this.roomProp.scale.set(k * size);
      const x = this.vw / 2 + 34 - (this.scroll - this.propAt);
      this.roomProp.position.set(Math.round(x), Math.round(this.hy + 40 - tex.height * k * size));
    }
    // (the light failing as the torches run out)
    const dim = d.torches <= 0 ? 0.55 : d.torches <= 2 ? 0.35 : d.torches <= 4 ? 0.15 : 0;
    if (dim) this.dark.rect(0, 0, this.vw, this.vh).fill({ color: 0x05040a, alpha: dim });
    // (the white flash of an ultimate, fading over a third of a second)
    const flash = (performance.now() - this.ultAt) / 1000;
    if (flash >= 0 && flash < 0.35) this.dark.rect(0, 0, this.vw, this.vh).fill({ color: 0xffffff, alpha: 0.7 * (1 - flash / 0.35) });
    // (a townsperson falling: the screen blinks red a moment)
    const fell = (performance.now() - this.hitAt) / 1000;
    if (this.flashColour !== 0xffffff && fell >= 0 && fell < 0.4) this.dark.rect(0, 0, this.vw, this.vh).fill({ color: this.flashColour, alpha: 0.3 * (1 - fell / 0.4) });
  }

  /** Between fights: the party in a line, walking to the right (or working at the site). */
  private drawMarch(v: ExpeditionView, now: number, walking: boolean, seen: Set<string>): void {
    for (const sp of this.fxPool) sp.visible = false;
    const n = v.members.length;
    // (at sea they stand on her deck as she rides the swell: the sea goes by, not their feet)
    const afloat = this.aboard(v);
    const bob = afloat ? Math.round(Math.sin(now / 600) * 1.5) : 0;
    if (afloat) this.showHull(v, this.vw / 2, Math.round(this.hy + 40) + bob + 6, Math.max(96, n * 22 + 56), now);
    else this.hull.visible = false;
    v.members.forEach((m, i) => {
      const key = `m${m.id}`;
      seen.add(key);
      const f = this.fig(key);
      f.sprite.rotation = 0;
      f.sprite.blendMode = 'normal';
      const x = this.vw / 2 + (n - 1) * 9 - i * 18;
      const frame = walking && !afloat ? 1 + (Math.floor(now / 100 + i * 3) % 8) : 0;
      // (stopped down a dungeon they stand and look; at the site they work it)
      const still = !walking && v.delve && v.phase === 'work';
      // (in the Himeko look, as the map draws them: art/hkFolk.ts; the old look while their layers load)
      const keys = hkLayers(hkWhoById(m.id, m.look, m.gear), { fighting: false, activity: still || walking ? 'idle' : 'build' });
      const col = walking ? [1, 0, 2, 0][Math.floor(now / 140 + i * 3) % 4] : still ? 0 : Math.floor(now / 350 + i) % 2 ? 4 : 3;
      if (hkSprite(f.sprite, keys, col, 2, x, Math.round(this.hy + 40) + bob, HK_HEIGHT)) {
        f.sprite.zIndex = i;
        f.sprite.alpha = 1;
        f.sprite.tint = 0xffffff;
        f.pop.visible = false;
        f.spark.visible = false;
        return;
      }
      f.sprite.anchor.set(0);
      f.sprite.texture = still
        ? lpcFrame(m.look, 'walk', 0, heldWeapon(m.gear, 'walk'), wornLayers(m.gear))
        : lpcFrame(m.look, walking ? 'walk' : 'thrust', walking ? frame : Math.floor(now / 160 + i) % FRAME_COUNT.thrust, heldWeapon(m.gear, 'walk'), wornLayers(m.gear));
      const k = 0.75;
      f.sprite.scale.set(k);
      f.sprite.position.set(Math.round(x - CENTRE_X * k), Math.round(this.hy + 40 - FEET_Y * k) + bob);
      f.sprite.zIndex = i;
      f.sprite.alpha = 1;
      f.sprite.tint = 0xffffff;
      f.pop.visible = false;
      f.spark.visible = false;
    });
  }

  /** The open sea from the horizon down, its swell rolling by as she sails (hidden ashore). */
  private drawSea(on: boolean, now: number): void {
    this.sea.clear();
    this.sea.visible = on;
    if (!on) return;
    const top = this.hy - 6;
    const h = this.vh - top;
    const bands = [0x2a6a9a, 0x2f76a8, 0x3584b4, 0x3a8cbc];
    bands.forEach((c, i) => this.sea.rect(0, top + (h * i) / bands.length, this.vw, h / bands.length + 1).fill(c));
    // (the swell's lit crests, nearer and faster lower down)
    for (let row = 0; row < 7; row++) {
      const y = top + 4 + row * (h / 7);
      const speed = 6 + row * 5;
      const gap = 34 + row * 6;
      const off = (this.scroll * speed * 0.06 + row * 13) % gap;
      for (let x = -gap + (gap - off); x < this.vw + gap; x += gap) this.sea.rect(Math.round(x), Math.round(y + Math.sin(now / 700 + x * 0.05) * 1.5), 8 + row * 2, 1).fill({ color: 0xcfeaf4, alpha: 0.5 });
    }
    this.sea.rect(0, top, this.vw, 2).fill({ color: 0xe8f6f4, alpha: 0.6 });
  }

  /** Whether the party is at sea in a boat (out or back, not at the place itself). */
  private afloat(v: ExpeditionView): boolean {
    return !!v.boat && v.phase !== 'work';
  }
  /** Whether the party is aloft in an airship (out or back): the sky all round, her gondola under their feet. */
  private aloft(v: ExpeditionView): boolean {
    return !!v.airship && v.phase !== 'work';
  }
  private aboard(v: ExpeditionView): boolean {
    return this.afloat(v) || this.aloft(v);
  }

  /** Her hull, `length` px long, centred at x with her deck at y, rocking a little. */
  private showHull(v: ExpeditionView, x: number, y: number, length: number, now: number): void {
    if (this.aloft(v)) {
      // (her gasbag over them and her gondola under their feet, the pack's airship turned to fly right: art/airshipArt.ts)
      const tex = airshipTexture(v.airship!.kind, 1, true);
      if (!tex) {
        void loadAirshipArt();
        this.hull.visible = false;
        return;
      }
      const k = Math.max(1, (length * 1.5) / tex.width);
      this.hull.texture = tex;
      this.hull.scale.set(k);
      this.hull.visible = true;
      this.hull.position.set(Math.round(x), Math.round(y - 6 + tex.height * k * (1 - DECK[v.airship!.kind])));
      this.hull.rotation = Math.sin(now / 1300) * 0.01;
      return;
    }
    this.hull.scale.set(1);
    const art = boatArt(v.boat!.kind, length);
    this.hull.texture = art.texture;
    this.hull.visible = true;
    this.hull.position.set(Math.round(x), Math.round(y + art.height * 0.02));
    this.hull.rotation = Math.sin(now / 900) * 0.015;
  }

  /** A fight: foes on the left, the party on the right facing them. */
  private drawFight(fighters: FighterView[], v: ExpeditionView, now: number, seen: Set<string>): void {
    const foes = fighters.filter((f) => f.side === 'enemy');
    const party = fighters.filter((f) => f.side === 'party');
    const at = new Map<string, [number, number]>();
    const { vw, hy } = this;
    const land = this.vh - hy;
    const foeGap = Math.min(24, (land - 28) / 3);
    // (a whole town at war, an assault's wave: more than a column holds, so two or three side by side)
    const cols = party.length > 12 ? 3 : party.length > 6 ? 2 : 1;
    const perCol = Math.ceil(party.length / cols);
    const partyGap = Math.min(16, (land - 24) / Math.max(1, perCol - 1));
    // (in a staggered line back from the front, spaced so the big ones don't stand in each other; a crowd in rows)
    const rows = foes.length > 8 ? 3 : 2;
    const perRow = Math.ceil(foes.length / (rows - 1 || 1));
    const spacing = Math.min(40, (vw * 0.32) / Math.max(1, (foes.length > 8 ? perRow : foes.length) - 1));
    foes.forEach((f, i) => {
      const k = foes.length > 8 ? Math.floor(i / perRow) : i % 2;
      const j = foes.length > 8 ? i % perRow : i;
      at.set(`enemy:${f.ref}`, [Math.round(vw * 0.36 - j * spacing - (k % 2) * spacing * 0.5), Math.round(hy + 18 + k * foeGap * (foes.length > 8 ? 1.1 : 1.6))]);
    });
    party.forEach((f, i) => {
      // a slanting column, as in the old games (side by side when there are many)
      const c = Math.floor(i / perCol);
      const r = i % perCol;
      at.set(`party:${f.ref}`, [Math.round(vw * 0.66) + c * 34 + r * 8 + (f.row === 'back' ? 12 : 0), Math.round(hy + 16 + r * partyGap)]);
    });
    // (a fight at sea: they stand on her deck, which runs under the whole column)
    if (this.aboard(v)) this.showHull(v, Math.round(vw * 0.74), Math.round(hy + 16 + Math.max(0, party.length - 1) * partyGap) + 8, Math.max(110, party.length * 26 + 60), now);
    else this.hull.visible = false;
    // the spells and skills just used: an orb of their element flies to the foe first (not for friends and self), then a
    // flash of their colour and their effect on whoever they touched
    let used = 0;
    const live = new Set<string>();
    const flights = new Map<string, Flight[]>();
    for (const act of v.acts) {
      const id = this.idByName.get(act.name) ?? '';
      const key = `${act.side}:${act.ref}:${act.name}:${act.targets.join(',')}`;
      live.add(key);
      let start = this.actSeen.get(key);
      if (start === undefined) this.actSeen.set(key, (start = now - act.age * 100));
      // (`window.__fxSlow` slows them, for previews)
      const t = (now - start) / 1000 / ((window as unknown as { __fxSlow?: number }).__fxSlow ?? 1);
      // the shot: from the caster to the first foe, or to the middle of the foes an area touches
      let wait = 0;
      const code = flyingAct(id);
      const foeSide = act.side === 'party' ? 'enemy' : 'party';
      const aims = code ? act.targets.map((r) => at.get(`${foeSide}:${r}`)).filter((q): q is [number, number] => !!q) : [];
      const from = at.get(`${act.side}:${act.ref}`);
      const actor = fighters.find((x) => x.side === act.side && x.ref === act.ref);
      if (code && from && aims.length) {
        const goal = aims.length > 1 ? [aims.reduce((s, q) => s + q[0], 0) / aims.length, aims.reduce((s, q) => s + q[1], 0) / aims.length] : aims[0];
        const a: [number, number] = [from[0] + (act.side === 'party' ? -10 : 8), from[1] - 16];
        const b: [number, number] = [goal[0], goal[1] - 14];
        const dur = shotTicks(code, a, b, SHOT_TILE);
        wait = LEAD + dur;
        this.shots.put(code, a, b, t * 10 - LEAD, dur, SHOT_SCALE);
        for (const r of act.targets) flights.set(`${foeSide}:${r}`, [...(flights.get(`${foeSide}:${r}`) ?? []), { age: act.age, wait }]);
      } else if (from && !actor?.ranged && this.strikesFoes(id)) {
        // a skill struck up close: its effect and the flinch wait for the lunge to land
        wait = MELEE_LAND;
        for (const r of act.targets) flights.set(`${foeSide}:${r}`, [...(flights.get(`${foeSide}:${r}`) ?? []), { age: act.age, wait }]);
      }
      // a cast: the spell's element gathers round the caster before it goes (the pixel effects pack's gather strip)
      if (from && act.age < 8 && SPELL_BY_ID[id]) {
        const gather = sheetOf(`px:${PX_ELEMENT[elementOf(id)]}-gather`);
        const tex = gather.frame((act.age / 10) * gather.fps);
        if (tex) {
          const sp = (this.fxPool[used] ??= this.effects.addChild(new Sprite()));
          used++;
          sp.visible = true;
          sp.texture = tex;
          sp.blendMode = 'add';
          const k = (gather.scale ?? 1) * 0.5;
          sp.scale.set(k, k);
          sp.position.set(Math.round(from[0] + (act.side === 'party' ? -4 : 4) - (gather.size * k) / 2), Math.round(from[1] - 4 - gather.size * k));
        }
      }
      const landed = t - wait / 10;
      const sh = sheetOf(actSprite(id));
      act.targets.forEach((ref, i) => {
        const p = at.get(`enemy:${ref}`) ?? at.get(`party:${ref}`);
        const tex = p ? sh.frame((landed - i * 0.08) * sh.fps) : null;
        if (!p || !tex || landed - i * 0.08 < 0) return;
        const sp = (this.fxPool[used] ??= this.effects.addChild(new Sprite()));
        used++;
        sp.visible = true;
        sp.texture = tex;
        sp.blendMode = sh.glow ? 'add' : 'normal';
        // (drawn at the fighters' size; the party's blows come from the right, so their slashes are turned)
        const k = (sh.scale ?? 1) * 0.6;
        const flip = act.side === 'party' ? -1 : 1;
        sp.scale.set(k * flip, k);
        sp.position.set(Math.round(p[0] - (sh.size * k * flip) / 2), Math.round(p[1] + sh.foot * k - sh.size * k));
      });
    }
    this.plainShots(fighters, v, at, now, flights);
    this.plainBlows(fighters, v, flights);
    for (let i = used; i < this.fxPool.length; i++) this.fxPool[i].visible = false;
    for (const k of this.actSeen.keys()) if (!live.has(k)) this.actSeen.delete(k);
    // first, each fighter as the screen sees it (a blow that was shot, cast or struck lands late: its flinch and number
    // wait for it), with the sim's tick counts smoothed to fractions of a tick so the motion is smooth
    const rigs = new Map<string, { f: FighterView; real: FighterView; popWait: number; sa: number; sh: number }>();
    const clockKeys = new Set<string>();
    for (const real of fighters) {
      const key = `${real.side}:${real.ref}`;
      if (!at.has(key)) continue;
      const wait = flights.get(key);
      const hitWait = wait?.find((w) => Math.abs(real.sinceHit - w.age) <= 2)?.wait ?? 0;
      const popWait = real.pop ? (wait?.find((w) => Math.abs(real.pop!.age - w.age) <= 2)?.wait ?? 0) : 0;
      const late = hitWait > 0 && real.sinceHit < hitWait;
      const f: FighterView = hitWait ? { ...real, sinceHit: late ? 999 : real.sinceHit - hitWait, ...(late ? { down: false } : {}), pop: real.pop } : real;
      clockKeys.add(`${key}:a`).add(`${key}:h`);
      rigs.set(key, { f, real, popWait, sa: this.clock.fine(`${key}:a`, f.sinceAction, now), sh: this.clock.fine(`${key}:h`, f.sinceHit, now) });
    }
    this.clock.prune(clockKeys);
    // (a friend just fallen, and a won fight: a flinch, and a hop for joy)
    const fallen = (side: string, self: string) => {
      let m = 999;
      for (const [k, r] of rigs) if (r.f.side === side && r.f.down && k !== self) m = Math.min(m, r.sh);
      return m;
    };
    const won = foes.length > 0 && foes.every((x) => x.down) && party.some((x) => !x.down);
    for (const [key, r] of rigs) {
      const { f, real } = r;
      const p = at.get(key)!;
      seen.add(key);
      const g = this.fig(key);
      const acting = r.sa < 8 && !f.down;
      // the striking pop: its share of the target's health, and when it's a new one (a heavy blow shakes the screen, a
      // townsperson's fall blinks it red)
      const pop0 = real.pop;
      const hard = pop0 && !pop0.heal && pop0.amount > 0 && pop0.age - r.popWait < 8 ? pop0.amount / Math.max(1, real.maxHp) : 0;
      const before = this.popAge.get(key);
      if (pop0 && pop0.age - r.popWait >= 0 && (before === undefined ? pop0.age - r.popWait <= 2 : pop0.age < before)) {
        if (hard >= HEAVY) {
          this.hitAt = now;
          this.hitK = 4;
          this.flashColour = 0xffffff;
        }
      }
      if (pop0) this.popAge.set(key, pop0.age);
      else this.popAge.delete(key);
      if (f.down && !this.wasDown.has(key)) {
        this.wasDown.add(key);
        if (r.sh < 3 && f.side === 'party') {
          this.hitAt = now;
          this.hitK = 5;
          this.flashColour = 0xc02030;
        }
      } else if (!f.down) this.wasDown.delete(key);
      const toward = f.side === 'party' ? -1 : 1;
      const fine: FighterView = { ...f, sinceAction: r.sa, sinceHit: r.sh };
      const deadFrame = this.pose(g.sprite, fine, p[0], p[1], acting, now);
      const wide = g.sprite.texture.width > g.sprite.texture.height * 1.1;
      const m = motionOf({ toward, sinceAction: r.sa, sinceHit: r.sh, down: f.down, ranged: f.ranged, hard, friendDown: fallen(f.side, key), wide, cheering: won && !f.down && f.side === 'party', now, ref: f.ref });
      // (the motion is only a lean and a shift of the picture's place: squash and lean about their feet)
      moveSprite(g.sprite, p[0], p[1], m, 1, !(deadFrame && f.down));
      g.sprite.zIndex = p[1] - (f.down ? 0.5 : 0);
      g.sprite.alpha = f.down ? (f.side === 'enemy' ? corpseAlpha(r.sh - 2, 'enemy') : 1) : 1;
      // (an elite wears its affix's colour; a boss its own; the struck flash white, then red)
      const base = f.elite ? (ELITES[f.elite as EliteAffix]?.tint ?? 0xffffff) : (ENEMIES[f.kind]?.tint ?? 0xffffff);
      g.sprite.blendMode = m.flash >= 0.9 ? 'add' : 'normal';
      g.sprite.tint = f.down ? (f.side === 'enemy' ? 0xb0a0a0 : base) : m.flash >= 0.9 ? 0xffffff : m.flash > 0.1 ? 0xff9090 : base;
      // the number over them: damage white, healing green, arcing up and away from the striker and fading
      const pop = real.pop && real.pop.age - r.popWait >= 0 && real.pop.age - r.popWait < 14 ? { ...real.pop, age: real.pop.age - r.popWait } : null;
      g.pop.visible = !!pop && (pop.amount > 0 || !pop.heal);
      if (pop) {
        g.pop.text = pop.amount > 0 ? String(pop.amount) : 'Miss';
        g.pop.style.fill = pop.heal ? 0x8aff9a : hard >= HEAVY ? 0xffd060 : 0xffffff;
        g.pop.scale.set(hard >= HEAVY ? 1.35 : 1);
        g.pop.position.set(p[0] - toward * pop.age * 0.5, p[1] - 22 - (pop.age * 1.6 - pop.age * pop.age * 0.06));
        g.pop.alpha = Math.min(1, (14 - pop.age) / 5);
        g.pop.zIndex = 999;
      }
      // a blow landing: flesh sprays blood away from the striker (the party faces left, its foes right), the rest sparks
      const bloody = f.kind === 'person' || bleeds(f.kind);
      const spark = f.sinceHit < 7 && !f.down ? (bloody ? splatFrame(f.sinceHit + 2) : impactFrame(f.sinceHit)) : null;
      g.spark.visible = !!spark;
      if (spark) {
        const size = (bloody ? SPLAT_SIZE : IMPACT_SIZE) * (hard >= HEAVY ? 0.85 : 0.6);
        g.spark.texture = spark;
        g.spark.anchor.set(0.5, 0.5);
        g.spark.width = g.spark.height = size;
        g.spark.scale.x = (bloody && f.side === 'enemy' ? -1 : 1) * Math.abs(g.spark.scale.x);
        g.spark.position.set(p[0] + (bloody ? (f.side === 'party' ? 8 : -8) : 0), p[1] - 26 + IMPACT_SIZE * 0.3);
        g.spark.zIndex = 998;
      }
    }
    this.figures.sortableChildren = true;
  }

  /** The plain ranged blows (a bow, a sling, a gun, a caster's bolt): the sim logs no target for them, so the foe that was
   *  struck (or missed) as the blow was made is the one it flies to. Their numbers and flinches wait for it (`flights`). */
  private plainShots(fighters: FighterView[], v: ExpeditionView, at: Map<string, [number, number]>, now: number, flights: Map<string, Flight[]>): void {
    const live = new Set<string>();
    for (const f of fighters) {
      const key = `${f.side}:${f.ref}`;
      const p = at.get(key);
      if (!f.ranged || !p) continue;
      live.add(key);
      let b = this.blows.get(key);
      if (!b || f.sinceAction < b.last) {
        b = { last: f.sinceAction, start: now - f.sinceAction * 100, code: blowShot(f), from: key, to: null, wait: 0 };
        this.blows.set(key, b);
        // (a spell or skill is shown by its own act, not as a plain shot)
        const cast = v.acts.some((a) => a.side === f.side && a.ref === f.ref && Math.abs(a.age - f.sinceAction) <= 2);
        if (f.sinceAction <= 4 && !cast) {
          let best = 3;
          for (const o of fighters) {
            if (o.side === f.side) continue;
            const hit = Math.min(o.sinceHit, o.pop && !o.pop.heal ? o.pop.age : 999);
            const d = Math.abs(hit - f.sinceAction);
            const q = at.get(`${o.side}:${o.ref}`);
            if (q && d < best) {
              best = d;
              b.to = `${o.side}:${o.ref}`;
            }
          }
        }
      }
      b.last = f.sinceAction;
      const goal = b.to ? at.get(b.to) : null;
      if (!goal) continue;
      const a: [number, number] = [p[0] + (f.side === 'party' ? -10 : 8), p[1] - 16];
      const z: [number, number] = [goal[0], goal[1] - 14];
      const dur = shotTicks(b.code, a, z, SHOT_TILE);
      b.wait = LEAD + dur;
      this.shots.put(b.code, a, z, (now - b.start) / 100 - LEAD, dur, SHOT_SCALE);
      if (f.sinceAction < b.wait + 16) flights.set(b.to!, [...(flights.get(b.to!) ?? []), { age: f.sinceAction, wait: b.wait }]);
    }
    for (const k of this.blows.keys()) if (!live.has(k)) this.blows.delete(k);
  }

  /** Whether a spell or skill goes for foes (not friends or self: heals, wards). */
  private strikesFoes(id: string): boolean {
    const effects = SPELL_BY_ID[id]?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? [];
    return effects.some((e) => FOE_TARGETS.includes(e.target) && e.kind !== 'heal' && e.kind !== 'revive');
  }

  /** The plain close blows: the foe that was struck (or missed) as the blow was made takes it when the lunge lands, so its
   *  number, flinch and spark wait for that (as for a shot in the air). */
  private plainBlows(fighters: FighterView[], v: ExpeditionView, flights: Map<string, Flight[]>): void {
    for (const f of fighters) {
      if (f.ranged || f.down || f.sinceAction > MELEE_LAND + 16) continue;
      if (v.acts.some((a) => a.side === f.side && a.ref === f.ref && Math.abs(a.age - f.sinceAction) <= 2)) continue;
      let best = 2;
      let to: string | null = null;
      for (const o of fighters) {
        if (o.side === f.side) continue;
        const hit = Math.min(o.sinceHit, o.pop && !o.pop.heal ? o.pop.age : 999);
        const d = Math.abs(hit - f.sinceAction);
        if (d < best) {
          best = d;
          to = `${o.side}:${o.ref}`;
        }
      }
      if (to) flights.set(to, [...(flights.get(to) ?? []), { age: f.sinceAction, wait: MELEE_LAND }]);
    }
  }

  /** A fighter's picture: a townsperson (or a raised foe) as an LPC figure, a creature, a still or a machine. */
  /** Returns whether the picture is already a dying one (a pack's own death frames), so no topple is added to it. */
  private pose(s: Sprite, f: FighterView, x: number, y: number, acting: boolean, now: number): boolean {
    const unit = f.kind === 'person' ? null : ENEMIES[f.kind];
    // (some foes are recoloured: a dungeon's boss in its own colours)
    const filter = unit?.look ? lookFilter(unit.look) : null;
    if ((s.filters?.[0] ?? null) !== filter) s.filters = filter ? [filter] : [];
    // (the party faces left, toward the foes; foes face right)
    const faceLeft = f.side === 'party';
    const k = 0.75;
    if (unit && 'sheet' in unit.sprite) {
      const sp = unit.sprite as { sheet: CreatureSheet; block: number; scale: number };
      const facing = faceLeft ? 'left' : 'right';
      const dies = f.down && creaturePoseFrames(sp.sheet, 'dead') > 0;
      s.texture = creatureFrame(sp.sheet, sp.block, facing, f.down ? 1 : Math.floor(now / 160 + f.ref), acting, f.down ? 'dead' : acting ? undefined : 'idle', dies ? (Math.max(0, f.sinceHit - 2) / FALL_TICKS) * creaturePoseFrames(sp.sheet, 'dead') : undefined);
      const size = creatureSize(sp.sheet);
      const flip = creatureFlip(sp.sheet, facing);
      const sc = sp.scale * k * 1.2;
      s.scale.set(sc * flip, sc);
      // (the sheet's feet line sits on the ground, not the frame's bottom edge: small creatures in big frames)
      s.position.set(Math.round(x - ((size.w * sc) / 2) * flip), Math.round(y - size.h * sc * creatureFeet(sp.sheet)));
      return dies;
    }
    if (unit && 'still' in unit.sprite) {
      const st = unit.sprite as StillSprite;
      s.texture = stillTexture(st.still);
      const sc = st.scale * k;
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      const bob = st.hover && !f.down ? Math.round(Math.sin(now / 300 + f.ref) * 2) - 4 : 0;
      s.position.set(Math.round(x - ((s.texture.width * sc) / 2) * flip), Math.round(y - s.texture.height * sc + bob));
      return false;
    }
    if (unit && 'machine' in unit.sprite) {
      const ms = unit.sprite as MachineSprite;
      s.texture = machineFrame(ms.machine, acting ? 3 : Math.floor(now / 160 + f.ref));
      const sc = ms.scale * k;
      const size = machineSize(ms.machine);
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - (size / 2) * sc * flip), Math.round(y - size * sc));
      return false;
    }
    // a shapeshifter fights in their beast's shape (wolf to wyvern by stage)
    if (f.beast && !f.down) {
      const facing = faceLeft ? 'left' : 'right';
      const sheet = f.beast.sheet as CreatureSheet;
      s.texture = creatureFrame(sheet, f.beast.block, facing, Math.floor(now / 160 + f.ref), acting, acting ? undefined : 'idle');
      const size = creatureSize(sheet);
      const flip = creatureFlip(sheet, facing);
      const sc = (f.beast.scale / 1.3) * 1.8 * k;
      s.anchor.set(0);
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - ((size.w * sc) / 2) * flip), Math.round(y - size.h * sc));
      return false;
    }
    // people
    const hs = unit ? (unit.sprite as HumanSprite) : null;
    const enemy = hs ? enemyLook(hs.people, f.ref) : null;
    const look = f.look ?? enemy?.look;
    if (!look) return false;
    const wear = enemy ? enemy.wear : wornLayers(f.gear);
    // a townsperson in the Himeko look, as the map draws them (art/hkFolk.ts; the founders too): all but a werewolf,
    // who fights in wolf form
    if (!hs && !f.wolf && f.look) {
      const keys = hkLayers(hkWhoById(f.ref, f.look, f.gear), { fighting: true, activity: 'fight' });
      // (on a tail they fall standing: the motion topples them, as there's no lying frame to cut at the waist)
      const finned = this.wet && this.mers.has(f.ref);
      const [col, row] = hkPose({ facing: faceLeft ? 'left' : 'right', moving: false, walked: 0, working: false, sinceBlow: acting ? f.sinceAction : 999, sinceHit: f.sinceHit, down: f.down && !finned, ranged: f.ranged, now });
      if (hkSprite(s, keys, col, row, x, y, HK_HEIGHT)) {
        this.finTail(s, finned, true, f.ref, faceLeft, now);
        return false;
      }
      // (until the weapon's layer loads, the same person without it: never a stranger's figure)
      const bare = hkLayers(hkWhoById(f.ref, f.look, f.gear), { fighting: false, activity: 'idle' });
      if (hkSprite(s, bare, col, row, x, y, HK_HEIGHT)) {
        this.finTail(s, finned, true, f.ref, faceLeft, now);
        return false;
      }
    }
    // a party member of a fighting calling in their combat form (a Craftpix hero: art/combatPoses.ts)
    // (a werewolf fights in wolf form: the Craftpix werewolves, by who they are)
    const hero = !hs ? (f.wolf ? WOLF_FORMS[f.ref % WOLF_FORMS.length] : f.undead ? skeletonSheet(f.ranged, f.ref) : heroSheet(f.cls, f.ref)) : null;
    if (hero) {
      const facing = faceLeft ? 'left' : 'right';
      s.texture = heroFrame(hero, { facing, moving: false, walked: 0, sinceBlow: acting ? f.sinceAction : 999, sinceHit: f.sinceHit, sinceBlock: 999, down: f.down, now, ref: f.ref, sinceDown: Math.max(0, f.sinceHit - 2) });
      const sc = heroScale(hero) * k; // (a wolf form at a hero's height: the rows are close on the fight screen)
      const flip = creatureFlip(hero, facing);
      s.anchor.set(0.5, 1);
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x), Math.round(y));
      return f.down && creaturePoseFrames(hero, 'dead') > 0;
    }
    const weapon = hs ? hs.weapon : heldWeapon(f.gear, 'fight');
    let anim: LpcAnim = 'walk';
    let frame = 0;
    if (f.down) {
      // (the pack's own fall, played through and held lying)
      anim = 'hurt';
      frame = Math.min(FRAME_COUNT.hurt - 1, Math.floor((Math.max(0, f.sinceHit - 2) / FALL_TICKS) * FRAME_COUNT.hurt));
    } else if (f.sinceHit < 3) {
      anim = 'hurt';
      frame = f.sinceHit < 2 ? 0 : 1;
    } else if (acting) {
      anim = hs ? attackAnim(hs, f.ranged) : fightAnim(f.gear, f.ranged);
      frame = Math.min(FRAME_COUNT[anim] - 1, Math.floor(f.sinceAction * (anim === 'shoot' ? 1.6 : 1)));
    }
    s.texture = lpcFrame(look, anim, frame, anim === 'spell' ? null : weapon, wear);
    s.anchor.set(0);
    const flip = faceLeft ? -1 : 1;
    s.scale.set(k * flip, k);
    s.position.set(Math.round(x - (flip > 0 ? CENTRE_X : -CENTRE_X - 1) * k), Math.round(y - FEET_Y * k));
    this.finTail(s, !!f.look && !hs && this.wet && this.mers.has(f.ref), false, f.ref, faceLeft, now);
    return f.down;
  }

  /** A merfolk fighting in the water shows to the waist with their tail trailing behind (art/merTail.ts, as on the
   *  map). The tail is a child of the figure's sprite, so every lunge, recoil, squash and fall moves it too. Called
   *  once the sprite is placed; anywhere else it hides the tail again. */
  private finTail(s: Sprite, on: boolean, hk: boolean, ref: number, faceLeft: boolean, now: number): void {
    let tail = tails.get(s);
    if (!on) {
      if (tail) tail.visible = false;
      return;
    }
    if (!tail) {
      tail = s.addChild(new Sprite());
      tails.set(s, tail);
    }
    const full = s.texture;
    const waist = hk ? HK_WAIST : WAIST;
    let cut = waistCuts.get(full);
    if (!cut) {
      const fr = full.frame;
      cut = new Texture({ source: full.source, frame: new Rectangle(fr.x, fr.y, fr.width, Math.round(fr.height * waist)) });
      waistCuts.set(full, cut);
    }
    s.texture = cut;
    let rootX = CENTRE_X;
    let rootY = cut.height;
    let size = 1;
    if (hk) {
      // (the paper doll's origin is at its feet: the cut's anchor and the tail's root follow)
      const feet = s.anchor.y * full.height;
      s.anchor.set(0.5, feet / cut.height);
      rootX = 0;
      rootY = cut.height - feet;
      size = HK_FIGURE / 48;
    }
    const flip = Math.sign(s.scale.x) || 1;
    tail.texture = tailTexture(ref);
    tail.anchor.set(5 / TAIL_W, 0);
    tail.position.set(rootX, rootY);
    // (the tail art points right and trails behind: they face left, so it points right, and on the other side the other way)
    tail.scale.set((faceLeft ? 1 : -1) * flip * size, size);
    tail.rotation = Math.sin(now / 300 + ref) * 0.12;
    tail.visible = true;
  }
}

/** A colour filter for a foe's look (hue turned, greyed, brightened), one per look. */
const lookFilters = new Map<string, ColorMatrixFilter>();
export function lookFilter(look: { hue?: number; grey?: boolean; bright?: number }): ColorMatrixFilter {
  const key = JSON.stringify(look);
  let f = lookFilters.get(key);
  if (!f) {
    f = new ColorMatrixFilter();
    if (look.grey) f.desaturate();
    if (look.hue) f.hue(look.hue, true);
    if (look.bright) f.brightness(look.bright, true);
    lookFilters.set(key, f);
  }
  return f;
}
