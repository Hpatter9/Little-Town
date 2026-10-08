// Market day (sim/pastimes.ts `marketOn`, snapshot `market`): stalls go up round the square, each the Glassblower
// pack's cloth awning (tinted a colour of its own) over its goods (sacks, crates, barrels, bottles, a vase), and now and
// then a stallholder cries their wares. Taken down when the market's over. Drawn among the things, sorted by their feet.

import { Container, Sprite, Texture } from 'pixi.js';
import { loadImage } from '../art/loadImage';
import awningUrl from '../art/shops/gb_awning.png';
import sacksUrl from '../art/shops/gb_sacks.png';
import cratesUrl from '../art/shops/gb_crates.png';
import barrelsUrl from '../art/shops/gb_barrels.png';
import bottlesUrl from '../art/shops/ap_bottles.png';
import vaseUrl from '../art/shops/ap_vase.png';
import { makeBubble } from './speech';

/** The stalls round the square: how many, how far out (px), and their awnings' colours. */
const STALLS = 5;
const RING = 78;
const TINTS = [0xe06060, 0x60a0e0, 0xf0d060, 0x80c070, 0xd080d0];
const CRIES = ['Fresh bread!', 'Two for a copper!', 'Finest wool in the land!', 'Apples, sweet apples!', 'Pots and pans!', 'Herbs for what ails you!', 'Come and see, come and see!', 'Fair prices!'];
const CRY_EVERY = 5;

export class MapMarket {
  private tex: Record<string, Texture> = {};
  private readonly stalls: Container[] = [];
  private at: { x: number; y: number } | null = null;
  private cry: Container | null = null;
  private cryT = 0;
  private cryN = 0;

  constructor(private readonly layer: Container) {
    const urls: Record<string, string> = { awning: awningUrl, sacks: sacksUrl, crates: cratesUrl, barrels: barrelsUrl, bottles: bottlesUrl, vase: vaseUrl };
    Promise.all(Object.entries(urls).map(([k, u]) => loadImage(u).then((im) => [k, im] as const)))
      .then((list) => {
        for (const [k, im] of list) {
          const t = Texture.from(im);
          t.source.scaleMode = 'nearest';
          this.tex[k] = t;
        }
        const at = this.at;
        this.at = null;
        this.sync(at);
      })
      .catch(() => undefined);
  }

  sync(square: { x: number; y: number } | null): void {
    if (square && this.at && square.x === this.at.x && square.y === this.at.y && this.stalls.length) return;
    for (const s of this.stalls) s.destroy({ children: true });
    this.stalls.length = 0;
    this.cry?.destroy({ children: true });
    this.cry = null;
    this.at = square;
    if (!square || !this.tex.awning) return;
    const goods = ['sacks', 'crates', 'barrels', 'bottles', 'vase'];
    for (let i = 0; i < STALLS; i++) {
      // (a half-ring behind the square, so the shoppers stand before them)
      const a = Math.PI * (1.1 + (i / (STALLS - 1)) * 0.8);
      const x = Math.round(square.x + Math.cos(a) * RING);
      const y = Math.round(square.y + Math.sin(a) * RING * 0.55);
      const c = this.layer.addChild(new Container());
      const aw = c.addChild(new Sprite(this.tex.awning));
      aw.anchor.set(0.5, 1);
      aw.scale.set(0.8);
      aw.tint = TINTS[i % TINTS.length];
      const g = c.addChild(new Sprite(this.tex[goods[i % goods.length]]));
      g.anchor.set(0.5, 1);
      g.scale.set(0.7);
      g.position.set(-2, 6);
      c.position.set(x, y);
      c.zIndex = y + 6;
      this.stalls.push(c);
    }
  }

  /** A stallholder cries their wares now and then. */
  render(dt: number): void {
    if (!this.stalls.length) return;
    this.cryT += dt;
    if (this.cryT < CRY_EVERY) return;
    this.cryT = 0;
    this.cry?.destroy({ children: true });
    this.cry = null;
    if ((this.cryN++ & 1) === 1) return; // (a quiet spell between cries)
    const st = this.stalls[this.cryN % this.stalls.length];
    this.cry = this.layer.addChild(makeBubble(CRIES[this.cryN % CRIES.length]));
    this.cry.position.set(st.x, st.y - 52);
    this.cry.zIndex = 1e7;
  }
}
