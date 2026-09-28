// Spell and hit effects (see CREDITS.md). Hit sparks, the boss blast, the conjuring swirl and revive sparkles
// are from the Super Pixel Effects Gigapack (unTied Games); turning, blood bursts and the launch are from the
// Alenia Star Magic pack (cut down to every third frame and cropped); healing and the laser's shock are from
// pvfx foundry thirteen, as are the bosses' own sweeping attacks and the Summoner's portal. Ice mages' frost
// and casting are from the ICE skills pack; the pillar of light at a revival from Holy VFX 02; flames on burning
// buildings and townsfolk's emotes from 5000 Pixel Effects.

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
import type { AreaFx } from '../../shared/data/enemies';

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
  const im = new Image();
  im.src = url;
  await im.decode();
  const src = Texture.from(im).source;
  for (let i = from; i < count; i++) into.push(new Texture({ source: src, frame: new Rectangle((i % across) * size, Math.floor(i / across) * size, size, size) }));
}

export async function loadEffects(): Promise<void> {
  await Promise.all([
    cut(impactUrl, IMPACT_SIZE, IMPACT_FRAMES, impacts),
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