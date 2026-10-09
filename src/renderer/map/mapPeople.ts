// Draws the townsfolk (and strangers, and the visitor at the edge of town) on the map. Positions arrive at the sim's
// tick rate and are interpolated per frame; everyone stands in `things`, sorted by their feet. The LPC sprites are
// side-on: they face the way they're going, left or right.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ClassId } from '../../shared/data/classes';
import type { PersonView } from '../../shared/sim/snapshot';
import { fxTicks, type PersonFx } from '../../shared/sim/state';
import { TICK_MS } from '../../shared/sim/time';
import { drawMarks, limpDip, marksKey } from './bodyMarks';
import { HK_CELL, HK_FEET, HK_FIGURE, hkLayers, hkPose, hkWhoOf, type HkFacing } from '../art/hkFolk';
import { hkTexture } from '../art/hkTexture';
import { CREATURE_FRAME, creatureFrame, creatureSize, type CreatureSheet } from '../art/creatures';
import { EMOTE_SIZE, emoteFrame, levelUpFrame, HOLY_SIZE, holyFrame, REVIVE_SIZE, reviveFrame, SPELL_SIZE, spellFrame, spellFrames, SPLAT_SIZE, splatFrame, type Emote } from '../art/effects';
import { fightAnim, fightPose, founderSheet, heroFrame, heroScale, heroSheet, SHOOT_TICKS, skeletonSheet, WOLF_FORMS, WOLF_SCALE } from '../art/combatPoses';
import { creatureFlip } from '../art/creatures';
import { loadImage } from '../art/loadImage';
import barrowUrl from '../art/shops/gb_barrow.png';
import { hauls, heapColour, mainLoad } from './haul';

import { heldWeapon, wardrobe, wornLayers } from '../art/held';
import { CENTRE_X, FEET_Y, FRAME_COUNT, FRAME_SIZE, lpcFrame, type LpcAnim } from '../art/lpc/lpc';
import { glowTexture } from '../town/layer';
import { TAIL_H, TAIL_W, tailTexture, WAIST } from '../art/merTail';
import { BEAT, danceStep, mournStep, type DanceStep } from './dance';
import { reflectOf, waterBelow } from './reflections';
import type { LandMap } from '../../shared/sim/land';
import { hash01, lineNow, makeBubble, REPLY_AFTER, SPEECH_EVERY, SPEECH_FOR, SPEECH_SHARE, TALK_NEAR, type SpeechContext } from './speech';

/** Standing still, a person breathes (a pixel's rise every couple of seconds) and shifts their weight now and then
 *  (a step frame for a moment every few seconds), each on their own clock, so nobody looks frozen. */
export function idleBreath(now: number, id: number): number {
  return Math.sin(now / 900 + id * 1.7) > 0.55 ? 1 : 0;
}
export function idleFidget(now: number, id: number): number {
  const t = (now / 1000 + id * 2.3) % (4 + (id % 3));
  return t < 0.18 ? 1 : t > 2.2 && t < 2.36 ? 8 : 0;
}

const EMOTE_EVERY = 11;
const EMOTE_FOR = 3;
const PILLAR_SCALE = 2;
const HORSE_SCALE = 0.85;
const SADDLE_LIFT = 16;
const BLEED_MINUTES = 120;
const CHILD_SCALE = 0.7;
/** A Himeko figure drawn as tall as the side-on townsfolk were (about 48px). */
const HK_K = 48 / HK_FIGURE;
/** Where a Himeko figure's waist is in its cell (a swimmer shows down to it). */
const HK_WAIST = 0.67;
const PX_PER_WALK_FRAME = 4;
const HIT_HALF_W = 11;
const HIT_H = 50;
/** At these a founder's hero swings their blow over and over (their work, in the only pose the sheets have for it). */
const WORK_SWING = new Set(['chop', 'mine', 'build', 'reap', 'till', 'forage', 'spar']);
/** A founder is drawn this much bigger than the townsfolk, with an aura in their origin's colour. */
const FOUNDER_SCALE = 1.14;
const AURA: Record<string, number> = { town: 0xffd860, lich: 0x9a6aff, druid: 0x7ae070, vampire: 0xff3048, werewolf: 0xc8d8ff, robot: 0x60e0ff, dwarves: 0xffa040, merfolk: 0x40e0e0, nomads: 0xffc060, fae: 0xff90e0, knights: 0xf0f0ff, alchemists: 0x80ff80, settlers: 0xffd860 };

/** How long after their last blow or wound a fighting calling keeps its combat form (ticks). */
const HERO_LINGER = 50;

/** Each class's Pixel Champions hero: its sheet and block (a mage is the sage sheet's blue-robed wizard). */
const CLASS_LOOK: Partial<Record<ClassId, [CreatureSheet, number]>> = {
  necromancer: ['champ_necromancer', 0],
  summoner: ['champ_summoner', 0],
  beast_tamer: ['champ_beast_tamer', 0],
  blood_knight: ['champ_blood_knight', 0],
  mage: ['champ_sage', 4],
};

/** The work bar over a head: its width (px) and how far above the feet it floats. */
const WORK_W = 18;
const WORK_ABOVE = 58;
/** A shapeshifter's bear: its block on the MV bear sheet, and its size against a person. */
/** The health bar's width (px) in a raid. */
const HP_W = 20;
/** The crier cries the news this long in every so long (ms). */
const CRY_EVERY = 20000;
const CRY_FOR = 6500;
/** The barrow's size, and how far ahead of the one pushing it (px). */
const BARROW_SCALE = 0.62;
const BARROW_AHEAD = 13;
let barrowTex: Texture | null = null;
loadImage(barrowUrl)
  .then((im) => {
    barrowTex = Texture.from(im);
    barrowTex.source.scaleMode = 'nearest';
  })
  .catch(() => undefined);

