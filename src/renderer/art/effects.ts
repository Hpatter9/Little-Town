// Spell and hit effects (see CREDITS.md). Hit sparks, the boss blast, the conjuring swirl and revive sparkles
// are from the Super Pixel Effects Gigapack (unTied Games); turning, blood bursts and the launch are from the
// Alenia Star Magic pack (cut down to every third frame and cropped); healing and the laser's shock are from
// pvfx foundry thirteen, as are the bosses' own sweeping attacks and the Summoner's portal. Ice mages' frost
// and casting are from the ICE skills pack; the pillar of light at a revival from Holy VFX 02; flames on burning
// buildings and townsfolk's emotes from 5000 Pixel Effects.

import { loadImage } from './loadImage';
import { Rectangle, Texture, type Sprite } from 'pixi.js';
import type { PersonFx } from '../../shared/sim/state';
import impactUrl from './effects/impact.png';
import blastUrl from './effects/blast.png';
import conjureUrl from './effects/conjure.png';
import reviveUrl from './effects/revive.png';
import undeadUrl from './effects/undead.png';
import vampireUrl from './effects/vampire.png';
import werewolfUrl from './effects/werewolf.png';
import healUrl from './effects/heal.png';
import shockUrl from './effects/shock.png';
import bloodUrl from './effects/bloodburst.png';
import splatSprayUrl from './effects/splat_spray.png';
import splatBurstUrl from './effects/splat_burst.png';
import splatGushUrl from './effects/splat_gush.png';
import launchUrl from './effects/launch.png';
import fireUrl from './effects/area_fire.png';
import quakeUrl from './effects/area_quake.png';
import shellUrl from './effects/area_shell.png';
import beamUrl from './effects/area_beam.png';
import acidUrl from './effects/area_acid.png';
import portalUrl from './effects/portal.png';
import frostNovaUrl from './effects/area_frost.png';
import frostUrl from './effects/frost.png';
import castUrl from './effects/cast.png';
import smokeUrl from './effects/smoke.png';
import meteorUrl from './effects/meteor.png';
import dustUrl from './effects/dust.png';
import holyUrl from './effects/holy.png';
import flameUrl from './effects/flame.png';
import zzzUrl from './effects/emote_zzz.png';
import heartUrl from './effects/emote_heart.png';
import angerUrl from './effects/emote_anger.png';
import sweatUrl from './effects/emote_sweat.png';
import noteUrl from './effects/emote_note.png';
import levelUpUrl from './effects/levelup.png';
import hitFireUrl from './effects/hit_fire.png';
import hitLightningUrl from './effects/hit_lightning.png';
import pvfxRoots from './effects/pvfx_rootscript.png';
import pvfxRain from './effects/pvfx_rain_field.png';
import pvfxLeaves from './effects/pvfx_leaf_gust.png';
import pvfxBloom from './effects/pvfx_spectral_bloom.png';
import pvfxVenomWard from './effects/pvfx_venom_ward.png';
import pvfxParry from './effects/pvfx_arcane_parry.png';
import pvfxCounterfall from './effects/pvfx_counterfall.png';
import pvfxPrism from './effects/pvfx_prism_loom.png';
import pvfxVoid from './effects/pvfx_void_implosion.png';
import pvfxMoths from './effects/pvfx_choir_moths.png';
import pvfxSuture from './effects/pvfx_suturelight.png';
import pvfxCharge from './effects/pvfx_focus_charge.png';
import pvfxSplash from './effects/pvfx_splash_crown.png';
import pvfxFoam from './effects/pvfx_shoreline_foam.png';
import pvfxHourglass from './effects/pvfx_hourglass_splinter.png';
import pvfxMercury from './effects/pvfx_mercury_molt.png';
import pvfxSpines from './effects/pvfx_ferrospine.png';
import pvfxOrchid from './effects/pvfx_cinder_orchid.png';
import pvfxMissile from './effects/pvfx_magical_projectile.png';
import aleniaBloodBubble from './effects/spell_blood_bubble.png';
import aleniaBloodStorm from './effects/spell_blood_storm.png';
import aleniaDarkFlames from './effects/spell_dark_flames.png';
import aleniaGoldVortex from './effects/spell_gold_vortex.png';
import aleniaLifeFountain from './effects/spell_life_fountain.png';
import aleniaChaosStorm from './effects/spell_chaos_storm.png';
import mgGroundFireUrl from './effects/mg_ground_fire.png';
import mgGroundFire2Url from './effects/mg_ground_fire2.png';
import mgSigilUrl from './effects/mg_sigil.png';
import mgBeamUrl from './effects/mg_beam.png';
import mgStrikeUrl from './effects/mg_strike.png';
import mgBoltUrl from './effects/mg_bolt.png';
import mgBolt2Url from './effects/mg_bolt2.png';
import mgPopUrl from './effects/mg_pop.png';
import mgSparksUrl from './effects/mg_sparks.png';
import mgFlameUrl from './effects/mg_flame.png';
import mgFlareUrl from './effects/mg_flare.png';
import mgSpikesUrl from './effects/mg_spikes.png';
import mgCreepUrl from './effects/mg_creep.png';
import mgPuffUrl from './effects/mg_puff.png';
import mgShardsUrl from './effects/mg_shards.png';
import slashWindUrl from './effects/slash_wind.png';
import slashFireUrl from './effects/slash_fire.png';
import slashLightningUrl from './effects/slash_lightning.png';
import slashPoisonUrl from './effects/slash_poison.png';
import slashGoldUrl from './effects/slash_gold.png';
import slashWaterUrl from './effects/slash_water.png';
import type { AreaFx } from '../../shared/data/enemies';
import pixelFxIndex from './effects/pixelfx.json';

