// What each calling is, how it fights and what it brings the town, in a few plain sentences (the owner's ask: class
// descriptions clear about what it is, what it does and its role). Shown when a calling is opened on the Townsfolk
// page (`classRow` in townsfolkPanel.ts); the role's own line comes from `ROLE_ABOUT`, and the skills it takes to in
// town are read from the class's `affinity`.

import type { ClassId, ClassRole } from './classes';

export interface ClassAbout {
  /** Who they are. */
  what: string;
  /** How they fight, and where they stand in a party or on the raid map. */
  fights: string;
}

/** What each role means in a fight. */
export const ROLE_ABOUT: Record<ClassRole, { name: string; text: string }> = {
  tank: { name: 'Tank', text: 'Stands in front and takes the blows meant for others; holds a whole raider pack on the trail.' },
  bruiser: { name: 'Bruiser', text: 'Fights up close and hits hard, and can take a beating while doing it.' },
  striker: { name: 'Striker', text: 'Quick and deadly up close: lands the killing blows, but goes down if caught.' },
  shooter: { name: 'Shooter', text: 'Fights from range: stands behind the line or on the walls and picks foes off.' },
  caster: { name: 'Caster', text: 'Spells from the back: great harm to many at once, but frail if anything reaches them.' },
  healer: { name: 'Healer', text: 'Keeps the party standing: heals, shields and lifts the fallen.' },
  support: { name: 'Support', text: 'Makes everyone else better: quickens, steadies, weakens the foe.' },
};

