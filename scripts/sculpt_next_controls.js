/* sculpt_next_controls.js: Substance 3D Modeler's controller layout, inside Sculpt (Ruth 2026-10-14, with Adobe's controller map: "this is substance, a full report on it").
   Adobe names the hands by role: the TOOL hand (the hand you sculpt with) and the SUPPORT hand. As in Modeler:
     SUPPORT hand   bottom button (S2)  hold: the Palette (the CLAY pages) shows while held; a quick tap pins it open or puts it away
                    top button (S1)     placement: Gizmo (a shape you place and stretch with knobs) <-> Free (back to your brush)
                    stick left / right  Undo / Redo
                    stick up / down     scope in (pick the layer your tool hand is on, or the next one) / out (the whole work)
                    stick click         colour pick: the next trigger pull takes the colour of what the tool hand touches
                    trigger             (already) while the tool hand sculpts, the support trigger smooths
     TOOL hand      trigger             sculpt (as before)
                    stick up / down     brush size;  left / right  edge hardness (soft, even, sharp, flat)
                    bottom button (T2)  swap to the partner tool (add <-> subtract: Clay <-> Erase)
                    top button (T1)     tap: select what the tool hand is on (a clay layer or an object); hold and move the hand: Quicktune (up / down strength, left / right size)
                    stick click         FREEZE / resume everything (Ruth's comfort rule; Modeler leaves this click free)
     Palette open:  tool stick left / right turns the Palette's pages (CLAY, SHAPES, LAYERS, EXPRESSIONS), as Modeler's S2 + TJ expands its panels.
     Tooltips:      rest a thumb on a button or stick for half a second and its job is said (Modeler shows a tooltip on touch).
   Grips stay the page's own: either grip moves the world, both grips scale it (exactly Modeler's grips).
   makeControls(vs, env): input(role, s, dt) with s = { top, bottom, click, x, y, trigger, tip (Vector3), touchTop, touchBottom, touchStick } -> { palette: 'show'|'hide'|null, page, freeze, say }. */
