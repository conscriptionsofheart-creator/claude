/* gizmo_next_effects.js: stage H8, the Effects gizmo (particles and trail), the last gizmo. One kind, `effects`, with a Particles tab (Meta's ParticleFx: Play on Start, Looping, Preset, Preview)
   and a Trail tab (Meta's TrailFx: Play on Start, Length, Width, Start Color, End Color, Preset Default, Simple, Tapered). Presets: smoke, sparks, confetti, splash.
   Nothing plays on open: the running state is never saved. Only the host starts an effect, and only while Gizmos live is on (Preview is her own press and plays once).
   Safety: alpha and colour move no faster than 2.5 a second (a full fade takes at least 0.4 s), a restart waits 0.4 s, and `flashSafe(series)` says whether a brightness series flashes more than 3 times a second.
   The page budget of 600 live particles holds across every gizmo. Drawing: one THREE.Points per gizmo and one ribbon mesh per trail, added to the scene apart from the box, so Hide gizmos hides the box and not the effect. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_actions.js');

  var BUDGET = 600, BUDGET_MIN = 50, BUDGET_MAX = 2000, SLEW = 2.5, RESTART = 0.4, WAIT_FRAMES = 2, TRAIL_POINTS = 64, TRAIL_BUDGET = 256, TRAIL_AGE = 2, TRAIL_ONCE = 3, MIN_STEP = 0.01, MAX_LEN = 5;
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* life is never under 0.8 s, so the fade in and the fade out are 0.4 s each */
  var PRESETS = {
    smoke:    { rate: 40, burst: 60, dur: 1.5,  life: [1.6, 2.4], speed: [0.3, 0.6], cone: 0.25, grav: -0.2, drag: 0.8, size: 0.18 },
    sparks:   { rate: 90, burst: 90, dur: 0.25, life: [0.8, 1.2], speed: [1.5, 3.5], cone: 1.0,  grav: 4,    drag: 0.5, size: 0.03 },
    confetti: { rate: 50, burst: 120, dur: 0.3, life: [1.6, 2.6], speed: [2, 4],     cone: 0.7,  grav: 3,    drag: 1.6, size: 0.05 },
    splash:   { rate: 70, burst: 80, dur: 0.2,  life: [0.9, 1.3], speed: [2, 3.5],   cone: 0.6,  grav: 9.8,  drag: 0.2, size: 0.04 }
  };
  var TRAIL_PRESETS = ['default', 'simple', 'tapered'];
  var PALETTE = [['White', '#ffffff'], ['Pink', '#e86cd2'], ['Gold', '#ffd166'], ['Cyan', '#5ae0ff'], ['Green', '#5ae0b4'], ['Orange', '#ff8a5c'], ['Violet', '#b48cff'], ['Red', '#ff5c6c']];
  var PRESET_OPTS = [['smoke', 'Smoke'], ['sparks', 'Sparks'], ['confetti', 'Confetti'], ['splash', 'Splash'], ['default', 'Trail Default'], ['simple', 'Trail Simple'], ['tapered', 'Trail Tapered']];
  var SIZES = [0.5, 1, 2, 4];

  function hexToRgb(h) { var m = /^#([0-9a-f]{6})$/i.exec(h); if (!m) return [1, 1, 1]; var n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function cleanHex(h, d) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : d; }
  function colorName(h) { var p = PALETTE.filter(function (x) { return x[1] === h; })[0]; return p ? p[0] : h; }

  /* ---------- flashSafe: a brightness series [{t, v}] or [v, v, ...] at `hz` (default 60), 0 to 1. A change is a move of 0.2 or more from the last value kept.
     Safe when no window of one second holds more than 3 changes. ---------- */
  function flashSafe(series, hz) {
    if (!Array.isArray(series) || series.length < 2) return true;
    var dt = 1 / (isNum(hz) && hz > 0 ? hz : 60), pts = series.map(function (s, i) { return isObj(s) ? { t: isNum(s.t) ? s.t : i * dt, v: isNum(s.v) ? s.v : 0 } : { t: i * dt, v: isNum(s) ? s : 0 }; });
    var ref = pts[0].v, times = [];
    for (var i = 1; i < pts.length; i++) if (Math.abs(pts[i].v - ref) >= 0.2) { times.push(pts[i].t); ref = pts[i].v; }
    for (var a = 0, b = 0; b < times.length; b++) { while (times[b] - times[a] >= 1) a++; if (b - a + 1 > 3) return false; }
    return true;
  }
  function slew(cur, target, dt) { var d = SLEW * dt; return cur + clamp(target - cur, -d, d); }

  /* ---------- the trail ribbon, pure: points [{x,y,z}] head last, returns {positions, colors, count} for a strip (two vertices a point) ---------- */
  function ribbon(points, width, preset, c0, c1, gain) {
    var n = points.length, pos = [], col = [], last = n - 1;
    for (var i = 0; i < n; i++) {
      var u = n > 1 ? i / last : 1, p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(last, i + 1)];
      var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, px = -dz, pz = dx, l = Math.sqrt(px * px + pz * pz);
      if (l < 1e-6) { px = 1; pz = 0; l = 1; }
      px /= l; pz /= l;
      var w = (preset === 'tapered' ? width * u : (preset === 'simple' ? width * 0.5 : width)) / 2;
      pos.push(p.x + px * w, p.y, p.z + pz * w, p.x - px * w, p.y, p.z - pz * w);
      var al = u * (isNum(gain) ? gain : 1);
      var cr = c1[0] + (c0[0] - c1[0]) * u, cg = c1[1] + (c0[1] - c1[1]) * u, cb = c1[2] + (c0[2] - c1[2]) * u;
      col.push(cr * al, cg * al, cb * al, cr * al, cg * al, cb * al);
    }
    return { positions: pos, colors: col, count: n * 2 };
  }

  function register() {
    GN.register('effects', { needs: ['actions'], version: 1 }, function (g) {
      var A = g.modules.actions;
      var API = {}, K = null, kapi = null;
      var sims = {}, told = {}, frame = 0, rot = 0, budget = BUDGET, layer = null, rnd = mulberry((Math.random() * 4294967296) >>> 0), stats = { ticks: 0, lastMs: 0, maxMs: 0, refused: 0 };
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'effects', what: t }); else g.say(t); };
      var once = function (key, t) { if (told[key]) return; told[key] = 1; msg(t); };
      var nowS = function () { return g.now() / 1000; };
      var ctx = function () { return g.ctx || {}; };

      function newSim(rec) {
        var cap = BUDGET_MAX;
        return { id: rec.id, mode: 'stop', want: null, stopFrame: -99, lastStart: -99, emitAcc: 0, burstLeft: 0, burstDur: 0, n: 0, started: false,
          pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3), age: new Float32Array(cap), life: new Float32Array(cap), mix: new Float32Array(cap), rgb: new Float32Array(cap * 3), alphaNow: new Float32Array(cap),
          trail: [], onceT: 0, gain: 0, shown: null, ended: false, obj: null, tobj: null, lastTarget: null };
      }
      function simOf(id) { var rec = kapi.get(id); if (!rec) return null; return sims[id] || (sims[id] = newSim(rec)); }
      function totalParticles() { var t = 0; Object.keys(sims).forEach(function (k) { t += sims[k].n; }); return t; }
      function totalTrail() { var t = 0; Object.keys(sims).forEach(function (k) { t += sims[k].trail.length; }); return t; }
      function externalUsed() { var f = ctx().particleFlow; if (!f || typeof f.used !== 'function') return 0; try { var u = f.used(); return isNum(u) && u > 0 ? u : 0; } catch (e) { return 0; } }
      function effectiveBudget() { var f = ctx().particleFlow, b = budget; if (f && typeof f.budget === 'function') { try { var pb = f.budget(); if (isNum(pb) && pb > 0) b = Math.min(b, Math.max(0, pb - externalUsed())); } catch (e) { /* page budget unknown */ } } return Math.max(0, b); }

      /* where the effect is coming from now: the gizmo, a prop, or a hand */
      function targetOf(rec) {
        var f = rec.follow;
        if (!f) return [rec.x, rec.y, rec.z];
        if (f === 'hand-left' || f === 'hand-right') { var h = ctx().hand, p = null; if (typeof h === 'function') { try { p = h(f === 'hand-left' ? 'left' : 'right'); } catch (e) { p = null; } } if (Array.isArray(p) && isNum(p[0]) && isNum(p[1]) && isNum(p[2])) return [p[0], p[1], p[2]]; once('hand', 'The hand position is not connected yet, so the effect stays where the box is.'); return [rec.x, rec.y, rec.z]; }
        var ps = g.props(), i;
        for (i = 0; i < ps.length; i++) if (ps[i] && ps[i].id === f && ps[i].object && ps[i].object.position) return [ps[i].object.position.x, ps[i].object.position.y, ps[i].object.position.z];
        return null;
      }

      /* ---------- starting and stopping ---------- */
      function begin(rec, s, mode) {
        var P = PRESETS[rec.preset] || PRESETS.sparks;
        s.mode = mode; s.want = null; s.onceT = 0; s.lastStart = frame; s.lastStartT = nowS(); s.ended = false; s.started = true; s.emitAcc = 0; s.gain = 0;
        s.burstLeft = mode === 'once' ? P.burst : 0; s.burstDur = P.dur;
        s.shown = { s: hexToRgb(rec.startColor), e: hexToRgb(rec.endColor) };
        s.lastTarget = null; s.trail = [];
        g.emit('fx', { id: rec.id, state: mode });
      }
      function clearSim(s) { s.n = 0; s.trail = []; s.emitAcc = 0; s.burstLeft = 0; s.gain = 0; draw(s); }
      function startLocal(id, mode) {
        var rec = kapi.get(id), s = simOf(id); if (!rec || !s) return false;
        mode = mode === 'loop' ? 'loop' : 'once';
        var waitFrames = frame - s.stopFrame < WAIT_FRAMES, waitTime = nowS() - (s.lastStartT === undefined ? -99 : s.lastStartT) < RESTART && s.lastStartT !== undefined;
        if (waitFrames || waitTime) { s.want = mode; s.mode = 'stop'; return true; }
        begin(rec, s, mode); return true;
      }
      function stopLocal(id) {
        var s = sims[id]; if (!s) return false;
        var was = s.mode !== 'stop' || s.want;
        s.mode = 'stop'; s.want = null; s.stopFrame = frame; clearSim(s);
        if (was) g.emit('fx', { id: id, state: 'stop' });
        return true;
      }
      API.play = function (id, mode) {
        if (g.isGuest()) { msg('Only the host can start an effect.'); return false; }
        var rec = kapi.get(id); if (!rec) return false;
        if (!g._live) { once('live', 'Turn Gizmos live on to play effects. Preview works without it.'); return false; }
        if (mode !== 'once' && mode !== 'loop') mode = rec.looping ? 'loop' : 'once';
        var ok = startLocal(id, mode); if (ok) g.send('fx', { id: id, mode: mode }); return ok;
      };
      API.stop = function (id) {
        if (g.isGuest()) { msg('Only the host can stop an effect.'); return false; }
        var ok = stopLocal(id); if (ok) g.send('fx', { id: id, mode: 'stop' }); return ok;
      };
      /* Preview: her own press, plays once even when Gizmos live is off */
      API.preview = function (id) {
        if (g.isGuest()) { msg('Only the host can preview an effect.'); return false; }
        var ok = startLocal(id, 'once'); if (ok) g.send('fx', { id: id, mode: 'once' }); return ok;
      };
      API.stopAll = function () { Object.keys(sims).forEach(function (id) { stopLocal(id); }); };
      API.modeOf = function (id) { var s = sims[id]; return s ? (s.mode !== 'stop' ? s.mode : (s.want ? s.want : 'stop')) : 'stop'; };
      API.waiting = function (id) { var s = sims[id]; return !!s && !!s.want; };
      API.count = function (id) { var s = sims[id]; return s ? s.n : 0; };
      API.total = function () { return totalParticles(); };
      API.budget = function () { return budget; };
      API.setBudget = function (n) { if (g.isGuest()) return budget; if (isNum(n)) budget = clamp(Math.round(n), BUDGET_MIN, BUDGET_MAX); if (!g._loading) g.persist(); return budget; };
      API.trail = function (id) { var s = sims[id]; return s ? s.trail.map(function (p) { return { x: p.x, y: p.y, z: p.z }; }) : []; };
      API.shownColors = function (id) { var s = sims[id]; return s && s.shown ? { start: s.shown.s.slice(), end: s.shown.e.slice() } : null; };
      API.seed = function (n) { rnd = mulberry(isNum(n) ? n : 1); };
      API.flashSafe = flashSafe;
      API.ribbon = ribbon;
      API.presets = function () { return JSON.parse(JSON.stringify(PRESETS)); };
      API.stats = stats;
      /* a particle's alpha at its age: 0.4 s up, 0.4 s down, so it never changes faster than 2.5 a second */
      API.alphaAt = function (age, life) { return clamp(Math.min(age / 0.4, (life - age) / 0.4), 0, 1); };

      /* ---------- one frame ---------- */
      function emit(rec, s, P, k, from) {
        var a = rnd() * Math.PI * 2, c = rnd() * P.cone, sp = P.speed[0] + rnd() * (P.speed[1] - P.speed[0]), i = s.n;
        var sinc = Math.sin(c), vx = Math.cos(a) * sinc * sp, vz = Math.sin(a) * sinc * sp, vy = Math.cos(c) * sp;
        s.pos[i * 3] = from[0] + (rnd() - 0.5) * 0.04; s.pos[i * 3 + 1] = from[1]; s.pos[i * 3 + 2] = from[2] + (rnd() - 0.5) * 0.04;
        s.vel[i * 3] = vx; s.vel[i * 3 + 1] = vy; s.vel[i * 3 + 2] = vz;
        s.age[i] = 0; s.life[i] = P.life[0] + rnd() * (P.life[1] - P.life[0]); s.mix[i] = rnd();
        s.n++;
      }
      function stepSim(rec, s, dt, room, from) {
        var P = PRESETS[rec.preset] || PRESETS.sparks, i, k = rec.size || 1;
        /* colours slew toward her choice */
        var ts = hexToRgb(rec.startColor), te = hexToRgb(rec.endColor);
        if (!s.shown) s.shown = { s: ts.slice(), e: te.slice() };
        for (i = 0; i < 3; i++) { s.shown.s[i] = slew(s.shown.s[i], ts[i], dt); s.shown.e[i] = slew(s.shown.e[i], te[i], dt); }
        /* move and age the live ones */
        var drag = Math.max(0, 1 - P.drag * dt);
        for (i = s.n - 1; i >= 0; i--) {
          s.age[i] += dt;
          if (s.age[i] >= s.life[i]) { var l = --s.n; if (i !== l) { for (var q = 0; q < 3; q++) { s.pos[i * 3 + q] = s.pos[l * 3 + q]; s.vel[i * 3 + q] = s.vel[l * 3 + q]; } s.age[i] = s.age[l]; s.life[i] = s.life[l]; s.mix[i] = s.mix[l]; } continue; }
          s.vel[i * 3 + 1] -= P.grav * dt; s.vel[i * 3] *= drag; s.vel[i * 3 + 1] *= drag; s.vel[i * 3 + 2] *= drag;
          s.pos[i * 3] += s.vel[i * 3] * dt * k; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt * k; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt * k;
        }
        /* emit: a loop at the preset's rate, a play once as a burst spread over the preset's window */
        if (rec.tab === 'particles' && s.mode !== 'stop' && from) {
          var want = 0;
          if (s.mode === 'loop') { s.emitAcc += P.rate * dt; want = Math.floor(s.emitAcc); s.emitAcc -= want; }
          else if (s.burstLeft > 0) { s.onceT += dt; var due = Math.floor(P.burst * Math.min(1, s.onceT / P.dur)) - (P.burst - s.burstLeft); want = Math.max(0, Math.min(s.burstLeft, due)); }
          var allowed = Math.max(0, Math.min(want, room.v)); if (allowed < want) stats.refused += want - allowed;
          for (i = 0; i < allowed; i++) emit(rec, s, P, k, from);
          room.v -= allowed;
          if (s.mode === 'once') { s.burstLeft -= allowed; if (s.onceT >= P.dur) s.burstLeft = 0; }
        }
      }
      function stepTrail(rec, s, dt, from, room) {
        s.gain = slew(s.gain, s.mode === 'stop' ? 0 : 1, dt);
        for (var i = s.trail.length - 1; i >= 0; i--) { s.trail[i].a += dt; if (s.trail[i].a > TRAIL_AGE) { s.trail.splice(0, i + 1); break; } }
        if (s.mode !== 'stop' && from) {
          var l = s.trail[s.trail.length - 1], moved = !l || Math.hypot(from[0] - l.x, from[1] - l.y, from[2] - l.z) >= MIN_STEP;
          if (moved) { if (s.trail.length >= TRAIL_POINTS) s.trail.shift(); else if (room.t > 0) room.t--; else moved = false; if (moved) s.trail.push({ x: from[0], y: from[1], z: from[2], a: 0 }); }
        }
        /* trim to her Length */
        var len = clamp(rec.length, 0.1, MAX_LEN), acc = 0;
        for (var j = s.trail.length - 1; j > 0; j--) { acc += Math.hypot(s.trail[j].x - s.trail[j - 1].x, s.trail[j].y - s.trail[j - 1].y, s.trail[j].z - s.trail[j - 1].z); if (acc > len) { s.trail.splice(0, j); break; } }
      }
      function tickAll(dt) {
        var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        frame++; stats.ticks++;
        var ids = Object.keys(sims);
        if (!ids.length) return;
        ids.forEach(function (id) { if (!kapi.get(id)) { disposeRender(sims[id]); delete sims[id]; } });
        ids = Object.keys(sims); if (!ids.length) return;
        rot = (rot + 1) % ids.length;
        var room = { v: Math.max(0, effectiveBudget() - totalParticles()), t: Math.max(0, TRAIL_BUDGET - totalTrail()) };
        for (var n = 0; n < ids.length; n++) {
          var id = ids[(n + rot) % ids.length], s = sims[id], rec = kapi.get(id); if (!rec) continue;
          if (s.want && frame - s.stopFrame >= WAIT_FRAMES && !(s.lastStartT !== undefined && nowS() - s.lastStartT < RESTART)) { var w = s.want; s.want = null; begin(rec, s, w); }
          var from = s.mode !== 'stop' ? targetOf(rec) : null;
          if (rec.tab === 'trail') {
            stepTrail(rec, s, dt, from, room);
            if (s.mode === 'once') { s.onceT += dt; if (s.onceT >= TRAIL_ONCE) { s.mode = 'stop'; s.ended = true; g.emit('fx', { id: id, state: 'end' }); } }
            if (s.mode === 'stop' && s.gain <= 0) s.trail = [];
          } else {
            stepSim(rec, s, dt, room, from);
            if (s.mode === 'once' && s.burstLeft === 0 && s.n === 0) { s.mode = 'stop'; s.ended = true; g.emit('fx', { id: id, state: 'end' }); }
          }
          draw(s, rec);
        }
        var ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0; stats.lastMs = ms; if (ms > stats.maxMs) stats.maxMs = ms;
      }

      /* ---------- drawing (only when THREE and a scene exist) ---------- */
      function layerObj() {
        if (layer && layer.parent) return layer;
        var T = g.THREE, sc = g.scene(); if (!T || !sc || typeof sc.add !== 'function') return null;
        layer = new T.Group(); layer.name = 'gizmoNext_effects_layer'; sc.add(layer); return layer;
      }
      function disposeRender(s) {
        [s.obj, s.tobj].forEach(function (o) { if (!o) return; if (o.parent) o.parent.remove(o); if (o.geometry && o.geometry.dispose) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
        s.obj = s.tobj = null;
      }
      function draw(s, rec) {
        rec = rec || kapi.get(s.id); var T = g.THREE; if (!T || !rec || !T.BufferAttribute) return;
        var L = layerObj(); if (!L) return;
        if (rec.tab === 'particles') {
          if (!s.obj) {
            if (!s.n) return;
            var geo = new T.BufferGeometry(), cap = Math.min(BUDGET_MAX, 2000);
            s.cpos = new Float32Array(cap * 3); s.ccol = new Float32Array(cap * 3);
            geo.setAttribute('position', new T.BufferAttribute(s.cpos, 3)); geo.setAttribute('color', new T.BufferAttribute(s.ccol, 3));
            s.obj = new T.Points(geo, new T.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.obj.frustumCulled = false; s.obj.name = 'fx_' + s.id;
            L.add(s.obj);
          }
          var P = PRESETS[rec.preset] || PRESETS.sparks, n = s.n, i, sh = s.shown;
          for (i = 0; i < n; i++) {
            var al = API.alphaAt(s.age[i], s.life[i]), m = rec.preset === 'confetti' ? s.mix[i] : s.age[i] / s.life[i];
            s.cpos[i * 3] = s.pos[i * 3]; s.cpos[i * 3 + 1] = s.pos[i * 3 + 1]; s.cpos[i * 3 + 2] = s.pos[i * 3 + 2];
            if (sh) for (var q = 0; q < 3; q++) s.ccol[i * 3 + q] = (sh.s[q] + (sh.e[q] - sh.s[q]) * m) * al;
          }
          s.obj.geometry.setDrawRange(0, n); s.obj.geometry.attributes.position.needsUpdate = true; s.obj.geometry.attributes.color.needsUpdate = true;
          s.obj.material.size = P.size * (rec.size || 1); s.obj.visible = n > 0;
        } else {
          var pts = s.trail;
          if (!s.tobj) {
            if (pts.length < 2) return;
            var tg = new T.BufferGeometry(), cap2 = TRAIL_POINTS * 2;
            s.tpos = new Float32Array(cap2 * 3); s.tcol = new Float32Array(cap2 * 3);
            tg.setAttribute('position', new T.BufferAttribute(s.tpos, 3)); tg.setAttribute('color', new T.BufferAttribute(s.tcol, 3));
            var idx = []; for (var k2 = 0; k2 < TRAIL_POINTS - 1; k2++) { var a = k2 * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
            tg.setIndex(new T.BufferAttribute(new Uint16Array(idx), 1));
            s.tobj = new T.Mesh(tg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); s.tobj.frustumCulled = false; s.tobj.name = 'fxtrail_' + s.id;
            L.add(s.tobj);
          }
          var r = ribbon(pts, clamp(rec.width, 0.005, 0.5), rec.preset, (s.shown || { s: hexToRgb(rec.startColor) }).s, (s.shown || { e: hexToRgb(rec.endColor) }).e, s.gain);
          for (var v = 0; v < r.positions.length; v++) { s.tpos[v] = r.positions[v]; s.tcol[v] = r.colors[v]; }
          s.tobj.geometry.setDrawRange(0, Math.max(0, (pts.length - 1) * 6)); s.tobj.geometry.attributes.position.needsUpdate = true; s.tobj.geometry.attributes.color.needsUpdate = true; s.tobj.visible = pts.length > 1;
        }
      }

      /* ---------- the kind ---------- */
      function glyph(c, cx, cy) {
        c.beginPath(); c.moveTo(cx - 22, cy + 22); c.quadraticCurveTo(cx - 6, cy + 6, cx + 20, cy - 20); c.stroke();
        [[-18, -14], [-2, -22], [14, -6], [4, 10], [-22, 4]].forEach(function (d) { c.beginPath(); c.arc(cx + d[0], cy + d[1], 3, 0, 7); c.fill(); });
      }
      kapi = g.defineKind({
        id: 'effects', name: 'Effects', plural: 'Effects', col: '#e86cd2', H: 0, max: 12, copyable: true, resize: 'none',
        glyph: glyph,
        defaults: function () {
          return { tab: 'particles', preset: 'sparks', looping: false, playOnStart: false, length: 1, width: 0.05, startColor: '#ffd166', endColor: '#e86cd2', size: 1, follow: null };
        },
        fields: [
          { key: 'tab', label: 'Tab', type: 'enum', opts: [['particles', 'Particles'], ['trail', 'Trail']] },
          { key: 'preset', label: 'Preset', type: 'enum', opts: PRESET_OPTS },
          { key: 'looping', label: 'Looping', type: 'bool' },
          { key: 'playOnStart', label: 'Play on Start', type: 'bool' },
          { key: 'length', label: 'Length (m)', type: 'num', min: 0.1, max: MAX_LEN, step: 0.1 },
          { key: 'width', label: 'Width (m)', type: 'num', min: 0.005, max: 0.5, step: 0.01 },
          { key: 'size', label: 'Size', type: 'num', min: 0.25, max: 4, step: 0.25 }
        ],
        validate: function (rec) {
          rec.startColor = cleanHex(rec.startColor, '#ffd166'); rec.endColor = cleanHex(rec.endColor, '#e86cd2');
          var ok = rec.tab === 'trail' ? TRAIL_PRESETS.indexOf(rec.preset) >= 0 : !!PRESETS[rec.preset];
          if (!ok) rec.preset = rec.tab === 'trail' ? 'default' : 'sparks';
          if (rec.follow !== null && typeof rec.follow !== 'string') rec.follow = null;
          return true;
        },
        build: function (rec, T) {
          var grp = new T.Group(), col = '#e86cd2';
          grp.add(new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false })));
          var small = new T.BoxGeometry(0.2, 0.2, 0.2);
          grp.add(new T.Mesh(small, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false })));
          grp.add(new T.LineSegments(new T.EdgesGeometry(small), new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false })));
          return grp;
        },
        rows: function (rec, H) {
          var rows = [], R = function (l, ic, act, on) { var r = { label: plain(l), ic: ic, act: act }; if (on) r.on = on; rows.push(r); };
          var set = function (patch, say) { return function () { g.pushUndo(); API.setFields(rec.id, patch); if (say) H.say(say); H.redraw(); }; };
          R('Play once', 'play', function () { if (API.play(rec.id, 'once')) H.say('Playing once'); H.redraw(); });
          R('Loop', 'play', function () { if (API.play(rec.id, 'loop')) H.say('Looping'); H.redraw(); });
          R('Stop', 'stop', function () { API.stop(rec.id); H.say('Stopped'); H.redraw(); });
          R('Preview', null, function () { API.preview(rec.id); H.redraw(); });
          R('Tab: ' + (rec.tab === 'trail' ? 'Trail' : 'Particles'), null, set({ tab: rec.tab === 'trail' ? 'particles' : 'trail' }, 'Tab changed'));
          var list = rec.tab === 'trail' ? TRAIL_PRESETS : Object.keys(PRESETS);
          R('Preset: ' + rec.preset, null, function () { var n = list[(list.indexOf(rec.preset) + 1) % list.length]; g.pushUndo(); API.setFields(rec.id, { preset: n }); H.say('Preset: ' + n); H.redraw(); });
          var nextCol = function (cur) { var i = PALETTE.findIndex(function (p) { return p[1] === cur; }); return PALETTE[(i + 1) % PALETTE.length][1]; };
          R('Start colour: ' + colorName(rec.startColor), null, function () { var n = nextCol(rec.startColor); g.pushUndo(); API.setFields(rec.id, { startColor: n }); H.say('Start colour: ' + colorName(n)); H.redraw(); });
          R('End colour: ' + colorName(rec.endColor), null, function () { var n = nextCol(rec.endColor); g.pushUndo(); API.setFields(rec.id, { endColor: n }); H.say('End colour: ' + colorName(n)); H.redraw(); });
          R('Size: ' + rec.size + 'x', null, function () { var n = SIZES[(SIZES.indexOf(rec.size) + 1) % SIZES.length] || 1; g.pushUndo(); API.setFields(rec.id, { size: n }); H.say('Size: ' + n + 'x'); H.redraw(); });
          if (rec.tab === 'trail') {
            R('Length: ' + rec.length + ' m', null, function () { var o = [0.5, 1, 2, 4], n = o[(o.indexOf(rec.length) + 1) % o.length] || 1; g.pushUndo(); API.setFields(rec.id, { length: n }); H.redraw(); });
            R('Width: ' + rec.width + ' m', null, function () { var o = [0.02, 0.05, 0.1, 0.2], n = o[(o.indexOf(rec.width) + 1) % o.length] || 0.05; g.pushUndo(); API.setFields(rec.id, { width: n }); H.redraw(); });
          }
          R('Follow: ' + (rec.follow || 'this box'), null, function () { var all = [null, 'hand-left', 'hand-right'].concat(g.props().slice(0, 6).map(function (p) { return p && p.id; }).filter(Boolean)), n = all[(all.indexOf(rec.follow) + 1) % all.length]; g.pushUndo(); API.setFields(rec.id, { follow: n }); H.say('Follow: ' + (n || 'this box')); H.redraw(); });
          return rows;
        }
      });

      API.kind = kapi;
      API.add = function (spec) { if (g.isGuest()) { msg('Only the host places gizmos.'); return null; } return kapi.add(spec || {}); };
      API.get = function (id) { return kapi.get(id); };
      API.list = function () { return kapi.list.slice(); };
      API.setFields = function (id, patch) { if (g.isGuest()) return null; return kapi.set(id, patch); };
      API.layer = function () { return layer; };
      /* the live particles as [x, y, z, alpha], for the demo map and tests */
      API.points = function (id) { var s = sims[id], out = []; if (!s) return out; for (var i = 0; i < s.n; i++) out.push([s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2], API.alphaAt(s.age[i], s.life[i])]); return out; };
      API.object = function (id) { var s = sims[id]; return s ? (s.obj || s.tobj) : null; };

      /* the beat action (H2): effect {gizmoId, mode: once, loop, stop} */
      A.register('effect', {
        validate: function (p) { var o = {}; ['id', 't', 'slot', 'kind', 'hold'].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; }); o.gizmoId = typeof p.gizmoId === 'string' ? p.gizmoId.slice(0, 80) : ''; o.mode = p.mode === 'loop' || p.mode === 'stop' ? p.mode : 'once'; return o; },
        start: function (p) {
          if (p.mode === 'stop') { API.stop(p.gizmoId); return null; }
          API.play(p.gizmoId, p.mode);
          return p.mode === 'loop' ? { keep: true } : null;
        },
        stop: function (p) { if (p.mode === 'loop') stopLocal(p.gizmoId); }
      });

      var part = {
        alwaysTick: true,
        tick: tickAll,
        /* going live: Play on Start effects start (the host only). Going off: everything stops and clears. */
        onLive: function (on) {
          if (!on) { API.stopAll(); return; }
          if (g.isGuest()) return;
          kapi.list.forEach(function (rec) { if (rec.playOnStart) API.play(rec.id, rec.looping ? 'loop' : 'once'); });
        },
        state: function () { return budget === BUDGET ? null : { v: 1, budget: budget }; },
        load: function (s) { API.stopAll(); budget = isObj(s) && isNum(s.budget) ? clamp(Math.round(s.budget), BUDGET_MIN, BUDGET_MAX) : BUDGET; told = {}; },
        reset: function () { API.stopAll(); budget = BUDGET; told = {}; },
        sync: { parts: { fx: {
          encode: function () { return null; },
          validate: function (v) { return isObj(v) && typeof v.id === 'string' && v.id.length <= 40 && (v.mode === 'once' || v.mode === 'loop' || v.mode === 'stop'); },
          apply: function (v) { if (v.mode === 'stop') stopLocal(v.id); else startLocal(v.id, v.mode); }
        } } },
        dispose: function () { Object.keys(sims).forEach(function (id) { disposeRender(sims[id]); }); sims = {}; if (layer && layer.parent) layer.parent.remove(layer); layer = null; }
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN.fxPresets = PRESETS;
  GN.flashSafe = flashSafe;
  GN._effectsRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
