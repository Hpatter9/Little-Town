// What each workshop shows while someone works there (map/workFx.ts draws it). Pure, so it is tested.

export type WorkLook = 'sparks' | 'steam' | 'sawdust' | 'threads' | 'embers' | 'glints' | 'arcs' | 'bubbles' | 'dust';

const LOOKS: [WorkLook, readonly string[]][] = [
  ['sparks', ['smithy', 'bloomery', 'armourer', 'gunsmith', 'steelworks', 'alloy_foundry', 'bone_forge', 'nanoforge', 'monster_guild']],
  ['embers', ['kiln', 'glassworks', 'campfire', 'cement_works', 'chandlery']],
  ['steam', ['bakery', 'brewery', 'smokehouse', 'cannery', 'tavern', 'refinery', 'power_station', 'appliance_plant', 'textile_mill', 'blood_cellar']],
  ['bubbles', ['apothecary', 'pharmacy', 'alembic', 'herb_press', 'bio_lab', 'pearl_works', 'drying_rack']],
  ['sawdust', ['sawmill', 'workbench', 'cooper', 'bone_carver', 'basketry', 'boatyard', 'tanning_rack', 'tannery', 'pelt_house', 'print_shop', 'windmill']],
  ['threads', ['loom', 'tailor', 'dyeworks', 'felt_works', 'glamour_loom']],
  ['arcs', ['electronics_plant', 'chip_fab', 'battery_plant', 'robot_workshop', 'assembler', 'clockmaker', 'garage', 'factory', 'fusion_reactor', 'ai_core']],
  ['glints', ['scriptorium', 'library', 'school', 'university', 'storytellers_circle', 'elder_lodge', 'jeweller', 'gem_cutter', 'mission_control', 'phylactery']],
];
const LOOK_OF = new Map<string, WorkLook>(LOOKS.flatMap(([look, ids]) => ids.map((id) => [id, look] as const)));

/** What a building at work shows (null: nothing). */
export function workLook(def: string): WorkLook | null {
  return LOOK_OF.get(def) ?? null;
}

