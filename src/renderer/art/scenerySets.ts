// Which of the packs' scenery sets (art/scenery.ts) the town uses, by its land and the season. Kept apart from the
// loader so the tests can read it without a renderer.

export type ScenerySet = 'leafy' | 'conifer' | 'snowTree' | 'dryTree' | 'bush' | 'bareBush' | 'rock' | 'snowRock' | 'dryRock' | 'cloud';

/** Which sets stand for the painted broadleaf trees, pines, bushes and boulders, for a land and a season. */
export function scenerySets(biome: string, season: string): { broadleaf: ScenerySet; pine: ScenerySet; bush: ScenerySet; boulder: ScenerySet; turned: boolean } {
  const snowy = biome === 'tundra' || (season === 'winter' && biome !== 'desert' && biome !== 'coast');
  if (snowy) return { broadleaf: 'snowTree', pine: 'snowTree', bush: 'bareBush', boulder: 'snowRock', turned: false };
  if (biome === 'desert') return { broadleaf: 'dryTree', pine: 'dryTree', bush: 'bush', boulder: 'dryRock', turned: season === 'autumn' };
  return { broadleaf: 'leafy', pine: 'conifer', bush: season === 'winter' ? 'bareBush' : 'bush', boulder: 'rock', turned: season === 'autumn' };
}
