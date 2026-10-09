// Each origin's menus are made of its own stuff (theme.ts holds the colours; these are the materials and shapes):
// the Nomads' are a bright tent (striped awnings with scalloped edges, stitched felt buttons, pennants, rugs, rope);
// the Druids' a tree (bark branches with leaves, mossy wood, vines); the Lich's bone (bone borders, skulls); the Blood
// Court's a gothic castle (stone, pointed arches, spires and battlements, red stained glass); and so on. Everything is
// CSS and small inline SVGs, scoped to html.theme-<id> like the rest of the theme.

import type { ThemeId } from '../shared/sim/snapshot';

/** An inline SVG image (for backgrounds, borders and ornaments). */
function svg(w: number, h: number, body: string): string {
  const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

/** A pseudo-element on every selector of a list ('a, b' + '::after' -> 'a::after, b::after'). */
const pseudo = (list: string, el: string): string => list.split(', ').map((x) => x + el).join(', ');

/** The selectors each skin dresses. */
function parts(T: string) {
  const all = (s: string) => s.split(',').map((x) => `${T} ${x.trim()}`).join(', ');
  return {
    frame: `${T}.page-panel body`,
    header: `${T} header`,
    title: `${T} h1`,
    main: `${T}.page-panel main`,
    btn: all('button:not(#close):not(.swatch):not(.card):not(.map-dot):not(.map-hold):not(.folk-row):not(.doll-slot):not(.wizard-dot):not(.skill):not(.event-option):not(.glance-tile):not(.kin), .place, .tab, #tabs button, #menu-btn, .chip'),
    on: all('.place.on, .tab.on, .inv-tab.on, #tabs button.on, button.primary, .tab.default, .card.pick.on'),
    card: all('.card, .queue-row, #inspect, #menu, #prompt, #person-card, #banner, #away, #tip, #raid-recap, #fight-result, .ff-window, #fight-banner:not(.ult)'),
    h2: all('h2, .era-head'),
    bar: all('#tabs, #clock'),
    fill: all('.bar-fill, .meter-fill'),
  };
}

/* ------------------------------------------------------------ the Nomad Caravan: a tent */

const scallops = (a: string, b: string) =>
  `radial-gradient(circle at 7px 0, ${a} 6px, transparent 6.5px) 0 0 / 28px 8px repeat-x, radial-gradient(circle at 7px 0, ${b} 6px, transparent 6.5px) 14px 0 / 28px 8px repeat-x`;

function nomads(T: string): string {
  const P = parts(T);
  return `
${P.frame} { border: 5px solid; border-image: repeating-linear-gradient(45deg, #c89a58 0 3px, #8a6030 3px 6px) 5; }
${P.frame}, ${P.main} { background-color: #f6e8c8;
  background-image: repeating-linear-gradient(0deg, rgba(120, 80, 40, 0.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(120, 80, 40, 0.05) 0 1px, transparent 1px 3px); }
${P.header} { position: relative; margin-bottom: 9px; border-bottom: 0; background: repeating-linear-gradient(90deg, #c0392b 0 16px, #fbf1dc 16px 32px); }
${P.header}::after { content: ''; position: absolute; left: 0; right: 0; bottom: -8px; height: 8px; background: ${scallops('#c0392b', '#fbf1dc')}; }
${P.title} { color: #fff8e8; text-shadow: 0 1px 0 #5a1a10, 1px 0 0 #5a1a10, -1px 0 0 #5a1a10, 0 -1px 0 #5a1a10; }
${P.btn} { background: #fdf5e2 linear-gradient(#c0392b 0 4px, transparent 4px) !important; color: #3a2414 !important; border: 1px solid #8a5a2a !important;
  border-radius: 5px 5px 3px 3px; outline: 1px dashed #b07a3a; outline-offset: -4px; font-weight: 700; }
${P.on} { background: #c0392b linear-gradient(#e8c040 0 4px, transparent 4px) !important; color: #fff8e8 !important; outline-color: #f0d070; box-shadow: 0 2px 0 #7a1a10; }
${P.card} { background: #fdf5e2 !important; color: #3a2414; border: 3px solid #b83a2a !important; border-radius: 3px;
  box-shadow: inset 0 0 0 2px #e8c040, inset 0 0 0 4px #b83a2a, 0 2px 0 rgba(90, 50, 20, 0.3); }
${P.h2} { display: inline-block; color: #fff8e8 !important; text-shadow: none !important; background: #3a6ac8; padding: 2px 18px 2px 8px;
  clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 50%, 100% 100%, 0 100%); }
${T} #tabs { background: repeating-linear-gradient(90deg, #3a6ac8 0 16px, #fbf1dc 16px 32px); border-top: 4px solid; border-image: repeating-linear-gradient(45deg, #c89a58 0 3px, #8a6030 3px 6px) 4; }
${T} #tabs button { padding-left: 2px !important; padding-right: 2px !important; letter-spacing: -0.02em; }
${T} #clock { background: #fbf1dc !important; color: #3a2414; border-bottom: 3px solid #c0392b !important; }
${T} #clock * { color: #3a2414; }
${P.fill} { background: repeating-linear-gradient(135deg, #e8a030 0 6px, #c0392b 6px 12px) !important; }
${T} .hint, ${T} .empty, ${T} .cost { color: #7a5a3a !important; }
${T} #top-title { color: #fff8e8 !important; background: #c0392b; padding: 2px 12px; border-radius: 3px; outline: 1px dashed #f0d070; outline-offset: -3px; }
`;
}

/* ------------------------------------------------------------ the Druid Grove: a tree */

const leaf = (x: number, y: number, r: number, c: string) => `<path d='M${x} ${y} q${6 * r} ${-8 * r} ${14 * r} ${-2 * r} q${-6 * r} ${8 * r} ${-14 * r} ${2 * r}z' fill='${c}'/>`;
const LEAVES = svg(60, 18, leaf(2, 14, 1, '#4a8a3a') + leaf(18, 10, 0.8, '#6ab04a') + leaf(34, 15, 1, '#3a7a2a') + leaf(46, 9, 0.7, '#8ac05a'));
const SPROUT = svg(14, 12, `<path d='M2 12 q1 -6 5 -8' stroke='#5a3a1a' stroke-width='1.5' fill='none'/>` + leaf(5, 6, 0.6, '#6ab04a'));
const VINE = svg(40, 8, `<path d='M0 4 q10 -6 20 0 t20 0' stroke='#4a7a2a' stroke-width='1.6' fill='none'/>` + leaf(8, 5, 0.4, '#6ab04a') + leaf(28, 5, 0.4, '#8ac05a'));
const BARK = 'repeating-linear-gradient(92deg, rgba(0, 0, 0, 0.18) 0 2px, transparent 2px 7px, rgba(255, 220, 160, 0.06) 7px 8px, transparent 8px 13px)';

function druid(T: string): string {
  const P = parts(T);
  return `
${P.frame} { border: 6px solid #4a3018; border-radius: 14px; }
${P.header} { position: relative; margin: 8px 10px 10px; border-radius: 22px 10px 22px 10px; border: 0;
  background: ${BARK}, linear-gradient(#7a5430, #4a3018); box-shadow: 0 3px 0 #2a1a0c; }
${P.header}::before { content: ''; position: absolute; left: -6px; top: -10px; width: 60px; height: 18px; background: ${LEAVES}; }
${P.header}::after { content: ''; position: absolute; right: 30px; bottom: -12px; width: 60px; height: 18px; background: ${LEAVES}; transform: scaleY(-1); }
${P.btn} { position: relative; background: ${BARK}, linear-gradient(#8a6038, #5a3a1c) !important; border: 1px solid #2a1a0c !important;
  border-radius: 14px 5px 14px 5px; color: #f4ecd0 !important; text-shadow: 0 1px 0 #2a1a0c; }
${pseudo(P.btn, '::after')} { content: ''; position: absolute; right: 2px; top: -9px; width: 14px; height: 12px; background: ${SPROUT}; pointer-events: none; }
${P.on} { background: ${BARK}, linear-gradient(#7ac05a, #3a7a2a) !important; box-shadow: 0 0 10px rgba(150, 230, 110, 0.5); }
${P.card} { background: linear-gradient(rgba(90, 140, 60, 0.35), transparent 10px), rgba(30, 44, 22, 0.94) !important; border: 2px solid #5a3a1a !important; border-radius: 12px 4px 12px 4px; }
${P.h2} { padding-bottom: 8px; background: ${VINE} 0 100% / 40px 8px repeat-x; color: #a8e088 !important; }
${T} #tabs { background: ${BARK}, linear-gradient(#7a5430, #3a2412); border-top: 0; padding-top: 12px; }
${T} #tabs::before { content: ''; position: absolute; left: 0; right: 0; top: -8px; height: 18px; background: ${LEAVES} 0 0 / 60px 18px repeat-x; pointer-events: none; }
${T} #clock { background: ${BARK}, linear-gradient(#6a4a28, #3a2412) !important; }
${P.fill} { background: linear-gradient(90deg, #3a7a2a, #8ac05a) !important; }
`;
}

/* ------------------------------------------------------------ the Lich: bone */

const BONES = svg(30, 30,
  // a frame of bones: knuckled ends at every corner, shafts along each side
  `<g fill='#e8e0c8' stroke='#6a6050' stroke-width='0.8'>` +
    `<rect x='6' y='2' width='18' height='4' rx='1'/><rect x='6' y='24' width='18' height='4' rx='1'/>` +
    `<rect x='2' y='6' width='4' height='18' ry='1'/><rect x='24' y='6' width='4' height='18' ry='1'/>` +
    [[4, 3], [3, 4], [26, 3], [27, 4], [4, 27], [3, 26], [26, 27], [27, 26]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2.6'/>`).join('') +
    `</g>`,
);
const SKULL = svg(12, 12, `<g fill='#e8e0c8'><circle cx='6' cy='5' r='4.5'/><rect x='3.5' y='7' width='5' height='4' rx='1'/></g><g fill='#1a1418'><circle cx='4.3' cy='5' r='1.2'/><circle cx='7.7' cy='5' r='1.2'/><rect x='5.5' y='7.2' width='1' height='1.5'/></g>`);

function lich(T: string): string {
  const P = parts(T);
  return `
${P.frame} { border: 10px solid; border-image: ${BONES} 10 round; }
${P.header} { border-bottom: 8px solid; border-image: ${BONES} 0 10 10 10 round; background: linear-gradient(#1c2420, #0e1412); }
${P.btn} { border: 5px solid !important; border-image: ${BONES} 9 round !important; border-radius: 0; background: #151c1a !important; color: #d8e8d0 !important; padding: 2px 8px; }
${P.on} { background: radial-gradient(ellipse at 50% 60%, rgba(120, 240, 160, 0.4), #0e1412 80%) !important; filter: drop-shadow(0 0 5px rgba(120, 240, 160, 0.7)); }
${P.card} { border: 9px solid !important; border-image: ${BONES} 9 round !important; border-radius: 0 !important; background: rgba(12, 18, 16, 0.94) !important; }
${P.h2} { padding-left: 18px; background: ${SKULL} 0 50% / 12px 12px no-repeat; }
${T} #tabs { border-top: 8px solid; border-image: ${BONES} 10 0 0 0 round; background: #0e1412; }
${T} #clock { border-bottom: 6px solid !important; border-image: ${BONES} 0 0 10 0 round !important; }
${P.fill} { background: linear-gradient(90deg, #2a8a5a, #7cf0a0) !important; box-shadow: 0 0 8px rgba(120, 240, 160, 0.6); }
`;
}

/* ------------------------------------------------------------ the Blood Court: a gothic castle */

const SPIRES = svg(24, 14, `<path d='M0 14 L4 6 L6 0 L8 6 L12 14 Z M12 14 L16 8 L18 3 L20 8 L24 14 Z' fill='#2e2232'/><path d='M6 0 L6 14 M18 3 L18 14' stroke='#4a3a4a' stroke-width='0.8'/>`);
const BATTLEMENT = svg(16, 8, `<path d='M0 8 V2 H6 V8 Z M10 8 V2 H16 V8 Z' fill='#3e3040'/><rect x='0' y='2' width='6' height='1' fill='#5a4a5c'/><rect x='10' y='2' width='6' height='1' fill='#5a4a5c'/>`);
const STONE = 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.25) 0 1px, transparent 1px 22px)';
const TREFOIL = svg(12, 12, `<g fill='#c83848'><circle cx='6' cy='3.5' r='2.4'/><circle cx='3.2' cy='7.5' r='2.4'/><circle cx='8.8' cy='7.5' r='2.4'/></g><path d='M6 2 V12' stroke='#1a0e16' stroke-width='1'/>`);
const GLASS = 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0 1px, transparent 1px) 0 0 / 10px 10px, linear-gradient(45deg, rgba(0, 0, 0, 0.5) 0 1px, transparent 1px) 0 0 / 10px 10px';

