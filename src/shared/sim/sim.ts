// Fixed-tick simulation. Rendering never drives it: callers feed in elapsed real time and the sim runs
// however many whole ticks that covers.

import { uniquesHourly } from './provenance';
import { CONQUEST } from '../data/conquest';
import { tacticsOrder } from './tactics';
import { regrowHourly } from './regrow';
import { streetsHourly } from './streets';
import { drawPath } from './pathPlans';
import { roamersTick, skirmishTrip } from './roamers';
import { strays } from './strays';
import { skiesHourly, skiesTick } from './skies';
import { faithHourly } from './faith';
import { religionHourly, religionTick } from './religion';
import { disastersTick } from './disasters';
import { worldHourly } from './worldLife';
import { marketsHourly, setRoute } from './markets';
import { empireHourly, empireTick } from './tradeEmpire';
import { groveHourly } from './grove';
import { giveChase } from './chase';
import { skipRaid, skipRaidsTick } from './raidSkip';
import { courtHourly } from './bargains';
import { workHourly } from './greatWork';
import { orderHourly } from './chivalry';
import { hordeHourly } from './warpath';
import { foundryHourly } from './foundry';
import { frontierHourly } from './frontier';
import { lightingHourly } from './lighting';
import { annalsHourly } from './annals';
import { tiersHourly } from './tiers';
import { memorialsHourly } from './statues';
import { envoyTick, factionsHourly, realmCommand } from './factions';
import { risingHourly } from './risingPowers';
import { addMember, cancelMuster, dropMember, makeLeader, order, persuade, raiseParty, sendMuster, setMuster } from './muster';
import { specialsHourly } from './specials';
import { sagasHourly } from './sagas';
import { huntsHourly } from './hunts';
import { dragonTick } from './dragon';
import { holdForFight } from './raidWait';
import { fightClock, openPrompt, parkPrompt, stoodTick, type Hold } from './popups';
import { leadQuest, waitingOnFounder } from './founderQuests';
import { creatureArrives, creatureTick, feedCreature, restCreature, teachCreature } from './creature';
import { stewardTick } from './steward';
import { storyHourly } from './story';
import { maybeEvent } from './events';
import { alignmentHourly } from './alignment';
import { rally } from './rally';
import { battleGo, fightSpeedTick, placeFighter, setAutoBattle, setBattleSpeed, setGameSpeed } from './battle';
import { castAt } from './powers';
import { Rng } from '../rng';
import { demolish, discardStock, placeBlueprint, townRadius, upgrade } from './buildings';
import { fogTick } from './fog';
import { cellAt, groundAt, isMarked, setGround, setMarked, type Pt, decayWear } from './land';
import { MARK_CLEAR_CAP, type Command } from './commands';
import { restockKits } from './kit';
import { equip, hourlyItems, queueCraft, reduceCraft } from './crafting';
import { growCrops, tendFields } from './farming';
import { tendHerds } from './livestock';
import { updateFires } from './fire';
import { updateSocial } from './social';
import { checkDespair, checkLeavers, updateBreaks } from './breaks';
import { trade, updateTrade } from './trade';
import { assignOperators, cycleOperator } from './operators';
import { releasePrisoner, updatePrisoners } from './prisoners';
import { updateDoom } from './doom';
import { updateMonsters } from './monsters';
import { destinationOf, recallExpedition, rolesFor, sendDelve, sendExpedition, updateExpeditions, sendParty } from './expeditions';
import { packHourly } from './pack';
import { ageingHourly } from './ageing';
import { replenishSea } from './sea';
import { bloodHourly } from './vampires';
import { RAID_KIND_BY_ID } from '../data/raids';
import { checkBleeding, heal } from './health';
import { updateAdvice } from './advice';
import { classesHourly } from './classes';
import { warHourly } from './war/war';
import { spendByClass, spendPoint } from './attributes';
import { questsHourly } from './quests';
import { acceptQuest, declineQuest, questBoardHourly } from './questBoard';
import { delvesHourly } from './delves';
import { placesHourly } from './places';
import { nestsHourly } from './nests';
import { wildHourly } from './wild';
import { greatEnemyHourly } from './greatEnemy';
import { deepHourly } from './deep';
import { underdarkHourly } from './underdark';
import { portalsHourly } from './portals';
import { magicHourly } from './magic';
import { ancestorsHourly } from './ancestors';
import { lookInside } from './interiors';
import { dynastyHourly } from './dynasty';
import { intrigueHourly } from './intrigue';
import { lineageHourly } from './lineage';
import type { RealmId } from '../data/portals';
import { giftVillage, villagesHourly } from './villages';
import { issueEdict, politicsHourly } from './politics';
import { guildsHourly } from './guilds';
import { ranchCommand, ranchHourly } from './ranch';
import { challenge, duelHourly, duelTick, duelTrip } from './duel';
import { disputesHourly } from './disputes';
import { nameCommand } from './naming';
import { arenaBet, arenaHourly, arenaTick, arenaTrip } from './arena';
import { endScene, queueScene, scenesHourly, watchScene } from './cutscenes';
import { turnPerson, turnTown } from './turning';
import { updateLaunch } from './era';
import { viewsChanged } from './snapshot';
import { maybeStartRaid, startGuildRaid, startRaid, updateRaid } from './raids';
import { answerPrompt, expirePrompts } from './roadEvents';
import { newTickContext, updatePerson, walkTo } from './people';
import type { Person } from './state';
import { setPin } from './pins';
import { cancelResearch, moveResearch, pickResearch, researchNext, seatStageNow } from './research';
import { autoPriorities, campCell, notify, type GameState } from './state';
import { TICK_MS, TICKS_PER_HOUR } from './time';
import { acceptVisitor, assignBeds, drillGuards, driftMorale, keepKin, maybeArrive, rejectVisitor, updateVisitor } from './townsfolk';
import { chooseOffer, keepOffer } from './researchOffer';
import { forSale, runPlanner, shoppingList } from './planner';
import { syncRing } from './ringWall';
import { chooseLich, watchLich } from './occult';
import { castHeld, castPowers, holdPower } from './powers';
import { lurkers } from './lurkers';
import { prowlers } from './prowlers';
import { nightWatchHourly } from './nightWatch';
import { bandsTick } from './bands';
import { caveBear } from './caveBear';
import { updateNomads } from './nomads';
import { rulesOf } from '../data/origins';
import { BUILDING_BY_ID } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import type { Material, Stock } from '../data/materials';

