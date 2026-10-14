/* sculpt_next_controllers.js: the real Quest controllers in your hands while you sculpt, with a label at every button saying what it does RIGHT NOW (Ruth 2026-10-14: "why don't the controllers look like the controllers in any way in any of the apps i told you about?").
   As in Substance 3D Modeler, Gravity Sketch and Shapes XR: the controller you hold is drawn as itself (Meta's Touch Plus for Quest 3 / 3S / Pro, Touch v3 for Quest 2; models from the WebXR input profiles, MIT, see xr_controller_models_LICENSE.md),
   its trigger, grip, buttons and stick move when you press them, and a word chip beside each one names its job, coloured by kind (amber: sculpting, lilac: the Palette, blue: undo and layers, gold: freeze, cream: the world).
   A chip brightens while your finger rests on its button (it fades over a fifth of a second: nothing flashes). Labels can be turned off on the Together page.
   makeControllerViews(THREE, env): env = { load(url) -> Promise<Object3D>, head() -> {p, q} | null, labels() -> { tool: {...}, support: {...} } }
     .update(role, s): s = { grip (Object3D), gamepad, profiles, handed, on }. Call every frame for each hand while Sculpt is on.
     .hideAll()  .shown()  .loaded(role) */
const BASE = (() => { try { return new URL('./', import.meta.url).href; } catch (e) { return './'; } })();
const MODEL = { plus: 'xr_meta_quest_touch_plus', v3: 'xr_oculus_touch_v3' };
/* Gravity Sketch-style colour per kind of job */
export const KIND = { sculpt: '#e8a866', palette: '#b48cff', history: '#7fb2ff', freeze: '#ffd36a', world: '#f3eee2', colour: '#ff7ab0', shape: '#7fd6a0' };
/* which glTF node and which gamepad button each chip belongs to */
const PARTS = { trigger: { node: 'xr_standard_trigger', button: 0 }, squeeze: { node: 'xr_standard_squeeze', button: 1 }, stick: { node: 'xr_standard_thumbstick', button: 3 }, bottom: { node: ['x_button', 'a_button'], button: 4 }, top: { node: ['y_button', 'b_button'], button: 5 } };
/* where each chip sits, in the controller's grip space (side = -1 for the left hand: chips go to the outside of each hand) */
const PLACE = { top: [0.062, 0.050, 0.004], bottom: [0.062, 0.028, 0.020], stick: [0.050, 0.074, 0.030], trigger: [0.060, -0.012, -0.050], squeeze: [0.064, -0.040, 0.030] };
const CW = 560, CH = 124, PW = 0.088, PH = PW * CH / CW;
/* the chips stand in a tidy column beside each hand, in the order the buttons sit from top to bottom (Gravity Sketch's tooltips), always upright and facing you */
const ORDER = ['top', 'bottom', 'stick', 'trigger', 'squeeze'], GAP = 0.024, OUT = 0.085, UP = 0.05;

const PLACE_AT = (k, side) => { const P = PLACE[k]; return { x: P[0] * side * 0.3, y: P[1] * 0.4, z: P[2] * 0.6 }; };   /* until the model is in: about where the button is */
export function pickModel(profiles) { const p = (profiles || []).join(' '); return /oculus-touch/.test(p) && !/quest-touch-plus|quest-touch-pro/.test(p) ? 'v3' : 'plus'; }