function vampire(T: string): string {
  const P = parts(T);
  // a lancet: chamfered shoulders up to a point
  const lancet = 'polygon(0 100%, 0 9px, 9px 0, calc(50% - 5px) 0, 50% -0px, calc(50% + 5px) 0, calc(100% - 9px) 0, 100% 9px, 100% 100%)';
  return `
${P.frame} { border: 6px solid #2a1e2e; box-shadow: inset 0 0 0 2px #5a4a5c; }
${P.frame}, ${P.main} { background-color: #140e14; background-image: ${STONE}; }
${P.header} { position: relative; margin-top: 12px; background: ${STONE}, linear-gradient(#3e3040, #221826); border-bottom: 3px solid #6a1020; }
${P.header}::before { content: ''; position: absolute; left: 0; right: 0; top: -13px; height: 14px; background: ${SPIRES} 0 0 / 24px 14px repeat-x; }
${P.title} { color: #e8c8d0; font-variant: small-caps; letter-spacing: 0.12em; }
${P.btn} { clip-path: ${lancet}; border-radius: 0 !important; padding-top: 7px !important; background: ${STONE}, linear-gradient(#4a3a4a, #2a1e2e) !important; color: #e8d8e0 !important; border: 1px solid #1a0e16 !important; }
${P.on} { background: ${GLASS}, radial-gradient(ellipse at 50% 40%, #e84858, #6a1020 75%) !important; color: #fff0f0 !important; }
${P.card} { clip-path: polygon(0 100%, 0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%); border-radius: 0 !important; background: ${STONE}, rgba(30, 20, 30, 0.95) !important; border: 1px solid #5a4a5c !important; }
${P.h2} { color: #d84858 !important; font-variant: small-caps; letter-spacing: 0.14em; }
${P.h2} { padding-left: 18px; background: ${TREFOIL} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: ${STONE}, linear-gradient(#3e3040, #1a121e); border-top: 0; margin-top: 8px; }
${T} #tabs::before { content: ''; position: absolute; left: 0; right: 0; top: -8px; height: 8px; background: ${BATTLEMENT} 0 0 / 16px 8px repeat-x; pointer-events: none; }
${T} #clock { background: ${STONE}, linear-gradient(#3e3040, #221826) !important; border-bottom: 2px solid #6a1020 !important; }
${P.fill} { background: linear-gradient(90deg, #6a1020, #e84858) !important; }
`;
}