/** How often a druid town's forest grows back a tile. */
const REGROW_TICKS = TICKS_PER_HOUR * 2;
import { updateShop, type ShopTown } from './shop';
import { updateWages } from './wages';
import { propertyHourly } from './property';
import { treasuryHourly } from './treasury';
import { ambitionHourly } from './ambition';
import { ceremoniesHourly } from './ceremonies';
import { festivalsHourly } from './festivals';
import { cultureHourly } from './culture';
import { diaryTick } from './diary';
import { injuriesHourly } from './injuries';
import { partiesHourly, postBounty, setVeto, withdrawBounty } from './parties';
import { boatsHourly } from './boats';
import { seafaringHourly } from './seafaring';
import { oddsHourly } from './raidOdds';
import { voteSettlementName } from './settlementName';
import { setFavourite } from './favourites';
import { buyRare } from './rareStall';
import { founderBuyShop, founderShopManager, founderShopPrice, founderShopStock } from './founderShops';
import { founderApprentice, founderFeast, founderHaggle, founderMatch, founderVisitor } from './founderDealings';
import { applyDev, devTick, setDevMode } from './dev';
import { founderExplore, founderGive, founderGo, founderHeir, founderRest, founderTick, founderWork } from './founder';

/** How the town trades at its shop: the planner decides what's spare and what to buy. */
const SHOP_TOWN: ShopTown = { forSale, wants: shoppingList };

/** Most ticks one advance() call will run; the rest of a long gap is dropped (long gaps go through catchUp). */
export const MAX_TICKS_PER_ADVANCE = 600;

export class Sim {
  private readonly rng: Rng;
  private pending: Command[] = [];
  private carryMs = 0;

  constructor(readonly state: GameState) {
    this.rng = new Rng(state.rngState);
  }

  /** Queue a command for the start of the next tick. */
  command(c: Command): void {
    this.pending.push(c);
  }

  /** Advance by `ms` of real time. Runs whole ticks and carries the remainder. Returns ticks stepped. */
  advance(ms: number, maxTicks = MAX_TICKS_PER_ADVANCE, budgetMs = Infinity, hold: Hold = null): number {
    this.carryMs += Math.max(0, ms);
    // (a wall-clock budget: ticks that don't fit stay owed and are caught up over the next calls, up to maxTicks' worth)
    const until = budgetMs === Infinity ? Infinity : performance.now() + budgetMs;
    let n = 0;
    while (this.carryMs >= TICK_MS && n < maxTicks) {
      if (until !== Infinity && (n & 7) === 7 && performance.now() > until) {
        this.carryMs = Math.min(this.carryMs, TICK_MS * maxTicks);
        return n;
      }
      this.carryMs -= TICK_MS;
      this.step(hold);
      n++;
    }
    if (n === maxTicks) this.carryMs = Math.min(this.carryMs, TICK_MS);
    return n;
  }