export const CLASS_ABOUT: Record<ClassId, ClassAbout> = {
  knight: {
    what: 'A sworn defender in plate, raised on oaths and drill. Knights live to stand between the town and whatever comes for it.',
    fights: 'Shield up, sword ready: a knight holds the front of the line, turns blows aside and taunts raiders onto themselves. In time they call on holy light to mend their friends and burn the dead.',
  },
  warrior: {
    what: 'A brawler with no patience for fine technique. Warriors trust weight, reach and nerve, and get angrier as the fight goes on.',
    fights: 'Two-handed axes and mauls, wide swings that catch more than one foe, and blows that grow harder the more hurt they are. Best in the thick of it, beside a tank.',
  },
  ranger: {
    what: 'A wanderer of the woods and hills who knows every track and herb. Rangers scout ahead and come back with what the land gives.',
    fights: 'A bow at range and a blade when cornered, a little nature magic to snare foes or close a wound, and extra harm against beasts.',
  },
  archer: {
    what: 'A patient shot who practises until the arrow goes where the eye does. Later archers take up crossbows and guns.',
    fights: 'Stays at the back or up on the wall and shoots, rarely missing; volleys that strike several foes and aimed shots that strike true. Frail if caught.',
  },
  beast_tamer: {
    what: 'A herder with a way with animals, wild or tame. The pens thrive under a tamer, and the wild things sometimes follow them home.',
    fights: 'Fights beside a beast companion that takes blows and bites back, and can turn wild beasts in a raid to the town\'s side.',
  },
  mage: {
    what: 'A scholar of the arcane who studies fire, frost and lightning until they answer. Mages learn fast and think faster.',
    fights: 'Burns, freezes and shocks from far back, with spells that burst across whole groups and ignore armour. Can\'t take a hit: keep them behind the line.',
  },
  witch: {
    what: 'A hedge-wise healer and curse-maker who knows which root mends and which one kills. Feared a little, needed a lot.',
    fights: 'Curses, poisons and sleeps: weakens and slows the foe so others finish them, with a healing draught for a friend in need.',
  },
  white_mage: {
    what: 'A healer of the old faith who tends the sick at home and the wounded in the field. The town breathes easier with one about.',
    fights: 'Heals, shields and raises the fallen; holy light burns the undead. Keep them alive and the party stays alive.',
  },
  monk: {
    what: 'A disciple of body and breath who trained in a quiet place far from here. Calm, disciplined, and never idle.',
    fights: 'Bare hands or a staff, quick strikes, hard to hit, and heals their own hurts mid-fight. Fights well alone or at the front.',
  },
  assassin: {
    what: 'A quiet one with a past nobody asks about. Light on their feet and lighter with a purse; useful when something needs ending quietly.',
    fights: 'Daggers and poison, striking true far more often than most; vanishes from a foe\'s sight and comes back at their throat.',
  },
  necromancer: {
    what: 'A student of death and what lies past it. Unsettling company, but the dead they raise fight for the living.',
    fights: 'Drains life, spreads rot, and raises fallen foes to fight on the town\'s side. Stays at the back behind their dead.',
  },
  summoner: {
    what: 'A caller of spirits and elementals who bargains with things from elsewhere. Their allies are never quite their own.',
    fights: 'Calls spirits, elementals and beasts of legend to fight for the party, and lets them take the blows.',
  },
  blood_knight: {
    what: 'A warrior bound to their own blood by an old oath. They fight as if the wound were a gift.',
    fights: 'Heals from the harm they deal and hits harder the more hurt they are: the closer to death, the more dangerous.',
  },
  bard: {
    what: 'A singer and teller of tales who carries news from town to town. Good for morale, good at the market, good company.',
    fights: 'Songs that steady and quicken the party and shake the foe\'s nerve; a little harm from a distance.',
  },
  alchemist: {
    what: 'A tinkerer of tinctures and powders who trusts a recipe over a prayer. Half healer, half bomb-maker.',
    fights: 'Throws flasks of fire and acid that splash across groups, and brews tonics that mend and strengthen the party.',
  },
  engineer: {
    what: 'A builder of machines who would rather fix a thing than fight it. Their workshop is never tidy.',
    fights: 'Guns, turrets and contraptions from range; patches armour mid-fight and sets traps on the trail.',
  },
  dragoon: {
    what: 'A spear-fighter of the old cavalry who learned to leap where horses could not. Proud, and fond of heights.',
    fights: 'Leaps high and comes down spear-first on the foe, striking hard and hitting through armour. Fights at the front.',
  },
  samurai: {
    what: 'A swordsman of one perfect cut, trained to stillness and then sudden motion. Few words, many hours of practice.',
    fights: 'Draws and strikes true more than anyone, with cuts that end a fight in one blow. A striker who wants the front.',
  },
  guardian: {
    what: 'A wall of a person with a shield the size of a door. Slow to anger and impossible to move.',
    fights: 'Draws every blow to themselves and turns them aside; the toughest at holding a trail spot against many.',
  },
  shaman: {
    what: 'A speaker to spirits, ancestors and the land itself. They read omens and ease the dying.',
    fights: 'Totems that heal friends and hex foes, spirits that strike from afar; heals and harms in the same breath.',
  },
  spellblade: {
    what: 'A fighter who learned a little magic, or a mage who learned to hold a sword. Good at many things, master of none.',
    fights: 'Sword in one hand, spell in the other: strikes up close, then bursts fire or frost on the next foe. Fits anywhere in a party.',
  },
  chronomancer: {
    what: 'A scholar of time itself, odd and distracted, always late or early. They say they have seen how this ends.',
    fights: 'Hastens friends and slows foes, rewinds a wound; at the last, stops time itself for a moment.',
  },
  hunter: {
    what: 'A trapper and tracker who keeps the town in meat and the woods in fear. Knows every beast by its spoor.',
    fights: 'Traps, nets and heavy shots from range: deadly against beasts and monsters, and quick to pin a foe in place.',
  },
  druid: {
    what: 'A keeper of the old groves who speaks for the green and the wild. Fields grow better with a druid walking them.',
    fights: 'Roots and thorns to hold foes, storms to strike them, healing from the green for friends; at the height of their art they take a beast\'s shape.',
  },
  dancer: {
    what: 'A performer whose grace hides a fighter\'s training. Draws a crowd at a feast and a foe\'s eye in a fight.',
    fights: 'Dances that charm foes and quicken friends; almost impossible to pin down, with blades when it comes to it.',
  },
};