/** A 7-frame impact burst, 48px square, played over whoever was just hit. */
export const IMPACT_FRAMES = 7;
export const IMPACT_SIZE = 48;
/** A boss's sweeping attack: a 13-frame explosion, 64px square. */
export const BLAST_FRAMES = 13;
export const BLAST_SIZE = 64;
/** Dark magic as an ally is summoned, raised or tamed: a 31-frame violet swirl, 64px. */
export const CONJURE_FRAMES = 31;
/** Golden sparkles as someone is brought back from death: 24 frames of 96px, 4 to a row. */
export const REVIVE_SIZE = 96;
/** Spells on townsfolk (turned, healed) are 96px; a Blood Knight's hit is 56px; the launch is 192px. */
export const SPELL_SIZE = 96;
export const BLOOD_SIZE = 56;
export const LAUNCH_SIZE = 192;

const impacts: Texture[] = [];
/** Blood (the Gigapack's red splatters, 64px): a spray flung from a blow, a gush from a heavy one, a burst where
 *  someone falls (its last frame is the stain left on the ground). */
export const SPLAT_SIZE = 64;
const splatSprays: Texture[] = [];
const splatBursts: Texture[] = [];
const splatGushes: Texture[] = [];
const blasts: Texture[] = [];
const conjures: Texture[] = [];
const revives: Texture[] = [];
const spells: Record<PersonFx, Texture[]> = { undead: [], vampire: [], werewolf: [], heal: [], frost: [] };
/** An ice mage casting: a cold vortex (ICE skills pack), 14 frames of 96px. */
const casts: Texture[] = [];
/** Smoke over a burning building, a meteor's impact, dust where a building came down (pvfx, 96px, 14 frames);
 *  a pillar of holy light as someone is revived (Holy VFX 02, 48px, 16 frames). */
const smokes: Texture[] = [];
const meteors: Texture[] = [];
const dusts: Texture[] = [];
export const HOLY_SIZE = 48;
const holies: Texture[] = [];
/** Flames licking up a burning building (32px, 8 frames) and the emotes over townsfolk (16px, 6 frames), from the
 *  5000 Pixel Effects pack. */