interface Drawn {
  view: PersonView;
  visitor: boolean;
  sprite: Sprite;
  shadow: Sprite;
  horse: Sprite;
  load: Graphics;
  /** The wheelbarrow pushed with a heavy load (map/haul.ts), and its heap's key. */
  barrow?: Container;
  /** Their reflection, standing at the water's edge (map/reflections.ts). */
  reflect?: Sprite;
  /** A child's kite on a fair, breezy day at play. */
  kite?: Graphics;
  heapKey?: string;
  bubble: Graphics;
  blood?: Graphics;
  bleedFrom?: number;
  /** The spray of a blow landing. */
  spray: Sprite;
  emote?: Sprite;
  levels?: number;
  levelAt?: number;
  levelUp?: Sprite;
  aura?: Sprite;
  /** Their harm as it shows (map/bodyMarks.ts): a patch, a peg, a hook, a crutch, a bandage; and what's drawn. */
  marks?: Graphics;
  marksKey?: string;
  /** Their lantern's glow (in the map's lights layer, so it shows after dark). */
  lamp?: Sprite;
  /** How far along the work in hand is, as a little bar over their head, and the fill last drawn. */
  work?: Graphics;
  workFill?: number;
  /** The last Himeko frame drawn: held while a new look's layers load (a weapon drawn for a fight), so nobody turns
   *  into someone else for a moment. */
  hkLast?: Texture;
  /** Their health over their head in a raid (the raiders have theirs), and the fill last drawn. */
  hpBar?: Graphics;
  hpFill?: string;
  /** A merfolk's tail, while they swim (art/merTail.ts). */
  tail?: Sprite;
  /** What they're saying (map/speech.ts), and the slot it was said in. */
  speech?: Container;
  speechSlot?: number;
  /** Answering someone beside them until this time. */
  replyUntil?: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: number;
  x: number;
  y: number;
  walked: number;
  animStart: number;
  /** Walking up or down the map (from the way they last moved), else side-on. */
  face: 'up' | 'down' | null;
  lastActivity: string;
  /** Standing still (snapshots in a row on the same spot), the step aside they're given so nobody stands on top of
   *  anyone else (`spread`), and how far aside they are drawn now (eased toward it; back to nothing once they walk). */
  stillSince?: number;
  aside?: { x: number; y: number };
  off?: { x: number; y: number };
}

/** Two people standing still closer than this (px) are stepped apart; walkers pass through each other. */
const PERSONAL_SPACE = 32;
/** Up and down the map counts this much of across (people stand closer front to back than side by side). */
const SQUASH = 0.75;
/** How long (ms) on one spot before someone counts as standing still (a pause in a walk, at a door or a queue, is
 *  left alone: stepping people aside on every pause had them jigging about), and how often the steps aside are
 *  worked out. */
const STILL_AFTER = 1200;
const SPREAD_EVERY = 250;
/** The places a step aside may take them: beside the spot and below it, a ring then a wider one, never up the map.
 *  (Someone working at a building's door stands on its bottom edge: stepped up, they went behind the building and
 *  vanished, then came out again as the places were dealt afresh: the owner's complaint that townsfolk flashed.) */
const ASIDE: readonly [number, number][] = [0, 1, 2].flatMap((ring) =>
  Array.from({ length: 4 + ring * 2 }, (_, k): [number, number] => {
    // (across the lower half-circle, from the right round to the left, the sides first)
    const n = 4 + ring * 2;
    const order = k % 2 === 0 ? k / 2 : n - 1 - (k - 1) / 2;
    const a = (order / (n - 1)) * Math.PI;
    const r = PERSONAL_SPACE * (ring + 1);
    return [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * SQUASH)];
  }),
);
/** How quickly a step aside is taken (a share of the way each frame at 60 fps). */
const ASIDE_EASE = 0.12;

export class MapPeople {
  private readonly drawn = new Map<number, Drawn>();
  moon = false;
  theme = 'town';
  /** What's going on, for what people say (main.ts, per snapshot), and the camera's zoom (bubbles stay readable). */
  weather = 'clear';
  season = 'spring';
  hour = 12;
  raid = false;
  zoom = 1;
  /** The latest news (main.ts, per snapshot): the town crier, the best talker about, calls it out now and then. */
  news: { id: number; text: string } | null = null;
  /** Where the sun leans their shadows (px aside; main.ts, from art/sun.ts). */
  sunLean = 0;
  /** The land (main.ts), for the reflections at the water's edge. */
  land: LandMap | null = null;
  private crierId = -1;
  /** The map's lights layer (main.ts): everyone out after dark carries a lantern's glow there. */
  lights: Container | null = null;
  weave = false;
  founderId = -1;
  revived: { id: number; since: number; at: number } | null = null;
  fx: { id: number; kind: PersonFx; since: number; at: number }[] = [];
  private readonly sparkle = new Sprite();
  private readonly pillar = new Sprite();
  private readonly spells: Sprite[] = [];

  constructor(private readonly layer: Container) {
    this.sparkle.visible = false;
    this.sparkle.zIndex = 1e8;
    this.pillar.visible = false;
    this.pillar.zIndex = 1e8;
    this.pillar.scale.set(PILLAR_SCALE);
    layer.addChild(this.sparkle, this.pillar);
  }