/* ------------------------------------------------------------ the Moon Pack: leather and claws */

const CLAWS = svg(26, 22, `<g stroke='#1a100a' stroke-width='2.2' stroke-linecap='round' opacity='0.55'><path d='M4 2 L10 20'/><path d='M11 1 L16 19'/><path d='M18 2 L22 18'/></g>`);
const MOON = svg(12, 12, `<circle cx='6' cy='6' r='5' fill='#e8e0c0'/><circle cx='8' cy='5' r='4.4' fill='#2a2018'/>`);
const FUR = 'repeating-linear-gradient(70deg, rgba(0, 0, 0, 0.12) 0 1px, transparent 1px 4px), repeating-linear-gradient(110deg, rgba(255, 240, 200, 0.05) 0 1px, transparent 1px 5px)';

function werewolf(T: string): string {
  const P = parts(T);
  const torn = 'polygon(0 0, 100% 0, 100% 78%, 92% 100%, 80% 84%, 66% 100%, 52% 86%, 38% 100%, 24% 85%, 10% 100%, 0 82%)';
  return `
${P.frame} { border: 4px solid #3a2a1a; }
${P.header} { position: relative; background: ${FUR}, linear-gradient(#5a4430, #3a2a1a); }
${P.header}::after { content: ''; position: absolute; right: 40px; top: 2px; width: 26px; height: 22px; background: ${CLAWS}; }
${P.btn} { clip-path: ${torn}; border-radius: 0 !important; padding-bottom: 7px !important; background: ${FUR}, linear-gradient(#6a5438, #4a3a28) !important; color: #f0e4cc !important; border: 0 !important; }
${P.on} { background: ${FUR}, linear-gradient(#a88a58, #6a4a28) !important; box-shadow: none; filter: drop-shadow(0 0 5px rgba(240, 230, 190, 0.5)); }
${P.card} { background: ${CLAWS} right 8px top 6px / 26px 22px no-repeat, ${FUR}, rgba(40, 30, 20, 0.95) !important; border: 2px solid #1a100a !important; border-radius: 2px; }
${P.h2} { padding-left: 18px; background: ${MOON} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: ${FUR}, linear-gradient(#4a3a28, #2a2018); }
${T} #clock { background: ${FUR}, linear-gradient(#4a3a28, #2a2018) !important; }
${P.fill} { background: linear-gradient(90deg, #8a6a3a, #e8e0c0) !important; }
`;
}