export const FLAME_SIZE = 32;
const flames: Texture[] = [];
export type Emote = 'zzz' | 'heart' | 'anger' | 'sweat' | 'note';
export const EMOTE_SIZE = 16;
const emotes: Record<Emote, Texture[]> = { zzz: [], heart: [], anger: [], sweat: [], note: [] };
/** A golden arrow when someone gets better at something (32px, 6 frames, same pack). */
const levelUps: Texture[] = [];
/** A gunshot's and a laser's hit (32px, 6 frames, same pack). */
const fireHits: Texture[] = [];
const lightningHits: Texture[] = [];
const shocks: Texture[] = [];
const bloods: Texture[] = [];
const launches: Texture[] = [];
/** Bosses' sweeping attacks and the Summoner's rift portal: 96px frames, 5 to a row. */
export const AREA_SIZE = 96;
const areas: Record<AreaFx, Texture[]> = { fire: [], quake: [], shell: [], beam: [], acid: [], frost: [] };
const portals: Texture[] = [];
/** Jets and beams start at the boss and point the way it faces (the art points right); the rest burst in front. */
export const AREA_FROM_BOSS: Record<AreaFx, boolean> = { fire: true, beam: true, quake: false, shell: false, acid: false, frost: false };

/** Load a sheet and cut `count` square frames of `size`, `across` to a row, from frame `from` on. */
async function cut(url: string, size: number, count: number, into: Texture[], across = count, from = 0): Promise<void> {
  const im = await loadImage(url);
  const src = Texture.from(im).source;
  for (let i = from; i < count; i++) into.push(new Texture({ source: src, frame: new Rectangle((i % across) * size, Math.floor(i / across) * size, size, size) }));
}

/**
 * Spell sheets (see town/spellsView.ts): pvfx-foundry's CC0 effects (96px, 5 to a row) and a few of the Alenia Star
 * Magic Pack's, shrunk from 320px (the vampire's blood bubble and blood storm, dark flames, a golden vortex, a fountain
 * of life, a chaotic storm). Each: the sheet, its frame size, frames, frames to a row.
 */
