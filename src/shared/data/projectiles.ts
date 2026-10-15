// What flies from a shooter to its mark on the battle screens (the owner's ask: arrows in the air, spells flying to their
// targets). Pure: the sim names the shot (`shotOf`, kept on the tactics board's `fx`), the views draw it (`battle/
// projectiles.ts`) and time its flight (`flightTicks`), the blow's number and effect landing when it arrives.

export type Ammo = 'arrow' | 'bolt' | 'bullet' | 'spear' | 'stone' | 'beam' | 'orb' | 'ball';

/** What a shot is: its ammunition, and for an orb the pixel-effects element it carries (fire, ice, lightning, light,
 *  dark, forest, poison, star... as `PX_ELEMENT` names them). Written `ammo` or `ammo:element`. */
export interface ShotLook {
  ammo: Ammo;
  el?: string;
}

export const shotCode = (l: ShotLook): string => (l.el ? `${l.ammo}:${l.el}` : l.ammo);
export function shotParse(code: string | undefined): ShotLook {
  const [ammo, el] = (code ?? 'arrow').split(':');
  return { ammo: (ammo as Ammo) || 'arrow', ...(el ? { el } : {}) };
}

/** The ammunition a weapon, creature or tower shoots, by its name. */
export function ammoOf(name: string, magic = false): Ammo {
  const n = name.toLowerCase();
  if (/laser|energy|plasma|blaster|beam|heavy weapon|raygun|disintegrat/.test(n)) return 'beam';
  if (/cannon|bombard|trebuchet|catapult|mortar|onager|siege|boulder|ballista stone/.test(n)) return 'ball';
  if (/pistol|musket|rifle|\bgun|shotgun|automatic|blunderbuss|carbine|arquebus|revolver|turret|bot\b|robot/.test(n)) return 'bullet';
  if (/crossbow|arbalest|ballista|bolt|scorpion/.test(n)) return 'bolt';
  if (/sling|stone|slinger|rock/.test(n)) return 'stone';
  if (/javelin|thrown|spear|dart|knife|axe|shuriken|ninja|kunai/.test(n)) return 'spear';
  if (magic || /staff|wand|rod|scepter|orb|tome|mage|wizard|magus|shaman|witch|priest|sorcer|necro|lich|druid|sage|oracle|hag|queen|king|fox|summoner|caster/.test(n)) return 'orb';
  return 'arrow';
}

/** The element a caster's plain shot carries, from its calling or its name. */
export function elementOf(name: string): string {
  const n = name.toLowerCase();
  if (/fire|flame|ember|ash|inferno|salamander|dragon|ignis|pyro/.test(n)) return 'fire';
  if (/ice|frost|rime|cold|snow|winter|glacial|chill|cryo/.test(n)) return 'ice';
  if (/storm|lightning|thunder|shock|spark|volt/.test(n)) return 'lightning';
  if (/white_mage|holy|priest|cleric|saint|light|angel|paladin|sun|sacred/.test(n)) return 'light';
  if (/necro|lich|dark|shadow|vampire|death|hex|witch|curse|void|bone|skeleton|gorgon/.test(n)) return 'dark';
  if (/druid|nature|forest|thorn|leaf|root|grove|satyr/.test(n)) return 'forest';
  if (/poison|venom|plague|toxic|alchem|acid/.test(n)) return 'poison';
  if (/chrono|time|moon|temporal/.test(n)) return 'moon';
  if (/earth|rock|stone|golem|quake/.test(n)) return 'earth';
  if (/water|tide|sea|wave|marid|merfolk|squid/.test(n)) return 'water';
  if (/wind|air|gale|sky|storm/.test(n)) return 'wind';
  return 'star';
}

/** The code of a shot from a named shooter: a weapon's name, or a creature's or calling's. */
export function shotOf(name: string, opts: { magic?: boolean; caster?: string } = {}): string {
  const ammo = ammoOf(name, !!opts.magic);
  return shotCode(ammo === 'orb' ? { ammo, el: elementOf(`${opts.caster ?? ''} ${name}`) } : { ammo });
}

/** Ticks a shot is in the air over `tiles` tiles: quick for a bullet and a beam, slower for a thrown spear and a
 *  stone, a spell between. At least two ticks, at most nine, so a shot is seen, and the fight does not wait on it. */
export function flightTicks(ammo: Ammo, tiles: number): number {
  const per: Record<Ammo, number> = { arrow: 0.7, bolt: 0.6, bullet: 0.3, spear: 0.9, stone: 0.9, beam: 0.2, orb: 0.8, ball: 1 };
  return Math.max(2, Math.min(9, Math.round(2 + tiles * per[ammo])));
}

/** How high a shot arcs at the top of its flight, in tiles' fractions of the distance: a lobbed stone and a ball arc
 *  high, an arrow a little, a bolt, a bullet and a beam fly straight. */
export const ARC: Record<Ammo, number> = { arrow: 0.22, bolt: 0.08, bullet: 0, spear: 0.2, stone: 0.4, beam: 0, orb: 0.1, ball: 0.55 };
