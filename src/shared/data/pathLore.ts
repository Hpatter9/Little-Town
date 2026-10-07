// The telling behind every calling on the tree (data/paths.ts), for the evolution card (the owner's ask: the
// prompts with more character and story, after the old Final Fantasy jobs and Baldur's Gate's class pages): what the
// road asks, what it makes of a person, and a line of the world's lore. FORK is how each base calling's crossroads
// is told as a scene; LORE is each node's passage; ASCENDED tells the last step.

/** How the fork is told, by the base calling, with {name} for the townsperson. */
export const FORK: Record<string, string> = {
  fighter: 'The sparring post in the yard is split clean through, and {name} is only breathing a little hard. The old hands have stopped correcting their stance. What they have is not technique yet, only strength and nerve, and the question is what to make of them.',
  guard: 'Every night of the last month {name} has taken the gate watch without being asked. They stand the same way at the end of it as at the start. A door that will not open is a rare thing, and there is more than one kind to become.',
  scout: 'Nobody saw {name} leave and nobody saw them come back, but there is a brace of hares by the fire and a map of the ridge nobody had drawn. Eyes like theirs are wasted at close quarters. The question is what they should be pointed at.',
  rogue: 'The purse was back on the table before its owner noticed it was gone, and {name} was across the room looking innocent. Quick hands, quicker feet, and no great respect for the rules of a fair fight. There are two ways to sharpen that.',
  apprentice: 'The candle lit itself again this morning, and this time {name} meant it to. The books are getting harder and they are reading them anyway. The spark wants a shape: the bright arts or the dark ones.',
  acolyte: '{name} has been sitting with the sick, and the sick have been getting better faster than the healer can explain. Something answers when they pray. Whether it answers with light or with discipline is theirs to decide.',
  wanderer: '{name} came back from the woods with a wolf cub asleep in their hood, and the cub would not go to anyone else. The land has taken a liking to them. The green will give them its secrets, or lend them its creatures.',
  minstrel: 'When {name} starts a song at the fire, the quarrelling stops and the tired sit up. People fight better when they are near them, and nobody is quite sure why. A voice like that can carry a party, or a trade can carry a town.',
};