  update(people: PersonView[], visitor: PersonView | null, now: number): void {
    const seen = new Set<number>();
    const all = visitor ? [...people.map((p) => [p, false] as const), [visitor, true] as const] : people.map((p) => [p, false] as const);
    for (const [p, isVisitor] of all) {
      seen.add(p.id);
      let d = this.drawn.get(p.id);
      if (!d) {
        const shadow = this.layer.addChild(new Sprite(glowTexture()));
        shadow.anchor.set(0.5);
        shadow.tint = 0x000000;
        const load = this.layer.addChild(bundle());
        const horse = this.layer.addChild(new Sprite());
        horse.scale.set(HORSE_SCALE);
        horse.visible = false;
        const sprite = this.layer.addChild(new Sprite());
        sprite.anchor.set(CENTRE_X / FRAME_SIZE, FEET_Y / FRAME_SIZE);
        const bubble = this.layer.addChild(questionBubble());
        const spray = this.layer.addChild(new Sprite());
        spray.anchor.set(0.5, 0.5);
        spray.visible = false;
        d = { view: p, visitor: isVisitor, sprite, shadow, horse, load, bubble, spray, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y }, at: now, x: p.x, y: p.y, walked: 0, animStart: now, lastActivity: p.activity, face: null };
        this.drawn.set(p.id, d);
      }
      if (d.stillSince === undefined || Math.abs(p.x - d.to.x) >= 0.5 || Math.abs(p.y - d.to.y) >= 0.5) d.stillSince = now;
      d.from = { x: d.x, y: d.y };
      d.to = { x: p.x, y: p.y };
      d.at = now;
      const levels = Object.values(p.skills).reduce((n, k) => n + k.level, 0);
      if (d.levels !== undefined && levels > d.levels) d.levelAt = now;
      d.levels = levels;
      if (p.activity !== d.lastActivity) {
        d.animStart = now;
        d.lastActivity = p.activity;
      }
      d.view = p;
      d.visitor = isVisitor;
    }
    let best = -1;
    this.crierId = -1;
    for (const d of this.drawn.values()) {
      const v = d.view;
      if (d.visitor || v.indoors || v.growsUpIn !== null || v.activity === 'fight' || v.activity === 'sleep' || v.typeName === 'Traveller') continue;
      const social = v.skills.social?.level ?? 0;
      if (social > best) [best, this.crierId] = [social, v.id];
    }
    for (const [id, d] of this.drawn)
      if (!seen.has(id)) {
        for (const o of [d.sprite, d.shadow, d.horse, d.load, d.bubble, d.spray, d.barrow, d.reflect, d.kite, d.blood, d.emote, d.levelUp, d.aura, d.lamp, d.tail, d.speech, d.marks, d.work, d.hpBar]) o?.destroy();
        this.drawn.delete(id);
      }
  }

  /** Nobody stands on top of anyone else: those standing still, by id, each keep their spot unless someone already
   *  placed is within `PERSONAL_SPACE`, and then take the nearest free place round it (`ASIDE`). Walkers are left alone. */
  private spreadAt = 0;
  private spread(now: number): void {
    if (now - this.spreadAt < SPREAD_EVERY) return;
    this.spreadAt = now;
    // (in a raid everyone stands where the fight put them: on the battle board the tiles lie closer than a step
    // aside, and the steps had the fighters jigging about (the owner's complaint))
    if (this.raid) {
      for (const d of this.drawn.values()) d.aside = undefined;
      return;
    }
    const placed: { x: number; y: number }[] = [];
    const still = [...this.drawn.values()].filter((d) => !d.view.indoors && now - (d.stillSince ?? now) >= STILL_AFTER).sort((a, b) => a.view.id - b.view.id);
    const free = (x: number, y: number) => placed.every((q) => Math.hypot(q.x - x, (q.y - y) / SQUASH) >= PERSONAL_SPACE);
    for (const d of this.drawn.values()) if (!still.includes(d)) d.aside = undefined;
    for (const d of still) {
      const keep = d.aside && free(d.to.x + d.aside.x, d.to.y + d.aside.y) ? d.aside : null;
      const step = keep ?? (free(d.to.x, d.to.y) ? { x: 0, y: 0 } : (ASIDE.map(([x, y]) => ({ x, y })).find((o) => free(d.to.x + o.x, d.to.y + o.y)) ?? { x: 0, y: 0 }));
      d.aside = step;
      placed.push({ x: d.to.x + step.x, y: d.to.y + step.y });
    }
  }

  private dressed(v: PersonView): [PersonView['look'], string[]] {
    if (v.typeName === 'Traveller' || v.look.wear) return [v.look, wornLayers(v.gear, v.gearQ)];
    const w = wardrobe({ id: v.id, gender: v.look.gender, typeName: v.typeName, gear: v.gear, coins: v.coins, child: v.growsUpIn !== null, founder: v.id === this.founderId }, this.theme, this.weave);
    return [{ ...v.look, outfit: w.outfit }, [...w.wear, ...wornLayers(v.gear, v.gearQ)]];
  }

  /** A person's Himeko look for now (art/hkFolk.ts), as a texture; null while their layers load. */
  private hkTexture(d: Drawn, now: number, inCombat: boolean, moving: boolean, step: DanceStep | null = null): Texture | null {
    const v = d.view;
    const fighting = inCombat || v.activity === 'fight';
    const working = WORK_SWING.has(v.activity) && !fighting;
    const reading = v.activity === 'research' && !fighting;
    const keys = hkLayers(hkWhoOf(v), { fighting, activity: v.activity });
    // (up or down the map while that's mostly how they walk; else the side they're turned to; a reader turned away
    // would hold the book over their head, so they read facing us)
    const side: HkFacing = v.dir < 0 ? 'left' : 'right';
    let facing: HkFacing = step?.facing && !fighting ? step.facing : !fighting && !working && d.face ? d.face : side;
    if (reading && facing === 'up') facing = 'down';
    let [col, row] = hkPose({ facing, moving, walked: d.walked, working, sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, down: v.downed !== null || (v.activity === 'sit' && !moving), ranged: v.battle.ranged, now, reading, playing: (v.activity === 'play' || v.activity === 'protest') && !fighting, ref: v.id });
    // (dancing at a feast, or mourning: map/dance.ts)
    if (step && step.col !== null && !fighting) col = step.col;
    return hkTexture(keys, col, row);
  }

  /** Now and then someone says a line in their nature's voice (map/speech.ts): in a slot of their own by their id,
   *  a share of the time; someone standing by answers a moment later. */
  private speak(d: Drawn, now: number, x: number, y: number, z: number, hidden: boolean): void {
    const v = d.view;
    const t = now + v.id * 7331;
    const slot = Math.floor(t / SPEECH_EVERY);
    const into = t - slot * SPEECH_EVERY;
    const quiet = hidden || d.visitor || v.activity === 'sleep' || v.activity === 'fight' || v.downed !== null || v.sinceHit < 20;
    // someone near: a friend, a rival, a child, anyone (and whether this one is the answerer, a little later)
    let nearFriend = false;
    let nearRival = false;
    let nearChild = false;
    let nearAnyone = false;
    let answering = false;
    for (const o of this.drawn.values()) {
      if (o === d || o.view.indoors || Math.hypot(o.x - d.x, o.y - d.y) > TALK_NEAR) continue;
      nearAnyone = true;
      if (v.friends.includes(o.view.name)) nearFriend = true;
      if (v.rivals.includes(o.view.name)) nearRival = true;
      if (o.view.growsUpIn !== null) nearChild = true;
      if (o.speech?.visible && o.speechSlot !== undefined && now - (o.speechSlot * SPEECH_EVERY - o.view.id * 7331) < REPLY_AFTER + 400 && now - (o.speechSlot * SPEECH_EVERY - o.view.id * 7331) >= REPLY_AFTER) answering = true;
    }
    const share = (window as unknown as { __talk?: number }).__talk ?? SPEECH_SHARE; // (previews: everyone talks)
    const talk = (window as unknown as { __talk?: number }).__talk;
    // (an answer, once begun, stays up its full time)
    if (answering && !quiet && (d.replyUntil === undefined || now > d.replyUntil + SPEECH_EVERY / 4)) d.replyUntil = now + SPEECH_FOR;
    const replying = d.replyUntil !== undefined && now < d.replyUntil;
    const speaks = !quiet && ((into < (talk ? SPEECH_EVERY : SPEECH_FOR) && hash01(v.id, slot) < share) || replying);
    // (the town crier: "Hear ye!" and the latest news, for a few seconds in every twenty while it's fresh)
    if (this.news && v.id === this.crierId && !quiet && (now % CRY_EVERY < CRY_FOR || (window as unknown as { __cry?: number }).__cry)) {
      const cryKey = -1 - this.news.id;
      if (d.speechSlot !== cryKey || !d.speech) {
        d.speech?.destroy();
        const text = this.news.text.length > 70 ? `${this.news.text.slice(0, 68)}…` : this.news.text;
        d.speech = this.layer.addChild(makeBubble(`Hear ye! ${text}`));
        d.speechSlot = cryKey;
      }
      const kz = Math.min(2.2, Math.max(1, 1 / Math.max(0.25, this.zoom)));
      d.speech.visible = true;
      d.speech.scale.set(kz);
      d.speech.position.set(Math.round(x), Math.round(y) - 64);
      d.speech.zIndex = z + 1e7;
      return;
    }
    if (!speaks) {
      if (d.speech) d.speech.visible = false;
      return;
    }
    const key = replying && !(into < SPEECH_FOR && hash01(v.id, slot) < share) ? Math.floor((d.replyUntil ?? 0) / 1000) + 100000 : slot;
    if (d.speechSlot !== key || !d.speech) {
      d.speech?.destroy();
      const c: SpeechContext = { weather: this.weather, season: this.season, hour: this.hour, raid: this.raid, nearFriend, nearRival, nearChild, nearAnyone };
      d.speech = this.layer.addChild(makeBubble(lineNow(v, c, key)));
      d.speechSlot = key;
    }
    const k = Math.min(2.2, Math.max(1, 1 / Math.max(0.25, this.zoom)));
    d.speech.visible = true;
    d.speech.scale.set(k);
    d.speech.position.set(Math.round(x), Math.round(y) - 64 - (v.swimming ? -16 : 0));
    d.speech.zIndex = z + 1e7;
  }

  private emoteFor(d: Drawn, now: number): Emote | null {
    const v = d.view;
    if (v.breakdown) return 'anger';
    if (v.activity === 'sleep') return 'zzz';
    // (at a feast, notes and hearts come thick and fast; at a funeral, none)
    if (v.activity === 'dance') return (now / 1000 + v.id * 1.3) % 4 < 1.7 ? (v.id % 3 === 0 || (v.partner && v.id % 2) ? 'heart' : 'note') : null;
    if (v.activity === 'mourn') return null;
    // (a raid on and not in the fight, or just struck: alarm)
    if (v.sinceHit < 25 && v.downed === null && !v.defending) return 'alarm';
    if (this.raid && !v.defending && v.activity !== 'fight' && v.downed === null && (now / 1000 + v.id) % 3 < 1.2) return 'alarm';
    const burst = ((now / 1000 + v.id * 3.7) % EMOTE_EVERY) < EMOTE_FOR;
    if (!burst) return null;
    if (v.needs.rest < 0.12 || v.needs.food < 0.12) return 'sweat';
    if (v.grieving) return 'grief';
    // (lost in thought at the desk; standing about with nothing to do for a while; proud of a level just won)
    if (v.activity === 'research' && v.id % 2 === 0) return 'think';
    if (d.levelAt !== undefined && now - d.levelAt < 20000) return 'proud';
    if (v.activity === 'idle' && now - d.animStart > 15000) return 'lost';
    if (v.partner && v.activity !== 'fight') {
      for (const o of this.drawn.values()) if (o.view.name === v.partner && Math.hypot(o.x - d.x, o.y - d.y) < 40) return 'heart';
    }
    if (v.morale >= 85 && (v.activity === 'idle' || v.activity === 'eat')) return 'note';
    return null;
  }

  private drawSpells(now: number): void {
    while (this.spells.length < this.fx.length) {
      const sp = this.layer.addChild(new Sprite());
      sp.zIndex = 1e8;
      this.spells.push(sp);
    }
    this.spells.forEach((sp, i) => {
      const f = this.fx[i];
      const who = f && this.drawn.get(f.id);
      const n = f ? spellFrames(f.kind) : 0;
      const progress = f ? (f.since + (now - f.at) / TICK_MS) / fxTicks(f.kind) : 1;
      const frame = who && f ? spellFrame(f.kind, progress * n) : null;
      sp.visible = !!frame && !!who && !who.view.indoors;
      if (!frame || !who) return;
      sp.texture = frame;
      sp.alpha = progress > 0.8 && f.kind !== 'frost' ? (1 - progress) / 0.2 : 1;
      sp.position.set(Math.round(who.x - SPELL_SIZE / 2), Math.round(who.y - SPELL_SIZE + 14));
    });
  }

  render(now: number): void {
    const who = this.revived && this.drawn.get(this.revived.id);
    const frame = who && this.revived ? reviveFrame(Math.floor(((this.revived.since + (now - this.revived.at) / TICK_MS) * 24) / 40)) : null;
    this.sparkle.visible = !!frame;
    if (frame && who) {
      this.sparkle.texture = frame;
      this.sparkle.position.set(Math.round(who.x - REVIVE_SIZE / 2), Math.round(who.y - REVIVE_SIZE + 10));
    }
    const beam = who && this.revived ? holyFrame((this.revived.since + (now - this.revived.at) / TICK_MS) * 0.8) : null;
    this.pillar.visible = !!beam;
    if (beam && who) {
      this.pillar.texture = beam;
      this.pillar.position.set(Math.round(who.x - (HOLY_SIZE * PILLAR_SCALE) / 2), Math.round(who.y + 4 - HOLY_SIZE * PILLAR_SCALE));
    }
    this.drawSpells(now);
    this.spread(now);
    for (const d of this.drawn.values()) {
      const t = Math.min(1, (now - d.at) / TICK_MS);
      let x = d.from.x + (d.to.x - d.from.x) * t;
      let y = d.from.y + (d.to.y - d.from.y) * t;
      d.walked += Math.hypot(x - d.x, y - d.y);
      d.x = x;
      d.y = y;
      // (a step aside from anyone standing on the same spot, taken at a walk: see `spread`)
      const want = d.aside ?? { x: 0, y: 0 };
      const off = (d.off ??= { x: 0, y: 0 });
      const ox = off.x;
      const oy = off.y;
      off.x += (want.x - off.x) * ASIDE_EASE;
      off.y += (want.y - off.y) * ASIDE_EASE;
      if (Math.abs(want.x - off.x) < 0.3 && Math.abs(want.y - off.y) < 0.3) [off.x, off.y] = [want.x, want.y];
      d.walked += Math.hypot(off.x - ox, off.y - oy);
      x += off.x;
      y += off.y;
      const z = y;
      const hidden = d.view.indoors;
      d.sprite.visible = !hidden;
      const held = heldWeapon(d.view.gear, d.view.activity);
      let [anim, frame] = this.pose(d, now);
      if (anim === 'thrust' && held && held !== 'spear') [anim, frame] = ['slash', cycle((now - d.animStart) / 1000, 1.0, FRAME_COUNT.slash)];
      // fighting: the blow their weapon strikes (art/combatPoses.ts), a flinch when struck, lying when down
      const v = d.view;
      const fighting = v.activity === 'fight' || v.sinceBlow < SHOOT_TICKS || v.sinceHit < 3 || v.downed !== null;
      if (fighting) {
        const fp = fightPose({ sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, down: v.downed !== null }, fightAnim(v.gear, v.battle.ranged));
        if (v.activity === 'fight' || fp[0] !== 'walk') [anim, frame] = fp;
      }
      const [look, wear] = this.dressed(d.view);
      const s = d.sprite;
      // which way they face: up or down the map when that's mostly how they're moving, else the side they look to
      const mdx = d.to.x - d.from.x;
      const mdy = d.to.y - d.from.y;
      if (Math.hypot(mdx, mdy) > 0.5) d.face = Math.abs(mdy) > Math.abs(mdx) * 1.2 ? (mdy < 0 ? 'up' : 'down') : null;
      else if (d.view.activity !== 'walk' && d.view.activity !== 'idle') d.face = null;
      const faceWay = anim === 'walk' && d.face && !d.view.mounted ? d.face : undefined;
      // (the old side-on frame only until their Himeko look has drawn once: after that it is never shown, and composing
      // it anyway, a new frame for every pose and facing, was a tenth of a phone's time with twenty about)
      if (!d.hkLast || hidden) s.texture = lpcFrame(look, anim, frame, held, wear, faceWay);
      s.anchor.set(CENTRE_X / FRAME_SIZE, FEET_Y / FRAME_SIZE);
      const flip = d.view.dir < 0 && !faceWay;
      const founder = d.view.founderCalling;
      const k = (d.view.growsUpIn !== null ? CHILD_SCALE : 1) * (d.view.look.height ?? 1) * (founder ? FOUNDER_SCALE : 1);
      s.scale.set(flip ? -k : k, k);
      // (nobody standing is frozen: a breath's rise and fall, and now and then a shift of weight: idleFidget)
      const breath = anim === 'walk' && frame === 0 && !fighting ? idleBreath(now, d.view.id) : 0;
      s.position.set(Math.round(x), Math.round(y) - breath);
      s.zIndex = z;
      const glow = d.view.rally === 'on' ? (Math.sin(now / 90) > 0 ? 0xffe070 : 0xffc040) : null;
      s.tint = glow ?? (d.view.monster === 'undead' ? 0xb0c8a8 : d.view.monster === 'vampire' ? 0xe8e0f0 : 0xffffff);
      const moving = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) > 0.5;
      // (hurt legs: a hitch in the walk)
      if (moving) s.y += limpDip(v.body.moving, d.walked);
      // at a gathering: dancing to the beat (a feast) or still with grief (a funeral): map/dance.ts
      const step = hidden ? null : v.activity === 'dance' ? danceStep(v.id, now, moving) : v.activity === 'mourn' ? mournStep(v.id) : null;
      const facing = step?.facing === 'left' || step?.facing === 'right' ? step.facing : d.view.dir < 0 ? 'left' : 'right';
      // (the side-on townsperson's sprite, which their harm is drawn over; a hero, wolf or class form isn't)
      let plain = true;
      // a fighting calling takes its combat form (a Craftpix hero) while it fights, and a little after
      // (the raised dead fight as the pack's skeletons, whatever their calling)
      // (an orc keeps the pack's Orc body in its own gear: no pack hero is green)
      const orc = v.look.body === 'orc';
      const hero = v.monster === 'undead' ? skeletonSheet(v.battle.ranged, v.id) : orc ? undefined : heroSheet(v.cls, v.id);
      // (a defender keeps the form the whole raid: switching only while striking made it flicker between turns)
      const inCombat = v.defending || v.activity === 'fight' || v.sinceBlow < HERO_LINGER || v.sinceHit < HERO_LINGER;
      if (hero && inCombat && !hidden && !founder && !(v.cls && CLASS_LOOK[v.cls])) {
        plain = false;
        s.texture = heroFrame(hero, { facing, moving, walked: d.walked, sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, sinceBlock: v.sinceBlock, down: v.downed !== null, now, ref: v.id });
        const hk = heroScale(hero) * k;
        s.anchor.set(0.5, 1);
        s.scale.set(hk * creatureFlip(hero, facing), hk);
      }
      // a founder wears their combat form always (the owner's ask): walking, standing, fighting, and at work the
      // hero's blow swung over and over (chopping, digging, building, reaping)
      if (founder && !hidden && v.monster !== 'undead' && !orc) {
        const sheet = founderSheet(v.cls, v.id, v.battle.ranged, (v.battle.attrs?.int ?? 0) > (v.battle.attrs?.str ?? 0));
        const working = WORK_SWING.has(v.activity);
        const swing = working ? Math.floor((now / 100) % 14) : 999;
        plain = false;
        s.texture = heroFrame(sheet, { facing, moving, walked: d.walked, sinceBlow: inCombat ? v.sinceBlow : swing, sinceHit: v.sinceHit, sinceBlock: v.sinceBlock, down: v.downed !== null, now, ref: v.id });
        const hk = heroScale(sheet) * k;
        s.anchor.set(0.5, 1);
        s.scale.set(hk * creatureFlip(sheet, facing), hk);
      }
      // someone who's taken up a special class looks the part (a Pixel Champions hero, at twice size)
      if (d.view.cls && CLASS_LOOK[d.view.cls] && !hidden && !founder) {
        const [sheet, block] = CLASS_LOOK[d.view.cls]!;
        plain = false;
        s.texture = creatureFrame(sheet, block, facing, moving ? Math.floor(d.walked / 5) : 1);
        const size = creatureSize(sheet);
        s.anchor.set(0.5, 1);
        s.scale.set(2 * k, 2 * k);
        void size;
      }
      // the townsfolk in the Himeko Sutori pack's dress (art/hkFolk.ts: the owner's call, founders too), four ways
      // round; it takes over from the side-on sprite, the hero forms and the class looks (the hero sheets are kept for
      // bosses and special strangers). Until their layers have loaded, the old look stands in.
      // (a fight's look adds the weapon: until its layer loads, the look without it, else the last frame drawn)
      let hkTex = hidden ? null : this.hkTexture(d, now, inCombat, moving, step);
      if (!hkTex && !hidden && inCombat) hkTex = this.hkTexture(d, now, false, moving);
      if (hkTex) d.hkLast = hkTex;
      else if (!hidden && d.hkLast) hkTex = d.hkLast;
      if (hkTex) {
        plain = false;
        s.texture = hkTex;
        s.anchor.set(0.5, HK_FEET / HK_CELL);
        const hk = k * HK_K;
        s.scale.set(hk, hk);
      }
      // on a full-moon night, and whenever they fight, werewolves show what they are
      if (d.view.monster === 'werewolf' && (this.moon || inCombat) && !hidden) {
        // (the Craftpix werewolves: black, red or white by who they are)
        const wolf = WOLF_FORMS[v.id % WOLF_FORMS.length];
        plain = false;
        s.texture = heroFrame(wolf, { facing, moving, walked: d.walked, sinceBlow: v.sinceBlow, sinceHit: v.sinceHit, sinceBlock: v.sinceBlock, down: v.downed !== null, now, ref: v.id });
        const wk = heroScale(wolf) * k * WOLF_SCALE;
        s.anchor.set(0.5, 1);
        s.scale.set(wk * creatureFlip(wolf, facing), wk);
      }
      // a shapeshifter fights in their beast's shape (data/levels.ts `beastForm`: wolf, lion, bear, drake, wyvern by
      // stage; a druid's bear)
      if (v.beast && inCombat && !hidden && v.downed === null) {
        const b = v.beast;
        const sheet = b.sheet as CreatureSheet;
        plain = false;
        s.texture = creatureFrame(sheet, b.block, facing, moving ? Math.floor(d.walked / 5) : Math.floor(now / 220 + v.id) % 3);
        s.anchor.set(0.5, 1);
        s.scale.set(b.scale * k * creatureFlip(sheet, facing), b.scale * k);
      }
      // in the sea a merrow shows to the waist, their tail curling below (art/merTail.ts)
      const swimming = v.swimming && !hidden && v.downed === null;
      if (swimming) {
        const bob = Math.sin(now / 420 + v.id) * 1.5;
        plain = false;
        s.texture = waistUp(s.texture, hkTex ? HK_WAIST : WAIST);
        s.anchor.set(hkTex ? 0.5 : CENTRE_X / FRAME_SIZE, 1);
        s.position.set(Math.round(x), Math.round(y - 4 + bob));
        if (!d.tail) d.tail = this.layer.addChild(new Sprite());
        d.tail.texture = tailTexture(v.id);
        d.tail.anchor.set(5 / TAIL_W, 0);
        d.tail.scale.set(facing === 'left' ? -k : k, k);
        d.tail.rotation = Math.sin(now / 300 + v.id) * 0.12 * (facing === 'left' ? -1 : 1);
        d.tail.position.set(Math.round(x), Math.round(y - 6 + bob));
        d.tail.zIndex = z - 0.05;
        d.tail.visible = true;
        void TAIL_H;
      } else if (d.tail) d.tail.visible = false;
      // (off the ground on the beat, and a squash as they land)
      if (step && !swimming) {
        s.y -= step.lift;
        if (step.squash !== 1) s.scale.set(s.scale.x * (2 - step.squash), s.scale.y * step.squash);
      }
      // cavalry: the rider sits on a horse
      const coat = d.view.mounted;
      d.horse.visible = coat !== null && !hidden;
      if (coat !== null) {
        d.horse.texture = creatureFrame('horse', coat, facing, moving ? Math.floor(d.walked / 8) % 3 : 1);
        d.horse.position.set(Math.round(x - (CREATURE_FRAME * HORSE_SCALE) / 2), Math.round(y + 2 - CREATURE_FRAME * HORSE_SCALE));
        d.horse.zIndex = z - 0.1;
        s.y -= SADDLE_LIFT;
        if (anim === 'walk' && !hkTex) s.texture = lpcFrame(look, 'walk', 0, held, wear);
      }
      // their harm, over the sprite (bodyMarks.ts)
      const marks = v.body.marks;
      // (a merrow on land wears their fins: the same overlay, in their tail's colours)
      const mer = v.mer && !swimming ? v.id : -1;
      const showMarks = plain && !hidden && (marks.length > 0 || mer >= 0) && v.downed === null;
      if (showMarks && !d.marks) d.marks = this.layer.addChild(new Graphics());
      if (d.marks) {
        d.marks.visible = showMarks;
        if (showMarks) {
          const sway = moving ? (Math.floor(d.walked / 8) % 2) : 0;
          const key = marksKey(marks, v.dir, sway, mer);
          if (key !== d.marksKey) {
            d.marksKey = key;
            drawMarks(d.marks, marks, sway, mer);
          }
          d.marks.position.set(s.x, s.y);
          d.marks.scale.set(flip ? -k : k, k);
          d.marks.zIndex = z + 0.05;
        }
      }
      // (what they carry is in their pack, not a bundle over their head: the owner's call; a heavy load goes in a
      // wheelbarrow pushed ahead of them, heaped with it: map/haul.ts)
      const pushing = !!barrowTex && hauls(v, moving) && !hidden;
      if (pushing && !d.barrow) {
        d.barrow = this.layer.addChild(new Container());
        const b = d.barrow.addChild(new Sprite(barrowTex!));
        b.anchor.set(0.5, 1);
        b.scale.set(BARROW_SCALE);
        d.barrow.addChild(new Graphics());
      }
      if (d.barrow) {
        d.barrow.visible = pushing;
        if (pushing) {
          const [mat, n] = mainLoad(v.carrying);
          const heap = Math.min(3, Math.floor(n / 4));
          const key = `${mat}:${heap}`;
          const g = d.barrow.children[1] as Graphics;
          if (key !== d.heapKey) {
            d.heapKey = key;
            const [c, top] = heapColour(mat);
            g.clear();
            // (a heap bulging over the tub's rim, bigger the more there is)
            const w = 5 + heap * 2;
            g.ellipse(-2, -13, w, 2 + heap).fill(c);
            g.ellipse(-3, -14 - heap * 0.5, w - 2, 1 + heap * 0.6).fill(top);
          }
          const way = faceWay === 'up' ? 0 : faceWay === 'down' ? 0 : d.view.dir;
          const bob = Math.floor(d.walked / 6) % 2;
          d.barrow.scale.x = way > 0 ? -1 : 1;
          d.barrow.position.set(Math.round(x + way * BARROW_AHEAD), Math.round(y + (faceWay === 'down' ? 9 : faceWay === 'up' ? -7 : 2)) - bob);
          d.barrow.zIndex = faceWay === 'up' ? z - 0.2 : z + 0.12;
        }
      }
      // a child at play on a fair day flies a kite, high on its string and dancing in the wind
      const flying = !hidden && v.growsUpIn !== null && v.activity === 'play' && v.id % 2 === 0 && this.hour >= 8 && this.hour < 18 && this.season !== 'winter' && (this.weather === 'clear' || this.weather === 'cloudy');
      if (flying && !d.kite) d.kite = this.layer.addChild(new Graphics());
      if (d.kite) {
        d.kite.visible = flying;
        if (flying) {
          const t = now / 1000 + v.id;
          const kx = -d.view.dir * (34 + Math.sin(t * 0.7) * 8);
          const ky = -86 + Math.sin(t * 1.3) * 7;
          const tilt = Math.sin(t * 1.9) * 0.35;
          const hue = [0xe04848, 0x4888e0, 0xe0c040, 0x60c060][v.id % 4];
          const g = d.kite.clear();
          // (the string sagging from the hand to the kite)
          g.moveTo(0, -22).quadraticCurveTo(kx * 0.6, -30, kx, ky + 8).stroke({ color: 0xf0ead8, width: 0.6, alpha: 0.8 });
          const pt = (ax: number, ay: number) => [kx + ax * Math.cos(tilt) - ay * Math.sin(tilt), ky + ax * Math.sin(tilt) + ay * Math.cos(tilt)];
          const [ax, ay] = pt(0, -8), [bx, by] = pt(5, 0), [cx, cy] = pt(0, 8), [ex, ey] = pt(-5, 0);
          g.poly([ax, ay, bx, by, cx, cy, ex, ey]).fill(hue).stroke({ color: 0x2a1a10, width: 0.6 });
          g.moveTo(ax, ay).lineTo(cx, cy).stroke({ color: 0xffffff, width: 0.5, alpha: 0.6 });
          // (its tail of bows)
          for (let i = 1; i <= 3; i++) g.rect(cx + Math.sin(t * 3 + i) * 2 * i - 1, cy + i * 4, 2, 1.5).fill(i % 2 ? 0xffffff : hue);
          d.kite.position.set(Math.round(x), Math.round(y));
          d.kite.zIndex = z + 1e6;
        }
      }
      d.load.visible = false;
      d.load.position.set(Math.round(x) - d.view.dir * 7 - 4, Math.round(y) - 40);
      d.load.zIndex = z + 0.1;
      // the work in hand: a small bar over their head, filling as it goes (sites, orders, study, fields, loads)
      const done = hidden || d.visitor ? null : d.view.taskDone;
      if (done !== null && !d.work) d.work = this.layer.addChild(new Graphics());
      if (d.work) {
        d.work.visible = done !== null;
        if (done !== null) {
          const fill = Math.round(done * WORK_W);
          if (fill !== d.workFill) {
            d.workFill = fill;
            d.work.clear();
            d.work.rect(-1, -1, WORK_W + 2, 5).fill({ color: 0x14100c, alpha: 0.85 });
            d.work.rect(0, 0, WORK_W, 3).fill({ color: 0x3a3226 });
            if (fill > 0) d.work.rect(0, 0, fill, 3).fill({ color: 0x8ad860 });
            if (fill > 0) d.work.rect(0, 0, fill, 1).fill({ color: 0xd0ffb0 });
          }
          d.work.position.set(Math.round(x) - WORK_W / 2, Math.round(y) - WORK_ABOVE);
          d.work.zIndex = z + 0.15;
        }
      }
      // in a raid everyone in it shows their health over their head, as the raiders do (green, gold when hurt, red when low)
      const showHp = !hidden && !d.visitor && (this.raid || v.activity === 'fight' || v.sinceHit < HERO_LINGER);
      if (showHp && !d.hpBar) d.hpBar = this.layer.addChild(new Graphics());
      if (d.hpBar) {
        d.hpBar.visible = showHp;
        if (showHp) {
          const share = Math.max(0, Math.min(1, v.hp / Math.max(1, v.maxHp)));
          const fill = Math.round(share * HP_W);
          const key = `${fill}:${v.downed ? 1 : 0}`;
          if (key !== d.hpFill) {
            d.hpFill = key;
            const col = v.downed ? 0x8a8a8a : share > 0.6 ? 0x5ad04a : share > 0.3 ? 0xe0b030 : 0xe04838;
            d.hpBar.clear();
            d.hpBar.rect(-1, -1, HP_W + 2, 5).fill({ color: 0x14100c, alpha: 0.85 });
            d.hpBar.rect(0, 0, HP_W, 3).fill({ color: 0x3a2622 });
            if (fill > 0) d.hpBar.rect(0, 0, fill, 3).fill({ color: col });
            if (fill > 0) d.hpBar.rect(0, 0, fill, 1).fill({ color: 0xffffff, alpha: 0.35 });
          }
          // (above the work bar when both show; higher over a hero's bigger figure)
          const above = (d.work?.visible ? WORK_ABOVE + 6 : WORK_ABOVE) + (plain ? 0 : 8);
          d.hpBar.position.set(Math.round(x) - HP_W / 2, Math.round(y) - above);
          d.hpBar.zIndex = z + 0.16;
        }
      }
      d.bubble.visible = d.visitor;
      d.bubble.position.set(Math.round(x) - 5, Math.round(y) - 66 + Math.round(Math.sin(now / 300) * 1.5));
      d.bubble.zIndex = z + 0.2;
      const arrow = d.levelAt !== undefined && !hidden ? levelUpFrame((now - d.levelAt) / 160) : null;
      if (arrow && !d.levelUp) d.levelUp = this.layer.addChild(new Sprite());
      if (d.levelUp) {
        d.levelUp.visible = !!arrow;
        if (arrow) {
          d.levelUp.texture = arrow;
          d.levelUp.position.set(Math.round(x) - 16, Math.round(y) - 60);
          d.levelUp.zIndex = z + 0.2;
        }
      }
      this.speak(d, now, x, y, z, hidden);
      const emote = hidden || d.visitor || d.view.bleedMinutes !== null ? null : this.emoteFor(d, now);
      if (emote && !d.emote) d.emote = this.layer.addChild(new Sprite());
      if (d.emote) {
        d.emote.visible = !!emote;
        if (emote) {
          d.emote.texture = emoteFrame(emote, now / 140 + d.view.id)!;
          d.emote.position.set(Math.round(x) - EMOTE_SIZE / 2 + 6, Math.round(y) - 62 + Math.round(Math.sin(now / 400 + d.view.id) * 1.5));
          d.emote.zIndex = z + 0.2;
        }
      }
      // a blow landing: blood flung away from the striker
      const splat = d.view.sinceHit < 6 && !hidden ? splatFrame(d.view.sinceHit + 2) : null;
      d.spray.visible = !!splat;
      if (splat) {
        d.spray.texture = splat;
        d.spray.width = d.spray.height = SPLAT_SIZE * 0.7;
        d.spray.scale.x = -d.view.hitFrom * Math.abs(d.spray.scale.x);
        d.spray.position.set(Math.round(x - d.view.hitFrom * 6), Math.round(y - 22));
        d.spray.zIndex = z + 0.4;
      }
      const left = d.view.bleedMinutes;
      if (left === null) d.bleedFrom = undefined;
      if (left !== null && !d.blood) d.blood = this.layer.addChild(new Graphics());
      if (d.blood) {
        d.blood.visible = left !== null && !hidden;
        if (left !== null) {
          const share = Math.max(0, Math.min(1, left / Math.max(BLEED_MINUTES, (d.bleedFrom ??= left))));
          const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now / 250));
          d.blood
            .clear()
            .rect(3, 0, 2, 1).rect(2, 1, 4, 2).rect(1, 3, 6, 3).rect(2, 6, 4, 1)
            .fill({ color: 0xd42a2a, alpha: pulse })
            .rect(3, 3, 1, 2)
            .fill({ color: 0xff9a8a, alpha: pulse })
            .rect(-6, 9, 20, 3)
            .fill({ color: 0x1a120c, alpha: 0.85 })
            .rect(-5, 10, Math.max(1, Math.round(18 * share)), 1)
            .fill(0xe04040);
          d.blood.position.set(Math.round(x) - 4, Math.round(y) - 40);
          d.blood.zIndex = z + 0.2;
        }
      }
      // (at the water's edge: mirrored in it)
      const mirrored = !hidden && !swimming && !!this.land && waterBelow(this.land, x, y, this.season);
      if (mirrored && !d.reflect) d.reflect = this.layer.addChild(new Sprite());
      if (d.reflect) {
        d.reflect.visible = mirrored;
        if (mirrored) {
          reflectOf(d.reflect, s.texture, x, y, s.anchor.y, Math.sign(s.scale.x) * Math.abs(s.scale.x), Math.abs(s.scale.y));
          d.reflect.zIndex = z - 0.7;
        }
      }
      d.shadow.visible = !hidden && !swimming;
      d.shadow.width = (coat !== null ? 34 : 18) * k;
      d.shadow.height = 6 * k;
      d.shadow.alpha = 0.42;
      d.shadow.position.set(Math.round(x + this.sunLean), Math.round(y) + 1);
      d.shadow.zIndex = z - 0.5;
      // a lantern: a warm pool of light about their feet (the lights layer fades up after dusk and is dark by day)
      if (this.lights) {
        if (!d.lamp) {
          d.lamp = this.lights.addChild(new Sprite(glowTexture()));
          d.lamp.anchor.set(0.5);
          d.lamp.width = d.lamp.height = 36;
          d.lamp.tint = 0xffc070;
          d.lamp.alpha = 0.5;
        }
        d.lamp.visible = !hidden;
        d.lamp.position.set(Math.round(x), Math.round(y) - 12);
      }
      if (founder && !d.aura) {
        d.aura = this.layer.addChild(new Sprite(glowTexture()));
        d.aura.anchor.set(0.5);
      }
      if (d.aura) {
        d.aura.visible = founder && !hidden;
        d.aura.tint = AURA[this.theme] ?? AURA.town;
        d.aura.width = 52 * k;
        d.aura.height = 72 * k;
        d.aura.alpha = 0.5 + 0.15 * Math.sin(now / 700);
        d.aura.position.set(Math.round(x), Math.round(y - 22 * k));
        d.aura.zIndex = z - 0.3;
      }
    }
  }

  private pose(d: Drawn, now: number): [LpcAnim, number] {
    const secs = (now - d.animStart) / 1000;
    switch (d.view.activity) {
      case 'walk':
        return ['walk', 1 + (Math.floor(d.walked / PX_PER_WALK_FRAME) % 8)];
      case 'chop':
        return ['slash', cycle(secs, 0.9, FRAME_COUNT.slash)]; // (an axe swung at the trunk)
      case 'build':
        return ['slash', cycle(secs, 0.6, FRAME_COUNT.slash)];
      case 'mine':
        return ['slash', cycle(secs, 1.1, FRAME_COUNT.slash)]; // (a pick swung overhead at the rock)
      case 'reap':
        return ['slash', cycle(secs, 1.3, FRAME_COUNT.slash)]; // (a sickle through the stalks)
      case 'till':
        return ['slash', cycle(secs, 1.0, FRAME_COUNT.slash)]; // (a hoe into the soil)
      case 'forage':
        return ['spell', cycle(secs, 1.4, FRAME_COUNT.spell)];
      case 'research':
        return ['spell', [0, 1, 2, 3, 2, 1, 0, 0][Math.floor(secs * 2.5) % 8]];
      case 'eat':
        return ['spell', Math.floor(secs * 3) % 2];
      case 'fight':
        return ['walk', 0]; // (standing ready: the blows come from fightPose)
      case 'sleep':
        return ['hurt', FRAME_COUNT.hurt - 1];
      case 'dance':
        return ['walk', 1 + (Math.floor(now / (BEAT / 2)) % 8)];
      case 'mourn':
        return ['walk', 0];
      default:
        return ['walk', idleFidget(now, d.view.id)];
    }
  }

  /** The person (or visitor) under a world point, if any (the one standing furthest down first). */
  personAt(wx: number, wy: number): PersonView | null {
    let best: Drawn | null = null;
    for (const d of this.drawn.values()) {
      if (d.view.indoors) continue;
      const x = d.x + (d.off?.x ?? 0);
      const y = d.y + (d.off?.y ?? 0);
      if (Math.abs(wx - x) <= HIT_HALF_W && wy <= y + 2 && wy >= y - HIT_H && (!best || y > best.y + (best.off?.y ?? 0))) best = d;
    }
    return best?.view ?? null;
  }

  /** Where someone is drawn now (world px, at their feet). */
  posOf(id: number): { x: number; y: number } | null {
    const d = this.drawn.get(id);
    return d ? { x: d.x + (d.off?.x ?? 0), y: d.y + (d.off?.y ?? 0) } : null;
  }
}