  /** One tick: apply queued commands, then (unless paused) run every system once, in a fixed order. */
  step(hold: Hold = null): void {
    const s = this.state;
    if (s.gameOver) {
      // the story is over; only a new game continues (but the report of how it ended can still be put away)
      this.pending = [];
      return;
    }
    for (const c of this.pending) this.apply(c);
    devTick(s); // (developer mode: orders built at once, a fast-forward's end: sim/dev.ts)
    skipRaidsTick(s); // (a town set to skip its raids: sim/raidSkip.ts)
    this.pending = [];
    if (s.paused) return;
    // (a pop-up is up: sim/popups.ts. The town stands still; a fight on screen plays on.)
    if (hold === 'popup') return stoodTick(s);
    if (hold === 'fight') return this.fightStep();
    if (waitingOnFounder(s)) return; // (a road question for the founder holds the game until it is answered)

    s.tick++;
    voteSettlementName(s);
    founderTick(s); // (the founder's orders end, and a rest mends: sim/founder.ts)
    stewardTick(s); // (a steward minds the town while the founder is away: sim/steward.ts)
    const ctx = newTickContext();
    for (const p of s.people) {
      if (p.away !== null) continue;
      updatePerson(s, p, this.rng, ctx);
      heal(s, p);
      // the downed bleed out in town too, unless they're tended in time
      checkBleeding(s, p);
      if (s.gameOver) break;
    }
    fogTick(s); // (the fog of war: what has been seen, and what is in sight: sim/fog.ts)
    syncRing(s); // (every piece of the wall going up shows its one progress: sim/ringWall.ts)
    updateExpeditions(s, this.rng);
    roamersTick(s); // (bands roaming the land, and the fights they start: sim/roamers.ts)
    skiesTick(s); // (sky pirates dropping in, and the town shooting at what hunts from the sky: sim/skies.ts)
    fightSpeedTick(s); // (every fight starts at 1×: sim/battle.ts)
    envoyTick(s);
    maybeStartRaid(s, this.rng);
    empireTick(s); // (a raid bought off, or met by hired swords: sim/tradeEmpire.ts)
    lurkers(s, this.rng);
    prowlers(s, this.rng); // (and the night prowlers that slip in where the wall has gaps: sim/prowlers.ts)
    caveBear(s, this.rng);
    updateNomads(s);
    updateRaid(s, this.rng);
    strays(s); // (a foe that outlived its raid or its band is sent away: sim/strays.ts)
    updateFires(s, this.rng);
    disastersTick(s); // (floods, wildfires, tornadoes, earthquakes: sim/disasters.ts)
    expirePrompts(s, this.rng);
    if (s.gameOver) return;
    for (const p of s.people) driftMorale(s, p);
    assignBeds(s);
    hourlyItems(s, this.rng);
    restockKits(s); // (battle items into the pouches: sim/kit.ts)
    growCrops(s);
    tendFields(s, this.rng);
    tendHerds(s);
    updateSocial(s, this.rng);
    checkDespair(s);
    assignOperators(s);
    updatePrisoners(s, this.rng);
    updateDoom(s, this.rng);
    updateLaunch(s);
    watchLich(s);
    this.regrow();
    castPowers(s, this.rng);
    if (s.gameOver) return;
    updateMonsters(s, this.rng, (target) => startGuildRaid(s, target, this.rng));
    updateBreaks(s, this.rng);
    checkLeavers(s);
    updateTrade(s, this.rng);
    updateShop(s, this.rng, SHOP_TOWN);
    bandsTick(s, this.rng); // (the visiting bands: caravans, travellers, bandits in disguise, refugees: sim/bands.ts)
    updateWages(s);
    propertyHourly(s);
    treasuryHourly(s, this.rng);
    ambitionHourly(s);
    partiesHourly(s);
    nightWatchHourly(s); // (who keeps the watch tonight, by the danger: sim/nightWatch.ts)
    oddsHourly(s); // (a probing band's night visit: sim/raidOdds.ts)
    boatsHourly(s, this.rng);
    seafaringHourly(s); // (harbour, shoals, colonies, pirates and the sea's monsters: sim/seafaring.ts)
    skiesHourly(s); // (airships, sky pirates and the hunters of the sky: sim/skies.ts)
    ceremoniesHourly(s);
    festivalsHourly(s);
    cultureHourly(s); // (the town's own customs, earned from its history: sim/culture.ts)
    annalsHourly(s);
    tiersHourly(s); // (the town's rank, the firsts it sees, its generations: sim/tiers.ts)
    memorialsHourly(s); // (homes named, ruins cleared, statues to the famous dead: sim/statues.ts)
    injuriesHourly(s, this.rng);
    if (s.tick % TICKS_PER_HOUR === 0) for (const p of s.people) if (p.autoPriorities) p.priorities = autoPriorities(p.skills, p.id === s.mainId);
    if (s.tick % TICKS_PER_HOUR === 0) classesHourly(s);
    if (s.tick % TICKS_PER_HOUR === 0) decayWear(s.land, s.tick / TICKS_PER_HOUR); // (footpaths grass over where nobody walks)
    regrowHourly(s); // (and the woods grow back: sim/regrow.ts)
    streetsHourly(s); // (streets planned where folk walk, and to the gates: sim/streets.ts)
    faithHourly(s); // (the gods: sim/faith.ts)
    religionHourly(s); // (the townsfolk's faith, the priests, omens and miracles, the cult: sim/religion.ts)
    religionTick(s); // (the priest's blessings on the defenders and on parties setting out)
    worldHourly(s); // (the realm beyond the town: sim/worldLife.ts)
    marketsHourly(s); // (prices, the trade house and its wagons: sim/markets.ts)
    empireHourly(s); // (trading posts, far caravans, the guilds' deals: sim/tradeEmpire.ts)
    groveHourly(s); // (a druid town's grove: sim/grove.ts)
    courtHourly(s); // (a fae town's Court and its bargains: sim/bargains.ts)
    workHourly(s); // (an alchemists' town's Great Work: sim/greatWork.ts)
    orderHourly(s); // (a knights' town's code: sim/chivalry.ts)
    hordeHourly(s); // (an orc town's warpath: sim/warpath.ts)
    foundryHourly(s); // (a machine town's factory mind: sim/foundry.ts)
    frontierHourly(s); // (a settlers' town's frontier: sim/frontier.ts)
    lightingHourly(s); // (the town's torches and lamps placed and burned: sim/lighting.ts)
    storyHourly(s); // (the founder's story: sim/story.ts)
    questBoardHourly(s); // (offers taken up or lapsing, accepted quests failing: sim/questBoard.ts)
    questsHourly(s);
    delvesHourly(s);
    placesHourly(s, this.rng);
    nestsHourly(s); // (monster nests on the land: sim/nests.ts)
    wildHourly(s); // (herds, predators and the woods spreading: sim/wild.ts)
    greatEnemyHourly(s); // (the Great Enemy: sim/greatEnemy.ts)
    deepHourly(s); // (the Deep under the town: sim/deep.ts)
    underdarkHourly(s); // (the Underdark, the caves under the land: sim/underdark.ts)
    portalsHourly(s); // (other worlds through an arch or a rift: sim/portals.ts)
    magicHourly(s); // (mana from the leylines, study, the town's rites and what they cost: sim/magic.ts)
    ancestorsHourly(s); // (a descendant's forebears: spirits, the heirloom, the Old House: sim/ancestors.ts)
    lineageHourly(s); // (children's lessons and apprenticeships: sim/lineage.ts)
    diaryTick(s); // (the day's doings counted for each townsperson's diary: sim/diary.ts)
    villagesHourly(s); // (daughter villages: sim/villages.ts)
    politicsHourly(s); // (the town's politics and law: sim/politics.ts)
    dynastyHourly(s); // (upbringing, feuds, the ruling house, heirlooms: sim/dynasty.ts)
    intrigueHourly(s); // (the houses' holdings, a ring, schemes on the council: sim/intrigue.ts)
    guildsHourly(s); // (guilds and squads formed to fill what the town lacks: sim/guilds.ts)
    ranchHourly(s); // (the monster ranch's day: sim/ranch.ts)
    arenaHourly(s); // (the arena's season, its card and its bout: sim/arena.ts)
    arenaTick(s);
    duelHourly(s); // (a rival's challenge: sim/duel.ts)
    duelTick(s); // (the founder's duel under way)
    disputesHourly(s); // (a quarrel or theft for the founder to judge: sim/disputes.ts)
    scenesHourly(s); // (cutscenes left unwatched lapse: sim/cutscenes.ts)
    // (a town just founded: its founding, to watch)
    if (s.tick === TICKS_PER_HOUR && s.autopilot !== false && !s.scenesSeen?.length && !s.scenes?.length) queueScene(s, 'founding');
    ageingHourly(s, this.rng);
    replenishSea(s, this.rng);
    bloodHourly(s);
    specialsHourly(s);
    sagasHourly(s);
    huntsHourly(s);
    dragonTick(s); // (the dragon in the hills: sim/dragon.ts)
    creatureTick(s); // (the town's great creature: sim/creature.ts)
    creatureArrives(s); // (and the saga it comes in, once Great Beasts is studied)
    factionsHourly(s, this.rng);
    risingHourly(s); // (the rising powers' own moves: sim/risingPowers.ts)
    if (CONQUEST.on) warHourly(s); // (the seasons of war: the realm's wars, the town drawn in, its borders on the War tab: sim/war/)
    if (s.tick % TICKS_PER_HOUR === 0) keepKin(s);
    if (s.tick % TICKS_PER_HOUR === 0) uniquesHourly(s); // (who bears each unique now: sim/provenance.ts)
    packHourly(
      s,
      this.rng,
      (dest, members) => {
        const d = destinationOf(s, dest);
        const r = sendExpedition(s, dest, members, rolesFor(members.map((id) => s.people.find((p) => p.id === id)!), d), 'bold');
        return r.ok ? s.expeditions[s.expeditions.length - 1] : null;
      },
      (kind, budget) => startRaid(s, RAID_KIND_BY_ID[kind], budget, this.rng),
    );
    drillGuards(s);
    updateAdvice(s);
    maybeArrive(s, this.rng);
    maybeEvent(s, this.rng);
    alignmentHourly(s); // (the town's alignment: sim/alignment.ts)
    holdForFight(s); // (questions wait while a fight is on screen: sim/raidWait.ts)
    updateVisitor(s, (p: Person, to: Pt) => walkTo(s, p, to));
    // the town decides for itself what to research, make, build and gather
    keepOffer(s); // (the three topics on offer: sim/researchOffer.ts)
    runPlanner(s);

    s.rngState = this.rng.state;
  }