/* ------------------------------------------------------------ the Machine Colony: plates and rivets */

const RIVETS = [0, 1]
  .flatMap((i) => [0, 1].map((j) => `radial-gradient(circle at ${i ? 'calc(100% - 5px)' : '5px'} ${j ? 'calc(100% - 5px)' : '5px'}, #d0d8e0 1.5px, #3a4450 2px, transparent 2.5px)`))
  .join(', ');
const BRUSHED = 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 3px)';

function robot(T: string): string {
  const P = parts(T);
  const chamfer = 'polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px)';
  return `
${P.frame} { border: 4px solid #5a6470; }
${P.header} { position: relative; background: ${BRUSHED}, linear-gradient(#6a7684, #3a4450); border-bottom: 4px solid; border-image: repeating-linear-gradient(45deg, #e8c040 0 6px, #1a1a20 6px 12px) 4; }
${P.title} { font-family: var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; }
${P.btn} { clip-path: ${chamfer}; border-radius: 0 !important; background: ${RIVETS}, ${BRUSHED}, linear-gradient(#7a8694, #4a5460) !important; color: #e8f4ff !important; border: 0 !important; font-family: var(--font-display); }
${P.on} { background: ${RIVETS}, linear-gradient(transparent calc(100% - 3px), #60e0ff calc(100% - 3px)), ${BRUSHED}, linear-gradient(#5a8aa8, #2a4a60) !important; }
${P.card} { clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  border-radius: 0 !important; background: ${RIVETS}, ${BRUSHED}, rgba(34, 42, 52, 0.96) !important; border: 0 !important; }
${P.h2} { font-family: var(--font-display); color: #60e0ff !important; }
${P.h2} { padding-left: 14px; background: linear-gradient(90deg, #40f080 0 2px, transparent 2px) 0 50% / 8px 8px no-repeat; }
${T} #tabs { background: ${BRUSHED}, linear-gradient(#5a6470, #2a3038); border-top: 3px solid; border-image: repeating-linear-gradient(45deg, #e8c040 0 6px, #1a1a20 6px 12px) 3; }
${T} #clock { background: ${BRUSHED}, linear-gradient(#4a5460, #2a3038) !important; font-family: var(--font-body); }
${P.fill} { background: repeating-linear-gradient(90deg, #60e0ff 0 5px, #2a8aa8 5px 6px) !important; }
`;
}

