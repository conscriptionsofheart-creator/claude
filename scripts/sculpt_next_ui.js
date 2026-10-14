/* sculpt_next_ui.js: the next engine's wrist-menu pages, in the Atelier's own look (the page draws them: picture tiles from vr_core.js's ICONS, the same row objects { label, ic, on, act } as its own
   Sculpt pages), the new picture-tile icons (24 x 24 line drawings in the same style as vr_core.js's, merged into ICONS by the page; a name that already exists there is left alone), and one lesson step
   per tool (Ruth: "every visible tool gets a one-step lesson"). Nothing here flashes or moves by itself.
   Pages: 10 CLAY (the brushes and their settings), 11 SHAPES (primitives, gizmo, booleans, Make clay, Hold), 12 LAYERS (layer list, groups, merge, remesh, save), 13 EXPRESSIONS (shape keys that move). */
export const ICONS = {
  clayIc: '<path d="M4 17c2-6 5-9 8-9s5 2 5 5-2 5-5 5H6"/><path d="M14 6c1-2 3-3 5-2"/>',
  flattenIc: '<path d="M3 15h18"/><path d="M5 11c2-3 4-3 7-3s5 0 7 3"/><path d="M12 4v4M10 6l2 2 2-2"/>',
  pinchIc: '<path d="M3 9c4 0 6 2 9 8 3-6 5-8 9-8"/><path d="M6 5l3 3M18 5l-3 3"/>',
  scrapeIc: '<path d="M3 16c3-4 6-6 9-6s6 2 9 6"/><path d="M8 4l8 8"/><path d="M14 4h4v4"/>',
  smearIc: '<path d="M3 15c3 0 4-3 7-3s5 3 11 3"/><path d="M3 19h6M12 19h9"/><path d="M15 6l3 3-3 3"/>',
  dotsIc: '<circle cx="5" cy="15" r="2.2"/><circle cx="12" cy="11" r="2.2"/><circle cx="19" cy="7" r="2.2"/><path d="M3 19c6-2 12-7 18-14" stroke-dasharray="1.5 3"/>',
  opAddIc: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  opSubIc: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
  opPaintIc: '<path d="M4 20c0-3 2-4 4-4s3 1 3 3-2 3-4 3"/><path d="M10 15 19 4l2 2-9 11"/>',
  opIntersectIc: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 7.2c1.6 1.2 1.6 8.4 0 9.6" stroke-width="3"/>',
  tintIc: '<path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
  symBoth: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M12 3v18" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/>',
  steadyIc: '<path d="M3 14c2-3 3 2 5-1s3 1 4 0"/><path d="M12 13c3 0 6-2 9-2"/><circle cx="12" cy="13" r="1.4"/>',
  falloffIc: '<path d="M3 18c3 0 4-12 9-12s6 12 9 12"/><path d="M3 21h18"/>',
  shapesIc: '<circle cx="7" cy="8" r="4"/><rect x="13" y="4" width="8" height="8" rx="1"/><path d="M5 20l4-7 4 7z"/><ellipse cx="17.5" cy="17.5" rx="3.5" ry="2.5"/>',
  layersIc: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
  primSphere: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3"/>',
  primCube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  primCylinder: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>',
  primCone: '<path d="M12 3 5 18"/><path d="M12 3l7 15"/><ellipse cx="12" cy="18" rx="7" ry="2.5"/>',
  primTorus: '<ellipse cx="12" cy="12" rx="9" ry="5"/><ellipse cx="12" cy="11.5" rx="3.5" ry="1.6"/>',
  primCapsule: '<rect x="8" y="3" width="8" height="18" rx="4"/>',
  placeShapeIc: '<circle cx="12" cy="12" r="6" stroke-dasharray="2 2.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  applyShapeIc: '<circle cx="12" cy="12" r="8"/><path d="M8 12.5l3 3 5-6"/>',
  dropShapeIc: '<circle cx="12" cy="12" r="8" stroke-dasharray="2 2.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  blendIc: '<path d="M3 16c4 0 5-8 9-8s5 8 9 8"/><path d="M3 16h18" stroke-dasharray="2 2.5"/>',
  makeClayIc: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M8 13c2-2 6-2 8 0"/>',
  holdIc: '<path d="M6 13V8a1.5 1.5 0 0 1 3 0v4M9 11V6a1.5 1.5 0 0 1 3 0v5"/><path d="M15 13V8a1.5 1.5 0 0 1 3 0v6c0 3-2 5-4.5 5"/><path d="M4 21h16"/>',
  clayFigIc: '<circle cx="9" cy="5" r="2"/><path d="M9 7v7M5 10h8M9 14l-3 6M9 14l3 6"/><path d="M16 9c2-2 5-1 5 2s-3 3-5 2"/>',
  layerAddIc: '<path d="M10 4 3 8l7 4 7-4z"/><path d="M3 12l7 4 4-2.3"/><path d="M19 13v6M16 16h6"/>',
  dupIc: '<rect x="4" y="4" width="11" height="11" rx="2"/><rect x="9" y="9" width="11" height="11" rx="2"/>',
  mergeIc: '<path d="M6 4v5c0 3 6 4 6 8v3"/><path d="M18 4v5c0 3-6 4-6 8"/><path d="M9 18l3 3 3-3"/>',
  groupIc: '<rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 2.5"/><rect x="6.5" y="6.5" width="5" height="5" rx="1"/><rect x="12.5" y="12.5" width="5" height="5" rx="1"/>',
  ungroupIc: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M14 4l6 6M20 4l-6 6" />',
  mergeGroupIc: '<rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 2.5"/><path d="M8 8c2 3 6 3 8 0M12 10v8M9 15l3 3 3-3"/>',
  trashIc: '<path d="M4 7h16M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  remeshIc: '<path d="M4 4h16v16H4z"/><path d="M4 12h16M12 4v16M4 8h16M4 16h16M8 4v16M16 4v16" stroke-width="0.8"/>',
  detailIc: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20"/><path d="M8 10h4M10 8v4"/>',
  budgetIc: '<path d="M4 18 12 5l8 13z"/><path d="M8 12h8" stroke-dasharray="2 2"/>',
  layerPickIc: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5" stroke-dasharray="2 2.5"/>',
  assetIc: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12v9M12 12l8-4.5M12 12 4 7.5"/><path d="M17 3v4M15 5h4"/>',
  backFigureIc: '<circle cx="12" cy="5" r="2"/><path d="M12 7v7M7 10h10M12 14l-3 6M12 14l3 6"/><path d="M3 12l2-2M3 12l2 2"/>',
  finishIc: '<circle cx="12" cy="12" r="8"/><path d="M8 9a4.5 4.5 0 0 1 4-2.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/>',
  supportIc: '<path d="M5 14V9a1.5 1.5 0 0 1 3 0v4"/><path d="M19 14V9a1.5 1.5 0 0 0-3 0v4"/><path d="M8 13c0 4 1.5 6 4 6s4-2 4-6"/><path d="M9 4c2-1.5 4-1.5 6 0"/>',
  motionIc: '<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01"/><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M19 4l2-1M20 7h2"/>',
  pulseIc: '<path d="M3 12h4l2-5 3 10 2-5h7"/>',
  pulseSpeedIc: '<circle cx="12" cy="13" r="7"/><path d="M12 13l3-3M12 3v3"/>',
  repeatIc: '<path d="M4 10a6 6 0 0 1 11-3l2 2"/><path d="M17 5v4h-4"/><path d="M20 14a6 6 0 0 1-11 3l-2-2"/><path d="M7 19v-4h4"/>',
  recordFaceIc: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  playMoveIc: '<circle cx="12" cy="12" r="8"/><path d="M10 8.5v7l5.5-3.5z"/>',
  emblemIc: '<circle cx="10" cy="5" r="2.2"/><path d="M5 20c-3-5 0-10 6-12 3-1 6-3 8-6"/><circle cx="17" cy="10" r="1.8"/><path d="M12 11c4 0 7 2 7 5s-4 4-6 7"/>',
  spinIc: '<ellipse cx="12" cy="17" rx="8" ry="3"/><path d="M12 3v11"/><path d="M17 15.5l2.5 1.5-2.5 1.5"/>',
  rodIc: '<path d="M4 19c3-1 4-4 6-7s5-6 10-7"/><path d="M6 21c3-1 4-4 6-7s5-6 10-7" opacity=".6"/><path d="M9 10l2 2M13 7l2 2"/>',
  twistIc: '<path d="M6 4c6 3 6 13 12 16"/><path d="M18 4c-6 3-6 13-12 16"/>',
  taperIc: '<path d="M3 9h10l8 3-8 3H3z"/>',
  sculptNextIc: '<path d="M4 15c0-5 4-9 9-9 4 0 7 3 7 6 0 4-3 6-7 6-3 0-4 1-6 1-2 0-3-2-3-4z"/><path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
};