const SPELL_SHEET_DEFS = {
  roots: [pvfxRoots, 96, 48, 5],
  rain: [pvfxRain, 96, 16, 5],
  leaves: [pvfxLeaves, 96, 14, 5],
  bloom: [pvfxBloom, 96, 16, 5],
  venom_ward: [pvfxVenomWard, 96, 16, 5],
  parry: [pvfxParry, 96, 16, 5],
  counterfall: [pvfxCounterfall, 96, 40, 5],
  prism: [pvfxPrism, 96, 60, 5],
  void: [pvfxVoid, 96, 14, 5],
  moths: [pvfxMoths, 96, 60, 5],
  suture: [pvfxSuture, 96, 36, 5],
  charge: [pvfxCharge, 96, 14, 5],
  splash: [pvfxSplash, 96, 14, 5],
  foam: [pvfxFoam, 96, 16, 5],
  hourglass: [pvfxHourglass, 96, 28, 5],
  mercury: [pvfxMercury, 96, 32, 5],
  spines: [pvfxSpines, 96, 40, 5],
  orchid: [pvfxOrchid, 96, 42, 5],
  missile: [pvfxMissile, 96, 12, 5],
  blood_bubble: [aleniaBloodBubble, 128, 20, 5],
  blood_storm: [aleniaBloodStorm, 112, 16, 4],
  dark_flames: [aleniaDarkFlames, 128, 20, 5],
  gold_vortex: [aleniaGoldVortex, 112, 16, 4],
  life_fountain: [aleniaLifeFountain, 128, 20, 5],
  chaos_storm: [aleniaChaosStorm, 112, 16, 4],
  // (Craftpix's Pixel Magic Sprite Effects: 72px strips; and its Magic Slash pack, cut to 96px by tools/compose-effects.cjs)
  mg_ground_fire: [mgGroundFireUrl, 72, 8, 8],
  mg_ground_fire2: [mgGroundFire2Url, 72, 8, 8],
  mg_sigil: [mgSigilUrl, 72, 8, 8],
  mg_beam: [mgBeamUrl, 72, 8, 8],
  mg_strike: [mgStrikeUrl, 72, 8, 8],
  mg_bolt: [mgBoltUrl, 72, 4, 4],
  mg_bolt2: [mgBolt2Url, 72, 4, 4],
  mg_pop: [mgPopUrl, 72, 4, 4],
  mg_sparks: [mgSparksUrl, 72, 8, 8],
  mg_flame: [mgFlameUrl, 72, 4, 4],
  mg_flare: [mgFlareUrl, 72, 4, 4],
  mg_spikes: [mgSpikesUrl, 72, 8, 8],
  mg_creep: [mgCreepUrl, 72, 8, 8],
  mg_puff: [mgPuffUrl, 72, 8, 8],
  mg_shards: [mgShardsUrl, 72, 6, 6],
  slash_wind: [slashWindUrl, 96, 18, 5],
  slash_fire: [slashFireUrl, 96, 12, 5],
  slash_lightning: [slashLightningUrl, 96, 12, 5],
  slash_poison: [slashPoisonUrl, 96, 24, 5],
  slash_gold: [slashGoldUrl, 96, 20, 5],
  slash_water: [slashWaterUrl, 96, 12, 5],
} as const;
export type SpellSheet = keyof typeof SPELL_SHEET_DEFS;
const spellSheets = Object.fromEntries(Object.keys(SPELL_SHEET_DEFS).map((k) => [k, [] as Texture[]])) as Record<SpellSheet, Texture[]>;
/** A spell sheet's frame size, and frame `i` of it (null once it's over, or before loading). */
export const spellSheetSize = (id: SpellSheet) => SPELL_SHEET_DEFS[id][1];
export const spellSheetFrame = (id: SpellSheet, i: number) => at(spellSheets[id], i);

/* ------------------------------------------------------------ the pixel effects atlas (tools/compose-pixelfx.cjs) */

/** The 5000 Pixel Effects atlas: every element in every shape (`px:<element>-<family>` in data/actFx.ts), 32px frames,
 *  loaded beside the page (`fx/pixelfx.png`) when the effects load; a strip's frames are cut when first asked for. */
const PIXELFX = pixelFxIndex as unknown as { size: number; frames: number; across: number; strips: Record<string, [number, number, number]> };
export const PIXELFX_SIZE = PIXELFX.size;
let pixelFxSource: Texture['source'] | null = null;
const pixelFxStrips = new Map<string, Texture[]>();
export const pixelFxHas = (id: string) => !!PIXELFX.strips[id];
/** Frame `i` of a pixel effect (its id without the `px:`): null before the atlas loads, or once the strip is over. */
export function pixelFxFrame(id: string, i: number): Texture | null {
  const at = PIXELFX.strips[id];
  if (!at || !pixelFxSource) return null;
  let list = pixelFxStrips.get(id);
  if (!list) {
    const [col, row, n] = at;
    list = [];
    for (let f = 0; f < n; f++) list.push(new Texture({ source: pixelFxSource, frame: new Rectangle(col * PIXELFX.size * PIXELFX.frames + f * PIXELFX.size, row * PIXELFX.size, PIXELFX.size, PIXELFX.size) }));
    pixelFxStrips.set(id, list);
  }
  return i >= 0 && i < list.length ? list[Math.floor(i)] : null;
}
export const pixelFxFrames = (id: string) => PIXELFX.strips[id]?.[2] ?? 0;
async function loadPixelFx(): Promise<void> {
  try {
    const im = await loadImage('fx/pixelfx.png');
    const src = Texture.from(im).source;
    src.scaleMode = 'nearest';
    pixelFxSource = src;
  } catch {
    // (no atlas: the older sheets stand in, see spellsView's sheetOf)
  }
}