  /** One tick of a fight on screen while the town holds: only the fight (a raid's battle, or the party's, skirmish's or
   *  bout's being watched) plays. The people, needs, work, weather and every other system stand still. */
  private fightStep(): void {
    const s = this.state;
    fightClock(s);
    fightSpeedTick(s);
    // (the defenders on the trail still walk to their spots: the set-up waits until they stand there, battle.ts)
    const ctx = newTickContext();
    const defenders = new Set<number>();
    for (const u of s.raid?.battle?.units ?? []) if (u.person !== undefined) defenders.add(u.person);
    for (const p of s.people) if (defenders.has(p.id) && p.away === null) updatePerson(s, p, this.rng, ctx);
    if (s.raid) updateRaid(s, this.rng);
    if (s.watching !== undefined) {
      updateExpeditions(s, this.rng);
      roamersTick(s);
      arenaTick(s);
    }
    s.rngState = this.rng.state;
  }

  /** A druid town's cleared forest grows back: now and then, a tree comes up on a grass cell beyond the town's
   *  edge, in the open land, away from any building and road. */
  private regrow(): void {
    const s = this.state;
    if (!rulesOf(s).regrow || s.tick % REGROW_TICKS !== 0) return;
    const m = s.land;
    const camp = campCell(s);
    const near = townRadius(s) + 2;
    const spots: number[] = [];
    for (let y = Math.max(0, camp.y - m.open); y <= Math.min(m.h - 1, camp.y + m.open); y++)
      for (let x = Math.max(0, camp.x - m.open); x <= Math.min(m.w - 1, camp.x + m.open); x++) {
        const d = Math.hypot(x - camp.x, y - camp.y);
        if (d <= near || d > m.open || groundAt(m, x, y) !== 'grass' || m.roads[y * m.w + x] === '#') continue;
        if (s.buildings.some((b) => Math.abs(b.tile - x) <= BUILDING_BY_ID[b.def].width && Math.abs(b.row - y) <= 3)) continue;
        spots.push(y * m.w + x);
      }
    if (!spots.length) return;
    const i = this.rng.pick(spots);
    const pool: Stock = {};
    for (const [mat, [lo, hi]] of Object.entries(TERRAIN.forest.pool) as [Material, [number, number]][]) {
      const n = this.rng.int(lo, hi);
      if (n > 0) pool[mat] = n;
    }
    const c = cellAt(m, i);
    setGround(m, c.x, c.y, 'forest');
    m.pools[i] = pool;
  }