const OP_IC = { add: 'opAddIc', subtract: 'opSubIc', paint: 'opPaintIc', intersect: 'opIntersectIc' };
const OP_WORD = { add: 'add', subtract: 'subtract', paint: 'paint', intersect: 'intersect' };
const SYM_IC = { off: 'symOff', mirror: 'symMirror', radial: 'symRound', both: 'symBoth' }, SYM_WORD = { off: 'off', mirror: 'mirror', radial: '360', both: 'mirror + 360' };
const PRIM_IC = { sphere: 'primSphere', cube: 'primCube', cylinder: 'primCylinder', cone: 'primCone', torus: 'primTorus', capsule: 'primCapsule' };
const COLOR_WORD = ['clay', 'terracotta', 'sky', 'leaf', 'sun', 'lilac', 'bone', 'slate'];
const BRUSH = {   /* mode -> [tile label, icon, what the voice says when you pick it] */
  clay: ['Clay', 'clayIc', 'Clay: pinch and draw, in the air or on clay; a tube of clay follows your fingertip. On a figure it builds up the skin.'],
  smooth: ['Smooth', 'smoothIc', 'Smooth: pinch and rub; bumps and lumps even out.'],
  flatten: ['Flatten', 'flattenIc', 'Flatten: pinch and slide; the surface settles to a flat plane.'],
  pinch: ['Pinch', 'pinchIc', 'Pinch: draw a line; it tightens into a crease (subtract) or a sharp ridge (add).'],
  inflate: ['Inflate', 'inflateIc', 'Inflate: pinch and hold; the surface swells out (subtract shrinks it).'],
  grab: ['Grab', 'grabIc', 'Grab: pinch and pull; a soft region comes with your hand.'],
  scrape: ['Scrape', 'scrapeIc', 'Scrape: pinch and drag; high spots are shaved down flat.'],
  smear: ['Smear', 'smearIc', 'Smear: pinch and drag along the surface; the clay is pushed along with your finger.'],
  dots: ['Dots', 'dotsIc', 'Dots: draw a line; a stamp is pressed in every so often along it.'],
};
const DOT_WORD = { ball: 'balls', ring: 'rings', cube: 'cubes', spike: 'spikes' };