export async function loadEffects(): Promise<void> {
  void loadPixelFx();
  await Promise.all([
    ...(Object.entries(SPELL_SHEET_DEFS) as [SpellSheet, readonly [string, number, number, number]][]).map(([id, [url, size, count, across]]) => cut(url, size, count, spellSheets[id], across)),
    cut(impactUrl, IMPACT_SIZE, IMPACT_FRAMES, impacts),
    cut(splatSprayUrl, SPLAT_SIZE, 8, splatSprays),
    cut(splatBurstUrl, SPLAT_SIZE, 10, splatBursts),
    cut(splatGushUrl, SPLAT_SIZE, 7, splatGushes, 4),
    cut(blastUrl, BLAST_SIZE, BLAST_FRAMES, blasts),
    cut(conjureUrl, BLAST_SIZE, CONJURE_FRAMES, conjures),
    cut(reviveUrl, REVIVE_SIZE, 24, revives, 4),
    cut(undeadUrl, SPELL_SIZE, 20, spells.undead),
    cut(vampireUrl, SPELL_SIZE, 20, spells.vampire),
    cut(werewolfUrl, SPELL_SIZE, 20, spells.werewolf),
    cut(healUrl, SPELL_SIZE, 15, spells.heal, 5),
    cut(shockUrl, SPELL_SIZE, 15, shocks, 5),
    // (the first frames are the drop falling in: a hit starts at the burst)
    cut(bloodUrl, BLOOD_SIZE, 20, bloods, 20, 7),
    cut(launchUrl, LAUNCH_SIZE, 20, launches),
    cut(fireUrl, AREA_SIZE, 14, areas.fire, 5),
    cut(quakeUrl, AREA_SIZE, 20, areas.quake, 5),
    cut(shellUrl, AREA_SIZE, 15, areas.shell, 5),
    cut(beamUrl, AREA_SIZE, 16, areas.beam, 5),
    cut(acidUrl, AREA_SIZE, 14, areas.acid, 5),
    cut(portalUrl, AREA_SIZE, 16, portals, 5),
    cut(frostNovaUrl, AREA_SIZE, 13, areas.frost, 5),
    cut(frostUrl, SPELL_SIZE, 9, spells.frost),
    cut(castUrl, SPELL_SIZE, 14, casts),
    cut(smokeUrl, AREA_SIZE, 14, smokes, 5),
    cut(meteorUrl, AREA_SIZE, 14, meteors, 5),
    cut(dustUrl, AREA_SIZE, 14, dusts, 5),
    cut(holyUrl, HOLY_SIZE, 16, holies),
    cut(flameUrl, FLAME_SIZE, 8, flames),
    cut(zzzUrl, EMOTE_SIZE, 6, emotes.zzz),
    cut(heartUrl, EMOTE_SIZE, 6, emotes.heart),
    cut(angerUrl, EMOTE_SIZE, 6, emotes.anger),
    cut(sweatUrl, EMOTE_SIZE, 6, emotes.sweat),
    cut(noteUrl, EMOTE_SIZE, 6, emotes.note),
    cut(levelUpUrl, FLAME_SIZE, 6, levelUps),
    cut(hitFireUrl, FLAME_SIZE, 6, fireHits),
    cut(hitLightningUrl, FLAME_SIZE, 6, lightningHits),
  ]);
}

const at = (list: Texture[], i: number): Texture | null => (i >= 0 && i < list.length ? list[Math.floor(i)] : null);

/** Frame `i` of each effect (null once it's over, or before loading). */
export const impactFrame = (i: number) => at(impacts, i);
/** A frame of blood: `spray` for an ordinary blow, `gush` for a heavy one, `burst` for a fall (null once over). The
 *  sprays fly to the right: flip them to fly away from the striker. */