/* ------------------------------------------------------------ the Deep Hold: carved stone and gold runes */

const RUNES = svg(40, 10, `<g stroke='#e8b840' stroke-width='1.2' fill='none'><path d='M3 2 V8 M3 2 L6 4'/><path d='M11 2 V8 M11 5 L14 2 M11 5 L14 8'/><path d='M20 2 L23 8 L26 2'/><path d='M31 2 V8 M31 2 L35 2 M31 5 L34 5'/></g>`);
const SLAB = 'linear-gradient(rgba(255, 255, 255, 0.12), transparent 30%, rgba(0, 0, 0, 0.25))';

function dwarves(T: string): string {
  const P = parts(T);
  return `
${P.frame} { border: 6px solid #4a4440; box-shadow: inset 0 0 0 2px #e8b840; }
${P.header} { position: relative; background: ${SLAB}, #6a625a; border-bottom: 0; padding-bottom: 14px; }
${P.header}::after { content: ''; position: absolute; left: 0; right: 0; bottom: 2px; height: 10px; background: ${RUNES} 0 0 / 40px 10px repeat-x; }
${P.title} { color: #f0c860; text-shadow: 0 1px 0 #2a2018; letter-spacing: 0.08em; }
${P.btn} { background: ${SLAB}, #7a7068 !important; color: #f8ecd0 !important; border: 2px solid #3a3430 !important; border-radius: 1px;
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.25), inset -1px -1px 0 rgba(0, 0, 0, 0.35); text-shadow: 0 1px 0 #2a2018; }
${P.on} { background: ${SLAB}, #8a6a2a !important; border-color: #e8b840 !important; box-shadow: inset 0 0 0 1px #f0d070, 0 0 8px rgba(232, 184, 64, 0.5); }
${P.card} { background: ${SLAB}, rgba(58, 52, 48, 0.96) !important; border: 2px solid #2a2420 !important; border-radius: 1px; box-shadow: inset 0 0 0 1px #8a6a2a; }
${P.h2} { color: #f0c860 !important; padding-bottom: 12px; background: ${RUNES} 0 100% / 40px 10px repeat-x; }
${T} #tabs { background: ${SLAB}, #5a524a; border-top: 3px solid #e8b840; }
${T} #clock { background: ${SLAB}, #4a4440 !important; border-bottom: 2px solid #e8b840 !important; }
${P.fill} { background: linear-gradient(90deg, #8a6a2a, #f0c860) !important; }
`;
}

/* ------------------------------------------------------------ the Tide Clan: sea glass and waves */

