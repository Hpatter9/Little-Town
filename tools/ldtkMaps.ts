// Turns a hand-made map kind's LDtk project into the data the game reads (src/shared/sim/handMaps.ts says what each
// kind reads: `MapKindSpec`). Pure: tools/ldtk-maps.ts writes the files, and each kind's test checks the committed data
// file is what this makes of the committed project, so the two can't drift apart.
//
// It reads each level's IntGrid layers by their values' identifiers (so the values may be reordered in the editor),
// its entities by their identifiers and fields, and its level fields by name.

import type { HandMap, HandThing, MapKindSpec } from '../src/shared/sim/handMaps';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export function mapsFromLdtk(project: Json, spec: MapKindSpec): HandMap[] {
  const defs = project.defs;
  const layerDef = (id: string) => {
    const d = defs.layers.find((l: Json) => l.identifier === id);
    if (!d) throw new Error(`no ${id} layer in ${spec.project}`);
    return d;
  };
  const gridIds = new Map(spec.grids.map((g) => [g.layer, new Map<number, string>(layerDef(g.layer).intGridValues.map((x: Json) => [x.value, x.identifier]))]));
  const levels: Json[] = project.levels.length ? project.levels : project.worlds.flatMap((w: Json) => w.levels);
  return levels.map((lv: Json): HandMap => {
    const where = `${spec.project} ${lv.identifier}`;
    const layer = (id: string) => {
      const l = lv.layerInstances?.find((x: Json) => x.__identifier === id);
      if (!l) throw new Error(`${where}: no ${id} layer (levels kept in separate files aren't read)`);
      return l;
    };
    const first = layer(spec.grids[0]?.layer ?? spec.entities[0].layer);
    const w: number = first.__cWid;
    const h: number = first.__cHei;
    const grids: Record<string, string[]> = {};
    for (const g of spec.grids) {
      const l = layer(g.layer);
      const ids = gridIds.get(g.layer)!;
      const chOf = new Map(g.values.map((x) => [x.id, x.ch]));
      const rows: string[] = [];
      for (let v = 0; v < h; v++) {
        let row = '';
        for (let u = 0; u < w; u++) {
          const n = l.intGridCsv[v * w + u];
          if (!n) {
            row += g.empty;
            continue;
          }
          const id = ids.get(n);
          const ch = id === undefined ? undefined : chOf.get(id);
          if (ch === undefined) throw new Error(`${where}: unknown ${g.layer} value "${id ?? n}" at ${u},${v}`);
          row += ch;
        }
        rows.push(row);
      }
      grids[g.layer] = rows;
    }
    const things: HandThing[] = [];
    for (const lname of [...new Set(spec.entities.map((e) => e.layer))]) {
      for (const e of layer(lname).entityInstances) {
        const [u, v] = e.__grid as [number, number];
        const es = spec.entities.find((x) => x.layer === lname && x.entity === e.__identifier);
        if (!es) throw new Error(`${where}: unknown entity ${e.__identifier} at ${u},${v}`);
        const t: HandThing = [u, v, es.entity];
        for (const f of es.fields) {
          const val = e.fieldInstances.find((x: Json) => x.__identifier === f.id)?.__value;
          if (f.of === 'int') {
            if (typeof val !== 'number') throw new Error(`${where}: ${es.entity} at ${u},${v} needs a number ${f.id}`);
            t.push(val);
          } else {
            if (!f.of.includes(val)) throw new Error(`${where}: ${es.entity} at ${u},${v} of unknown ${f.id} "${val}"`);
            t.push(val);
          }
        }
        things.push(t);
      }
    }
    // (in reading order, so the file doesn't change when the editor saves its entities in another order)
    const key = (t: HandThing) => t.slice(2).join('\u0001');
    things.sort((a, b) => a[1] - b[1] || a[0] - b[0] || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    const fields: HandMap['fields'] = {};
    for (const f of spec.levelFields) {
      const raw = lv.fieldInstances.find((x: Json) => x.__identifier === f.id)?.__value;
      if (f.type === 'strings') {
        const xs = ((raw ?? []) as unknown[]).filter((x): x is string => typeof x === 'string' && x !== '');
        for (const x of xs) if (f.of && !f.of.includes(x)) throw new Error(`${where}: ${f.id} "${x}" unknown`);
        if (!xs.length && !f.optional) throw new Error(`${where}: ${f.id} is empty`);
        fields[f.id] = xs;
      } else if (f.type === 'int') {
        if (typeof raw !== 'number') {
          if (!f.optional) throw new Error(`${where}: ${f.id} needs a number`);
        } else fields[f.id] = raw;
      } else {
        const x = typeof raw === 'string' ? raw : '';
        if (!x && !f.optional) throw new Error(`${where}: ${f.id} is empty`);
        if (x && f.of && !f.of.includes(x)) throw new Error(`${where}: ${f.id} "${x}" unknown`);
        fields[f.id] = x;
      }
    }
    return { id: lv.identifier, w, h, fields, grids, things };
  });
}

/** The data file's text. */
export function mapsSource(spec: MapKindSpec, maps: HandMap[]): string {
  const q = (x: string) => `'${x.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const val = (x: string | number | string[]): string => (Array.isArray(x) ? `[${x.map(q).join(', ')}]` : typeof x === 'number' ? String(x) : q(x));
  const out = [
    `// ${spec.what}. Made by \`node tools/ldtk-maps.mjs\` from ${spec.project}: edit the maps in LDtk and run it`,
    "// again, don't edit this file by hand (the maps' test checks the two agree).",
    '',
    "import type { HandMap } from '../sim/handMaps';",
    '',
    `export const ${spec.exportName}: readonly HandMap[] = [`,
  ];
  for (const m of maps) {
    out.push('  {');
    out.push(`    id: ${q(m.id)},`);
    out.push(`    w: ${m.w},`);
    out.push(`    h: ${m.h},`);
    out.push('    fields: {');
    for (const [k, v] of Object.entries(m.fields)) out.push(`      ${k}: ${val(v)},`);
    out.push('    },');
    out.push('    grids: {');
    for (const [k, rows] of Object.entries(m.grids)) {
      out.push(`      ${k}: [`);
      for (const r of rows) out.push(`        ${q(r)},`);
      out.push('      ],');
    }
    out.push('    },');
    out.push('    things: [');
    for (const t of m.things) out.push(`      [${t.map((x) => val(x)).join(', ')}],`);
    out.push('    ],');
    out.push('  },');
  }
  out.push('];', '');
  return out.join('\n');
}
