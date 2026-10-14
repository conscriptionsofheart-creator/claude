/* sculpt_next_looks.js: colour GRADIENTS, SKINS and LOOKS for objects and clay (Ruth 2026-10-14: "not just blue orange, but all kinds of color gradients, and the ability to put skins and shaders on the objects").
   GRADIENT: two to six colours that blend into each other. A library of named ones (her emblem's two, sunset, ocean, fire, skin tones, gold...) and her own, built a colour at a time from the Colour tile.
   SKIN: how the gradient lies on a surface: smooth along the line you drag, or as a pattern made of the gradient's colours: marble veins, wood rings, scales, speckle, stripes, spots, camo, clouds.
         Patterns come from the object's own shape (3D noise in its own space), so they wrap round it with no seams and keep their size whatever the object's size. They are stored as vertex colours,
         so they travel in the .glb and look the same on three r128 and r186.
   LOOK: the surface the light sees (a three.js material): matte, satin, gloss, metal, chrome, glow, glass, pearl, velvet, candy, toon. Pure data here; makeMaterial builds the three.js material.
   People are not dressed here: a figure keeps its own skin shader (the Atelier's BodyFX); Paint still colours a figure in its keys' way. */

import { parseStops, rgb2hsv, hsv2rgb } from './sculpt_next_wheel.js';
const hexRGB = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const even = list => list.map((c, i) => [list.length === 1 ? 0 : i / (list.length - 1), c]);
/* the library (front faces; a rod's back face is the same gradient a little darker unless a back is given) */
export const GRADIENTS = [
  { name: 'from Colour', dynamic: true },   /* the colour you picked on the wheel, from deep to light */
  { name: 'emblem blue', stops: [[0, '#140b78'], [0.25, '#170d8c'], [0.45, '#2a1fd4'], [0.6, '#4a2cff'], [0.72, '#6a28f2'], [0.82, '#9620c8'], [0.9, '#cf2a8c'], [1, '#ff4a2a']], back: [[0, '#2a18e0'], [0.18, '#5a46ff'], [0.34, '#8b7cff'], [0.5, '#5a46ff'], [1, '#3a22e8']], ball: [[0, '#21149a'], [0.5, '#4a2cff'], [1, '#8a3cff']] },
  { name: 'emblem orange', stops: [[0, '#3a0a5a'], [0.12, '#6a1060'], [0.25, '#c03848'], [0.38, '#ff8a1e'], [0.5, '#ffab14'], [0.62, '#ff7a1e'], [0.8, '#ff5424'], [1, '#ff9a12']], back: [[0, '#2a0650'], [0.5, '#2a0650'], [0.66, '#5a0a66'], [0.8, '#a03050'], [0.92, '#ff7a20'], [1, '#ffa018']], ball: [[0, '#ff2424'], [0.5, '#ff5a20'], [1, '#ffb41a']] },
  { name: 'sunset', stops: even(['#2b1055', '#7a1f6b', '#d53369', '#ff9a44', '#ffd86f']) },
  { name: 'ocean', stops: even(['#03045e', '#0077b6', '#00b4d8', '#90e0ef']) },
  { name: 'aurora', stops: even(['#1a0b3b', '#3a86ff', '#2ec4b6', '#b8f2e6']) },
  { name: 'forest', stops: even(['#0b3d20', '#2d6a4f', '#74c69d', '#d8f3dc']) },
  { name: 'fire', stops: even(['#3d0000', '#c1121f', '#ff7b00', '#ffd000']) },
  { name: 'lava', stops: even(['#1b0000', '#5c0000', '#ff3c00', '#ffb100']) },
  { name: 'rose gold', stops: even(['#6d3b47', '#b76e79', '#e8b4a0', '#f7e1d7']) },
  { name: 'candy', stops: even(['#ff5fa2', '#ffc6e2', '#a0e7ff', '#7b5cff']) },
  { name: 'peacock', stops: even(['#0b2545', '#13315c', '#0f9b8e', '#3ddc97', '#d4af37']) },
  { name: 'midnight', stops: even(['#0f0c29', '#302b63', '#4a3f8f', '#8e7cc3']) },
  { name: 'neon', stops: even(['#ff00e0', '#7a00ff', '#00e5ff']) },
  { name: 'mint', stops: even(['#004d40', '#26a69a', '#a7ffeb']) },
  { name: 'earth', stops: even(['#3e2723', '#795548', '#a1887f', '#d7ccc8']) },
  { name: 'skin tones', stops: even(['#4a2c1d', '#8d5524', '#c68642', '#e0ac69', '#f6d2b0']) },
  { name: 'gold', stops: even(['#5c4300', '#b8860b', '#ffd700', '#fff4b0']) },
  { name: 'silver', stops: even(['#2b2b2b', '#8a8a8a', '#e6e6e6']) },
  { name: 'rainbow', stops: even(['#ff004c', '#ff8a00', '#ffe600', '#2bd96b', '#00b3ff', '#7a3cff']) },
  { name: 'custom', custom: true },
];
export const GRADIENT_NAMES = GRADIENTS.map(g => g.name);
const hex2 = v => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
/* the gradient a setting names: { front, back, ball } as stops [[t, '#hex']] (palette = the Colour tile's colours, 0..255) */
export function gradientOf(cfg, palette) {
  const g = GRADIENTS.find(x => x.name === cfg.gradient) || GRADIENTS[0];
  let front;
  if (g.dynamic) { const c = pickedRGB(cfg, palette), [h, sat, v] = rgb2hsv(c[0], c[1], c[2]); front = [[0, hex2(hsv2rgb(h, Math.min(1, sat * 1.1), v * 0.35).map(x => x * 255))], [0.55, hex2(c.map(x => x * 255))], [1, hex2(hsv2rgb(h, sat * 0.45, Math.min(1, v * 0.6 + 0.45)).map(x => x * 255))]]; }
  else if (g.custom) { const L = parseStops(cfg.gradCustom); front = L.length ? (L.length === 1 ? [L[0], L[0]] : L).map((st, i, a) => [a === L ? st.t : i, hex2(st.rgb.map(x => x * 255)) + (st.a < 0.999 ? Math.round(st.a * 255).toString(16).padStart(2, '0') : '')]) : [[0, '#ffffff'], [1, '#000000']]; }
  else front = g.stops;
  const dark = front.map(([t, c]) => [t, hex2(hexRGB(c).map(v => v * 255 * 0.6)) + c.slice(7)]);
  return { front, back: g.back || dark, ball: g.ball || front, see: front.some(([, c]) => c.length === 9) };
}
/* the colour picked on the wheel (0..1), or the old palette's when none was picked */
export function pickedRGB(cfg, palette) { const h = String(cfg.rgb || ''); if (/^#[0-9a-f]{6}$/i.test(h)) return hexRGB(h); const p = palette[(cfg.tint || 0) % palette.length]; return p.map(v => v / 255); }
/* how solid a gradient is at t (stops written #rrggbbaa carry their own see-through) */
export function alphaAt(stops, t) { t = Math.max(0, Math.min(1, t)); const A = c => (c.length === 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1); for (let i = 0; i < stops.length - 1; i++) { const [ta, ca] = stops[i], [tb, cb] = stops[i + 1]; if (t <= tb) { const u = (t - ta) / (tb - ta || 1); return A(ca) + (A(cb) - A(ca)) * u; } } return A(stops[stops.length - 1][1]); }
export function addCustomColour(cfg, rgb255) { const cur = cfg.gradient === 'custom' ? String(cfg.gradCustom || '').split(',').filter(Boolean) : []; cur.push(hex2(rgb255)); return cur.slice(-6).join(','); }
/* a colour along stops (0..1 each channel) */
export function colourAt(stops, t) { t = Math.max(0, Math.min(1, t)); for (let i = 0; i < stops.length - 1; i++) { const [ta, ca] = stops[i], [tb, cb] = stops[i + 1]; if (t <= tb) { const u = (t - ta) / (tb - ta || 1), A = hexRGB(ca), B = hexRGB(cb); return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u]; } } return hexRGB(stops[stops.length - 1][1]); }

/* ---------- skins: patterns from 3D noise (deterministic: the same on every headset) ---------- */
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const fade = t => t * t * (3 - 2 * t);
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi), L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf), L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
const fbm = (x, y, z, n) => { let a = 0, w = 0.5, f = 1; for (let i = 0; i < (n || 4); i++) { a += w * noise(x * f, y * f, z * f); f *= 2.03; w *= 0.5; } return a / (1 - Math.pow(0.5, n || 4)); };
function cells(x, y, z) {   /* distance to the nearest and next-nearest scattered point (Worley) */
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let f1 = 9, f2 = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = xi + dx, Y = yi + dy, Z = zi + dz, px = X + hash3(X, Y, Z), py = Y + hash3(Y, Z, X), pz = Z + hash3(Z, X, Y), d = Math.hypot(px - x, py - y, pz - z); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
  return [f1, f2];
}
/* each skin: (x, y, z in units of the object's size) -> 0..1, a place along the gradient */
export const SKINS = {
  smooth: null,
  marble: (x, y, z) => { const v = Math.sin((x + y * 0.4) * 9 + fbm(x * 3, y * 3, z * 3, 5) * 7); return 1 - Math.pow(Math.abs(v), 0.35); },
  wood: (x, y, z) => { const r = Math.hypot(x, z) * 14 + fbm(x * 2, y * 6, z * 2, 3) * 3; return 0.5 + 0.5 * Math.sin(r * Math.PI); },
  scales: (x, y, z) => { const [f1, f2] = cells(x * 9, y * 9, z * 9); return Math.min(1, (f2 - f1) * 2.2); },
  speckle: (x, y, z) => { const n = fbm(x * 40, y * 40, z * 40, 2); return n > 0.62 ? 1 : n < 0.3 ? 0 : 0.5; },
  stripes: (x, y, z) => 0.5 + 0.5 * Math.sin((y * 10 + fbm(x * 2, y * 2, z * 2, 3) * 1.5) * Math.PI),
  spots: (x, y, z) => { const [f1] = cells(x * 6, y * 6, z * 6); return f1 < 0.28 ? 1 : f1 < 0.38 ? 0 : 0.5; },
  camo: (x, y, z) => { const n = fbm(x * 4, y * 4, z * 4, 4); return n < 0.42 ? 0 : n < 0.55 ? 0.5 : 1; },
  clouds: (x, y, z) => fbm(x * 3, y * 3, z * 3, 5),
};
export const SKIN_NAMES = Object.keys(SKINS);
/* where a point sits along the gradient: smooth = along the line you dragged (lineT); a pattern = the pattern, nudged by the line when you dragged one */
export function placeOf(skin, lineT, x, y, z, dragged) {
  const f = SKINS[skin]; if (!f) return lineT; const p = f(x, y, z); return dragged ? Math.max(0, Math.min(1, lineT * 0.6 + p * 0.4)) : p;
}