export function makeMenu(vs, env) {
  const say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const c = vs.cfg, cyc = (list, v) => list[(list.indexOf(v) + 1) % list.length], spinTarget = () => { const A = vs.assets(); return A.length ? A[A.length - 1].object : vs.clay.active ? vs.clay.active.work.group : null; };
  const brush = m => ({ label: BRUSH[m][0], ic: BRUSH[m][1], on: () => c.mode === m, act: ui => { vs.set.mode(m); say(BRUSH[m][2]); ui.draw(); } });
  const opTile = () => ({ label: 'Mode: ' + OP_WORD[c.op], ic: OP_IC[c.op], on: () => c.op !== 'add', act: ui => { vs.set.op(cyc(['add', 'subtract', 'paint', 'intersect'], c.op)); say(({ add: 'Add: brushes and shapes build clay up.', subtract: 'Subtract: brushes and shapes take clay away.', paint: 'Paint: brushes and shapes only colour what they touch, in the Colour tile\'s colour.', intersect: 'Intersect: only what a Clay stroke, Dots or a shape covers is kept.' })[c.op]); ui.draw(); } });
  const pages = {
    10: { title: 'CLAY', rows: ui => [
      brush('clay'), brush('smooth'), brush('flatten'), brush('pinch'), brush('inflate'), brush('grab'), brush('scrape'), brush('smear'), brush('dots'),
      opTile(),
      { label: 'Finish: ' + c.finish, ic: 'finishIc', act: () => { vs.set.finish(cyc(['matte', 'satin', 'gloss', 'metal', 'glow'], c.finish)); if (!vs.clay.active) say('Clay will be ' + c.finish + '. Make some clay, then pick it to change its finish.'); ui.draw(); } },
      { label: 'Colour: ' + COLOR_WORD[c.tint % COLOR_WORD.length], ic: 'tintIc', act: () => { vs.set.tint(c.tint + 1); say('New clay and paint come out ' + COLOR_WORD[c.tint % COLOR_WORD.length] + '.'); ui.draw(); } },
      { label: 'Size ' + c.size + ' cm', ic: 'brushSize', act: () => { const L = [0.5, 1, 2, 3, 5, 8, 12, 18], n = L.find(x => x > c.size + 1e-6); vs.set.size(n || L[0]); say('Brush size ' + c.size + ' cm. The brush-hand stick also changes it.'); ui.draw(); } },
      { label: 'Strength ' + c.strength + '%', ic: 'strengthBars', act: () => { const L = [10, 25, 50, 75, 100], n = L.find(x => x > c.strength); vs.set.strength(n || L[0]); say('Strength ' + c.strength + '%'); ui.draw(); } },
      { label: 'Symmetry: ' + SYM_WORD[c.sym], ic: SYM_IC[c.sym], on: () => c.sym !== 'off', act: () => { vs.set.sym(cyc(['off', 'mirror', 'radial', 'both'], c.sym)); say(({ off: 'One mark only.', mirror: 'Mirror: every stroke is copied across the middle of the work (on a figure: a left key and a right key).', radial: '360: every stroke is repeated ' + c.count + ' times round the work (on a figure: round the nearest bone).', both: 'Mirror and 360 together.' })[c.sym]); ui.draw(); } },
      { label: 'Steady: ' + (c.stabilize <= 0 ? 'off' : c.stabilize < 0.5 ? 'some' : 'lots'), ic: 'steadyIc', on: () => c.stabilize > 0, act: () => { vs.set.stabilize(c.stabilize <= 0 ? 0.3 : c.stabilize < 0.5 ? 0.8 : 0); say(c.stabilize <= 0 ? 'Steady off: the brush is exactly at your fingertip.' : 'Steady ' + (c.stabilize < 0.5 ? 'some' : 'lots') + ': the brush trails your fingertip on a short string, so a shaky hand draws a clean line.'); ui.draw(); } },
      { label: 'Edge: ' + c.falloff, ic: 'falloffIc', act: () => { vs.set.falloff(cyc(['smooth', 'linear', 'sharp', 'flat'], c.falloff)); say(({ smooth: 'Soft edge.', linear: 'Even edge, straight from the middle to the rim.', sharp: 'Sharp: strong in the middle, little at the rim.', flat: 'Flat: full strength almost to the rim.' })[c.falloff]); ui.draw(); } },
      ...(c.mode === 'clay' ? [{ label: 'Clay: ' + (c.clayProfile === 'flat' ? 'ribbon' : 'round'), ic: 'clayIc', act: () => { vs.set.clayProfile(c.clayProfile === 'flat' ? 'round' : 'flat'); say(c.clayProfile === 'flat' ? 'Clay comes out as a flat ribbon lying on the surface.' : 'Clay comes out as a round tube.'); ui.draw(); } }] : []),
      ...(c.mode === 'dots' ? [{ label: 'Dots: ' + DOT_WORD[c.dot], ic: 'dotsIc', act: () => { vs.set.dot(cyc(['ball', 'ring', 'cube', 'spike'], c.dot)); say('Dots presses ' + DOT_WORD[c.dot] + '.'); ui.draw(); } }] : []),
      { label: 'Undo stroke', ic: 'undoStroke', act: () => { if (!vs.undo()) say('Nothing to undo'); ui.draw(); } }, { label: 'Redo stroke', ic: 'redoStroke', act: () => { if (!vs.redo()) say('Nothing to redo'); ui.draw(); } },
      { label: 'Other hand smooths: ' + (c.supportSmooth ? 'on' : 'off'), ic: 'supportIc', on: () => c.supportSmooth, act: () => { vs.set.supportSmooth(!c.supportSmooth); say(c.supportSmooth ? 'While one hand sculpts, pinch with the other hand to smooth.' : 'Both hands sculpt with the picked brush.'); ui.draw(); } },
      { label: 'Rod', ic: 'rodIc', on: () => c.mode === 'rod', act: () => { vs.set.mode('rod'); say('Rod: pinch and draw a line; a solid rectangular rod follows it, twisted and tapered. Size sets how wide.'); ui.draw(); } },
      ...(c.mode === 'rod' ? [{ label: 'Twist: ' + c.rodTwist + '°', ic: 'twistIc', act: () => { const L = [0, 90, 180, 360, 540], n = L.find(x => x > c.rodTwist); vs.set.rodTwist(n == null ? 0 : n); say('The next rod twists ' + c.rodTwist + ' degrees from end to end.'); ui.draw(); } },
        { label: 'Rod end: ' + (c.rodEnd === 'taper' ? 'tapered' : 'blunt'), ic: 'taperIc', act: () => { vs.set.rodEnd(c.rodEnd === 'taper' ? 'blunt' : 'taper'); say(c.rodEnd === 'taper' ? 'The rod\'s end is drawn out and tapered to a point.' : 'The rod keeps its full size to a flat end.'); ui.draw(); } }] : []),
      { label: 'Make the emblem', ic: 'emblemIc', act: () => { vs.makeEmblem(); ui.draw(); } },
      { label: 'Spin: ' + (spinTarget() && vs.motion.spinning(spinTarget()) ? 'on' : 'off'), ic: 'spinIc', on: () => !!(spinTarget() && vs.motion.spinning(spinTarget())), act: () => { const L = vs.clay.active, A = vs.assets(), g = A.length ? A[A.length - 1].object : L ? L.work.group : null; if (!g) { say('Make some clay, a rod or the emblem first; Spin turns it slowly round.'); return; } const on = vs.motion.spinning(g); vs.spin(g, on ? 0 : 10); say(on ? 'Spin off: it eases to a stop.' : 'Spin on: one slow turn every 10 seconds. Save clay keeps the spin as an animation.'); ui.draw(); } },
      vs.assetBench ? { label: 'Back to the figure', ic: 'backFigureIc', act: () => { vs.endAsset(); ui.draw(); } } : { label: 'New asset', ic: 'assetIc', act: () => { vs.newAsset(); ui.draw(); } },
      { label: 'Shapes ▸', ic: 'shapesIc', act: () => ui.page(11) }, { label: 'Layers ▸', ic: 'layersIc', act: () => ui.page(12) }, { label: 'Expressions ▸', ic: 'motionIc', act: () => ui.page(13) },
      { label: 'Back to brushes', ic: 'undo', act: () => ui.page(0) },
    ] },
    11: { title: 'SHAPES', rows: ui => [
      { label: 'Place a shape', ic: 'placeShapeIc', on: () => c.mode === 'prim', act: () => { vs.set.mode('prim'); say('Shapes: pinch in the air and a ' + c.prim + ' sits at your fingertip. Pinch inside to move it, a knob to stretch, both hands to resize. Apply shape puts it in.'); ui.draw(); } },
      { label: 'Shape: ' + c.prim, ic: PRIM_IC[c.prim], act: () => { vs.set.prim(cyc(['sphere', 'cube', 'cylinder', 'cone', 'torus', 'capsule'], c.prim)); say('Shape: ' + c.prim + '.'); ui.draw(); } },
      opTile(),
      { label: 'Apply shape', ic: 'applyShapeIc', act: () => { if (!vs.shapes.live) { say('There is no shape to apply: Place a shape first.'); return; } vs.shapes.applyPending(true); ui.draw(); } },
      { label: 'Drop shape', ic: 'dropShapeIc', act: () => { if (!vs.shapes.live) { say('No shape to drop.'); return; } vs.shapes.drop(); say('The shape is gone; nothing was changed.'); ui.draw(); } },
      { label: 'Blend: ' + (c.blend <= 0 ? 'hard' : c.blend < 0.5 ? 'soft' : 'very soft'), ic: 'blendIc', act: () => { vs.set.blend(c.blend <= 0 ? 0.3 : c.blend < 0.5 ? 0.8 : 0); say(c.blend <= 0 ? 'Hard edge where new clay meets old.' : 'New clay melts into the old with a ' + (c.blend < 0.5 ? 'soft' : 'very soft') + ' fillet.'); ui.draw(); } },
      { label: 'Make clay', ic: 'makeClayIc', act: () => { const src = vs.pickedObject && vs.pickedObject(); if (!src) { say('Pick the object first (More > Pick stamp, tick it), then Make clay.'); return; } let m = null; src.traverse(o => { if (!m && o.isMesh && !o.isSkinnedMesh) m = o; }); if (!m) { say('That object has nothing that can become clay (figures cannot).'); return; } vs.makeClay(m); ui.draw(); } },
      { label: 'Hold', ic: 'holdIc', on: () => c.mode === 'hold', act: () => { vs.set.mode('hold'); say('Hold: pinch with one hand to move and turn the work; pinch with both hands to resize it and turn it.'); ui.draw(); } },
      { label: 'Hold: ' + (c.holdWhat === 'layer' ? 'picked layer' : 'whole work'), ic: 'holdIc', act: () => { vs.set.holdWhat(c.holdWhat === 'layer' ? 'work' : 'layer'); say(c.holdWhat === 'layer' ? 'Hold moves only the picked layer (and its group).' : 'Hold moves the whole work.'); ui.draw(); } },
      { label: 'Clay on figure: ' + (c.clayOnFigure === 'clay' ? 'new clay' : 'skin'), ic: 'clayFigIc', act: () => { vs.set.clayOnFigure(c.clayOnFigure === 'clay' ? 'skin' : 'clay'); say(c.clayOnFigure === 'clay' ? 'On a figure, Clay puts new clay on top of the skin (a separate piece).' : 'On a figure, Clay builds up the skin itself, in a shape key.'); ui.draw(); } },
      { label: 'Symmetry: ' + SYM_WORD[c.sym], ic: SYM_IC[c.sym], on: () => c.sym !== 'off', act: () => { vs.set.sym(cyc(['off', 'mirror', 'radial', 'both'], c.sym)); say('Symmetry ' + SYM_WORD[c.sym] + ': shapes get their copies too.'); ui.draw(); } },
      { label: 'Undo stroke', ic: 'undoStroke', act: () => { if (!vs.undo()) say('Nothing to undo'); ui.draw(); } },
      { label: 'Back to clay', ic: 'undo', act: () => ui.page(10) },
    ] },
    12: { title: 'LAYERS', rows: ui => {
      const C = vs.clay, list = C.allLayers().filter(C.live), act = C.active;
      const rows = list.slice(0, 8).map(L => ({ label: L.name.slice(0, 14) + (L === act ? ' ✓' : '') + (L.group.visible ? '' : ' (hidden)') + (L.locked ? ' (locked)' : '') + (L.groupId ? ' [' + L.groupId + ']' : ''), ic: 'layerPickIc', on: () => L === C.active, act: () => { C.pickLayer(L); ui.draw(); } }));
      if (list.length > 8) rows.push({ label: 'Next layer', ic: 'layerPickIc', act: () => { C.stepLayer(1); ui.draw(); } });
      return rows.concat([
        { label: 'New layer', ic: 'layerAddIc', act: () => { C.addLayer(); ui.draw(); } },
        { label: act && !act.group.visible ? 'Show layer' : 'Hide layer', ic: 'eye', act: () => { C.toggleHide(); ui.draw(); } },
        { label: act && act.locked ? 'Unlock layer' : 'Lock layer', ic: 'lock', act: () => { C.toggleLock(); ui.draw(); } },
        { label: 'Duplicate layer', ic: 'dupIc', act: () => { C.duplicate(); ui.draw(); } },
        { label: 'Merge down: ' + (c.op === 'subtract' ? 'cut out' : c.op === 'intersect' ? 'keep shared' : 'add'), ic: 'mergeIc', act: () => { C.mergeDown(c.op === 'subtract' || c.op === 'intersect' ? c.op : 'add', c.blend); ui.draw(); } },
        { label: 'Group with below', ic: 'groupIc', act: () => { C.groupWithBelow(); ui.draw(); } },
        { label: 'Ungroup', ic: 'ungroupIc', act: () => { C.ungroup(); ui.draw(); } },
        { label: 'Merge group', ic: 'mergeGroupIc', act: () => { C.mergeGroup(); ui.draw(); } },
        { label: 'Delete layer', ic: 'trashIc', act: () => { C.removeLayer(); ui.draw(); } },
        { label: 'Detail: ' + c.detail + ' mm', ic: 'detailIc', act: () => { vs.set.detail(c.detail <= 3 ? 5 : c.detail <= 5 ? 10 : 3); say('New layers and Remesh use ' + c.detail + ' mm detail' + (c.detail <= 3 ? ' (fine, heavier)' : c.detail >= 10 ? ' (rough, lightest)' : '') + '.'); ui.draw(); } },
        { label: 'Remesh layer', ic: 'remeshIc', act: () => { if (!C.active) { say('Pick a layer first.'); return; } C.remesh(c.detail / 1000); ui.draw(); } },
        { label: 'Budget: ' + (c.budget ? (c.budget / 1000) + 'k' : 'all'), ic: 'budgetIc', act: () => { const L = [0, 5000, 20000, 50000, 100000], n = L[(L.indexOf(c.budget) + 1) % L.length]; vs.set.budget(n); say(n ? 'Saved copies are thinned to ' + (n / 1000) + 'k triangles. The work in the room keeps every triangle, and people are never thinned.' : 'Saved copies keep every triangle.'); ui.draw(); } },
        { label: 'Save clay', ic: 'floppy', act: () => { const w = C.works.filter(x => x.group.parent && x.layers.length); if (!w.length) { say('There is no clay to save yet.'); return; } say('Saving to the library…'); vs.save((w[0].name || 'Clay') + ' sculpted', { roots: w.map(x => x.group) }).then(() => ui.draw(), e => say('Not saved: ' + (e && e.message || e))); } },
        { label: 'Undo stroke', ic: 'undoStroke', act: () => { if (!vs.undo()) say('Nothing to undo'); ui.draw(); } },
        { label: 'Back to clay', ic: 'undo', act: () => ui.page(10) },
      ]);
    } },
    13: { title: 'EXPRESSIONS', rows: ui => {
      const ks = vs.keys(), seen = new Set(), rows = [];
      ks.forEach(k => { if (seen.has(k.name)) return; seen.add(k.name); if (rows.length < 9) rows.push({ label: '▶ ' + k.name.slice(0, 16), ic: 'pulseIc', act: () => { vs.pulse(k.name); } }); });
      if (!rows.length) rows.push({ label: 'No shape keys yet', ic: 'pulseIc', act: () => say('Sculpt on a face first: every stroke makes a shape key, and each key can play as an expression here.') });
      const SP = { 0.3: 'quick', 0.6: 'normal', 1.5: 'slow' }, rec = vs.motion.recording;
      return rows.concat([
        { label: 'Pulse: ' + (SP[c.pulseDur] || c.pulseDur + ' s'), ic: 'pulseSpeedIc', act: () => { vs.set.pulseDur(c.pulseDur <= 0.3 ? 0.6 : c.pulseDur <= 0.6 ? 1.5 : 0.3); say(({ 0.3: 'Quick pulse (0.3 s): a micro-expression, a flicker of the brow.', 0.6: 'Normal pulse (0.6 s).', 1.5: 'Slow pulse (1.5 s): a smile that grows and fades.' })[c.pulseDur]); ui.draw(); } },
        { label: 'Plays: ' + (c.pulseRepeat === 1 ? 'once' : c.pulseRepeat + ' times'), ic: 'repeatIc', act: () => { vs.set.pulseRepeat(c.pulseRepeat === 1 ? 3 : 1); say(c.pulseRepeat === 1 ? 'Each tap plays the expression once.' : 'Each tap plays it three times, with a rest between (never faster than once a second).'); ui.draw(); } },
        rec ? { label: 'Stop recording', ic: 'recordFaceIc', on: () => true, act: () => { vs.stopMotion(); ui.draw(); } } : { label: 'Record face', ic: 'recordFaceIc', act: () => { vs.recordMotion(); ui.draw(); } },
        { label: 'Play the move', ic: 'playMoveIc', act: () => { if (!vs.playMotion()) say('Record a move first: Record face, play some expressions, Stop.'); } },
        { label: 'Back to clay', ic: 'undo', act: () => ui.page(10) },
      ]);
    } },
  };
  /* menu(pg, ui) -> rows for the page; ui = { draw(), page(n), say(t) } from the host. Each row's act gets ui, so the rows stay free of page globals. */
  function menu(pg, ui) { const p = pages[pg]; if (!p) return null; return p.rows(ui).map(r => Object.assign({}, r, { act: () => { try { r.act(ui); } catch (e) { say('Error: ' + (e && e.message || e)); } } })); }
  menu.title = pg => (pages[pg] ? pages[pg].title : null);
  menu.pages = Object.keys(pages).map(Number);
  /* the tile that opens the clay pages from the first Sculpt page */
  menu.entry = ui => ({ label: 'Clay & shapes ▸', ic: 'sculptNextIc', act: () => ui.page(10) });
  return menu;
}