function bundle(): Graphics {
  return new Graphics().rect(0, 2, 9, 9).fill(0x5a3e24).rect(1, 1, 7, 9).fill(0x8a6440).rect(1, 5, 7, 1).fill(0x5a3e24).rect(3, 0, 3, 2).fill(0x5a3e24);
}
function questionBubble(): Graphics {
  const g = new Graphics().rect(0, 0, 11, 12).fill(0x2a1f17).rect(1, 1, 9, 10).fill(0xfff4d6).rect(4, 12, 3, 2).fill(0x2a1f17);
  return g.rect(3, 2, 5, 1).fill(0x2a1f17).rect(7, 3, 1, 2).fill(0x2a1f17).rect(5, 5, 2, 1).fill(0x2a1f17).rect(5, 6, 1, 1).fill(0x2a1f17).rect(5, 8, 1, 1).fill(0x2a1f17);
}
function cycle(secs: number, period: number, frames: number): number {
  const phase = (secs % period) / period;
  return phase < 0.7 ? Math.floor((phase / 0.7) * frames) : 0;
}

/** A person's frame cut off at the waist (for swimming), one cut per frame. */
const waists = new Map<Texture, Texture>();
function waistUp(tex: Texture, waist = WAIST): Texture {
  let t = waists.get(tex);
  if (!t) {
    const f = tex.frame;
    t = new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.width, Math.round(f.height * waist)) });
    waists.set(tex, t);
  }
  return t;
}