/* ---------- looks: the surface for the light ---------- */
export const LOOKS = {
  matte: { roughness: 0.95, metalness: 0 }, satin: { roughness: 0.6, metalness: 0 }, gloss: { roughness: 0.18, metalness: 0 }, metal: { roughness: 0.3, metalness: 0.9 }, chrome: { roughness: 0.05, metalness: 1 },
  glow: { roughness: 0.45, metalness: 0, glow: 0.7 }, glass: { roughness: 0.05, metalness: 0, opacity: 0.45, physical: { clearcoat: 1 } }, pearl: { roughness: 0.25, metalness: 0.1, physical: { clearcoat: 1, iridescence: 1 } },
  velvet: { roughness: 0.85, metalness: 0, physical: { sheen: 1 } }, candy: { roughness: 0.3, metalness: 0, physical: { clearcoat: 1, clearcoatRoughness: 0.05 } }, toon: { toon: true },
};
export const LOOK_NAMES = Object.keys(LOOKS);
/* a three.js material for a look, keeping the old material's colour, texture and vertex colours */
export function makeMaterial(THREE, look, old) {
  const L = LOOKS[look] || LOOKS.satin, o = old || {}, base = { vertexColors: !!o.vertexColors, color: o.color ? o.color.clone() : new THREE.Color(0xffffff), map: o.map || null, side: o.side == null ? THREE.FrontSide : o.side };
  let m;
  if (L.toon) m = new THREE.MeshToonMaterial(base);
  else if (L.physical && THREE.MeshPhysicalMaterial) {
    m = new THREE.MeshPhysicalMaterial(Object.assign(base, { roughness: L.roughness, metalness: L.metalness }));
    const P = L.physical; if (P.clearcoat != null) m.clearcoat = P.clearcoat; if (P.clearcoatRoughness != null) m.clearcoatRoughness = P.clearcoatRoughness;
    if (P.iridescence != null && 'iridescence' in m) m.iridescence = P.iridescence;   /* three r141 and later; older ones keep the clearcoat */
    if (P.sheen != null) { if (typeof m.sheen === 'number') { m.sheen = P.sheen; if (m.sheenColor) m.sheenColor.setRGB(1, 1, 1); } else if ('sheen' in m) m.sheen = new THREE.Color(0.9, 0.9, 0.9); }   /* r128: sheen is a colour; later: a number and a sheenColor */
  } else m = new THREE.MeshStandardMaterial(Object.assign(base, { roughness: L.roughness == null ? 0.6 : L.roughness, metalness: L.metalness || 0 }));
  if (L.opacity != null) { m.transparent = true; m.opacity = L.opacity; m.depthWrite = false; }
  if (L.glow && m.emissive) {   /* glow in the object's OWN colours: with vertex colours the emissive light is multiplied by them in the shader (a white glow would wash a gradient out) */
    if (!base.vertexColors) m.emissive.copy(base.color).multiplyScalar(L.glow);
    else { m.emissive.setRGB(L.glow, L.glow, L.glow); m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif'); }; m.customProgramCacheKey = () => 'glowvc'; }
  }
  m.userData.look = look; m.name = (o.name || 'look') + ' ' + look; return m;
}