export function splatFrame(i: number, kind: 'spray' | 'gush' | 'burst' = 'spray'): Texture | null {
  return at(kind === 'spray' ? splatSprays : kind === 'gush' ? splatGushes : splatBursts, i);
}
/** The stain a burst leaves (its widest frame, before the drops thin out), for the ground where someone fell; null
 *  until loaded. */
export const bloodPoolTexture = (): Texture | null => splatBursts[5] ?? null;
export const blastFrame = (i: number) => at(blasts, i);
export const conjureFrame = (i: number) => at(conjures, i);
export const reviveFrame = (i: number) => at(revives, i);
export const spellFrame = (kind: PersonFx, i: number) => at(spells[kind], i);
export const spellFrames = (kind: PersonFx) => spells[kind].length || 20;
export const areaFrame = (fx: AreaFx, i: number) => at(areas[fx], i);
export const portalFrame = (i: number) => at(portals, i);
export const castFrame = (i: number) => at(casts, i);
/** Smoke loops for as long as the fire burns. */
export const smokeFrame = (i: number) => (smokes.length ? smokes[Math.floor(i) % smokes.length] : null);
export const meteorFrame = (i: number) => at(meteors, i);
export const dustFrame = (i: number) => at(dusts, i);
export const holyFrame = (i: number) => at(holies, i);
/** Flames and emotes loop. */
const loop = (list: Texture[], i: number) => (list.length ? list[((Math.floor(i) % list.length) + list.length) % list.length] : null);
export const flameFrame = (i: number) => loop(flames, i);
export const emoteFrame = (kind: Emote, i: number) => loop(emotes[kind], i);
export const levelUpFrame = (i: number) => at(levelUps, i);
export const fireHitFrame = (i: number) => at(fireHits, i);
export const lightningHitFrame = (i: number) => at(lightningHits, i);
export const shockFrame = (i: number) => at(shocks, i);
export const bloodFrame = (i: number) => at(bloods, i);
/** The launch loops (for as long as the ship is lifting off). */
export const launchFrame = (i: number) => (launches.length ? launches[Math.floor(i) % launches.length] : null);

/** Boss effects are drawn half again as big. */
const AREA_SCALE = 1.5;
/** Where each boss effect is pinned in its 96px frame (from the pack's manifests): the nozzle of a jet or beam,
 *  the ground under a burst. The plain blast is pinned at its bottom centre. */
const AREA_PIVOT: Record<AreaFx, [number, number]> = { fire: [24, 56], beam: [12, 48], quake: [48, 71], shell: [48, 58], acid: [48, 64], frost: [48, 61] };
/** Jets and beams come out this high off the ground; bursts land this far in front of the boss. */
const NOZZLE_HEIGHT = 26;
const BURST_AHEAD = 50;

/**
 * Show a boss's sweeping attack on `sprite`, `since` ticks after it: its own effect if it has one (fire, a
 * quake...), else the plain blast. `x` is the boss, facing `dir`; `ground` is the walkway's y.
 */
export function placeArea(sprite: Sprite, fx: AreaFx | undefined, since: number, x: number, dir: number, ground: number): void {
  const tex = fx ? areaFrame(fx, since) : blastFrame(since);
  sprite.visible = !!tex;
  if (!tex) return;
  sprite.texture = tex;
  const flip = dir < 0 ? -1 : 1;
  const [px, py] = fx ? AREA_PIVOT[fx] : [BLAST_SIZE / 2, BLAST_SIZE - 8];
  const fromBoss = !!fx && AREA_FROM_BOSS[fx];
  // the pinned point: at the boss's mouth or gun for a jet, on the ground ahead for a burst
  const ax = x + dir * (fromBoss ? 10 : BURST_AHEAD);
  const ay = ground - (fromBoss ? NOZZLE_HEIGHT : 0);
  // (the art points right: flipped, it's drawn leftward from the sprite's x)
  sprite.scale.set(AREA_SCALE * flip, AREA_SCALE);
  sprite.x = Math.round(ax - flip * px * AREA_SCALE);
  sprite.y = Math.round(ay - py * AREA_SCALE);
}