export function makeControllerViews(THREE, env) {
  env = env || {}; const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const views = { tool: null, support: null }, profiles = {}, tmpP = new V3(), tmpQ = new Q(), tmpS = new V3();
  const fetchJson = u => (typeof fetch === 'function' ? fetch(u).then(r => r.json()) : Promise.reject(new Error('no fetch')));
  function profile(kind) { if (!profiles[kind]) profiles[kind] = fetchJson(BASE + MODEL[kind] + '_profile.json').catch(() => null); return profiles[kind]; }
  /* the controller's body: the real model, or a plain stand-in while it loads or if it cannot load */
  function standIn(side) {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x2a2633, roughness: 0.55, metalness: 0.1 });
    const body = new THREE.Mesh(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.018, 0.07, 6, 12) : new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), m); body.rotation.x = -0.9; body.position.set(0, -0.01, 0.03); g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 28), m); ring.position.set(side * 0.01, 0.02, -0.03); ring.rotation.y = side * 0.4; g.add(ring);
    g.name = 'sculptControllerStandIn'; return g;
  }
  function chip() {
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null; if (!cv) return null; cv.width = CW; cv.height = CH;
    const tex = new THREE.CanvasTexture(cv); if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); mesh.renderOrder = 1007;
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf3eee2, transparent: true, opacity: 0.55, depthTest: false })); line.renderOrder = 1006;
    return { cv, ctx: cv.getContext('2d'), tex, mesh, line, sig: '', glow: 0, glowDrawn: -1 };
  }
  function drawChip(c, text, kind, glow) {
    const x = c.ctx, col = KIND[kind] || KIND.world, g = Math.round(glow * 10) / 10, sig = text + '|' + kind + '|' + g; if (sig === c.sig) return; c.sig = sig;
    x.clearRect(0, 0, CW, CH); const r = 30, w = CW - 8, h = CH - 8;
    x.beginPath(); if (x.roundRect) x.roundRect(4, 4, w, h, r); else x.rect(4, 4, w, h);
    x.fillStyle = g > 0 ? `rgba(${58 + 40 * g},${45 + 30 * g},${77 + 30 * g},0.96)` : 'rgba(22,17,30,0.9)'; x.fill(); x.lineWidth = 6; x.strokeStyle = col; x.stroke();
    x.beginPath(); x.arc(4 + 44, CH / 2, 18, 0, Math.PI * 2); x.fillStyle = col; x.fill();
    x.fillStyle = '#f3eee2'; x.textBaseline = 'middle'; const F = px => `700 ${px}px system-ui, "Segoe UI", sans-serif`, room = w - 100;
    x.font = F(46); if (x.measureText(text).width <= room) x.fillText(text, 84, CH / 2 + 2);
    else {   /* a long job goes on two lines (the stick's second job, after the dot) rather than in small letters */
      const cut = text.indexOf(' · '), a = cut > 0 ? text.slice(0, cut) : text, b = cut > 0 ? text.slice(cut + 3) : ''; let s1 = 44, s2 = 36;
      x.font = F(s1); while (x.measureText(a).width > room && s1 > 26) { s1 -= 2; x.font = F(s1); } x.fillText(a, 84, b ? CH * 0.33 : CH / 2 + 2);
      if (b) { x.font = F(s2); while (x.measureText(b).width > room && s2 > 22) { s2 -= 2; x.font = F(s2); } x.fillStyle = 'rgba(243,238,226,0.85)'; x.fillText(b, 84, CH * 0.72); }
    }
    c.tex.needsUpdate = true;
  }
  function build(role, s) {
    const side = s.handed === 'left' ? -1 : 1, kind = pickModel(s.profiles), root = new THREE.Group(); root.name = 'sculptController_' + role;
    const v = { role, side, kind, root, model: standIn(side), real: false, nodes: {}, chips: {}, parts: [], grip: s.grip, handed: s.handed };
    root.add(v.model); s.grip.add(root);
    Object.keys(PLACE).forEach(k => { const c = chip(); if (!c) return; const P = PLACE[k]; c.mesh.position.set(P[0] * side, P[1], P[2]); root.add(c.mesh); root.add(c.line); v.chips[k] = c; });
    if (env.load) {
      const url = BASE + MODEL[kind] + '_' + (side < 0 ? 'left' : 'right') + '.glb';
      Promise.all([env.load(url), profile(kind)]).then(([scene, prof]) => {
        if (!scene || views[role] !== v) return; root.remove(v.model); v.model = scene; v.real = true; root.add(scene);
        scene.traverse(o => { if (o.isMesh) { o.renderOrder = 1; if (o.material) { o.material = o.material.clone(); o.material.depthWrite = true; } } });
        const lay = prof && prof.layouts && prof.layouts[side < 0 ? 'left' : 'right'];
        if (lay) Object.values(lay.components).forEach(comp => Object.values(comp.visualResponses || {}).forEach(vr => {
          if (vr.valueNodeProperty !== 'transform') return; const val = scene.getObjectByName(vr.valueNodeName), mn = scene.getObjectByName(vr.minNodeName), mx = scene.getObjectByName(vr.maxNodeName); if (!val || !mn || !mx) return;
          const gi = comp.gamepadIndices || {}; v.parts.push({ val, mn, mx, prop: vr.componentProperty, button: gi.button, xAxis: gi.xAxis, yAxis: gi.yAxis });
        }));
        /* each chip's leader line ends at its own button on the model */
        scene.updateWorldMatrix(true, true); root.updateWorldMatrix(true, false); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        Object.entries(PARTS).forEach(([k, P]) => { const names = [].concat(P.node); let n = null; names.forEach(nm => { n = n || scene.getObjectByName(nm); }); if (n) { const b = new THREE.Box3().setFromObject(n); if (!b.isEmpty()) v.nodes[k] = b.getCenter(new V3()).applyMatrix4(inv); } });
      }).catch(e => { if (typeof console !== 'undefined') console.warn('sculpt controller model', e && e.message || e); });
    }
    return v;
  }
  /* trigger, grip, buttons and stick move with your fingers (the profile's min / max poses) */
  function animate(v, gp) {
    if (!gp || !v.parts.length) return;
    v.parts.forEach(p => {
      let t = 0; if (p.prop === 'button') { const b = gp.buttons && gp.buttons[p.button]; t = b ? (b.value || (b.pressed ? 1 : 0)) : 0; } else if (p.prop === 'xAxis') t = ((gp.axes && gp.axes[p.xAxis]) || 0) * 0.5 + 0.5; else if (p.prop === 'yAxis') t = ((gp.axes && gp.axes[p.yAxis]) || 0) * 0.5 + 0.5;
      p.val.quaternion.copy(p.mn.quaternion).slerp(p.mx.quaternion, t); p.val.position.lerpVectors(p.mn.position, p.mx.position, t);
    });
  }
  function update(role, s) {
    if (!s || !s.grip) return; let v = views[role];
    if (v && (v.grip !== s.grip || v.handed !== s.handed || v.kind !== pickModel(s.profiles))) { if (v.root.parent) v.root.parent.remove(v.root); v = views[role] = null; }
    if (!v) v = views[role] = build(role, s);
    v.root.visible = s.on !== false; v.seen = typeof performance !== 'undefined' ? performance.now() : Date.now(); if (!v.root.visible) return;
    animate(v, s.gamepad);
    const L = (env.labels && env.labels()) || null, mine = L && L[role], show = !!(mine && L.on !== false), gp = s.gamepad, head = env.head && env.head();
    Object.entries(v.chips).forEach(([k, c]) => {
      const lab = mine && mine[k]; c.mesh.visible = c.line.visible = show && !!lab; if (!c.mesh.visible) return;
      const b = gp && gp.buttons && gp.buttons[PARTS[k].button], hot = !!(b && (b.touched || b.pressed || b.value > 0.05));
      c.glow += ((hot ? 1 : 0) - c.glow) * 0.25; if (Math.abs(c.glow - (hot ? 1 : 0)) < 0.02) c.glow = hot ? 1 : 0; drawChip(c, lab[0], lab[1], c.glow);
    });
    /* the column: beside the hand on its outer side, as you see it (your right / left), upright, facing you; each line runs to its own button */
    v.root.updateWorldMatrix(true, false); v.root.matrixWorld.decompose(tmpP, tmpQ, tmpS); const sc = tmpS.x || 1, inv = new THREE.Matrix4().copy(v.root.matrixWorld).invert(), rootQi = tmpQ.clone().invert();
    const hq = head && head.q ? head.q : new Q(), right = new V3(1, 0, 0).applyQuaternion(hq), up = new V3(0, 1, 0).applyQuaternion(hq), hp = head && head.p ? head.p : tmpP.clone().add(new V3(0, 0.4, 0.4));
    const faceQ = new Q().setFromRotationMatrix(new THREE.Matrix4().lookAt(hp, tmpP, up));
    let i = 0; ORDER.forEach(k => { const c = v.chips[k]; if (!c || !c.mesh.visible) return;
      const wp = tmpP.clone().addScaledVector(right, v.side * (OUT + PW * 0.5)).addScaledVector(up, UP - i * GAP); i++;
      c.mesh.position.copy(wp).applyMatrix4(inv); c.mesh.quaternion.copy(rootQi).multiply(faceQ); c.mesh.scale.setScalar((1 + 0.1 * c.glow) / sc);
      const edge = wp.clone().addScaledVector(right, -v.side * PW * 0.5 * (1 + 0.1 * c.glow)).applyMatrix4(inv), a = v.nodes[k] || PLACE_AT(k, v.side), pos = c.line.geometry.attributes.position;
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, edge.x, edge.y, edge.z); pos.needsUpdate = true; c.line.geometry.computeBoundingSphere(); });
  }
  function hideAll() { Object.values(views).forEach(v => { if (v) v.root.visible = false; }); }
  function forget() { Object.keys(views).forEach(k => { const v = views[k]; if (v && v.root.parent) v.root.parent.remove(v.root); views[k] = null; }); }
  return { update, hideAll, forget, shown: () => Object.values(views).some(v => v && v.root.visible), loaded: role => !!(views[role] && views[role].real), views, chipText: (role, k) => { const v = views[role], c = v && v.chips[k]; return c && c.mesh.visible ? c.sig.split('|')[0] : null; } };
}

