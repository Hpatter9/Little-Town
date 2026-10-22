// Turns the hand-made raid boards' LDtk project (maps/raid-boards.ldtk) into the data the game reads
// (src/shared/data/raidBoards.ts). Pure: tools/ldtk-boards.ts writes the file, and test/raidBoards.test.ts checks the
// committed file is what this makes of the committed project, so the two can't drift apart.
//
// It reads each level's Terrain and Height IntGrid layers by their values' identifiers (so the values may be reordered
// in the editor) and its Things layer's entities by their identifiers and `kind` / `line` / `way` fields; the board's
// name, lands and raid kinds are the level's fields.

import { BOARD_GROUNDS, COVER_KINDS, PROP_KINDS, type BoardThing, type RaidBoardDef } from '../src/shared/sim/raidBoards';
import { BIOMES, type Biome } from '../src/shared/data/biomes';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const GROUND_CH = new Map(BOARD_GROUNDS.map((x) => [x.id, x.ch]));

export function boardsFromLdtk(project: Json): RaidBoardDef[] {
  const defs = project.defs;
  const layerDef = (id: string) => {
    const d = defs.layers.find((l: Json) => l.identifier === id);
    if (!d) throw new Error(`no ${id} layer in the project`);
    return d;
  };
  const terrainIds = new Map<number, string>(layerDef('Terrain').intGridValues.map((x: Json) => [x.value, x.identifier]));
  const heightIds = new Map<number, string>(layerDef('Height').intGridValues.map((x: Json) => [x.value, x.identifier]));
  const levels: Json[] = project.levels.length ? project.levels : project.worlds.flatMap((w: Json) => w.levels);
  return levels.map((lv: Json): RaidBoardDef => {
    const where = `board ${lv.identifier}`;
    const field = (id: string) => lv.fieldInstances.find((f: Json) => f.__identifier === id)?.__value;
    const layer = (id: string) => {
      const l = lv.layerInstances?.find((x: Json) => x.__identifier === id);
      if (!l) throw new Error(`${where}: no ${id} layer (levels kept in separate files aren't read)`);
      return l;
    };
    const terrain = layer('Terrain');
    const w: number = terrain.__cWid;
    const h: number = terrain.__cHei;
    const ground: string[] = [];
    const height: string[] = [];
    const hcsv: number[] = layer('Height').intGridCsv;
    for (let v = 0; v < h; v++) {
      let g = '';
      let hh = '';
      for (let u = 0; u < w; u++) {
        const id = terrainIds.get(terrain.intGridCsv[v * w + u]);
        const ch = id === undefined ? '.' : GROUND_CH.get(id);
        if (ch === undefined) throw new Error(`${where}: unknown ground "${id}" at ${u},${v}`);
        g += ch;
        const hv = hcsv[v * w + u];
        const hid = hv ? heightIds.get(hv) : undefined;
        const n = hid ? Number(hid.replace(/^h/, '')) : 0;
        if (hid && !(n >= 0 && n <= 9)) throw new Error(`${where}: height "${hid}" at ${u},${v}`);
        hh += hid ? String(n) : '.';
      }
      ground.push(g);
      height.push(hh);
    }
    const things: [number, number, BoardThing][] = [];
    for (const e of layer('Things').entityInstances) {
      const [u, v] = e.__grid as [number, number];
      const f = (id: string) => e.fieldInstances.find((x: Json) => x.__identifier === id)?.__value;
      let what: string;
      if (e.__identifier === 'Town') what = f('line') === 'back' ? 'back' : 'front';
      else if (e.__identifier === 'Raiders') what = `way${Math.max(1, Math.min(3, Number(f('way') ?? 1)))}`;
      else if (e.__identifier === 'Cover' || e.__identifier === 'Prop') {
        what = f('kind');
        const kinds: readonly string[] = e.__identifier === 'Cover' ? COVER_KINDS : PROP_KINDS;
        if (!kinds.includes(what)) throw new Error(`${where}: ${e.__identifier} of unknown kind "${what}" at ${u},${v}`);
      } else throw new Error(`${where}: unknown entity ${e.__identifier}`);
      things.push([u, v, what as BoardThing]);
    }
    // (in reading order, so the file doesn't change when the editor saves its entities in another order)
    things.sort((a, b) => a[1] - b[1] || a[0] - b[0] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
    const biomes = (field('biomes') ?? []) as string[];
    for (const b of biomes) if (!(BIOMES as readonly string[]).includes(b)) throw new Error(`${where}: unknown land "${b}"`);
    return {
      id: lv.identifier,
      name: field('name') || lv.identifier.replace(/_/g, ' '),
      biomes: biomes as Biome[],
      raidKinds: ((field('raidKinds') ?? []) as string[]).filter(Boolean),
      notRaidKinds: ((field('notRaidKinds') ?? []) as string[]).filter(Boolean),
      w,
      h,
      ground,
      height,
      things,
    };
  });
}

/** The data file's text. */
export function boardsSource(boards: RaidBoardDef[]): string {
  const q = (x: string) => `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const list = (xs: string[]) => `[${xs.map(q).join(', ')}]`;
  const out = [
    '// The hand-made raid boards (sim/raidBoards.ts). Made by `node tools/ldtk-boards.mjs` from maps/raid-boards.ldtk: edit',
    "// the boards in LDtk and run it again, don't edit this file by hand (test/raidBoards.test.ts checks the two agree).",
    '',
    "import type { RaidBoardDef } from '../sim/raidBoards';",
    '',
    'export const RAID_BOARDS: readonly RaidBoardDef[] = [',
  ];
  for (const b of boards) {
    out.push('  {');
    out.push(`    id: ${q(b.id)},`);
    out.push(`    name: ${q(b.name)},`);
    out.push(`    biomes: ${list(b.biomes)},`);
    out.push(`    raidKinds: ${list(b.raidKinds)},`);
    out.push(`    notRaidKinds: ${list(b.notRaidKinds)},`);
    out.push(`    w: ${b.w},`);
    out.push(`    h: ${b.h},`);
    out.push('    ground: [');
    for (const r of b.ground) out.push(`      ${q(r)},`);
    out.push('    ],');
    out.push('    height: [');
    for (const r of b.height) out.push(`      ${q(r)},`);
    out.push('    ],');
    out.push('    things: [');
    for (const [u, v, what] of b.things) out.push(`      [${u}, ${v}, ${q(what)}],`);
    out.push('    ],');
    out.push('  },');
  }
  out.push('];', '');
  return out.join('\n');
}
