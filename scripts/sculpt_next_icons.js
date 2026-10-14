/* sculpt_next_icons.js: the picture tiles, redrawn BOLD (Ruth 2026-10-14: "the icons are way too small to read, this icon design is HORRIBLE").
   Each icon is one or two big filled shapes in the Atelier's colours, with a dark edge so it reads on the dark tile and on the amber "on" tile alike, and no fine detail that vanishes at arm's length.
   24 x 24 drawing units; every element carries its own fill and stroke, so the page's tile drawer (vr_core.js iconFor, which sets a thin outline by default) shows them exactly as drawn. */
const C = '#f3eee2', A = '#e8a866', O = '#ff9a4a', T = '#e0786a', L = '#b48cff', B = '#7fb2ff', G = '#7fd6a0', Y = '#ffd36a', P = '#ff7ab0', D = '#1a1424', W = '#ffffff';
const st = (f, s, w) => `fill="${f || 'none'}" stroke="${s || 'none'}" stroke-width="${w == null ? 1.4 : w}" stroke-linecap="round" stroke-linejoin="round"`;
const c = (x, y, r, f, s, w) => `<circle cx="${x}" cy="${y}" r="${r}" ${st(f, s == null ? D : s, w)}/>`;
const rect = (x, y, w, h, rx, f, s, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${st(f, s == null ? D : s, sw)}/>`;
const p = (d, f, s, w) => `<path d="${d}" ${st(f, s == null ? D : s, w)}/>`;
const ln = (d, s, w) => `<path d="${d}" ${st('none', s, w == null ? 2.6 : w)}/>`;
const shine = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${W}" fill-opacity="0.55" stroke="none"/>`;
const blob = (f) => p('M4 15c0-5 4-9 8.5-9S20 9 20 13.5 17 20 12 20 4 19 4 15z', f);
const arrow = (d, s) => ln(d, s || C, 2.6);

export const BOLD = {
  /* brushes */
  clayIc: blob(T) + shine(9, 10, 2.6, 1.6),
  smoothIc: p('M3 17h18v4H3z', B) + ln('M3 13c2-3 3 3 5 0s3 3 5 0', C, 2.4) + ln('M14 13h7', C, 2.4),
  flattenIc: p('M4 20c0-6 3.5-9 8-9s8 3 8 9z', A) + rect(3, 6, 18, 3.6, 1.6, C),
  pinchIc: p('M3 20c1-7 4-10 7-10l2 6 2-6c3 0 6 3 7 10z', T) + ln('M10 10l2 6 2-6', C, 1.8),
  inflateIc: c(12, 13, 6.5, A) + shine(9.8, 10.8, 2, 1.3) + arrow('M12 2.5v2.5M21.5 13H19M2.5 13H5'),
  grabIc: p('M3 20c1-5 4-7 7-7 2 0 2-6 5-8 2 0 1.5 4 0 7 2 1 6 3 6 8z', L) + arrow('M14 3l3-1 1 3'),
  scrapeIc: p('M3 20c1-5 4-7 9-7s8 2 9 7z', T) + p('M5 9l12-5 2 4-12 5z', C),
  smearIc: p('M3 18c4-6 9-7 18-8v4c-8 1-12 3-15 7z', A) + c(19, 12, 3, P),
  dotsIc: c(5, 13, 3, Y) + c(12, 13, 3, Y) + c(19, 13, 3, Y),
  /* mode on every brush */
  opAddIc: c(12, 12, 9, G) + ln('M12 7v10M7 12h10', D, 3),
  opSubIc: c(12, 12, 9, T) + ln('M7 12h10', D, 3),
  opPaintIc: p('M4 20c0-3 2-4 4-4l2 2c0 2-2 3-6 2z', P) + p('M9 16l9-11 2 2-9 11z', A),
  opIntersectIc: c(9, 12, 6.5, 'none', C, 2) + c(15, 12, 6.5, 'none', C, 2) + p('M12 6.8a6.5 6.5 0 0 1 0 10.4a6.5 6.5 0 0 1 0-10.4z', L),
  /* brush settings (our own, so they match) */
  nxSize: c(7, 15, 3, C) + c(15.5, 11, 6.5, A) + shine(13.5, 8.8, 2, 1.2),
  nxStrength: rect(3, 14, 4, 7, 1, Y) + rect(10, 10, 4, 11, 1, A) + rect(17, 5, 4, 16, 1, O),
  nxSymOff: c(12, 12, 6, A),
  nxSymMirror: c(7, 12, 4.5, A) + c(17, 12, 4.5, A) + ln('M12 3v18', C, 2),
  nxSymRound: c(12, 4.5, 2.6, A) + c(19.5, 12, 2.6, A) + c(12, 19.5, 2.6, A) + c(4.5, 12, 2.6, A) + c(12, 12, 2, C),
  nxSymBoth: c(12, 4.5, 2.4, A) + c(19.5, 12, 2.4, A) + c(12, 19.5, 2.4, A) + c(4.5, 12, 2.4, A) + ln('M12 2v20', C, 1.8),
  steadyIc: ln('M3 16c2-6 3 2 5-3', T, 2.4) + ln('M10 12h11', G, 3),
  falloffIc: c(12, 12, 9, 'rgba(232,168,102,0.35)') + c(12, 12, 5.5, 'rgba(232,168,102,0.75)', 'none') + c(12, 12, 2.6, A, 'none'),
  supportIc: p('M3 19c2-5 6-7 10-7s6 2 8 7z', B) + ln('M5 9c2-2 3 2 5 0s3 2 5 0 3 2 4 0', C, 2.2),
  nxUndo: p('M10 4L3 10l7 6v-4c5 0 8 2 10 6 0-6-4-10-10-10z', A),
  nxRedo: p('M14 4l7 6-7 6v-4c-5 0-8 2-10 6 0-6 4-10 10-10z', A),
  /* colour, gradients, skins, looks */
  tintIc: c(12, 12, 8, P) + shine(9.5, 9.5, 2.4, 1.5),
  wheelIc: p('M12 12V3a9 9 0 0 1 7.8 4.5z', '#ff5a5a', D, 1) + p('M12 12l7.8-4.5a9 9 0 0 1 0 9z', Y, D, 1) + p('M12 12l7.8 4.5A9 9 0 0 1 12 21z', G, D, 1) + p('M12 12v9a9 9 0 0 1-7.8-4.5z', B, D, 1) + p('M12 12l-7.8 4.5a9 9 0 0 1 0-9z', L, D, 1) + p('M12 12L4.2 7.5A9 9 0 0 1 12 3z', P, D, 1) + c(12, 12, 2.4, C),
  gradientIc: rect(2.5, 7, 6.5, 10, 1, '#4a2cff') + rect(9, 7, 6.5, 10, 0, '#cf2a8c', D, 0) + rect(15, 7, 6.5, 10, 1, '#ff9a12') + rect(2.5, 7, 19, 10, 2, 'none', D, 1.6),
  skinIc: c(12, 12, 9, '#d8d0e6') + ln('M5 8c4 1 5 5 9 4s4 4 6 5', '#6a5a80', 1.8) + ln('M4 14c3 0 4 3 7 3', '#6a5a80', 1.4),
  lookIc: c(12, 12, 8.5, L) + shine(9, 8.6, 3, 2) + c(15.5, 15.5, 1.2, W, 'none'),
  finishIc: c(12, 12, 8.5, A) + shine(9, 8.6, 3, 2),
  /* draw, shapes, pieces */
  rodIc: p('M3 19c3-2 4-6 7-8s6-3 8-7l3 2c-2 4-5 6-8 8s-4 6-7 8z', '#6a28f2') + p('M10 11c3-2 6-3 8-7l1.5 1c-2 4-5 5-8 7z', '#ff4a2a', 'none'),
  twistIc: p('M3 9c4-4 7 4 11 0s5-2 7-2v4c-2 0-3-2-7 2s-7-4-11 0z', A) + p('M3 15c4-4 7 4 11 0s5-2 7-2v4c-2 0-3-2-7 2s-7-4-11 0z', L),
  taperIc: p('M3 8h12l7 4-7 4H3z', A),
  ballIc: c(12, 12, 8.5, '#ff5a20') + p('M6 7.5a8.5 8.5 0 0 1 12 0', 'none', Y, 2.6) + shine(9, 9, 2.6, 1.6),
  joinIc: rect(2.5, 9, 9, 6, 2, A) + c(17, 12, 4.5, L) + ln('M11.5 12h1.5', C, 2.4),
  emblemIc: p('M4 20c2-6 5-9 9-11s6-4 8-7c-1 6-4 9-8 11s-6 4-9 7z', '#4a2cff') + c(10, 6, 2.6, '#4a2cff') + p('M13 13c3 1 6 3 6 7-2 1-4 0-6-2z', O) + c(17, 10, 2.2, '#ff5a20'),
  spinIc: p('M12 4a8 8 0 1 1-7.6 5.5', 'none', A, 3) + p('M2 6l3 5 4-3z', A),
  shapesIc: p('M3 9l6-3 6 3v7l-6 3-6-3z', B) + p('M3 9l6 3 6-3M9 12v7', 'none', D, 1.2) + c(17.5, 15.5, 4.5, A),
  placeShapeIc: p('M5 8l7-4 7 4v8l-7 4-7-4z', B) + c(12, 4, 2, O) + c(19, 12, 2, O) + c(5, 12, 2, O) + c(12, 20, 2, O),
  primSphere: c(12, 12, 8.5, B) + shine(9, 9, 2.8, 1.8),
  primCube: p('M4 8l8-4 8 4v9l-8 4-8-4z', B) + p('M4 8l8 4 8-4M12 12v9', 'none', D, 1.4) + p('M4 8l8-4 8 4-8 4z', '#a6c8ff', 'none'),
  primCylinder: p('M5 6v12c0 2 3 3 7 3s7-1 7-3V6', B) + `<ellipse cx="12" cy="6" rx="7" ry="2.6" ${st('#a6c8ff', D, 1.4)}/>`,
  primCone: p('M12 3l7.5 15c0 2-3.5 3-7.5 3s-7.5-1-7.5-3z', B),
  primTorus: `<ellipse cx="12" cy="12" rx="9" ry="6" ${st(B, D, 1.4)}/><ellipse cx="12" cy="11.5" rx="4" ry="2" ${st('#2a2036', D, 1.4)}/>`,
  primCapsule: rect(7, 3, 10, 18, 5, B) + shine(10, 7, 1.6, 2.4),
  applyShapeIc: c(12, 12, 9, G) + ln('M7.5 12.5l3 3 6-6.5', D, 3),
  dropShapeIc: c(12, 12, 9, T) + ln('M8 8l8 8M16 8l-8 8', D, 3),
  blendIc: c(8.5, 12, 5.5, A) + c(15.5, 12, 5.5, L) + p('M12 8.2a5.5 5.5 0 0 1 0 7.6a5.5 5.5 0 0 1 0-7.6z', P, 'none'),
  makeClayIc: rect(2.5, 8, 7, 7, 1.4, B) + arrow('M11 11.5h3l-1.5-1.5M14 11.5l-1.5 1.5') + p('M15 14c0-3 1.6-5 3.6-5S22 11 22 13.6 20.6 18 18.3 18 15 17 15 14z', T),
  holdIc: c(12, 14, 5.5, A) + rect(5, 4, 3, 8, 1.5, A) + rect(9.2, 2.5, 3, 9, 1.5, A) + rect(13.4, 3, 3, 9, 1.5, A) + rect(17.4, 6, 3, 8, 1.5, A),
  clayFigIc: c(8, 5.5, 2.8, C) + p('M4 21c0-6 1.6-10 4-10s4 4 4 10z', C) + p('M13 16c0-3 2-5 4.5-5S22 13 22 16s-2 5-4.5 5S13 19 13 16z', T),
  /* layers */
  layersIc: p('M12 3l9 4.5-9 4.5-9-4.5z', L) + p('M3 12l9 4.5 9-4.5', 'none', B, 2.6) + p('M3 16.5l9 4.5 9-4.5', 'none', A, 2.6),
  layerPickIc: p('M12 4l9 4.5-9 4.5-9-4.5z', L) + ln('M7 17l3 3 7-7', G, 3),
  layerAddIc: p('M10 4l8 4-8 4-8-4z', L) + c(18, 17, 5, G) + ln('M18 14v6M15 17h6', D, 2.2),
  dupIc: rect(3, 3, 12, 12, 2, B) + rect(9, 9, 12, 12, 2, A),
  mergeIc: p('M12 2l7 3.5-7 3.5-7-3.5z', A) + arrow('M12 10v5M9.5 12.5L12 15l2.5-2.5') + p('M12 16l9 3-9 3-9-3z', L),
  groupIc: ln('M5 4H3v16h2M19 4h2v16h-2', C, 2.4) + c(9, 12, 3, A) + c(15, 12, 3, L),
  ungroupIc: ln('M5 4H3v6M3 14v6h2M19 4h2v6M21 14v6h-2', C, 2.2) + c(8, 12, 3, A) + c(16, 12, 3, L),
  mergeGroupIc: c(8, 9, 4, A) + c(16, 9, 4, L) + arrow('M12 14v3') + c(12, 19.5, 3, P),
  trashIc: rect(5, 7, 14, 14, 2, T) + rect(3, 4, 18, 3, 1.2, C) + rect(9.5, 2, 5, 2.5, 1, C) + ln('M10 11v6M14 11v6', D, 1.8),
  detailIc: rect(3, 3, 18, 18, 2, '#2a2036', C, 1.8) + ln('M9 3v18M15 3v18M3 9h18M3 15h18', C, 1.2),
  remeshIc: rect(3, 3, 12, 12, 1.6, '#2a2036', C, 1.6) + ln('M7 3v12M11 3v12M3 7h12M3 11h12', C, 1) + arrow('M16 16l5 5M21 17v4h-4'),
  budgetIc: p('M12 3l9 16H3z', Y) + p('M12 9l4 7H8z', D, 'none'),
  keepIc: rect(3, 5, 18, 15, 2.4, A) + rect(3, 5, 18, 5, 2, O) + rect(9, 7, 6, 1.6, 0.8, D, 'none'),
  saveIc: rect(3, 3, 18, 18, 2.4, B) + rect(7, 3, 10, 6, 1, C) + rect(7, 13, 10, 7, 1, C),
  /* the story bench, expressions */
  assetIc: rect(4, 7, 16, 13, 2, A) + p('M12 2l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 10.2 8.8 11.9l.6-3.6-2.6-2.5 3.6-.5z', Y),
  backFigureIc: c(14, 5, 3, C) + p('M10 21c0-6 1.8-11 4-11s4 5 4 11z', C) + arrow('M9 13H3M5.5 10.5L3 13l2.5 2.5'),
  motionIc: c(12, 12, 9, Y) + c(9, 10, 1.4, D, 'none') + c(15, 10, 1.4, D, 'none') + ln('M8 14c2 3 6 3 8 0', D, 2),
  pulseIc: ln('M2 13h5l2-6 3 12 3-9 2 3h5', P, 2.8),
  pulseSpeedIc: c(12, 13.5, 8, C) + ln('M12 13.5V9M12 13.5l3 2', D, 2.2) + rect(10, 2, 4, 3, 1, A),
  repeatIc: p('M5 11a7 7 0 0 1 12-4', 'none', A, 3) + p('M19 13a7 7 0 0 1-12 4', 'none', A, 3) + p('M15 3l3 4-5 1z', A) + p('M9 21l-3-4 5-1z', A),
  recordFaceIc: c(12, 12, 9, '#2a2036', C, 1.8) + c(12, 12, 5.5, '#ff4a4a', 'none'),
  playMoveIc: p('M7 4l13 8-13 8z', G),
  /* together, controls */
  togetherIc: c(8, 7, 3.6, B) + p('M2 21c0-5 2.6-8 6-8s6 3 6 8z', B) + c(16.5, 8, 3.2, O) + p('M11 21c.5-4 2.8-7 5.5-7S22 17 22 21z', O),
  controllerIc: p('M6 7h12c3 0 4.5 3 4.5 6s-1.5 5-3.5 5c-2 0-3-2-4-3H9c-1 1-2 3-4 3s-3.5-2-3.5-5S3 7 6 7z', C) + c(16.5, 11, 1.6, T, 'none') + c(18.5, 13.5, 1.6, B, 'none') + ln('M7 10.5v4M5 12.5h4', D, 2),
  sculptNextIc: blob(T) + p('M18 2l1.2 2.8L22 6l-2.8 1.2L18 10l-1.2-2.8L14 6l2.8-1.2z', Y),
  cutIc: p('M3 19c0-5 3-8 9-8s9 3 9 8z', T) + ln('M2 14h20', Y, 2.4) + p('M14 3l6 6-3 1-4-4z', C) + ln('M13 6l-2 6', C, 1.6),
  carveIc: p('M3 20V12c3 0 4 4 9 4s6-4 9-4v8z', T) + p('M12 3l3 3-3 5-3-5z', C) + ln('M12 11v2', C, 1.6),
  nxEye: p('M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7S5 17 2 12z', C) + c(12, 12, 3.6, B) + c(12, 12, 1.4, D, 'none'),
  nxLock: rect(4, 10, 16, 11, 2.4, A) + p('M8 10V7a4 4 0 0 1 8 0v3', 'none', C, 2.6) + c(12, 15.5, 1.6, D, 'none'),
  nxBack: p('M11 4L3 12l8 8v-5h10V9H11z', C),
};
/* our own names where the page already has an icon of that name (the page's own wins there, and stays as it is on its own pages) */
/* the Palette (a panel with tiles) and the button labels (a controller with a word chip) */
BOLD.paletteIc = rect(2.5, 4, 19, 15, 3, '#3a2d4d', C, 1.6) + rect(5, 7, 4, 4, 1, A, D, 1) + rect(10, 7, 4, 4, 1, L, D, 1) + rect(15, 7, 4, 4, 1, G, D, 1) + rect(5, 13, 14, 3, 1.5, B, D, 1);
BOLD.labelsIc = p('M4 14c0-3 2-5 5-5s5 2 5 5-1 6-5 6-5-3-5-6z', '#3a2d4d', C, 1.6) + c(9, 13, 1.6, Y, D, 1) + rect(13, 3, 9, 5.5, 2.5, A, D, 1.2) + ln('M14 8.5l-3 3', C, 1.4);
Object.assign(BOLD, { nxSmooth: BOLD.smoothIc, nxInflate: BOLD.inflateIc, nxGrab: BOLD.grabIc, nxCut: BOLD.cutIc, nxCarve: BOLD.carveIc });