const DEAD = 0.18, FLICK = 0.7, ARM = 0.35;
const HARD = ['smooth', 'linear', 'sharp', 'flat'], HARD_WORD = { smooth: 'soft', linear: 'even', sharp: 'sharp', flat: 'flat' };
export const CONTROL_MAP = [
  ['support', 'bottom', 'Hold for the Palette; a quick tap pins it open or puts it away.'],
  ['support', 'top', 'Placement: shapes with the gizmo, or free brushing.'],
  ['support', 'stick', 'Left: undo. Right: redo. Up: step into a layer. Down: back to the whole work. Click: pick up a colour.'],
  ['tool', 'bottom', 'Swap to the partner tool: add or take away.'],
  ['tool', 'top', 'Tap: select what your hand is on. Hold and move your hand: fine-tune size and strength.'],
  ['tool', 'stick', 'Up and down: brush size. Left and right: soft or hard edge. Click: freeze or resume everything.'],
];
export function makeControls(vs, env) {
  env = env || {}; const cfg = vs.cfg, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const H = { tool: { arm: true, prev: {} }, support: { arm: true, prev: {} } }, P = { held: false, t0: 0, pinned: false, open: false }, Q = { on: false, t0: 0, at: null, size0: 0, str0: 0, moved: false };
  let lastPrimFrom = null, sizeSaid = 0, touchT = {}, touchSaid = {};
  const edge = (h, k, v) => { const was = !!h.prev[k]; h.prev[k] = !!v; return v && !was ? 'down' : !v && was ? 'up' : null; };
  const tip = (role, t) => { const key = role + ':' + t, line = CONTROL_MAP.find(r => r[0] === role && r[1] === t); if (!line) return; const now = Date.now(); if (now - (touchSaid[key] || 0) < 12000) return; touchSaid[key] = now; say((role === 'tool' ? 'Tool hand, ' : 'Support hand, ') + (t === 'stick' ? 'stick' : t + ' button') + ': ' + line[2]); };
  function input(role, s, dt) {
    if (!cfg.on || cfg.controls === 'atelier') return null;
    const h = H[role] || H.tool, out = { palette: null, page: null, freeze: false }, x = Math.abs(s.x || 0) > DEAD ? s.x : 0, y = Math.abs(s.y || 0) > DEAD ? s.y : 0, now = performance.now();
    /* tooltips on touch */
    [['touchTop', 'top'], ['touchBottom', 'bottom'], ['touchStick', 'stick']].forEach(([k, t]) => { const key = role + k; if (s[k] && !s.top && !s.bottom && !x && !y) { if (!touchT[key]) touchT[key] = now; else if (now - touchT[key] > 500) tip(role, t); } else touchT[key] = 0; });
    if (Math.abs(s.x || 0) < ARM && Math.abs(s.y || 0) < ARM) h.arm = true;
    if (role === 'support') {
      const b = edge(h, 'bottom', s.bottom);   /* S2: hold = Palette while held, tap = pin / unpin */
      if (b === 'down') { P.held = true; P.t0 = now; P.wasPinned = P.pinned; if (!P.open) { out.palette = 'show'; P.open = true; } }
      if (b === 'up') { P.held = false; const tap = now - P.t0 < 350; if (tap) { P.pinned = !P.wasPinned; if (!P.pinned) { out.palette = 'hide'; P.open = false; } else say('Palette pinned open. Tap the support hand\'s lower button again to put it away.'); } else if (!P.pinned) { out.palette = 'hide'; P.open = false; } }
      if (edge(h, 'top', s.top) === 'down') {   /* S1: Gizmo <-> Free placement */
        if (cfg.mode === 'prim') { vs.set.mode(lastPrimFrom && lastPrimFrom !== 'prim' ? lastPrimFrom : 'clay'); say('Free: your brush again (' + cfg.mode + ').'); }
        else { lastPrimFrom = cfg.mode; vs.set.mode('prim'); say('Gizmo: pinch in the air for a ' + cfg.prim + ', then move it, stretch a knob, or resize with both hands.'); }
      }
      if (h.arm && x <= -FLICK) { h.arm = false; if (!vs.undo()) say('Nothing to undo.'); }
      else if (h.arm && x >= FLICK) { h.arm = false; if (!vs.redo()) say('Nothing to redo.'); }
      else if (h.arm && y <= -FLICK) { h.arm = false; scopeIn(s.tip); }   /* WebXR sticks: forward is negative y */
      else if (h.arm && y >= FLICK) { h.arm = false; scopeOut(); }
      if (edge(h, 'click', s.click) === 'down') { picking = true; say('Colour pick: touch something with your tool hand and pull the trigger to take its colour.'); }
      return out;
    }
    /* the tool hand */
    if (edge(h, 'click', s.click) === 'down') { out.freeze = true; return out; }   /* comfort first: freeze or resume everything */
    if (P.open && x && h.arm && Math.abs(x) >= FLICK) { h.arm = false; out.page = 'step:' + (x > 0 ? 1 : -1); return out; }   /* Palette open: the tool stick turns its pages */
    if (y && !Q.on) { const k = Math.exp(-y * dt * 1.6); vs.set.size(Math.round(cfg.size * k * 100) / 100); if (now - sizeSaid > 900) { sizeSaid = now; say('Size ' + (Math.round(cfg.size * 10) / 10) + ' cm'); } }   /* forward grows the brush, back shrinks it */
    if (!P.open && h.arm && Math.abs(x) >= FLICK && !Q.on) { h.arm = false; const i = HARD.indexOf(cfg.falloff), n = Math.max(0, Math.min(HARD.length - 1, (i < 0 ? 0 : i) + (x > 0 ? 1 : -1))); vs.set.falloff(HARD[n]); say('Edge: ' + HARD_WORD[HARD[n]] + '.'); }
    if (edge(h, 'bottom', s.bottom) === 'down') {   /* T2: the partner tool */
      const was = cfg.op; vs.set.op(was === 'subtract' ? 'add' : 'subtract'); say(cfg.op === 'subtract' ? 'Partner tool: taking away (Erase).' : 'Back to adding (' + cfg.mode + ').');
    }
    const t1 = edge(h, 'top', s.top);   /* T1: tap = select, hold and move = Quicktune */
    if (t1 === 'down') { Q.on = true; Q.t0 = now; Q.at = s.tip ? s.tip.clone() : null; Q.size0 = cfg.size; Q.str0 = cfg.strength; Q.moved = false; }
    if (Q.on && s.top && Q.at && s.tip) { const d = s.tip.clone().sub(Q.at); if (Math.abs(d.y) > 0.015 || Math.hypot(d.x, d.z) > 0.015) Q.moved = true; if (Q.moved) { vs.set.strength(Math.round(Math.max(5, Math.min(100, Q.str0 + d.y * 400)))); vs.set.size(Math.max(0.3, Math.min(30, Q.size0 * Math.exp((d.x + d.z * 0) * 8)))); if (now - sizeSaid > 700) { sizeSaid = now; say('Strength ' + cfg.strength + '%, size ' + (Math.round(cfg.size * 10) / 10) + ' cm'); } } }
    if (t1 === 'up') { if (Q.on && !Q.moved && now - Q.t0 < 600) selectAt(s.tip); Q.on = false; }
    return out;
  }
  /* scope: in = the layer under the tool hand (or the next one), out = the whole work */
  function scopeIn(at) { const C = vs.clay, hit = at ? C.hit(at, 0.08, false) : null; if (hit && hit.layer) { C.pickLayer(hit.layer); vs.set.holdWhat('layer'); say('In: ' + hit.layer.name + '. Hold moves this layer; brushes go into it.'); return; } const L = C.stepLayer(1); if (L) { vs.set.holdWhat('layer'); say('In: ' + L.name + '.'); } else say('There is no clay to step into yet.'); }
  function scopeOut() { vs.set.holdWhat('work'); say('Out: the whole work. Hold moves all of it.'); }
  function selectAt(at) {
    if (!at) return; const C = vs.clay, hit = C.hit(at, 0.06, false); if (hit && hit.layer) { C.pickLayer(hit.layer); return; }
    const A = vs.assets(); let best = null, bd = 0.12; A.forEach(a => { const box = new env.THREE.Box3().setFromObject(a.object), d = box.distanceToPoint(at); if (d < bd) { bd = d; best = a; } });
    if (best) { selected = best; say(best.name + ' selected: the Look tool, Spin and Hold work on it.'); } else say('Nothing here to select. Touch a clay layer, a rod, a ball or the emblem.');
  }
  let picking = false, selected = null;
  /* colour pick: called by the engine for the first tool pinch while picking; returns true when it took the pinch */
  function pickColour(at) {
    if (!picking || !at) return false; picking = false; const rgb = env.colourAt ? env.colourAt(at) : null;
    if (!rgb) { say('No colour there: touch clay, a rod, a ball or an object.'); return true; }
    const hex = '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); vs.set.rgb(hex); say('Picked up that colour. Clay, paint, rods and balls take it now.'); return true;
  }
  return { input, pickColour, get picking() { return picking; }, get selected() { return selected && selected.object.parent ? selected : null }, get paletteOpen() { return P.open; }, get paletteHeld() { return P.held; }, setPaletteOpen(v) { P.open = !!v; if (!v) { P.pinned = false; P.held = false; } }, map: CONTROL_MAP };
}
