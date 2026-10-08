// Watching a party away (an expedition, later a delve), in the manner of the old Final Fantasy games: between fights
// the party walks to the right through scenery that suits where they're going; when a fight starts the foes stand on
// the left and the party on the right, facing them, stepping forward to strike or cast, numbers popping up over whoever
// is hit or mended, a flash of the spell's colour where it lands. The sim does the fighting (combat.ts, actions.ts);
// this only shows it. The bars over and under it (the action's name, the names, health and time gauges) are in
// fightHud.ts.

import { boatArt } from '../art/boatArt';
import { ColorMatrixFilter, Container, Graphics, Sprite, Text, TilingSprite } from 'pixi.js';
import { ABILITY_BY_ID } from '../../shared/data/abilities';
import type { Element } from '../../shared/data/effects';
import { ENEMIES, type HumanSprite, type MachineSprite, type StillSprite } from '../../shared/data/enemies';
import { SPELL_BY_ID } from '../../shared/data/spells';
import type { ExpeditionView, FighterView } from '../../shared/sim/snapshot';
import { creatureFlip, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
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
import { hkLayers, hkPose, hkWhoById } from '../art/hkFolk';
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

/** Each element's colour for the flash where a spell or skill lands. */
const ELEMENT_COLOUR: Record<Element, number> = {
  physical: 0xffffff, fire: 0xff7030, ice: 0x9ae8ff, lightning: 0xfff070, holy: 0xffe8a0, dark: 0x8a40c0, nature: 0x6ad048, poison: 0x90f040,
  arcane: 0xc080ff, blood: 0xe03040, time: 0xb0a0ff, sound: 0xffc0e0, water: 0x40b0e0, earth: 0xc09060, wind: 0xd0f0e0,
};

/** The element of a spell or skill (for its flash), by id. */
function elementOf(id: string): Element {
  const effects = SPELL_BY_ID[id]?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? [];
  return effects.find((e) => e.element)?.element ?? (effects.some((e) => e.kind === 'heal' || e.kind === 'revive') ? 'holy' : 'arcane');
}

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
    this.world.addChild(this.photo, this.ground, ...this.layers.slice(0, 3), this.wallTorches, this.roomProp, this.layers[3], this.sea, this.figures, this.fx, this.effects, this.dark);
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

  update(v: ExpeditionView | null, biome?: Biome, season?: string, sea = false): void {
    this.root.visible = !!v;
    this.view = v;
    if (!v) return;
    // (on the road it's the land on the way; arrived at a dungeon, it's inside)
    // (`window.__scene` shows any scene, for previews)
    const scene = (window as unknown as { __scene?: SceneId }).__scene ?? sceneFor(v.dest, v.scenery, v.phase, biome);
    // (and painted by hand, or a painted backdrop from the packs: `window.__look` forces one, for previews)
    const look = (window as unknown as { __look?: SceneLook }).__look ?? lookFor(scene, v.id, season, sea);
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
    if (since < 0.8) {
      const k = (1 - since / 0.8) * 7;
      this.world.position.set(Math.round((Math.random() - 0.5) * k), this.worldTop + Math.round((Math.random() - 0.5) * k));
    } else this.world.position.set(0, this.worldTop);
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
    if (this.afloat(v) && !walking) this.scroll += MARCH * dt * 0.5;
    this.drawSea(this.afloat(v), now);
    if (fighting) this.drawFight(v.battle!, v, now, seen);
    else this.drawMarch(v, now, walking, seen);
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
  }

  /** Between fights: the party in a line, walking to the right (or working at the site). */
  private drawMarch(v: ExpeditionView, now: number, walking: boolean, seen: Set<string>): void {
    for (const sp of this.fxPool) sp.visible = false;
    const n = v.members.length;
    // (at sea they stand on her deck as she rides the swell: the sea goes by, not their feet)
    const afloat = this.afloat(v);
    const bob = afloat ? Math.round(Math.sin(now / 600) * 1.5) : 0;
    if (afloat) this.showHull(v, this.vw / 2, Math.round(this.hy + 40) + bob + 6, Math.max(96, n * 22 + 56), now);
    else this.hull.visible = false;
    v.members.forEach((m, i) => {
      const key = `m${m.id}`;
      seen.add(key);
      const f = this.fig(key);
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

  /** Her hull, `length` px long, centred at x with her deck at y, rocking a little. */
  private showHull(v: ExpeditionView, x: number, y: number, length: number, now: number): void {
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
    if (this.afloat(v)) this.showHull(v, Math.round(vw * 0.74), Math.round(hy + 16 + Math.max(0, party.length - 1) * partyGap) + 8, Math.max(110, party.length * 26 + 60), now);
    else this.hull.visible = false;
    // the spells and skills just used: a flash of their colour and their effect on whoever they touched
    let used = 0;
    const live = new Set<string>();
    for (const act of v.acts) {
      const id = this.idByName.get(act.name) ?? '';
      const key = `${act.side}:${act.ref}:${act.name}:${act.targets.join(',')}`;
      live.add(key);
      let start = this.actSeen.get(key);
      if (start === undefined) this.actSeen.set(key, (start = now - act.age * 100));
      // (`window.__fxSlow` slows them, for previews)
      const t = (now - start) / 1000 / ((window as unknown as { __fxSlow?: number }).__fxSlow ?? 1);
      if (act.age <= 8) {
        const colour = ELEMENT_COLOUR[elementOf(id)];
        const k = act.age / 8;
        for (const ref of act.targets) {
          const p = at.get(`enemy:${ref}`) ?? at.get(`party:${ref}`);
          if (!p) continue;
          this.fx.circle(p[0], p[1] - 10, 6 + 10 * k).fill({ color: colour, alpha: 0.3 * (1 - k) });
        }
      }
      const sh = sheetOf(actSprite(id));
      act.targets.forEach((ref, i) => {
        const p = at.get(`enemy:${ref}`) ?? at.get(`party:${ref}`);
        const tex = p ? sh.frame((t - i * 0.08) * sh.fps) : null;
        if (!p || !tex || t - i * 0.08 < 0) return;
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
    for (let i = used; i < this.fxPool.length; i++) this.fxPool[i].visible = false;
    for (const k of this.actSeen.keys()) if (!live.has(k)) this.actSeen.delete(k);
    for (const f of fighters) {
      const key = `${f.side}:${f.ref}`;
      const p = at.get(key);
      if (!p) continue;
      seen.add(key);
      const g = this.fig(key);
      const acting = f.sinceAction < 6 && !f.down;
      // (they step out toward the foe to strike or cast)
      const step = acting ? (f.side === 'party' ? -10 : 8) : 0;
      this.pose(g.sprite, f, p[0] + step, p[1], acting, now);
      g.sprite.zIndex = p[1];
      g.sprite.alpha = f.down && f.side === 'enemy' ? Math.max(0, 1 - f.sinceHit / 20) : 1;
      // (an elite wears its affix's colour; a boss its own)
      g.sprite.tint = f.sinceHit < 3 && !f.down ? 0xff8080 : f.elite ? (ELITES[f.elite as EliteAffix]?.tint ?? 0xffffff) : (ENEMIES[f.kind]?.tint ?? 0xffffff);
      // the number over them: damage white, healing green, rising and fading
      const pop = f.pop && f.pop.age < 14 ? f.pop : null;
      g.pop.visible = !!pop && (pop.amount > 0 || !pop.heal);
      if (pop) {
        g.pop.text = pop.amount > 0 ? String(pop.amount) : 'Miss';
        g.pop.style.fill = pop.heal ? 0x8aff9a : 0xffffff;
        g.pop.position.set(p[0], p[1] - 22 - pop.age * 0.9);
        g.pop.alpha = Math.min(1, (14 - pop.age) / 5);
        g.pop.zIndex = 999;
      }
      // a blow landing: flesh sprays blood away from the striker (the party faces left, its foes right), the rest sparks
      const bloody = f.kind === 'person' || bleeds(f.kind);
      const spark = f.sinceHit < 7 && !f.down ? (bloody ? splatFrame(f.sinceHit + 2) : impactFrame(f.sinceHit)) : null;
      g.spark.visible = !!spark;
      if (spark) {
        const size = bloody ? SPLAT_SIZE * 0.6 : IMPACT_SIZE * 0.6;
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

  /** A fighter's picture: a townsperson (or a raised foe) as an LPC figure, a creature, a still or a machine. */
  private pose(s: Sprite, f: FighterView, x: number, y: number, acting: boolean, now: number): void {
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
      s.texture = creatureFrame(sp.sheet, sp.block, facing, f.down ? 1 : Math.floor(now / 160 + f.ref), acting, f.down ? 'dead' : acting ? undefined : 'idle');
      const size = creatureSize(sp.sheet);
      const flip = creatureFlip(sp.sheet, facing);
      const sc = sp.scale * k * 1.2;
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - ((size.w * sc) / 2) * flip), Math.round(y - size.h * sc));
      return;
    }
    if (unit && 'still' in unit.sprite) {
      const st = unit.sprite as StillSprite;
      s.texture = stillTexture(st.still);
      const sc = st.scale * k;
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      const bob = st.hover && !f.down ? Math.round(Math.sin(now / 300 + f.ref) * 2) - 4 : 0;
      s.position.set(Math.round(x - ((s.texture.width * sc) / 2) * flip), Math.round(y - s.texture.height * sc + bob));
      return;
    }
    if (unit && 'machine' in unit.sprite) {
      const ms = unit.sprite as MachineSprite;
      s.texture = machineFrame(ms.machine, acting ? 3 : Math.floor(now / 160 + f.ref));
      const sc = ms.scale * k;
      const size = machineSize(ms.machine);
      const flip = faceLeft ? -1 : 1;
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x - (size / 2) * sc * flip), Math.round(y - size * sc));
      return;
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
      return;
    }
    // people
    const hs = unit ? (unit.sprite as HumanSprite) : null;
    const enemy = hs ? enemyLook(hs.people, f.ref) : null;
    const look = f.look ?? enemy?.look;
    if (!look) return;
    const wear = enemy ? enemy.wear : wornLayers(f.gear);
    // a townsperson in the Himeko look, as the map draws them (art/hkFolk.ts; the founders too): all but a werewolf,
    // who fights in wolf form
    if (!hs && !f.wolf && f.look) {
      const keys = hkLayers(hkWhoById(f.ref, f.look, f.gear), { fighting: true, activity: 'fight' });
      const [col, row] = hkPose({ facing: faceLeft ? 'left' : 'right', moving: false, walked: 0, working: false, sinceBlow: acting ? f.sinceAction : 999, sinceHit: f.sinceHit, down: f.down, ranged: f.ranged, now });
      if (hkSprite(s, keys, col, row, x, y, HK_HEIGHT)) return;
      // (until the weapon's layer loads, the same person without it: never a stranger's figure)
      const bare = hkLayers(hkWhoById(f.ref, f.look, f.gear), { fighting: false, activity: 'idle' });
      if (hkSprite(s, bare, col, row, x, y, HK_HEIGHT)) return;
    }
    // a party member of a fighting calling in their combat form (a Craftpix hero: art/combatPoses.ts)
    // (a werewolf fights in wolf form: the Craftpix werewolves, by who they are)
    const hero = !hs ? (f.wolf ? WOLF_FORMS[f.ref % WOLF_FORMS.length] : f.undead ? skeletonSheet(f.ranged, f.ref) : heroSheet(f.cls, f.ref)) : null;
    if (hero) {
      const facing = faceLeft ? 'left' : 'right';
      s.texture = heroFrame(hero, { facing, moving: false, walked: 0, sinceBlow: acting ? f.sinceAction : 999, sinceHit: f.sinceHit, sinceBlock: 999, down: f.down, now, ref: f.ref });
      const sc = heroScale(hero) * k; // (a wolf form at a hero's height: the rows are close on the fight screen)
      const flip = creatureFlip(hero, facing);
      s.anchor.set(0.5, 1);
      s.scale.set(sc * flip, sc);
      s.position.set(Math.round(x), Math.round(y));
      return;
    }
    const weapon = hs ? hs.weapon : heldWeapon(f.gear, 'fight');
    let anim: LpcAnim = 'walk';
    let frame = 0;
    if (f.down) {
      anim = 'hurt';
      frame = FRAME_COUNT.hurt - 1;
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