const WAVE = svg(32, 8, `<path d='M0 5 q4 -5 8 0 t8 0 t8 0 t8 0 V8 H0 Z' fill='#3a8a84'/><path d='M0 5 q4 -5 8 0 t8 0 t8 0 t8 0' stroke='#c8f0e8' stroke-width='1' fill='none'/>`);
const SHELL = svg(12, 12, `<path d='M6 11 L1 5 Q6 -1 11 5 Z' fill='#f0c8b0' stroke='#c08070' stroke-width='0.7'/><path d='M6 11 L4 3 M6 11 L6 2 M6 11 L8 3' stroke='#c08070' stroke-width='0.6'/>`);

function merfolk(T: string): string {
  const P = parts(T);
  return `
${P.frame} { border: 4px solid #2a6a6a; border-radius: 10px; }
${P.frame}, ${P.main} { background-color: #0e2a30; background-image: radial-gradient(circle at 20% 80%, rgba(120, 220, 210, 0.08) 0 30px, transparent 31px), radial-gradient(circle at 80% 30%, rgba(120, 220, 210, 0.06) 0 20px, transparent 21px); }
${P.header} { position: relative; margin-bottom: 8px; background: linear-gradient(#2a7a8a, #1a4a5a); border-bottom: 0; }
${P.header}::after { content: ''; position: absolute; left: 0; right: 0; bottom: -7px; height: 8px; background: ${WAVE} 0 0 / 32px 8px repeat-x; }
${P.btn} { border-radius: 999px; background: linear-gradient(rgba(255, 255, 255, 0.35), transparent 45%), linear-gradient(#5ab0b0, #2a7a80) !important;
  color: #f0fffc !important; border: 1px solid rgba(200, 255, 245, 0.6) !important; text-shadow: 0 1px 0 #0e3a40; }
${P.on} { background: linear-gradient(rgba(255, 255, 255, 0.45), transparent 45%), linear-gradient(#a0f0e0, #3aa8a0) !important; box-shadow: 0 0 10px rgba(160, 240, 224, 0.6); color: #0e2a30 !important; text-shadow: none; }
${P.card} { border-radius: 14px !important; background: linear-gradient(rgba(160, 240, 230, 0.12), transparent 40%), rgba(14, 42, 48, 0.94) !important; border: 1px solid rgba(160, 240, 230, 0.4) !important; }
${P.h2} { padding-left: 18px; background: ${SHELL} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: linear-gradient(#1a4a5a, #0e2a30); border-top: 0; }
${T} #tabs::before { content: ''; position: absolute; left: 0; right: 0; top: -7px; height: 8px; background: ${WAVE} 0 0 / 32px 8px repeat-x; transform: scaleY(-1); pointer-events: none; }
${T} #clock { background: linear-gradient(#2a7a8a, #1a4a5a) !important; }
${P.fill} { background: linear-gradient(90deg, #2a7a80, #a0f0e0) !important; }
`;
}

/* ------------------------------------------------------------ the Nomads... see above; the Fae Court: petals and shimmer */

const SPARK = svg(10, 10, `<path d='M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z' fill='#fff4c0'/>`);
const BLOSSOM = svg(12, 12, `<g fill='#f0a0e0'><circle cx='6' cy='3' r='2.6'/><circle cx='9' cy='6' r='2.6'/><circle cx='6' cy='9' r='2.6'/><circle cx='3' cy='6' r='2.6'/></g><circle cx='6' cy='6' r='1.6' fill='#fff0a0'/>`);

function fae(T: string): string {
  const P = parts(T);
  return `
@keyframes fae-shimmer { from { background-position: 0 0, 0 0; } to { background-position: 200% 0, 0 0; } }
${P.frame} { border: 3px solid #c890e8; border-radius: 16px; box-shadow: inset 0 0 14px rgba(240, 160, 230, 0.4); }
${P.header} { background: linear-gradient(100deg, #6a3a8a, #3a5a8a, #6a3a8a); border-bottom: 1px solid #f0a0e0; border-radius: 12px 12px 0 0; }
${P.title} { color: #fff0fb; text-shadow: 0 0 6px #f0a0e0; font-style: italic; }
${P.btn} { position: relative; border-radius: 14px 4px 14px 4px; border: 1px solid rgba(255, 220, 250, 0.7) !important;
  background: linear-gradient(110deg, #d890d0, #90c0e8, #b0e090, #d890d0) 0 0 / 200% 100% !important; color: #2a1438 !important; font-weight: 700;
  animation: fae-shimmer 6s linear infinite; }
${P.on} { box-shadow: 0 0 12px rgba(255, 200, 250, 0.9); }
${pseudo(P.on, '::after')} { content: ''; position: absolute; right: -2px; top: -4px; width: 10px; height: 10px; background: ${SPARK}; pointer-events: none; }
${P.card} { border-radius: 18px 4px 18px 4px !important; background: linear-gradient(135deg, rgba(240, 160, 230, 0.16), rgba(144, 192, 232, 0.12)), rgba(30, 20, 44, 0.94) !important; border: 1px solid rgba(240, 190, 240, 0.5) !important; }
${P.h2} { color: #f8c0f0 !important; font-style: italic; }
${P.h2} { padding-left: 18px; background: ${BLOSSOM} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: linear-gradient(100deg, #3a2050, #20304a, #3a2050); border-top: 1px solid #f0a0e0; }
${T} #clock { background: linear-gradient(100deg, #4a2a60, #2a3a5a) !important; }
${P.fill} { background: linear-gradient(90deg, #d890d0, #90c0e8, #b0e090) !important; }
`;
}

