// Makes the game's data files from every hand-made map's LDtk project under maps/: the raid boards
// (tools/ldtkBoards.ts) and each kind in `HAND_MAP_KINDS` (tools/ldtkMaps.ts). Run after editing any of them:
// `node tools/ldtk-maps.mjs` (or `node tools/ldtk-maps.mjs delve-floors` for one project).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { boardsFromLdtk, boardsSource } from './ldtkBoards';
import { mapsFromLdtk, mapsSource } from './ldtkMaps';
import { HAND_MAP_KINDS } from './handMapKinds';

const only = process.argv.slice(2);
const wanted = (project: string) => !only.length || only.some((x) => project.includes(x));

if (wanted('maps/raid-boards.ldtk')) {
  const boards = boardsFromLdtk(JSON.parse(readFileSync('maps/raid-boards.ldtk', 'utf8')));
  writeFileSync('src/shared/data/raidBoards.ts', boardsSource(boards));
  console.log(`src/shared/data/raidBoards.ts: ${boards.length} raid boards`);
}
for (const spec of HAND_MAP_KINDS) {
  if (!wanted(spec.project) || !existsSync(spec.project)) continue;
  const maps = mapsFromLdtk(JSON.parse(readFileSync(spec.project, 'utf8')), spec);
  writeFileSync(spec.out, mapsSource(spec, maps));
  console.log(`${spec.out}: ${maps.length} maps (${maps.map((m) => m.id).join(', ')})`);
}