/* one lesson step per tool (the page's lesson card shows the text and a "Show me" button for the tile). Written to you, Ruth. */
const L1 = (id, name, label, ic, text) => ({ id: 'sculptnext_' + id, name, steps: [{ text, tile: { label, ic } }] });
export const LESSONS = [
  L1('clay', 'Clay', 'Clay', 'clayIc', 'Pick Clay, then pinch your thumb and finger together in the air and draw: a tube of clay follows your fingertip. Let go to finish the stroke; Undo takes it back.'),
  L1('smooth', 'Smooth', 'Smooth', 'smoothIc', 'Pick Smooth, pinch on the clay or the skin and rub back and forth: the bumps even out. Hold longer for more.'),
  L1('flatten', 'Flatten', 'Flatten', 'flattenIc', 'Pick Flatten, pinch on a rounded spot and slide: it settles to the flat plane under your finger.'),
  L1('pinch', 'Pinch', 'Pinch', 'pinchIc', 'Pick Pinch, set Mode to subtract, then draw a line across the surface: it tightens into a crease. In add it makes a sharp ridge.'),
  L1('inflate', 'Inflate', 'Inflate', 'inflateIc', 'Pick Inflate, pinch on the surface and hold still: it swells out while you hold. Mode subtract shrinks it instead.'),
  L1('grab', 'Grab', 'Grab', 'grabIc', 'Pick Grab, pinch on the surface and pull your hand away: a soft region comes with you. The Edge tile sets how soft.'),
  L1('scrape', 'Scrape', 'Scrape', 'scrapeIc', 'Pick Scrape, pinch and drag across a bump: the high part is shaved off flat, the rest stays.'),
  L1('smear', 'Smear', 'Smear', 'smearIc', 'Pick Smear, pinch and drag along the surface: the clay is pushed along with your finger, like smudging.'),
  L1('dots', 'Dots', 'Dots', 'dotsIc', 'Pick Dots, then draw a line: a ball is pressed in every few centimetres. The Dots tile below switches to rings, cubes or spikes.'),
  L1('mode', 'Add, subtract, paint, intersect', 'Mode: add', 'opAddIc', 'Tap the Mode tile to step through add, subtract, paint and intersect. Every brush and every shape follows it: build up, carve away, only colour, or keep only what you cover.'),
  L1('colour', 'Colour', 'Colour: clay', 'tintIc', 'Tap Colour to choose the colour new clay and paint come out in. Then set Mode to paint and brush over clay to colour it.'),
  L1('symmetry', 'Mirror and 360', 'Symmetry: off', 'symOff', 'Tap Symmetry once for mirror, twice for 360, three times for both. Then make one stroke and watch the copies appear with it.'),
  L1('steady', 'Steady', 'Steady: some', 'steadyIc', 'Tap Steady for more or less steadiness. With it on, the brush ball trails your fingertip on a short string, so a shaky line comes out smooth.'),
  L1('edge', 'Edge', 'Edge: smooth', 'falloffIc', 'Tap Edge to choose how the brush fades from its middle to its rim: soft, even, sharp or flat.'),
  L1('shapes', 'Shapes', 'Place a shape', 'placeShapeIc', 'On the Shapes page tap Place a shape, then pinch in the air: a see-through ball sits at your finger. Pinch inside it to move it, then tap Apply shape.'),
  L1('shapekind', 'Shape kind', 'Shape: sphere', 'primSphere', 'Tap the Shape tile to switch between sphere, cube, cylinder, cone, torus and capsule before you place one.'),
  L1('gizmo', 'Stretch and resize a shape', 'Place a shape', 'placeShapeIc', 'With a shape placed, pinch one of its orange knobs and pull to stretch that side; pinch it with both hands and pull apart to make it bigger.'),
  L1('apply', 'Apply shape', 'Apply shape', 'applyShapeIc', 'Tap Apply shape: in add it becomes clay, in subtract it carves a hole in the clay or the piece under it, in intersect only what is inside it stays.'),
  L1('drop', 'Drop shape', 'Drop shape', 'dropShapeIc', 'Tap Drop shape to throw the placed shape away without changing anything.'),
  L1('blend', 'Blend', 'Blend: soft', 'blendIc', 'Tap Blend to choose how new clay and shapes meet the old: a hard edge or a soft fillet.'),
  L1('makeclay', 'Make clay', 'Make clay', 'makeClayIc', 'Pick an object with More > Pick stamp, then tap Make clay: it becomes clay, so every clay brush and boolean works on it. The original is hidden, not deleted.'),
  L1('hold', 'Hold', 'Hold', 'holdIc', 'Tap Hold, then pinch with both hands and pull them apart: the whole work grows. Turn your hands round each other to turn it.'),
  L1('holdwhat', 'Hold what', 'Hold: whole work', 'holdIc', 'Tap this to choose whether Hold moves the whole work or only the picked layer and its group.'),
  L1('clayfigure', 'Clay on a figure', 'Clay on figure: skin', 'clayFigIc', 'Tap to choose what Clay does on a figure: build up the skin itself (kept in a shape key, the skeleton stays as it is) or put new clay on top.'),
  L1('layers', 'Layers', 'Layers ▸', 'layersIc', 'Open Layers: each tile is a layer; tap one to pick it. New strokes go into the picked layer.'),
  L1('newlayer', 'New layer', 'New layer', 'layerAddIc', 'Tap New layer, then make a stroke: it goes on its own layer, which you can hide, move or delete without touching the rest.'),
  L1('hide', 'Hide a layer', 'Hide layer', 'eye', 'Tap Hide layer to hide the picked layer; no tool touches it while it is hidden. Tap again to show it.'),
  L1('lock', 'Lock a layer', 'Lock layer', 'lock', 'Tap Lock layer and the picked layer cannot be changed until you unlock it.'),
  L1('duplicate', 'Duplicate', 'Duplicate layer', 'dupIc', 'Tap Duplicate layer: an exact copy sits on top of the picked one, ready to move with Hold.'),
  L1('merge', 'Merge down', 'Merge down: add', 'mergeIc', 'Tap Merge down to put the picked layer into the one below. With Mode subtract it is cut out instead; with intersect only what both share stays.'),
  L1('group', 'Group', 'Group with below', 'groupIc', 'Tap Group with below to join the picked layer and the one under it in a group: Hold moves them together.'),
  L1('ungroup', 'Ungroup', 'Ungroup', 'ungroupIc', 'Tap Ungroup to let the layers of the picked layer\'s group go their own way again.'),
  L1('mergegroup', 'Merge group', 'Merge group', 'mergeGroupIc', 'Tap Merge group to turn a whole group into one layer, so you can use it as one stamp or one cutter.'),
  L1('delete', 'Delete layer', 'Delete layer', 'trashIc', 'Tap Delete layer to remove the picked layer. Undo brings it back.'),
  L1('detail', 'Detail', 'Detail: 5 mm', 'detailIc', 'Tap Detail to choose how fine new layers are: 3 mm for small work, 5 mm normal, 10 mm rough and light.'),
  L1('remesh', 'Remesh', 'Remesh layer', 'remeshIc', 'Pick a layer, set Detail, then tap Remesh layer: the layer is made again at that detail, finer or lighter.'),
  L1('budget', 'Budget', 'Budget: all', 'budgetIc', 'Tap Budget to set how many triangles a saved copy may have. Only the saved copy is thinned, and people are never thinned.'),
  L1('saveclay', 'Save clay', 'Save clay', 'floppy', 'Tap Save clay to put your clay in the library as a .glb, without taking the headset off.'),
  L1('asset', 'New asset', 'New asset', 'assetIc', 'Tap New asset: the figure steps aside and your next clay starts an object of its own for the story. Save clay keeps it in the library; Back to the figure brings the figure back.'),
  L1('finish', 'Finish', 'Finish: satin', 'finishIc', 'Pick a clay layer, then tap Finish to step through matte, satin, gloss, metal and glow.'),
  L1('support', 'Other hand smooths', 'Other hand smooths: on', 'supportIc', 'Sculpt with one hand; without letting go, pinch with your other hand and rub: that hand smooths while the first keeps its brush.'),
  L1('expressions', 'Expressions', 'Expressions ▸', 'motionIc', 'Open Expressions and tap a shape key: the face moves into it and back, smoothly, like a real expression.'),
  L1('pulse', 'Pulse speed', 'Pulse: normal', 'pulseSpeedIc', 'Tap Pulse to choose quick (a micro-expression, 0.3 s), normal or slow (1.5 s).'),
  L1('record', 'Record a move', 'Record face', 'recordFaceIc', 'Tap Record face, play a few expressions, then Stop recording: it becomes an animation that Save figure keeps in the .glb.'),
  L1('playmove', 'Play the move', 'Play the move', 'playMoveIc', 'Tap Play the move to watch the last recorded expression move once.'),
  L1('emblem', 'Make the emblem', 'Make the emblem', 'emblemIc', 'Tap Make the emblem: your two-figure emblem appears beside you, each body a rectangular rod twisted, bent and tapered, in its own colours, turning slowly.'),
  L1('rod', 'Rod', 'Rod', 'rodIc', 'Pick Rod, then pinch and draw a curve in the air: a solid rectangular rod follows your finger, twisted and tapered to a point. Size sets how wide it is.'),
  L1('twist', 'Twist', 'Twist: 180°', 'twistIc', 'With Rod picked, tap Twist to choose how far the next rod turns from one end to the other: 0, 90, 180, 360 or 540 degrees.'),
  L1('rodend', 'Rod end', 'Rod end: tapered', 'taperIc', 'With Rod picked, tap Rod end: tapered draws the end out to a point, blunt keeps it full size.'),
  L1('spin', 'Spin', 'Spin: off', 'spinIc', 'Pick some clay, then tap Spin: the whole work turns slowly round, one turn every 10 seconds. Tap again and it eases to a stop. Save clay keeps the spin.'),
  L1('saw', 'Saw on clay', 'Saw', 'cutIc', 'Pick Saw on the first Sculpt page and sweep it through clay with the trigger held: a slit as wide as the Size ring is cut, the rest stays. It saws figures and objects as before.'),
  L1('carveclay', 'Carve and stamp on clay', 'Carve', 'carveIc', 'Carve and Stamp work on clay too: sweep Carve to dig a groove, or press a picked object in with Stamp to carve its shape out of the clay.'),
];