/* ------------------------------------------------------------ the Crucible: brass and glass */

const SCREWS = [0, 1]
  .flatMap((i) => [0, 1].map((j) => `radial-gradient(circle at ${i ? 'calc(100% - 6px)' : '6px'} ${j ? 'calc(100% - 6px)' : '6px'}, #f8e0a0 1px, #8a5a20 2px, transparent 2.6px)`))
  .join(', ');
const FLASK = svg(12, 12, `<path d='M4.5 1 H7.5 V4 L10.5 10 Q11 11 10 11 H2 Q1 11 1.5 10 L4.5 4 Z' fill='rgba(200,230,240,0.5)' stroke='#c8a060' stroke-width='0.8'/><path d='M2.5 8 H9.5 L10.5 10 Q11 11 10 11 H2 Q1 11 1.5 10 Z' fill='#80f060'/>`);

function alchemists(T: string): string {
  const P = parts(T);
  return `
@keyframes brew { from { background-position: 0 0; } to { background-position: 0 -24px; } }
${P.frame} { border: 5px solid; border-image: linear-gradient(135deg, #f0d080, #a86a20, #f0d080, #7a4a10) 5; }
${P.header} { background: ${SCREWS}, linear-gradient(#3a5a4a, #1a2a24); border-bottom: 3px solid #c8963a; }
${P.btn} { background: linear-gradient(rgba(255, 255, 255, 0.25), transparent 40%), linear-gradient(#2a4a3a, #183028) !important; color: #e8f8e0 !important;
  border: 2px solid #c8963a !important; border-radius: 3px; box-shadow: inset 0 0 0 1px #6a4010; }
${P.on} { background: radial-gradient(circle at 30% 70%, rgba(200, 255, 170, 0.6) 0 2px, transparent 3px) 0 0 / 12px 12px, linear-gradient(#5ac050, #2a6a30) !important; box-shadow: 0 0 10px rgba(128, 240, 96, 0.6); animation: brew 2s linear infinite; }
${P.card} { background: ${SCREWS}, linear-gradient(rgba(200, 240, 230, 0.08), transparent 40%), rgba(20, 32, 28, 0.95) !important; border: 2px solid #a8763a !important; border-radius: 4px; }
${P.h2} { color: #f0c870 !important; }
${P.h2} { padding-left: 18px; background: ${FLASK} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: linear-gradient(#2a3a30, #141e1a); border-top: 4px solid; border-image: linear-gradient(90deg, #c8963a, #f0d080, #a86a20) 4; }
${T} #clock { background: linear-gradient(#2a3a30, #141e1a) !important; border-bottom: 3px solid #c8963a !important; }
${P.fill} { background: radial-gradient(circle at 50% 70%, rgba(220, 255, 200, 0.7) 0 1.5px, transparent 2px) 0 0 / 9px 8px, linear-gradient(90deg, #3a8a3a, #80f060) !important; animation: brew 1.5s linear infinite; }
`;
}

/* ------------------------------------------------------------ the Exiled Order: steel and heraldry */

const CREST = svg(12, 13, `<path d='M1 1 H11 V6 Q11 11 6 12.5 Q1 11 1 6 Z' fill='#3050a0' stroke='#e8c040' stroke-width='1'/><path d='M6 3 V10 M3.5 6 H8.5' stroke='#e8c040' stroke-width='1.2'/>`);
const PLATE = 'linear-gradient(rgba(255, 255, 255, 0.28), transparent 35%, rgba(0, 0, 0, 0.2))';