/* what each button does right now, for each hand: [words, kind]. Follows the engine's settings (brush, partner tool, Palette open, Gizmo or free). */
export function buttonLabels(cfg, st) {
  st = st || {}; const BR = { clay: 'Clay', smooth: 'Smooth', flatten: 'Flatten', pinch: 'Pinch', inflate: 'Inflate', grab: 'Grab', scrape: 'Scrape', smear: 'Smear', dots: 'Dots', prim: 'Place shape', hold: 'Hold work', rod: ({ rod: 'Draw rod', tube: 'Draw tube', ribbon: 'Draw ribbon', ink: 'Draw ink' })[cfg.rodProfile || 'rod'], ball: 'Ball', gradient: 'Lay gradient', look: 'Put on look', cut: 'Cut', stamp: 'Stamp' };
  const brush = (BR[cfg.mode] || (cfg.mode ? cfg.mode[0].toUpperCase() + cfg.mode.slice(1) : 'Sculpt')) + (cfg.op === 'subtract' && !['hold', 'look', 'gradient', 'rod', 'ball'].includes(cfg.mode) ? ' (take away)' : cfg.op === 'paint' ? ' (paint)' : '');
  if (cfg.controls === 'atelier') return { on: cfg.labels !== false, tool: { trigger: [brush, 'sculpt'], squeeze: ['Move world', 'world'], stick: ['Size ↕ · click: Freeze', 'freeze'] }, support: { trigger: [cfg.supportSmooth ? 'Smooth' : brush, 'sculpt'], squeeze: ['Move world', 'world'], bottom: ['Undo', 'history'], top: ['Redo', 'history'], stick: ['click: Freeze', 'freeze'] } };
  const pal = !!st.paletteOpen;
  return {
    on: cfg.labels !== false,
    tool: {
      trigger: [st.overPalette ? 'Tap the Palette' : st.picking ? 'Pick colour' : brush, st.overPalette ? 'palette' : st.picking ? 'colour' : 'sculpt'],
      squeeze: ['Move world', 'world'],
      bottom: ['Partner: ' + (cfg.op === 'subtract' ? 'Add' : 'Take away'), 'sculpt'],
      top: ['Select · hold: Tune', 'shape'],
      stick: [pal ? 'Pages ◀ ▶ · click: Freeze' : 'Size ↕  Edge ↔ · click: Freeze', 'sculpt'],
    },
    support: {
      trigger: [cfg.supportSmooth ? 'Smooth' : brush, 'sculpt'],
      squeeze: ['Move world', 'world'],
      bottom: [pal ? 'Palette: tap to hide' : 'Palette (hold)', 'palette'],
      top: [cfg.mode === 'prim' ? 'Free brush' : 'Gizmo shapes', 'shape'],
      stick: ['Undo ◀  ▶ Redo · click: pick colour', 'history'],
    },
    freeze: ['Tool stick click: Freeze', 'freeze'],
  };
}