/* every new tile, the page it is on and its picture-tile icon (also written out in sculpt_next_CHANGES.md) */
export const TILES = [
  { page: 'Sculpt (first page)', label: 'Clay & shapes ▸', ic: 'sculptNextIc' },
  ...Object.keys(BRUSH).map(m => ({ page: 'CLAY', label: BRUSH[m][0], ic: BRUSH[m][1] })),
  { page: 'CLAY', label: 'Mode: add / subtract / paint / intersect', ic: 'opAddIc / opSubIc / opPaintIc / opIntersectIc' },
  { page: 'CLAY', label: 'Colour: clay / terracotta / sky / leaf / sun / lilac / bone / slate', ic: 'tintIc' },
  { page: 'CLAY', label: 'Size N cm', ic: 'brushSize' }, { page: 'CLAY', label: 'Strength N%', ic: 'strengthBars' },
  { page: 'CLAY', label: 'Symmetry: off / mirror / 360 / mirror + 360', ic: 'symOff / symMirror / symRound / symBoth' },
  { page: 'CLAY', label: 'Steady: off / some / lots', ic: 'steadyIc' }, { page: 'CLAY', label: 'Edge: smooth / linear / sharp / flat', ic: 'falloffIc' },
  { page: 'CLAY', label: 'Clay: round / ribbon (when Clay is picked)', ic: 'clayIc' }, { page: 'CLAY', label: 'Dots: balls / rings / cubes / spikes (when Dots is picked)', ic: 'dotsIc' },
  { page: 'CLAY', label: 'Finish: matte / satin / gloss / metal / glow', ic: 'finishIc' }, { page: 'CLAY', label: 'Other hand smooths: on / off', ic: 'supportIc' },
  { page: 'CLAY', label: 'New asset / Back to the figure', ic: 'assetIc / backFigureIc' }, { page: 'CLAY', label: 'Expressions ▸', ic: 'motionIc' },
  { page: 'EXPRESSIONS', label: '▶ <shape key> (one tile per key, tap to play it)', ic: 'pulseIc' }, { page: 'EXPRESSIONS', label: 'Pulse: quick / normal / slow', ic: 'pulseSpeedIc' }, { page: 'EXPRESSIONS', label: 'Plays: once / 3 times', ic: 'repeatIc' },
  { page: 'EXPRESSIONS', label: 'Record face / Stop recording', ic: 'recordFaceIc' }, { page: 'EXPRESSIONS', label: 'Play the move', ic: 'playMoveIc' },
  { page: 'CLAY', label: 'Undo stroke / Redo stroke', ic: 'undoStroke / redoStroke' }, { page: 'CLAY', label: 'Shapes ▸', ic: 'shapesIc' }, { page: 'CLAY', label: 'Layers ▸', ic: 'layersIc' },
  { page: 'SHAPES', label: 'Place a shape', ic: 'placeShapeIc' }, { page: 'SHAPES', label: 'Shape: sphere / cube / cylinder / cone / torus / capsule', ic: 'primSphere / primCube / primCylinder / primCone / primTorus / primCapsule' },
  { page: 'SHAPES', label: 'Apply shape', ic: 'applyShapeIc' }, { page: 'SHAPES', label: 'Drop shape', ic: 'dropShapeIc' }, { page: 'SHAPES', label: 'Blend: hard / soft / very soft', ic: 'blendIc' },
  { page: 'SHAPES', label: 'Make clay', ic: 'makeClayIc' }, { page: 'SHAPES', label: 'Hold', ic: 'holdIc' }, { page: 'SHAPES', label: 'Hold: whole work / picked layer', ic: 'holdIc' }, { page: 'SHAPES', label: 'Clay on figure: skin / new clay', ic: 'clayFigIc' },
  { page: 'LAYERS', label: '(one tile per layer, tap to pick)', ic: 'layerPickIc' }, { page: 'LAYERS', label: 'New layer', ic: 'layerAddIc' }, { page: 'LAYERS', label: 'Hide layer / Show layer', ic: 'eye' }, { page: 'LAYERS', label: 'Lock layer / Unlock layer', ic: 'lock' },
  { page: 'LAYERS', label: 'Duplicate layer', ic: 'dupIc' }, { page: 'LAYERS', label: 'Merge down: add / cut out / keep shared', ic: 'mergeIc' }, { page: 'LAYERS', label: 'Group with below', ic: 'groupIc' }, { page: 'LAYERS', label: 'Ungroup', ic: 'ungroupIc' },
  { page: 'LAYERS', label: 'Merge group', ic: 'mergeGroupIc' }, { page: 'LAYERS', label: 'Delete layer', ic: 'trashIc' }, { page: 'LAYERS', label: 'Detail: 3 / 5 / 10 mm', ic: 'detailIc' }, { page: 'LAYERS', label: 'Remesh layer', ic: 'remeshIc' },
  { page: 'LAYERS', label: 'Budget: all / 5k / 20k / 50k / 100k', ic: 'budgetIc' }, { page: 'LAYERS', label: 'Save clay', ic: 'floppy' },
];
