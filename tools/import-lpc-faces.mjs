// Adds the up- and down-facing walk rows to the LPC layer data (a dev tool, run by hand; needs Playwright's Chromium):
// for each layer in src/renderer/art/lpc/lpcData.json (right-facing rows only, from Little Wayfarers' pre-cut data), it
// finds the layer's sheet in the Universal LPC spritesheet (../chronos-assets/Universal-LPC-spritesheet-master) by
// name, picks the colour variant whose walk-right row (row 11 of the full sheet) matches the data's walk row best,
// and cuts its walk-up (row 8) and walk-down (row 10) rows into src/renderer/art/lpc/lpcFaces.json: { layers: { id:
// dataURL of a 2-row sheet }, diff: { id: pixels that differed on the walk-right row } }. Weapons are left out (nobody
// walks with one drawn). Layers with no sheet found are left out, and the composer falls back to the side view.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const ROOT = process.env.LPC || path.resolve('../chronos-assets/Universal-LPC-spritesheet-master/Universal-LPC-spritesheet-master');
const data = JSON.parse(readFileSync('src/renderer/art/lpc/lpcData.json', 'utf8'));
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.png')) files.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
})(ROOT);
const G = { m: 'male', f: 'female' };
/** Candidate sheets for a layer id (regexes on the sheet's path within the repo). */
function candidates(id) {
  const m = /^(.*)_([mf])$/.exec(id);
  if (!m) return [];
  const [, base, gender] = m;
  const g = G[gender];
  const r = (re) => files.filter((f) => re.test(f));
  const body = (name) => r(new RegExp(`^body/${g}/${name}\\.png$`));
  if (base.startsWith('w_')) return [];
  if (base === 'body_light') return body('light');
  if (base === 'body_orc') return body('orc');
  if (base === 'body_skeleton') return r(/^body\/male\/skeleton\.png$/);
  if (base === 'ears_elf') return r(new RegExp(`^body/${g}/ears/elvenears_`));
  if (base === 'ears_big') return r(new RegExp(`^body/${g}/ears/bigears_`));
  if (base.startsWith('eyes_')) return r(new RegExp(`^body/${g}/eyes/${base.slice(5)}\\.png$`));
  if (base === 'beard') return r(new RegExp(`^facial/${g}/beard(\\.png|/)`));
  if (base === 'stache') return r(new RegExp(`^facial/${g}/(mustache|bigstache|frenchstache)(\\.png|/)`));
  if (base.startsWith('hair_')) return r(new RegExp(`^hair/${g}/${base.slice(5)}(\\.png|/)`));
  const T = {
    torso_chain: `^torso/chain/mail_${g}\\.png$`,
    torso_jacket: `^torso/chain/tabard/jacket_${g}\\.png$`,
    torso_leather: `^torso/leather/chest_${g}\\.png$`,
    torso_leathersh: `^torso/leather/shoulders_${g}\\.png$`,
    torso_plate: `^torso/plate/chest_${g}\\.png$`,
    torso_platearms: `^torso/plate/arms_${g}\\.png$`,
    torso_goldchest: `^torso/gold/chest_${g}\\.png$`,
    torso_goldarms: `^torso/gold/arms_${g}\\.png$`,
    torso_longsleeve: `^torso/shirts/longsleeve/`,
    torso_sleeveless: `^torso/shirts/sleeveless/`,
    torso_tunic: `^torso/tunics/`,
    torso_robe: `^torso/robes_female_no_th-sh/`,
    torso_dress: `^torso/dress_female/dress_w_sash`,
    torso_underdress: `^torso/dress_female/underdress`,
    torso_overskirt: `^torso/dress_female/overskirt`,
    torso_pirate: `^torso/dress_female/`,
    legs_pants: `^legs/pants/${g}/`,
    legs_metal: `^legs/armor/${g}/`,
    legs_robeskirt: `^legs/skirt/${g}/`,
    feet_shoes: `^feet/shoes/${g}/`,
    feet_boots: `^feet/armor/${g}/`,
    hands_gloves: `^hands/gloves/${g}/`,
    hands_bracers: `^hands/bracers/${g}/`,
    belt_leather: `^belt/leather/${g}/`,
    belt_cloth: `^belt/cloth/${g}/`,
    head_helm: `^head/helms/${g}/metal_helm`,
    head_gold: `^head/helms/${g}/golden_helm`,
    head_chain: `^head/helms/${g}/chainhat`,
    head_chainhood: `^head/hoods/${g}/chain_hood`,
    head_hood: `^head/hoods/${g}/cloth_hood`,
    head_cap: `^head/caps/${g}/`,
    head_bandana: `^head/bandanas/${g}/`,
    head_tiara: `^head/tiaras_female/`,
    head_tiara_s: `^head/tiaras_female/`,
    back_cape: `^(torso/back/cape/(normal|trimmed)|behind_body/cape/(normal|trimmed))/.*${g}`,
    back_tatter: `^(torso/back/cape/tattered|behind_body/cape/tattered)/.*${g}`,
    back_quiver: `^behind_body/equipment/quiver`,
    back_wings: `^torso/back/wings/`,
    cape_front: `^torso/back/cape/`,
  };
  return T[base] ? r(new RegExp(T[base])) : [];
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const out = { layers: {}, diff: {} };
let found = 0;
const missing = [];
for (const id of Object.keys(data.layers)) {
  const cands = candidates(id);
  if (!cands.length) {
    if (!id.startsWith('w_')) missing.push(id);
    continue;
  }
  const res = await page.evaluate(
    async ({ a, list }) => {
      const load = (s) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = s; });
      const px = (im, x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, x, y, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
      const A = await load(a);
      const ga = px(A, 0, 2 * 64, 64 * 9, 64);
      let best = null;
      for (const [name, src] of list) {
        const B = await load(src);
        if (B.height < 21 * 64) continue;
        const gb = px(B, 0, 11 * 64, 64 * 9, 64);
        let diff = 0;
        for (let i = 0; i < ga.length; i += 4) if (ga[i + 3] !== gb[i + 3] || (ga[i + 3] && (ga[i] !== gb[i] || ga[i + 1] !== gb[i + 1] || ga[i + 2] !== gb[i + 2]))) diff++;
        if (!best || diff < best.diff) best = { name, diff, B };
        if (diff === 0) break;
      }
      if (!best) return null;
      const c = document.createElement('canvas');
      c.width = 64 * 9;
      c.height = 128;
      const g = c.getContext('2d');
      g.drawImage(best.B, 0, 8 * 64, 64 * 9, 64, 0, 0, 64 * 9, 64); // walk up
      g.drawImage(best.B, 0, 10 * 64, 64 * 9, 64, 0, 64, 64 * 9, 64); // walk down
      return { name: best.name, diff: best.diff, png: c.toDataURL('image/png') };
    },
    { a: data.layers[id], list: cands.slice(0, 40).map((f) => [f, 'data:image/png;base64,' + readFileSync(path.join(ROOT, f)).toString('base64')]) },
  );
  if (!res) {
    missing.push(id);
    continue;
  }
  out.layers[id] = res.png;
  out.diff[id] = res.diff;
  found++;
  console.log(`${id}: ${res.name} (${res.diff} px off)`);
}
await browser.close();
writeFileSync('src/renderer/art/lpc/lpcFaces.json', JSON.stringify(out));
console.log(`wrote lpcFaces.json: ${found} layers; missing: ${missing.join(', ') || 'none'}`);