const L: Record<string, string> = {
  // the bases
  fighter: 'The plainest beginning: a strong arm, a borrowed blade, and the willingness to stand where the blows fall. Every great warrior started here, and so did most of the dead ones.',
  guard: 'They stand at the door. Whatever comes has to get past them first, and they have decided it will not. There is no glory in it yet, only the quiet pride of a thing that holds.',
  scout: 'Light on their feet and sharp of eye, better at a distance than up close. They know which way the wind carries a scent, and how far an arrow flies downhill.',
  rogue: 'Quick hands and quicker feet, and a fight is a thing to win, not to be fair about. They go for the knees, the eyes, the purse, and they are usually gone before the shouting starts.',
  apprentice: 'They have read a book or two, and a spark comes when they call it. Frail, curious, and already a little dangerous, mostly to themselves.',
  acolyte: 'They pray, and sometimes something answers: a little mending, a little light. The gods are not generous, but they have noticed.',
  wanderer: 'They walked a long way and listened to the land, and something in the wild listened back. Birds land near them. Dogs do not bark.',
  minstrel: 'A tune, a tale and a quick wit. They make everyone around them a little braver, and most of them a little poorer by the end of the evening.',

  // the Fighter's roads
  knight: 'The oath is simple: stand between the town and whatever comes for it. A Knight learns to want the blows aimed at others, to turn a shield as another turns a page, and to be the last thing standing when the dust settles. The plate is heavy. So is the trust.',
  paladin: 'Somewhere in the long nights on watch the Knight began to pray, and the light began to answer. A Paladin fights with a lit blade and a healer\'s hands; the dead cannot abide them, and the living are glad of them. The road asks for an oath kept even when nobody is watching.',
  crusader: 'Every blow a judgement, every charge a sermon. The Crusader has stopped asking whether the cause is just and started making it so, with a hammer. Raiders who have met one tell stories of a wall of light that walked.',
  templar: 'Consecrated steel, warded plate, and a mind no curse can get a grip on. The Templar is what a fortress would be if it could swing a sword. Spells break on them like rain.',
  dragoon: 'Nobody taught them to jump like that. A Dragoon fights from the air, lance first, and comes down where the enemy least wanted them. The landing shakes the ground; the second landing breaks it.',
  wyvern_knight: 'The leaps grew longer and the landings harder, until the Wyvern Knight seemed to borrow the sky from the beasts that own it. They fall on the foe like weather. Dragon-kind watches them with something like respect.',
  lance_captain: 'When the Lance Captain strikes, everyone strikes. They lead the charge rather than make it, and a line with one at its head moves like a single long weapon. Old soldiers would follow one anywhere, and have.',
  berserker: 'The worse it gets, the better they fight, and they do not much mind the getting. A Berserker throws away the shield because it was slowing the axe. They sleep soundly after battles that leave others shaking.',
  warlord: 'A Berserker who learned to make everyone else fight like one. The Warlord\'s banner on the field is worth twenty swords, and the war cry under it is worth twenty more. They win fights before the first blow by being obviously about to.',
  titan: 'Too big to stop. The Titan\'s blows fell two at once and shake the ground under the third; walls have been known to come down when one leans on them. There is a kind of calm in them now, the calm of a landslide.',
  warchief: 'The war cry that turns a crowd into an army. The Warchief fights at the front of a horde of their own making, and the horde is braver, faster and crueller for it. Raiders break at the sound before the sight.',
  blood_reaver: 'They heal from the wounds they deal. The fight feeds the Blood Reaver, and a long fight feeds them well; the more blood on the ground, the harder they are to put there. It is an old and ugly art, and a very effective one.',
  blood_lord: 'Every drop spilt nearby is theirs to drink. The Blood Lord walks through a melee like a man through rain, coming out wetter and stronger. The Court would make one a duke; everyone else makes room.',
  gorefiend: 'Half mad with it, and all the more terrible for that. The lower the Gorefiend\'s health, the more dreadful their blows, until near death they are the most dangerous thing on the field. They laugh at the worst moments.',

  // the Guard's roads
  sentinel: 'Shield first, always. The Sentinel draws the blows and turns them, and has learned to be hit without minding it. In a line of fighters they are the part that does not move.',
  bulwark: 'A wall with a person somewhere behind it. The Bulwark holds where others would break and is nearly impossible to move, to poison, to frighten or to wear down. Raiders have given up on them mid-fight and gone looking for someone easier.',
  aegis: 'The Aegis shields the whole line: blows meant for anyone near land on them instead, and they are built to take it. A party behind one feels the difference the first time nothing gets through. It is a lonely post and the proudest one.',
  colossus: 'Armour on armour, until the Colossus is too heavy to move and too heavy to be moved. Whatever strikes them is hurt by the striking. They advance at a walk and the enemy backs away at the same pace.',
  gatewarden: 'The Gatewarden holds the gate: raiders who reach it find it holding back. They taunt, they plant their feet, and they do not leave the threshold until the last one is down or gone. Every town wants one. Few deserve one.',
  ironwall: 'None shall pass. The Ironwall holds twice as many at the gate as anyone, strikes back at every blow that lands, and has never yet been the reason a raid got in. They say the gate could be taken down and nobody would notice.',
  shield_saint: 'A guard who found faith on the long watches. The Shield Saint\'s shield glows, and the hurt sheltering behind it mend while they wait. Light is a kind of wall too.',
  spellsword: 'Sword in one hand, spell in the other, and no patience for choosing. The Spellsword puts fire on the blade and lightning in the charge, and fights where a mage would never dare. They are rarely the best at either art and often the most useful.',
  battlemage: 'They cast in the thick of it. The Battlemage\'s spells go off at arm\'s length and their sword follows through the smoke; the plate is woven with wards because it has to be. Where they stand, the air smells of ozone.',
  arcane_knight: 'Plate woven through with wards, spells struck home with the sword. The Arcane Knight shrugs off magic that would flatten a mage and hits like a warrior while doing it. Knights of the old orders call them a contradiction; the contradiction wins.',
  stormblade: 'The blade is a lightning rod. Every cut the Stormblade lands is a thunderclap, and the struck stand stunned while the next one comes. Their duels are brief and very loud.',
  rune_knight: 'Runes cut into armour and steel: slower magic than a spell, and it lasts. The Rune Knight goes into a fight already warded, already sharpened, and already reflecting what is thrown at them.',
  runeguard: 'The Runeguard carves warding runes on everyone near, so the whole party fights under a shield that mends them while it holds. The runes take an hour to cut and a moment to prove their worth.',
  hexblade: 'Runes of ruin on the blade. Whatever the Hexblade strikes weakens, slows and fails, and keeps failing after the blade is gone. They are not popular at tournaments.',

  // the Scout's roads
  archer: 'They shoot from the back and rarely miss. The Archer\'s art is patience: the breath held, the moment picked, the arrow already on its way before the raider has finished turning round.',
  sharpshooter: 'One shot, one fall. The Sharpshooter picks the target that matters, the chief, the caster, the one about to break through, and ends it from across the field. Everything else is somebody else\'s problem.',
  hawkeye: 'The Hawkeye sees everything and hits all of it, at any range the field allows. Their arrows fall like a hard rain across the whole enemy line. Raiders learn to fear the open ground near a town that keeps one.',
  deadeye: 'They aim for the gap in the armour and find it more often than not. The Deadeye\'s shots go through plate as if it were cloth, and strike true so often that the ordinary hit is the surprise.',
  gunner: 'Powder, shot and the smell of it. The Gunner takes to the new weapons as they come, and the old ones never quite forgive them for it. A loud calling, and a short argument.',
  musketeer: 'Volley fire and a bayonet for anything that gets close. The Musketeer fights in the modern way: in time, by numbers, and with a great deal of smoke. Four shots in the time of one.',
  artillerist: 'They think in blasts. The Artillerist hits everything near the mark, and the mark is wherever the enemy has bunched up. Walls, raiders and the occasional unlucky tree all come down alike.',
  ranger: 'At home in the wild: bow and blade, beast lore and a little nature magic. The Ranger strikes first because they saw the foe first, and they always saw the foe first.',
  hunter: 'Traps, nets and the big shot held for the right moment. The Hunter is deadly to beasts and monsters and knows which end of each is the dangerous one. They sleep in trees without thinking about it.',
  beast_slayer: 'They know where the heart is on anything with fur or scales. The Beast Slayer\'s arrows go in to the fletching and the beast does not get up. Lairs empty when one moves into the district.',
  monster_hunter: 'The bigger they are, the more there is to aim at. The Monster Hunter goes after the things other hunters run from, and comes home with the horns. The Guild sends them the hunts nobody else will take.',
  beast_tamer: 'They fight beside a beast companion, and wild ones come over to their side mid-fight. The Beast Tamer wins by having more friends than the enemy expected, and sharper ones.',
  beastmaster: 'A pack at their heels. The Beastmaster calls a pride into the fight and wild things turn on their own at a word. They smell faintly of lion and do not apologise for it.',
  packleader: 'They run with the wolves, and the wolves run as one. The Packleader\'s pack strikes together, hastened and savage, and a raid that meets it meets a dozen teeth at once.',

  // the Rogue's roads
  assassin: 'Quick blades and poison from the shadows. The Assassin strikes true more than most and is seldom seen doing it. They are polite, well dressed, and not invited back.',
  shadow: 'Not seen until the knife is in. The Shadow vanishes in plain sight and comes back out of nowhere with the blow already landed. Even friends lose track of them in a crowded room.',
  nightblade: 'The Nightblade strikes from darkness and is gone before the body falls. One cut, from behind, in the dark: there is no second. Raiders have died in the middle of their own camp without a sound.',
  phantom: 'Half there. Blows pass through the Phantom and theirs always land, and nobody can say afterwards quite what they looked like. They may be the quickest thing on two legs in the realm.',
  venomist: 'Every blade dipped. What the Venomist cuts sickens and slows, and a scratch is as good as a wound. They keep their own antidotes in a locked case and do not share.',
  toxicant: 'The Toxicant\'s poisons spread from one foe to the next, and a single cut can lay low a line. Enemy camps empty from fevers nobody can trace. The Guild keeps a file on them.',
  widowmaker: 'A single cut that keeps on killing. The Widowmaker\'s long cut bleeds, and bleeds, and now and then the struck one simply does not wake tomorrow. There are towns where the name is not said aloud.',
  duelist: 'One blade, held just so. The Duelist ends things in a cut or two and answers every blow with a riposte, and they would rather fence than brawl. The style is beautiful. The results are not.',
  samurai: 'One perfect cut. The Samurai draws and strikes true more than anyone, and spends the rest of their time making sure the next cut is more perfect than the last. The sword is the whole of them.',
  kensei: 'The sword saint. The Kensei\'s strikes cannot be turned by plate, shield or spell, and nearly all of them land. There are perhaps three in a generation and the others are busy.',
  iaijutsu_master: 'The draw is the strike. The Iaijutsu Master acts first, always, and the first blow is so often the last that most of their fights are over before the enemy has decided to begin.',
  blade_dancer: 'A dance with two blades, and impossible to pin down. The Blade Dancer is never where the blow lands and usually where the next cut comes from. They fight to music nobody else can hear.',
  mirage: 'The foe strikes at air. The Mirage blinds and vanishes and is simply not there when the blow arrives; whole raids have swung at one for a minute and connected with nothing.',
  whirling_dervish: 'They spin through the press with both blades out and everyone near is cut. The Whirling Dervish turns a crowded melee into a storm with a person at the centre. Allies learn to stand back.',

  // the Apprentice's roads
  elementalist: 'Fire, frost and lightning from afar. The Elementalist has stopped singeing their own eyebrows and started singeing other people\'s, and the spells are getting bigger. Frail up close and quite aware of it.',
  archmage: 'Master of all three elements, and of the big spells that end fights at a word. The Archmage is the thing the enemy casters are afraid of. The staff is mostly ceremonial. Mostly.',
  pyromancer: 'All fire. The Pyromancer\'s infernos burn on after the spell is done, and the field after one of their fights is black for a season. They are warm company and dangerous neighbours.',
  cryomancer: 'All ice. What the Cryomancer touches slows, freezes and shatters, and a raid caught in their blizzard arrives at the gate half the size it left. Their breath frosts in summer.',
  chronomancer: 'They hasten friends and slow foes, and bend the turn order to suit them. The Chronomancer is seldom the one who lands the killing blow and always the reason it landed in time.',
  time_weaver: 'The Time Weaver winds the party ahead: more turns, sooner, for everyone. A fight with one in it runs at the party\'s pace and the enemy\'s expense. They are always slightly early.',
  fatespinner: 'The Fatespinner winds the foe back: stopped mid-stride, slowed to a crawl, undone. Raiders describe the sensation as being stuck in honey while the arrows come in. They are always slightly late, on purpose.',
  occultist: 'They read the darker books. The Occultist\'s curses, poisons and sleeps weaken the foe more than any fire would, and the evil eye is theirs to give. The other apprentices stopped sitting next to them.',
  witch: 'The Witch weakens the foe more than they burn them: a hex here, a blinding there, until the enemy can barely lift a sword. Nobody is sure where they learned it and nobody asks.',
  hexer: 'Curses that stack and stick. The Hexer piles weakness on slowness on doom until the struck fail at everything they try, and some of them simply stop. The Crone Queen is said to have begun this way.',
  coven_mother: 'Hexes on the foe and blessings on the party, both at once. The Coven Mother bargains with something on the party\'s behalf and the price is always paid by the other side. Her apprentices adore her.',
  necromancer: 'They raise fallen enemies to fight for the town and drain life from the living. The Necromancer is not welcome at feasts and is very welcome at the gate when the raiders come. The dead do not argue.',
  deathcaller: 'The dead come when the Deathcaller calls, and more of them each time: wraiths, walking corpses, skulls that fly. Battlefields are a harvest. They have stopped minding the smell.',
  lich_adept: 'Halfway to undeath by choice. The Lich Adept drains to heal, resists what would kill a living caster, and does not stay down when struck. The last step is a phylactery, and they are already shopping for a box.',

  // the Acolyte's roads
  priest: 'Heals, shields and raises the fallen; holy light against the dead. The Priest is why the party came home, and they will tell you it was the gods. It was partly the gods.',
  cleric: 'The great mender. A Cleric keeps a whole party standing through fights that should have killed them twice over, and has the bruises from the front line to prove it was earned.',
  high_priest: 'The High Priest mends everyone at once and brings the fallen back with a word. Death is a conversation they have won before. The temple is theirs and the god is listening.',
  hierophant: 'Blessings that last. The Hierophant\'s party fights warded, hastened and inspired from the first blow to the last, and the raiders feel they are fighting a faith rather than a town.',
  inquisitor: 'A priest who took up the sword. Light in the blade and no mercy for the dead, the possessed or the caster who thought silence was a courtesy. The Inquisitor asks questions afterwards.',
  witch_hunter: 'The Witch Hunter silences casters and burns the unholy. Nothing cursed stays cursed near them and nothing undead stays up. They carry a lot of salt.',
  exorcist: 'The Exorcist turns the dead and the possessed and cleanses every curse laid on the party. Where they walk, the dark things walk the other way. They sleep very well.',
  monk: 'Bare-handed or with a staff: quick, hard to hit, and mending themselves between blows. The Monk fights with a calm that unsettles the enemy more than fury would.',
  master: 'A flurry of blows and a calm mind. The Master lands three strikes in the time of one, each where it hurts, and is already elsewhere when the reply comes. Students line up; most of them leave.',
  grandmaster: 'Strikes faster than the eye can follow. The Grandmaster\'s hundred fists fall on one foe like hail, and that foe is done. They have not been hit in a fight for some years.',
  fist_of_light: 'Holy light in every blow. The Fist of Light mends the party with each strike landed, so the harder the fight the better the healer. Monks of the old houses call it heresy and take notes.',
  shaman: 'Totems and spirits: healing and hexing in one hand. The Shaman talks to things nobody else can see, and the things do favours. The totem glows at night.',
  witch_doctor: 'Poisons and plagues on the foe, cures for the party, all from the same bag. The Witch Doctor\'s plague totem empties the enemy line while their own friends feel better than they have in years.',
  spirit_chief: 'The ancestors answer. The Spirit Chief calls the honoured dead to fight beside the party, and the dead come gladly, with the courage of people who have nothing left to lose.',

  // the Wanderer's roads
  druid: 'Roots, thorns and storms; mending with the green. The Druid fights with the land itself and the land seems to enjoy it. Thorns grow where they bled.',
  archdruid: 'The forest fights for them: roots, swarms and sudden growth. The Archdruid walks into a fight and the ground under the enemy becomes a different, hungrier place.',
  green_sage: 'Life itself. The Green Sage\'s party heals as it fights and the fallen rise again, green-lit, with earth under their nails. The oldest trees bow a little when one passes.',
  stormcaller: 'They call down the weather. Lightning, hail and gales come at the Stormcaller\'s word and the enemy line goes down like wheat. Their hair is never quite still.',
  shapeshifter: 'They fight in the shape of a beast, a greater one with every stage: wolf, lion, bear, drake, and at the last something with wings. The Shapeshifter comes back from a fight picking fur out of their teeth.',
  primal: 'More beast than person now, and tougher, faster and hungrier for it. The Primal heals with every bite and sleeps outdoors by preference. Their friends have stopped asking them to come inside.',
  manyform: 'The Manyform shifts mid-fight, taking the shape each moment needs: speed, then fury, then hide. Enemies who thought they knew what they were fighting are usually wrong by the second round.',
  summoner: 'They call spirits and beasts to fight at their side, and stand well back while the summoned do the fighting. Frail as glass and fierce as a furnace, the Summoner lives or dies by whoever stands in front of them.',
  conjurer: 'The Conjurer binds the elements: salamanders of flame, undines of the deep, golems of stone, called up and set loose. The caster is the one small person behind a wall of elemental fury, and must be kept that way.',
  elementarch: 'A court of elementals at once: fire, stone, water and storm, bound and obedient. The Elementarch\'s own hands never need to be raised. If anything reaches them it is already too late, so nothing must.',
  voidbinder: 'Past the elements, into the dark. The Voidbinder reaches through the veil and drags out demons and worse, bound to serve, and the enemy breaks at the sight. The bargains are the Voidbinder\'s problem, later.',
  beastcaller: 'The beasts of the wild come to the Beastcaller\'s call: lions, wolves, and in time the beasts of legend. A frail figure with a pride at its feet. Do not let them be the one the raiders reach.',
  drake_tamer: 'Dragon-kind answers the Drake Tamer: hatchlings first, three at a time, and in the end the wyvern. Few callers reach this far and fewer survive the learning. Their companion sets fires by accident.',
  lord_of_hosts: 'Not one beast but a host of them, and the Behemoth at the last. The Lord of Hosts walks onto a field alone and the field fills with teeth and horns. There has never been a less dangerous-looking person at the head of so much.',

  // the Minstrel's roads
  bard: 'Songs that steady the party and shake the foe. The Bard\'s marching song gets a tired party to the fight and their war song gets it through. Afterwards there is a ballad about it, somewhat exaggerated.',
  skald: 'They sing of war, and the party fights as if it were already a saga. The Skald\'s saga of heroes makes heroes; it is less a trick than a prophecy. Berserkers weep at the chorus.',
  maestro: 'Every song at once: haste, courage, mending, dread for the foe. The Maestro conducts a battle like an orchestra and the enemy is the only one out of tune. They take a bow afterwards.',
  warsinger: 'The song is a weapon. The Warsinger\'s notes cut and the chords stun, and a shattering chord can bring an enemy line to its knees with its hands over its ears. Hard to sit next to at the tavern.',
  dancer: 'Dances that charm the foe and quicken friends. The Dancer is never still and never where the blow lands, and raiders have been known to stop and watch, which is the point.',
  muse: 'Inspiration beyond reason. The Muse\'s party strikes true, never tires and keeps on mending, and nobody can quite explain afterwards why they fought so well. They were watching the Muse.',
  fire_dancer: 'A dance with flame. Beautiful, and the foe burns: the Fire Dancer\'s circle leaves the enemy line alight and the audience applauding. The straw roofs of the town are a standing concern.',
  tinker: 'Pockets full of flasks and springs, and something in them always goes off. The Tinker is not yet sure whether they are an alchemist or an engineer and has blown up a shed finding out.',
  alchemist: 'Flasks of fire and acid thrown overhand, and tonics for the party brewed in the same pot (rinsed, usually). The Alchemist is a support who has decided to also be an artillery piece.',
  bombardier: 'Bigger flasks. The Bombardier\'s firestorm leaves the whole enemy line burning, choking and blind, and the crater is a talking point. Towns with one keep the apothecary well away from the granary.',
  philosopher: 'The deeper art. The Philosopher\'s elixirs make the party more than it was: stronger, faster, warded and whole, for as long as the fight lasts. The stone itself is said to be a few years off.',
  artificer: 'Guns, turrets and contraptions, and armour mended mid-fight with a spanner. The Artificer builds the party\'s edge in a workshop and carries it into the field in a satchel.',
  machinist: 'A turret for every fight and a bigger gun each age. The Machinist\'s sentry battery holds a line by itself while the Machinist reloads. They are on first-name terms with the drone hub.',
  clockwork_sage: 'Devices that heal, shield and hasten: a workshop on legs. The Clockwork Sage\'s wonders tick away at the party\'s side and the enemy\'s spells fizzle in a cloud of gears. They have a device for that too.',
};

/** Every ascended form shares this frame, with {name} the form and {from} the calling before it. */
export const ASCENDED = 'The last of the line. There is nothing past {name}: the {from} has become the thing the stories were about, and the stories will have to be rewritten. Few reach it, and none by levels alone: it takes an ascension, a deed worthy of legend, or a very long life.';

/** The passage for a node: its own, or the ascended frame for a last form. */
export function loreOf(id: string, name: string, from?: string): string {
  return L[id] ?? ASCENDED.replace('{name}', name).replace('{from}', from ?? 'calling');
}
export const LORE_IDS: readonly string[] = Object.keys(L);
