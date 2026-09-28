// One-off import of the Little Wayfarers LPC layer data into a JSON module this project bundles.
// Usage: node tools/import-lpc.mjs [path/to/little-wayfarers/src/renderer/lpc_data.js]
// The layers are from the Universal LPC spritesheet (CC-BY-SA 3.0 / GPL 3.0); see CREDITS.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const src = process.argv[2] ?? 'C:/Games/little-wayfarers/src/renderer/lpc_data.js';
const win = {};
vm.runInNewContext(readFileSync(src, 'utf8'), { window: win });
if (!win.LPC_DATA || !win.LPC_META) throw new Error(`no LPC_DATA/LPC_META in ${src}`);

mkdirSync('src/renderer/art/lpc', { recursive: true });
const out = 'src/renderer/art/lpc/lpcData.json';
writeFileSync(out, JSON.stringify({ layers: win.LPC_DATA, has: win.LPC_META.has, alias: win.LPC_META.alias }));
console.log(`wrote ${out}: ${Object.keys(win.LPC_DATA).length} layers`);