function knights(T: string): string {
  const P = parts(T);
  const banner = 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 6px), 0 100%)';
  return `
${P.frame} { border: 5px solid #8a8a94; box-shadow: inset 0 0 0 2px #e8c040; }
${P.header} { background: ${PLATE}, #2a3a6a; border-bottom: 3px solid #e8c040; }
${P.title} { color: #f8ecc0; letter-spacing: 0.08em; }
${P.btn} { background: ${PLATE}, #9a9aa4 !important; color: #1a1a24 !important; border: 1px solid #4a4a54 !important; border-radius: 2px; font-weight: 700; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4); }
${T} #tabs button { clip-path: ${banner}; padding-bottom: 8px !important; background: ${PLATE}, #3050a0 !important; color: #f8ecc0 !important; text-shadow: 0 1px 0 #1a2a5a; }
${P.on} { background: ${PLATE}, #a03030 !important; color: #f8ecc0 !important; border-color: #e8c040 !important; text-shadow: 0 1px 0 #4a1010; }
${P.card} { background: ${PLATE}, rgba(38, 40, 52, 0.95) !important; border: 2px solid #8a8a94 !important; border-radius: 2px; box-shadow: inset 0 0 0 1px #e8c040; }
${P.h2} { display: inline-block; color: #f8ecc0 !important; background: ${CREST} 5px 50% / 12px 13px no-repeat, #a03030; padding: 2px 10px 2px 22px; border: 1px solid #e8c040; }
${T} #tabs { background: ${PLATE}, #4a4a54; border-top: 3px solid #e8c040; }
${T} #clock { background: ${PLATE}, #2a3a6a !important; border-bottom: 2px solid #e8c040 !important; }
${P.fill} { background: linear-gradient(90deg, #3050a0, #e8c040) !important; }
`;
}

/* ------------------------------------------------------------ the Orc Warband: hide, iron and war paint */

const TUSK = svg(12, 12, `<path d='M2 11 Q2 4 6 1 Q4 6 5 11 Z' fill='#f0e8d0' stroke='#5a3a20' stroke-width='0.6'/><path d='M10 11 Q10 4 6 1 Q8 6 7 11 Z' fill='#f0e8d0' stroke='#5a3a20' stroke-width='0.6'/>`);
const HIDE = 'repeating-linear-gradient(115deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 7px), linear-gradient(rgba(255, 220, 180, 0.08), transparent 40%, rgba(0, 0, 0, 0.25))';
const STUDS = 'radial-gradient(circle, #b0a8a0 0 1.2px, #3a3430 1.6px, transparent 2px) 0 0 / 14px 100%';

function orcs(T: string): string {
  const P = parts(T);
  const torn = 'polygon(0 0, 100% 0, 100% 100%, 85% calc(100% - 5px), 65% 100%, 45% calc(100% - 6px), 25% 100%, 0 calc(100% - 4px))';
  return `
${P.frame} { border: 5px solid #4a2e1a; box-shadow: inset 0 0 0 2px #8a1a14; }
${P.header} { background: ${HIDE}, #4a2a18; border-bottom: 3px solid #8a1a14; }
${P.title} { color: #f8d8b0; letter-spacing: 0.06em; text-shadow: 0 2px 0 #1a0a04; }
${P.btn} { background: ${HIDE}, #6a4a2e !important; color: #fff0dc !important; border: 1px solid #2a1a0e !important; border-radius: 3px 8px 3px 6px; font-weight: 700; text-shadow: 0 1px 0 #1a0a04; }
${T} #tabs button { clip-path: ${torn}; padding-bottom: 7px !important; background: ${HIDE}, #5a3a22 !important; color: #f8e0c0 !important; }
${P.on} { background: ${HIDE}, #8a1a14 !important; color: #fff0dc !important; border-color: #e06030 !important; }
${P.card} { background: ${HIDE}, rgba(44, 28, 18, 0.95) !important; border: 2px solid #4a2e1a !important; border-radius: 4px 10px 4px 8px; box-shadow: inset 0 0 0 1px rgba(224, 96, 48, 0.35); }
${P.h2} { color: #e8783a !important; padding-left: 18px; background: ${TUSK} 0 50% / 12px 12px no-repeat; }
${T} #tabs { background: ${STUDS}, linear-gradient(#3a2416, #1e120a); border-top: 4px solid #8a1a14; }
${T} #clock { background: ${HIDE}, #3a2416 !important; border-bottom: 3px solid #8a1a14 !important; }
${P.fill} { background: repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.18) 0 3px, transparent 3px 7px), linear-gradient(90deg, #4a7a2a, #a8d050) !important; }
`;
}

const SKINS: Partial<Record<ThemeId, (T: string) => string>> = { nomads, druid, lich, vampire, werewolf, robot, dwarves, merfolk, fae, alchemists, knights, orcs };

/** A theme's materials and shapes (after its colours), or nothing (the settlers keep the plain look). */
export const skinCss = (id: ThemeId, T: string): string => SKINS[id]?.(T) ?? '';
