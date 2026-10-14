/* sculpt_next_emblem.js: Ruth's emblem in three dimensions (Ruth 2026-10-13: "be able to create this in 3dimension with all the gradient and rich colors on it, and animate it to spin";
   2026-10-14: "take a rectangular rod (not flattened), twist it, and then bend it, and then stretch the end of it and taper it off").
   Each figure's body is ONE rod made exactly that way (sculpt_next_rod.js): a solid rectangular bar about 1.8 times as wide as it is thick, twisted on its length, bent along a path traced from her
   picture (moving in depth too), its far end drawn out and tapered to a point. Its front face carries the main gradient (blue: navy, royal blue, violet, magenta, red-orange; orange: plum, crimson,
   gold, orange), its back face the fold colours (lavender; plum to orange), so the folds show exactly where the rod turns. The heads are spheres with their own gradients.
   buildEmblem(THREE, opts) -> a Group 'Emblem' of four meshes (vertex colours), centred, y up, about 42 cm tall. The parts are plain meshes: every brush works on them, Make clay turns one into clay. */
import { rodGeometryGen, colourAt } from './sculpt_next_rod.js';

/* traced from the picture (1250 x 1250, y down): path [x, y, depth toward you] in picture pixels */
export const EMBLEM = {
  parts: [
    { name: 'Blue figure', kind: 'rod', wide: 185, thick: 100,
      pts: [[585, 1222, -10], [452, 1114, -40], [322, 968, -66], [244, 808, -58], [252, 650, -12], [334, 530, 36], [458, 446, 54], [590, 372, 46], [712, 288, 24], [806, 186, 8], [886, 70, 0]],
      twist: [[0, 180], [0.18, 175], [0.55, 0], [0.8, -10], [1, -30]], taper: [[0, 0.02], [0.07, 0.42], [0.2, 0.92], [0.34, 1], [0.5, 0.86], [0.64, 0.68], [0.8, 0.42], [0.93, 0.16], [1, 0.01]],
      taperThick: [[0, 0.05], [0.1, 0.6], [0.25, 1], [0.6, 0.85], [0.85, 0.5], [1, 0.08]], stretch: 0.06,
      front: [[0, '#140b78'], [0.25, '#170d8c'], [0.45, '#2a1fd4'], [0.6, '#4a2cff'], [0.72, '#6a28f2'], [0.82, '#9620c8'], [0.9, '#cf2a8c'], [1, '#ff4a2a']],
      back: [[0, '#2a18e0'], [0.18, '#5a46ff'], [0.34, '#8b7cff'], [0.5, '#5a46ff'], [1, '#3a22e8']] },
    { name: 'Blue head', kind: 'ball', z: 30, c: [565, 237], r: 80, stops: [[0, '#21149a'], [0.5, '#4a2cff'], [1, '#8a3cff']], dir: [0.7, 0.7] },
    { name: 'Orange figure', kind: 'rod', wide: 215, thick: 110,
      pts: [[598, 470, 0], [700, 514, 18], [818, 584, 40], [910, 680, 44], [936, 784, 18], [888, 894, -28], [790, 984, -54], [700, 1080, -44], [664, 1170, -14], [666, 1232, 0]],
      twist: [[0, 10], [0.42, 0], [0.78, 180], [1, 200]], taper: [[0, 0.02], [0.1, 0.4], [0.28, 0.9], [0.44, 1], [0.6, 0.86], [0.78, 0.52], [0.92, 0.2], [1, 0.01]],
      taperThick: [[0, 0.06], [0.15, 0.7], [0.35, 1], [0.7, 0.8], [0.9, 0.4], [1, 0.08]], stretch: 0.05,
      front: [[0, '#3a0a5a'], [0.12, '#6a1060'], [0.25, '#c03848'], [0.38, '#ff8a1e'], [0.5, '#ffab14'], [0.62, '#ff7a1e'], [0.8, '#ff5424'], [1, '#ff9a12']],
      back: [[0, '#2a0650'], [0.5, '#2a0650'], [0.66, '#5a0a66'], [0.8, '#a03050'], [0.92, '#ff7a20'], [1, '#ffa018']] },
    { name: 'Orange head', kind: 'ball', z: 30, c: [872, 460], r: 75, stops: [[0, '#ff2424'], [0.5, '#ff5a20'], [1, '#ffb41a']], dir: [0.7, 0.7] },
  ],
};
export function buildEmblem(THREE, opts) { const it = buildEmblemGen(THREE, opts); let r; do r = it.next(); while (!r.done); return r.value; }
/* the same, a slice at a time (the engine runs it in its job queue, so the emblem appears over a few frames and no frame is held up). Parts are added to grp (or a new group) as they are done. */
export function* buildEmblemGen(THREE, opts, grp) {
  opts = opts || {}; const height = opts.height || 0.42, s = height / 1180; grp = grp || new THREE.Group(); grp.name = opts.name || 'Emblem';
  const lin = parseInt(THREE.REVISION, 10) >= 152 && !(THREE.ColorManagement && THREE.ColorManagement.enabled === false), toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness == null ? 0.34 : opts.roughness, metalness: 0.04 });
  for (const part of EMBLEM.parts) {
    let geo;
    if (part.kind === 'rod') {
      const path = part.pts.map(p => [(p[0] - 625) * s, (640 - p[1]) * s, p[2] * s]);
      geo = yield* rodGeometryGen(THREE, path, { width: part.wide * s, thick: part.thick * s, twist: part.twist, taper: part.taper, taperThick: part.taperThick, stretch: part.stretch, front: part.front, back: part.back, slices: opts.slices || 320, around: 48 });
    } else {
      const r = part.r * s; geo = new THREE.SphereGeometry(r, 48, 32); const P = geo.attributes.position, col = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) { const t = 0.5 + 0.5 * ((P.getX(i) * part.dir[0] + P.getY(i) * part.dir[1]) / r), c = colourAt(part.stops, t); for (let q = 0; q < 3; q++) col[i * 3 + q] = lin ? toLin(c[q]) : c[q]; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.translate((part.c[0] - 625) * s, (640 - part.c[1]) * s, (part.z || 0) * s);
    }
    const m = new THREE.Mesh(geo, mat()); m.name = part.name; grp.add(m); m.updateMatrixWorld(true); yield;
  }
  return grp;
}