  private apply(c: Command): void {
    viewsChanged(); // (the snapshot's views are worked out afresh: snapshot.ts)
    const s = this.state;
    switch (c.type) {
      case 'placeBuilding':
      {
        const r = placeBlueprint(s, c.def, c.x, c.y);
        if (!r.ok && r.reason) notify(s, `Can't build there: ${r.reason.toLowerCase()}.`);
        break;
      }
      case 'demolish':
        demolish(s, c.building);
        break;
      case 'turnPerson': {
        const r = turnPerson(s, c.person, c.kind);
        if (!r.ok) notify(s, `Can't: ${r.reason}.`);
        break;
      }
      case 'turnTown':
        turnTown(s, c.kind);
        break;
      case 'upgrade': {
        const r = upgrade(s, c.building);
        if (!r.ok) notify(s, `Can't upgrade: ${r.reason}.`);
        break;
      }
      case 'discardStock':
        discardStock(s, c.building, c.material);
        break;
      case 'queueCraft':
        queueCraft(s, c.item);
        break;
      case 'reduceCraft':
        reduceCraft(s, c.order, c.all);
        break;
      case 'equip': {
        const p = s.people.find((q) => q.id === c.person);
        if (p && p.away === null) equip(s, p, c.slot, c.item);
        break;
      }
      case 'queueResearch':
        pickResearch(s.research, c.topic, s.cheats.unlockAll ? 'space' : s.era, s.origin, seatStageNow(s));
        break;
      case 'studyOffer':
        chooseOffer(s, c.topic);
        break;
      case 'cancelResearch':
        cancelResearch(s.research, c.topic, true);
        break;
      case 'orderRing':
        s.ringOrder = true;
        break;
      case 'pinBuilding': {
        const no = setPin(s, c.def, c.on);
        if (no) notify(s, `Can't wish for that: ${no.toLowerCase()}.`);
        break;
      }
      case 'moveResearch':
        moveResearch(s.research, c.topic, c.dir);
        break;
      case 'researchNext':
        researchNext(s.research, c.topic);
        break;
      case 'sendExpedition':
        sendExpedition(s, c.dest, c.members, c.roles, c.stance, c.horses, c.truck === true);
        break;
      case 'sendDelve': {
        const r = sendDelve(s, c.dest, c.members, c.stakes);
        if (!r.ok) notify(s, `Can't send the delvers: ${r.reason}.`);
        break;
      }
      case 'realm': {
        const r = realmCommand(s, c.faction, c.op, this.rng);
        if (!r.ok && r.reason) notify(s, `${r.reason}.`);
        break;
      }
      case 'muster': {
        const say = (r: { ok: boolean; reason?: string }) => r.ok || notify(s, `${r.reason}.`);
        if (c.op === 'raise' && c.dest) say(raiseParty(s, c.dest));
        else if (c.op === 'add' && c.person !== undefined) say(addMember(s, c.person));
        else if (c.op === 'drop' && c.person !== undefined) dropMember(s, c.person);
        else if (c.op === 'lead' && c.person !== undefined) makeLeader(s, c.person);
        else if (c.op === 'persuade' && c.person !== undefined) say(persuade(s, c.person));
        else if (c.op === 'order' && c.person !== undefined) say(order(s, c.person));
        else if (c.op === 'set') setMuster(s, { stakes: c.stakes, rations: c.rations, torches: c.torches, horses: c.horses });
        else if (c.op === 'send') say(sendMuster(s));
        else if (c.op === 'cancel') cancelMuster(s);
        break;
      }
      case 'sendParty': {
        const r = sendParty(s, c.dest, c.stakes);
        if (!r.ok) notify(s, `Can't send a party: ${r.reason}.`);
        break;
      }
      case 'trade':
        trade(s, c.offer, this.rng);
        break;
      case 'buyRare':
        buyRare(s, c.material as Material, c.count, c.who);
        break;
      case 'cycleOperator':
        cycleOperator(s, c.building);
        break;
      case 'releasePrisoner':
        releasePrisoner(s, c.prisoner);
        break;
      case 'setOrder': {
        const p = s.people.find((q) => q.id === c.person);
        if (p?.monster) p.order = c.order;
        break;
      }
      case 'rally':
        rally(s, c.person);
        break;
      case 'battlePlace':
        placeFighter(s, c.person, c.spot);
        break;
      case 'battleGo':
        battleGo(s);
        break;
      case 'battleAuto':
        setAutoBattle(s, c.on);
        break;
      case 'battleSpeed':
        setBattleSpeed(s, c.speed);
        break;
      case 'raidSkip':
        skipRaid(s);
        break;
      case 'giveChase':
        giveChase(s);
        break;
      case 'skipRaids':
        s.skipRaids = c.on;
        if (c.on) skipRaid(s);
        break;
      case 'tactics':
        tacticsOrder(s, c.order);
        break;
      case 'battleStyle':
        s.battleStyle = c.style; // (from the next raid: sim/tactics.ts)
        break;
      case 'spendStat': {
        const p = s.people.find((q) => q.id === c.person);
        if (p) c.attr ? spendPoint(p, c.attr) : spendByClass(p);
        // (letting them choose is remembered: they spend their own from now on, till the box is unticked)
        if (p && !c.attr) p.autoStats = true;
        break;
      }
      case 'autoStats': {
        const p = s.people.find((q) => q.id === c.person);
        if (p) {
          if (c.on) {
            p.autoStats = true;
            spendByClass(p);
          } else delete p.autoStats;
        }
        break;
      }
      case 'setAsk':
        if (c.evolve !== undefined) s.evolveAsk = c.evolve;
        if (c.stats !== undefined) s.statsAsk = c.stats;
        break;
      case 'gameSpeed':
        setGameSpeed(s, c.speed);
        break;
      case 'scene':
        if (c.op === 'watch') watchScene(s, c.key);
        else endScene(s, c.key, c.op === 'done');
        break;
      case 'battleCast':
        castAt(s, c.power, this.rng, [c.x, c.y]);
        break;
      case 'favourite':
        setFavourite(s, c.id, c.on);
        break;
      case 'watch':
        s.watching = c.expedition !== null && (s.expeditions.some((e) => e.id === c.expedition) || !!skirmishTrip(s, c.expedition) || !!arenaTrip(s, c.expedition) || !!duelTrip(s, c.expedition)) ? c.expedition : undefined;
        break;
      case 'giftVillage':
        giftVillage(s, c.id);
        break;
      case 'ranch':
        ranchCommand(s, c.id, c.op, c.name, c.keep);
        break;
      case 'arenaBet':
        arenaBet(s, c.on, c.amount);
        break;
      case 'tradeRoute':
        setRoute(s, c.to, c.open);
        break;
      case 'lookInside':
        lookInside(s, c.building);
        break;
      case 'watchPortal':
        s.watchingPortal = c.realm && (s.portals ?? []).some((p) => p.realm === c.realm) ? (c.realm as RealmId) : undefined;
        break;
      case 'watchDeep':
        s.watchingDeep = c.depth !== null && s.deep && c.depth <= s.deep.levels.length ? c.depth : undefined;
        if (s.watchingDeep) s.watchingUnder = undefined;
        break;
      case 'watchUnder':
        // (the Underdark's view: sim/underdark.ts; it takes the Deep's place)
        s.watchingUnder = c.on && s.underdark ? true : undefined;
        if (s.watchingUnder) s.watchingDeep = undefined;
        // (which depth: the upper caves unless asked for one; the view keeps to the depths opened)
        s.watchingUnderDepth = s.watchingUnder && c.depth ? c.depth : undefined;
        break;
      case 'watchMine':
        s.watchingMine = c.place !== null && (s.places ?? []).some((p) => p.id === c.place && p.mine) ? c.place : undefined;
        break;
      case 'follow':
        s.hero = c.person !== null && s.people.some((p) => p.id === c.person) ? c.person : undefined;
        break;
      case 'founderGo':
        founderGo(s, c.building);
        break;
      case 'founderWork':
        founderWork(s, c.job);
        break;
      case 'founderRest':
        founderRest(s);
        break;
      case 'founderExplore':
        founderExplore(s, c.dir);
        break;
      case 'founderGive':
        founderGive(s, c.amount);
        break;
      case 'founderBuyShop':
        founderBuyShop(s, c.building);
        break;
      case 'founderShopStock':
        founderShopStock(s, c.building, c.stock);
        break;
      case 'founderShopPrice':
        founderShopPrice(s, c.building, c.price);
        break;
      case 'founderShopManager':
        founderShopManager(s, c.building, c.person);
        break;
      case 'founderHeir':
        founderHeir(s, c.person);
        break;
      case 'founderVisitor':
        founderVisitor(s, c.terms);
        break;
      case 'founderApprentice':
        founderApprentice(s, c.child, c.master);
        break;
      case 'founderMatch':
        founderMatch(s, c.person);
        break;
      case 'founderFeast':
        founderFeast(s, c.grade);
        break;
      case 'founderHaggle':
        founderHaggle(s, c.offer);
        break;
      case 'holdPower':
        holdPower(s, c.power);
        break;
      case 'castHeld':
        if (!castHeld(s, this.rng)) notify(s, "Can't cast it yet.");
        break;
      case 'duel': {
        const r = challenge(s, c.foe, c.to);
        if (!r.ok) notify(s, `${r.reason}.`);
        break;
      }
      case 'name':
        nameCommand(s, c.kind, c.id, c.name);
        break;
      case 'answerPrompt':
        answerPrompt(s, c.prompt, c.option, this.rng);
        break;
      case 'parkPrompt':
        parkPrompt(s, c.prompt);
        break;
      case 'openPrompt':
        openPrompt(s, c.prompt);
        break;
      case 'creature':
        if (c.op === 'feed') feedCreature(s);
        else if (c.op === 'rest') restCreature(s);
        else teachCreature(s, c.op === 'praise');
        break;
      case 'recallExpedition':
        recallExpedition(s, c.expedition);
        break;
      case 'acceptVisitor':
        acceptVisitor(s);
        break;
      case 'rejectVisitor':
        rejectVisitor(s);
        break;
      case 'setPriority': {
        const p = s.people.find((q) => q.id === c.person);
        if (!p || p.bornTick != null) break; // children don't work
        p.priorities[c.job] = c.priority;
        p.autoPriorities = false;
        break;
      }
      case 'setAutoPriorities': {
        const p = s.people.find((q) => q.id === c.person);
        if (!p || p.bornTick != null) break;
        p.autoPriorities = c.on;
        if (c.on) p.priorities = autoPriorities(p.skills, p.id === s.mainId);
        break;
      }
      case 'cheatUnlockAll':
        if (!s.ironman) s.cheats.unlockAll = c.on; // (no cheating in ironman)
        break;
      case 'devMode':
        setDevMode(s, c.on);
        break;
      case 'dev':
        // (refused unless the town has developer mode on: sim/dev.ts)
        if (s.dev && !s.ironman) applyDev(s, c.order);
        break;
      case 'setPaused':
        s.paused = c.paused;
        break;
      case 'becomeLich':
        chooseLich(s);
        break;
      case 'setDirection':
        s.direction = c.direction;
        s.plan = undefined; // (it decides afresh)
        break;
      case 'veto':
        setVeto(s, c.dest, c.on);
        break;
      case 'quest':
        if (c.op === 'accept') acceptQuest(s, c.sort, c.id);
        else if (c.op === 'lead') {
          const r = leadQuest(s, c.sort, c.id); // (the founder leads it themselves: sim/founderQuests.ts)
          if (!r.ok) notify(s, `${r.reason}.`);
        } else declineQuest(s, c.sort, c.id);
        break;
      case 'bounty':
        if (c.post) {
          const r = postBounty(s, c.dest);
          if (!r.ok) notify(s, `Can't post a bounty: ${r.reason}.`);
        } else withdrawBounty(s, c.dest);
        break;
      case 'setTax':
        s.tax = c.rate;
        break;
      case 'edict': {
        const r = issueEdict(s, c.op, c.law, c.pay);
        if (!r.ok) notify(s, `No edict: ${r.reason}.`);
        break;
      }
      case 'setTownSize':
        if (c.size === null) delete s.popTarget;
        else s.popTarget = c.size;
        break;
      case 'toggleGather': {
        if (!s.land.pools[c.cell]) return;
        setMarked(s.land, c.cell, !isMarked(s.land, c.cell));
        break;
      }
      case 'drawPath':
        drawPath(s, c.cells, c.on);
        break;
      case 'markClear': {
        // (a drag's worth: only wild cells with something to gather can be marked; any can be unmarked)
        for (const i of c.cells.slice(0, MARK_CLEAR_CAP)) {
          if (i < 0 || i >= s.land.w * s.land.h || isMarked(s.land, i) === c.on) continue;
          if (!c.on || s.land.pools[i]) setMarked(s.land, i, c.on);
        }
        break;
      }
    }
  }
}
