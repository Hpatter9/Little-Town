// The town's own animals (no DOM, so the tests can reach it): which homes keep a dog, a cat or a few hens, what they're
// called and what they look like, all by the home's id, so a pet stays the same pet. map/mapPets.ts draws them.

export type PetKind = 'dog' | 'cat' | 'hen';

export interface PetDef {
  kind: PetKind;
  /** Which coat (a column of the atlas: four dogs, four cats, the rooster and the hen). */
  coat: number;
  name: string;
}

const DOG_NAMES = ['Biscuit', 'Bran', 'Pip', 'Rufus', 'Mutt', 'Scamp', 'Ash', 'Bramble', 'Tuck', 'Fang', 'Sorrel', 'Hob', 'Patch', 'Bracken', 'Gruff', 'Nettle', 'Boots', 'Wolfie', 'Dunny', 'Barley'];
const CAT_NAMES = ['Mittens', 'Smudge', 'Soot', 'Whiskers', 'Tansy', 'Moth', 'Puddle', 'Thistle', 'Mouser', 'Cinder', 'Fern', 'Velvet', 'Tib', 'Marigold', 'Nib', 'Grimalkin', 'Pounce', 'Saffron', 'Dusk', 'Butter'];
const HEN_NAMES = ['Henrietta', 'Clucky', 'Dot', 'Speckle', 'Peck', 'Goldie', 'Bertha', 'Nell', 'Pippa', 'Ruby'];

/** A small stable hash of a number and a salt, 0 to 1. */
export function petHash(n: number, salt: number): number {
  let h = (n * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The share of homes with a dog, with a cat, and with hens scratching about the yard. */
export const DOG_SHARE = 0.4;
export const CAT_SHARE = 0.35;
export const HEN_SHARE = 0.3;

/** The animals a home keeps, by its id and the town's people: the liches and the Blood Court keep only black cats,
 *  and the machines nothing. */
export function petsOf(home: number, people: string): PetDef[] {
  if (people === 'robot' || people === 'machines') return [];
  const out: PetDef[] = [];
  const pick = (names: string[], salt: number) => names[Math.floor(petHash(home, salt) * names.length)];
  if (people === 'lich' || people === 'vampire') {
    if (petHash(home, 1) < CAT_SHARE + 0.15) out.push({ kind: 'cat', coat: 1, name: pick(['Soot', 'Grimalkin', 'Dusk', 'Nightshade', 'Raven', 'Wormwood', 'Shade', 'Hex'], 2) });
    return out;
  }
  const r = petHash(home, 1);
  if (r < DOG_SHARE) out.push({ kind: 'dog', coat: Math.floor(petHash(home, 3) * 4), name: pick(DOG_NAMES, 2) });
  else if (r < DOG_SHARE + CAT_SHARE) out.push({ kind: 'cat', coat: Math.floor(petHash(home, 3) * 4), name: pick(CAT_NAMES, 2) });
  // (hens in the older ages: a rooster now and then among them)
  if (petHash(home, 5) < HEN_SHARE) {
    const n = 2 + Math.floor(petHash(home, 6) * 3);
    for (let i = 0; i < n; i++) out.push({ kind: 'hen', coat: i === 0 && petHash(home, 7) < 0.4 ? 0 : 1, name: HEN_NAMES[Math.floor(petHash(home, 10 + i) * HEN_NAMES.length)] });
  }
  return out;
}

/** What the tap card says a pet is up to. */
export function petLine(kind: PetKind, state: string, home: string): string {
  const whose = `${home}'s ${kind === 'hen' ? 'hen' : kind}`;
  const doing: Record<string, string> = {
    idle: kind === 'dog' ? 'lazing in the sun' : kind === 'cat' ? 'washing a paw' : 'scratching for grubs',
    wander: kind === 'hen' ? 'pecking about the yard' : 'nosing about',
    follow: 'trotting at their person\'s heels',
    bark: 'barking at the raiders!',
    flee: kind === 'cat' ? 'fleeing a dog, fur on end' : 'scattering in a flap',
    sleep: kind === 'hen' ? 'gone to roost' : 'curled up asleep by the door',
    happy: 'delighted with the attention',
    hunt: 'chasing a rat round the stores',
  };
  return `${whose}, ${doing[state] ?? 'about the place'}.`;
}
