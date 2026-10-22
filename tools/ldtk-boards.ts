// Makes src/shared/data/raidBoards.ts from the hand-made raid boards' LDtk project (tools/ldtkBoards.ts). Run after
// editing maps/raid-boards.ldtk: `node tools/ldtk-boards.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { boardsFromLdtk, boardsSource } from './ldtkBoards';

const IN = 'maps/raid-boards.ldtk';
const OUT = 'src/shared/data/raidBoards.ts';
const boards = boardsFromLdtk(JSON.parse(readFileSync(IN, 'utf8')));
writeFileSync(OUT, boardsSource(boards));
console.log(`${OUT}: ${boards.length} boards (${boards.map((b) => b.name).join(', ')})`);
