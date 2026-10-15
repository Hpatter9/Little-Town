// Each guild's badge, drawn next to its members' names (renderer/art/guildMarks.ts): a round token in the guild's
// colour with one glyph from the DawnLike item sheets. One per guild role (data/guilds.ts).

import type { GuildRole } from './guilds';
import type { Glyph } from './emblems';

export interface GuildEmblem {
  glyph: Glyph;
  /** The token's field, its rim. */
  fill: string;
  rim: string;
}

export const GUILD_EMBLEMS: Record<GuildRole, GuildEmblem> = {
  wardens: { glyph: ['Shield', 4], fill: '#3d5273', rim: '#9fb4d6' },
  menders: { glyph: ['Potion', 0], fill: '#7a2f3a', rim: '#e89aa4' },
  rangers: { glyph: ['Ammo', 8], fill: '#3b6a36', rim: '#9bd08a' },
  crafters: { glyph: ['Tool', 9], fill: '#7a5326', rim: '#e0b070' },
  merchants: { glyph: ['Money', 0], fill: '#6b5a1c', rim: '#f0d66a' },
  scholars: { glyph: ['Book', 40], fill: '#3a3f86', rim: '#a3a9ee' },
  elite: { glyph: ['ShortWep', 1], fill: '#2a2230', rim: '#c9a64a' },
};
