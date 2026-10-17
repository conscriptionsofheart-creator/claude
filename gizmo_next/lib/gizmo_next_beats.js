/* gizmo_next_beats.js: stage H1, the scene clock and the Beat strip. Plain classic JS, no page globals, THREE not needed.
   One timeline, not a second one. A beat is all the pins at one time t. The list is CastPins-shaped: [{id,t,slot,kind,pose|look|transform,...}].
   Sampling is a pure function of the list and t: the same t gives the same state, whether you played to it, scrubbed to it or joined late.
   Nothing starts by itself. A scene opens stopped, a load applies nothing, and the clock only moves after a person presses Play.
   Host calls it needs (all optional): ctx.pose {get,apply,blend?}, ctx.look {get,apply}, ctx.songTime(), ctx.selectedSlots(), ctx.figures(), ctx.props(), ctx.moveProp(id,tf).
   The page reaches it as GizmoNext.beats (or g.modules.beats). Later stages hang on it through onPass/onStop (H2 actions). */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');

  var MAX_PINS = 300, MAX_PIN_CHARS = 8000, MAX_T = 86400, MIN_LOOK_GAP = 0.4, MAX_CARDS = 24;
  var SAMPLED = { pose: 'pose', hand: 'pose', look: 'look', move: 'transform' };
  var MODES = ['once', 'loop', 'yoyo'];
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  var ICON = { pose: 'pose', hand: 'hand', look: 'look', move: 'move', say: 'voice', face: 'face', sound: 'sound', ragdoll: 'ragdoll', seat: 'seat', script: 'script', camera: 'camera', effect: 'effect' };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function r6(v) { return Math.round(v * 1000000) / 1000000; }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function noop() {}

  /* ---------- pure maths, also used by the tests ---------- */
  function smootherstep(x) { x = x <= 0 ? 0 : (x >= 1 ? 1 : x); return x * x * x * (x * (6 * x - 15) + 10); }

  /* raw seconds since the region start -> a time inside [lo,hi] for Once, Loop or Yoyo */
  function mapTime(raw, lo, hi, mode) {
    var span = hi - lo; if (!(span > 0)) return lo;
    if (!isNum(raw) || raw < 0) raw = 0;
    raw = r6(raw);
    if (mode === 'loop') return r6(lo + (raw % span));
    if (mode === 'yoyo') { var p = raw % (2 * span); return r6(lo + (p <= span ? p : 2 * span - p)); }
    return r6(lo + Math.min(raw, span));
  }

  function blend(a, b, k) {
    if (isNum(a) && isNum(b)) return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) { var o = new Array(a.length); for (var i = 0; i < a.length; i++) o[i] = blend(a[i], b[i], k); return o; }
    if (isObj(a) && isObj(b)) {
      var r = {}, key;
      for (key in a) if (!BAD[key] && Object.prototype.hasOwnProperty.call(a, key)) r[key] = Object.prototype.hasOwnProperty.call(b, key) ? blend(a[key], b[key], k) : copy(a[key]);
      for (key in b) if (!BAD[key] && Object.prototype.hasOwnProperty.call(b, key) && !Object.prototype.hasOwnProperty.call(a, key)) r[key] = copy(b[key]);
      return r;
    }
    return copy(k < 0.5 ? a : b);
  }
  function copy(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) { var a = new Array(v.length); for (var i = 0; i < v.length; i++) a[i] = copy(v[i]); return a; }
    var o = {}; for (var k in v) if (!BAD[k] && Object.prototype.hasOwnProperty.call(v, k)) o[k] = copy(v[k]);
    return o;
  }
  /* a value cleaned for keeping: finite numbers, short strings, bounded depth and width, no dangerous keys */
  function scrub(v, depth) {
    if (depth > 6) return null;
    if (isNum(v)) return Math.abs(v) > 1e7 ? 0 : v;
    if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) : v;
    if (typeof v === 'boolean' || v === null) return v;
    if (Array.isArray(v)) return v.slice(0, 128).map(function (x) { return scrub(x, depth + 1); });
    if (isObj(v)) {
      var o = {}, n = 0;
      for (var k in v) { if (!Object.prototype.hasOwnProperty.call(v, k) || BAD[k]) continue; if (++n > 128) break; o[String(k).slice(0, 40)] = scrub(v[k], depth + 1); }
      return o;
    }
    return null;
  }
  function same(a, b, tol) {
    if (isNum(a) && isNum(b)) return Math.abs(a - b) <= tol;
    if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!same(a[i], b[i], tol)) return false; return true; }
    if (isObj(a) && isObj(b)) {
      var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) { if (!Object.prototype.hasOwnProperty.call(b, ka[j]) || !same(a[ka[j]], b[ka[j]], tol)) return false; }
      return true;
    }
    return a === b;
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function register() {
    GN.register('beats', { needs: ['core'], version: 1 }, function (g) {
      var L = [];                         /* the beat list, sorted by t (stable) */
      var ver = 0, idN = 0;
      var cache = { ver: -1, groups: null, events: null, hash: 0, hashVer: -1 };
      var gap = 1.0, speed = 1, mode = 'once', bracket = null;
      var ranges = {}, rng = null;        /* named ranges (a trigger starts one), and the range being played now, which plays once whatever the loop mode */
      var st = 'stopped';                 /* 'stopped' | 'paused' | 'playing' */
      var tNow = 0, raw = 0;              /* the clock: mapped time, and seconds since the region start (unwrapped) */
      var started = null;                 /* the saved start state, taken the first time anything is applied */
      var last = {};                      /* last applied text for each slot and channel, so a still figure is not poked every frame */
      var selected = null, ui = [], uiAcc = 0, syncAcc = 0, lastWarn = 0, pendingSend = 0;
      var passFns = [], stopFns = [], pauseFns = [];
      var api = {};
      api.hooks = { pin: {}, list: [], rows: [] }; /* later stages: pin[kind](pin) returns the cleaned pin or null; list[i](pins) returns a new list. Both must be pure. */

      var guest = function () { return g.isGuest(); };
      var hostObj = function (n) { var o = g.ctx && g.ctx[n]; return o && typeof o === 'object' ? o : null; };
      var songT = function () { var v = g.call('songTime', null); return isNum(v) && v >= 0 ? v : null; };
      var say = function (t) { return g.say(t); };
      var touch = function () { applyListHooks(); ver++; if (!g._loading) g.persist(); g.emit('beat-change', { n: L.length }); paintUI(); };

      /* ---------- cleaning ---------- */
      function cleanSlot(s) {
        if (isNum(s) && s >= 0 && s <= 9999 && Math.floor(s) === s) return s;
        if (typeof s === 'string' && s.length && s.length <= 40 && !BAD[s]) return s;
        return null;
      }
      function byId(id) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
      function cleanPin(raw0, taken) {
        if (!isObj(raw0)) return null;
        var slot = cleanSlot(raw0.slot), kind = raw0.kind, t = raw0.t;
        if (slot === null || typeof kind !== 'string' || !/^[a-z][a-z0-9_]{0,23}$/.test(kind) || !isNum(t)) return null;
        var p = { id: '', t: r3(clamp(t, 0, MAX_T)), slot: slot, kind: kind };
        var pk = SAMPLED[kind];
        if (pk) {
          if (!isObj(raw0[pk]) && !(pk === 'pose' && Array.isArray(raw0[pk]))) return null;
          p[pk] = scrub(raw0[pk], 0);
          if (kind === 'move') { var pid = typeof raw0.propId === 'string' ? raw0.propId.slice(0, 40) : String(slot).replace(/^prop:/, ''); if (BAD[pid]) return null; p.propId = pid; }
        } else {
          var n = 0;
          for (var key in raw0) {
            if (!Object.prototype.hasOwnProperty.call(raw0, key) || BAD[key] || key === 'id' || key === 't' || key === 'slot' || key === 'kind' || key === 'hold') continue;
            if (++n > 16) break; p[String(key).slice(0, 24)] = scrub(raw0[key], 0);
          }
        }
        if (isNum(raw0.hold) && raw0.hold > 0) p.hold = r3(clamp(raw0.hold, 0, 600));
        var id = typeof raw0.id === 'string' && /^[A-Za-z0-9_.:-]{1,40}$/.test(raw0.id) && !BAD[raw0.id] && !(taken && taken[raw0.id]) ? raw0.id : '';
        if (!id) { do { idN++; id = 'b' + idN; } while (taken && taken[id]); }
        if (taken) taken[id] = 1;
        p.id = id;
        var hk = api.hooks.pin[kind];
        if (hk) { try { p = hk(p); } catch (e) { p = null; } if (!p || typeof p !== 'object') return null; }
        var size; try { size = JSON.stringify(p).length; } catch (e) { return null; }
        return size > MAX_PIN_CHARS ? null : p;
      }
      function sortList() {
        var idx = L.map(function (p, i) { return [p, i]; });
        idx.sort(function (a, b) { return a[0].t - b[0].t || a[1] - b[1]; });
        L = idx.map(function (x) { return x[0]; });
      }
      /* looks may change no faster than every 0.4 s: distinct look times are pushed apart (so at most 2.5 changes a second) */
      function enforceLook() {
        var times = [], i;
        for (i = 0; i < L.length; i++) if (L[i].kind === 'look' && times.indexOf(L[i].t) < 0) times.push(L[i].t);
        times.sort(function (a, b) { return a - b; });
        var prev = -1e9, moved = 0, map = {};
        times.forEach(function (T) {
          var nt = T;
          if (nt - prev < MIN_LOOK_GAP - 1e-9) nt = r3(prev + MIN_LOOK_GAP);
          if (nt !== T) { moved++; map[T] = nt; }
          prev = nt;
        });
        if (moved) for (i = 0; i < L.length; i++) if (L[i].kind === 'look' && map[L[i].t] !== undefined) L[i].t = map[L[i].t];
        if (moved) sortList();
        return moved;
      }
      function applyListHooks() {
        api.hooks.list.forEach(function (fn) {
          try {
            var r = fn(L.map(copy));
            if (Array.isArray(r)) { var taken = {}, next = []; r.slice(0, MAX_PINS).forEach(function (x) { var q = cleanPin(x, taken); if (q) next.push(q); }); L = next; sortList(); }
          } catch (e) { /* a hook must not break the list */ }
        });
      }
      var LOOK_MSG = 'Look changes are kept 0.4 seconds apart, so nothing flashes.';

      /* ---------- groups and the pure sampler ---------- */
      function groups() {
        if (cache.ver === ver && cache.groups) return cache.groups;
        var G = {}, order = [], ev = [];
        L.forEach(function (p) {
          if (!SAMPLED[p.kind]) { ev.push(p); return; }
          if (p.kind === 'look') {
            /* each part of a look (shader, clothes, eyes, skin ...) is its own timeline, so a beat that carries one part never touches the others */
            Object.keys(p.look).forEach(function (part) {
              var pk2 = String(p.slot) + '|look|' + part;
              if (!G[pk2]) { G[pk2] = { slot: p.slot, kind: 'look', part: part, pins: [] }; order.push(pk2); }
              G[pk2].pins.push({ t: p.t, hold: p.hold, kind: 'look', look: p.look[part] });
            });
            return;
          }
          var key = String(p.slot) + '|' + p.kind;
          if (!G[key]) { G[key] = { slot: p.slot, kind: p.kind, pins: [] }; order.push(key); }
          G[key].pins.push(p);
        });
        order.sort();
        cache.groups = order.map(function (k) { return G[k]; }); cache.events = ev; cache.ver = ver;
        return cache.groups;
      }
      function holdOf(p, nextT) {
        var gp = nextT - p.t, h = clamp(p.hold || 0, 0, Math.max(0, gp));
        if (p.kind === 'look') h = Math.min(h, Math.max(0, gp - MIN_LOOK_GAP));
        return h;
      }
      function blendFn(kind) {
        var P = hostObj('pose');
        if ((kind === 'pose' || kind === 'hand') && P && typeof P.blend === 'function') return function (a, b, k) { try { var r = P.blend(a, b, k); return r === undefined ? blend(a, b, k) : r; } catch (e) { return blend(a, b, k); } };
        return blend;
      }
      function sample(grp, t) {
        var pins = grp.pins, n = pins.length, pk = SAMPLED[grp.kind];
        if (t <= pins[0].t) return copy(pins[0][pk]);
        if (t >= pins[n - 1].t) return copy(pins[n - 1][pk]);
        var i = 0; while (i < n - 1 && pins[i + 1].t <= t) i++;
        var a = pins[i], b = pins[i + 1], start = a.t + holdOf(a, b.t);
        if (t <= start) return copy(a[pk]);
        var k = smootherstep((t - start) / (b.t - start));
        return blendFn(grp.kind)(a[pk], b[pk], k);
      }
      function stateAt(t) {
        t = isNum(t) ? t : 0;
        var out = {}, G = groups();
        for (var i = 0; i < G.length; i++) {
          var grp = G[i], s = String(grp.slot);
          if (grp.kind === 'look') {
            if (t < grp.pins[0].t - 1e-9) continue; /* before a part's first beat it is left alone */
            var o1 = out[s] = out[s] || {}; (o1.look = o1.look || {})[grp.part] = sample(grp, t);
          } else (out[s] = out[s] || {})[grp.kind] = sample(grp, t);
        }
        return out;
      }
      function slotOf(s) { var G = groups(); for (var i = 0; i < G.length; i++) if (String(G[i].slot) === s) return G[i].slot; return s; }

      /* ---------- the host's figures and props ---------- */
      function propObj(id) { var ps = g.props(); for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].id === id) return ps[i].object || null; return null; }
      function readTransform(o) {
        if (!o || !o.position || !o.rotation || !o.scale) return null;
        return { p: [r6(o.position.x), r6(o.position.y), r6(o.position.z)], r: [r6(o.rotation.x), r6(o.rotation.y), r6(o.rotation.z)], s: [r6(o.scale.x), r6(o.scale.y), r6(o.scale.z)] };
      }
      function writeTransform(propId, tf) {
        if (!isObj(tf)) return;
        var c = g.ctx;
        if (c && typeof c.moveProp === 'function') { try { c.moveProp(propId, tf); } catch (e) { /* host refused */ } return; }
        var o = propObj(propId); if (!o) return;
        try {
          if (Array.isArray(tf.p) && tf.p.length === 3) o.position.set(tf.p[0], tf.p[1], tf.p[2]);
          if (Array.isArray(tf.r) && tf.r.length === 3) o.rotation.set(tf.r[0], tf.r[1], tf.r[2]);
          if (Array.isArray(tf.s) && tf.s.length === 3) o.scale.set(tf.s[0], tf.s[1], tf.s[2]);
        } catch (e) { /* a prop that went away */ }
      }
      function readChannel(kind, slot) {
        var P = hostObj('pose'), K = hostObj('look');
        try {
          if (kind === 'move') return readTransform(propObj(String(slot).replace(/^prop:/, '')));
          if ((kind === 'pose' || kind === 'hand') && P && typeof P.get === 'function') { var v = P.get(slot, kind); return v === undefined || v === null ? null : scrub(v, 0); }
          if (kind === 'look' && K && typeof K.get === 'function') { var l = K.get(slot); return l === undefined || l === null ? null : scrub(l, 0); }
        } catch (e) { /* the figure went away */ }
        return null;
      }
      function writeChannel(kind, slot, val) {
        var P = hostObj('pose'), K = hostObj('look');
        try {
          if (kind === 'move') writeTransform(String(slot).replace(/^prop:/, ''), val);
          else if (kind === 'pose' && P && typeof P.apply === 'function') P.apply(slot, val, 1);
          else if (kind === 'hand' && P && typeof P.apply === 'function') P.apply(slot, val, 1, 'hand');
          else if (kind === 'look' && K && typeof K.apply === 'function') K.apply(slot, val, 1);
        } catch (e) { /* one figure must not stop the rest */ }
      }
      function ensureStart() {
        if (started) return;
        started = [];
        var seen = {};
        groups().forEach(function (grp) {
          var sk = String(grp.slot) + '|' + grp.kind; if (seen[sk]) return; seen[sk] = 1;
          var v = readChannel(grp.kind, grp.slot); if (v !== null) started.push({ slot: grp.slot, kind: grp.kind, val: v });
        });
      }
      function applyAt(t) {
        ensureStart();
        var S = stateAt(t), keys = Object.keys(S);
        for (var i = 0; i < keys.length; i++) {
          var s = keys[i], ch = S[s], slot = slotOf(s), kinds = Object.keys(ch);
          for (var j = 0; j < kinds.length; j++) {
            var kind = kinds[j], txt = JSON.stringify(ch[kind]), key = s + '|' + kind;
            if (last[key] === txt) continue;
            last[key] = txt; writeChannel(kind, slot, ch[kind]);
          }
        }
        return S;
      }
      function restoreStart() {
        var s = started; started = null; last = {};
        if (s) s.forEach(function (e) { writeChannel(e.kind, e.slot, e.val); });
      }

      /* ---------- the clock ---------- */
      function length() { var m = 0; L.forEach(function (p) { var e = p.t + (p.hold || 0); if (e > m) m = e; }); return r3(m); }
      function region() {
        if (rng) return [rng.a, rng.b];
        if (bracket) return [bracket.a, bracket.b];
        return [0, length()];
      }
      function curMode() { return rng ? 'once' : mode;
      }
      function setT(t) { tNow = r6(t); }
      function startRaw(from) { var lo = region()[0]; raw = Math.max(0, r6(from - lo)); }
      /* the core allows 10 messages a second for each part; a change that is dropped is tried again for up to 3 s, so a Stop is never lost */
      function sendTransport(retry) {
        if (guest() || g.isPrivate() || !(g.ctx && g.ctx.sync)) return;
        if (!g.send('beats', api.sync.parts.beats.encode()) && retry) pendingSend = 3;
      }

      function crossEvents(prev, cur) {
        if (!passFns.length) return;
        groups();
        var ev = cache.events; if (!ev.length) return;
        var r = region(), lo = r[0], hi = r[1], span = hi - lo; if (!(span > 0)) return;
        var period = curMode() === 'yoyo' ? 2 * span : span;
        var j0 = Math.floor(prev / period), j1 = Math.floor((cur + 2e-9) / period); /* the same small allowance as the test below, so a beat exactly at a wrap is never skipped by a rounding error */
        if (j1 - j0 > 50) j0 = j1 - 50;
        if (curMode() === 'once') { j0 = 0; j1 = 0; } /* a play once does not wrap: the beat at the start must not start again when the end is reached */
        var out = [];
        for (var j = j0; j <= j1; j++) for (var i = 0; i < ev.length; i++) {
          var p = ev[i]; if (p.t < lo - 1e-9 || p.t > hi + 1e-9) continue;
          if (p.t >= hi - 1e-9 && curMode() !== 'once' && p.t > lo + 1e-9) continue;
          var rr = j * period + (p.t - lo);
          if (rr > prev + 1e-9 && rr <= cur + 1e-9) out.push({ r: rr, o: i, p: p });
        }
        if (!out.length) return;
        out.sort(function (a, b) { return a.r - b.r || a.o - b.o; });
        var pins = out.map(function (x) { return copy(x.p); }), info = { t: tNow, from: prev, to: cur, mode: curMode() };
        passFns.slice().forEach(function (f) { try { f(pins, info); } catch (e) { g.log({ who: 'beats', what: 'A beat action stopped with an error' }); } });
      }

      function advance(dt) {
        var r = region(), lo = r[0], hi = r[1], span = hi - lo, prev = raw, song = songT();
        if (song !== null) {
          raw = Math.max(0, r6(song - lo)); setT(song);
          applyAt(tNow);
          if (raw > prev && raw - prev < 0.5) crossEvents(prev, raw);
          return;
        }
        if (!(span > 0)) { st = 'paused'; return; }
        raw = raw + dt * speed; /* not rounded here: rounding every frame would drift; the mapped time is rounded to a microsecond instead */
        setT(mapTime(raw, lo, hi, curMode()));
        applyAt(tNow);
        if (curMode() === 'once' && raw >= span - 1e-9) {
          raw = span; setT(hi); applyAt(tNow);
          crossEvents(prev, raw);
          rng = null; st = 'paused'; g.emit('beat-end', { t: tNow }); sendTransport(true); paintUI();
          return;
        }
        crossEvents(prev, raw);
      }

      /* ---------- transport ---------- */
      function playNow(fromT) {
        var r = region(), lo = r[0], hi = r[1];
        if (hi - lo <= 0.001) { say('Add at least two beats first, then press Play.'); return false; }
        ensureStart();
        var from = isNum(fromT) ? fromT : tNow;
        if (!isNum(fromT) && curMode() === 'once' && tNow >= hi - 1e-6) from = lo;
        from = clamp(from, lo, hi);
        startRaw(from); setT(from);
        st = 'playing';
        applyAt(tNow);
        crossEvents(raw - 1e-6, raw);
        g.log({ who: 'beats', what: 'Playing from ' + fmt(tNow) + ' s' });
        g.emit('beat-play', { t: tNow, mode: mode });
        sendTransport(true); paintUI();
        return true;
      }
      function pauseNow() { if (st !== 'playing') return false; st = 'paused'; pauseFns.slice().forEach(function (f) { try { f(); } catch (e) { /* a listener must not stop the pause */ } }); sendTransport(true); paintUI(); return true; }
      function stopNow() {
        var was = st; st = 'stopped'; rng = null; raw = 0; setT(0);
        restoreStart();
        stopFns.slice().forEach(function (f) { try { f({ was: was }); } catch (e) { /* a stopper must not stop the rest */ } });
        g.log({ who: 'beats', what: 'Stopped, figures put back' });
        g.emit('beat-stop', { was: was });
        sendTransport(true); paintUI();
        return true;
      }
      function scrubNow(t) {
        var len = length(), hi = bracket ? Math.max(bracket.b, len) : len;
        t = clamp(isNum(t) ? t : 0, 0, hi);
        startRaw(clamp(t, region()[0], region()[1])); setT(t);
        if (st === 'stopped' && L.length) st = 'paused';
        applyAt(tNow);
        sendTransport(false); paintUI();
        return true;
      }
      var needHost = function (what) { if (guest()) { say('Only the host can ' + what + '.'); return true; } return false; };

      /* ---------- beats ---------- */
      function addPin(spec, quiet) {
        var taken = {}; L.forEach(function (p) { taken[p.id] = 1; });
        var p = cleanPin(spec, taken);
        if (!p) return null;
        if (SAMPLED[p.kind]) {
          for (var i = 0; i < L.length; i++) {
            var q = L[i];
            if (q.kind === p.kind && String(q.slot) === String(p.slot) && Math.abs(q.t - p.t) < 0.0005) { p.id = q.id; if (q.hold && !p.hold) p.hold = q.hold; L[i] = p; sortList(); return p; }
          }
        }
        if (L.length >= MAX_PINS) { if (!quiet) say('That is as many beats as one scene holds. Delete a few first.'); return null; }
        L.push(p); sortList();
        if (p.kind === 'look' && enforceLook() && !quiet) say(LOOK_MSG);
        return p;
      }
      function pinCopy(p) { return p ? copy(p) : null; }
      function minimalPin(p) { return pinCopy(byId(p.id)) || pinCopy(p); }

      api.add = function (spec) {
        if (needHost('change beats')) return null;
        if (!isObj(spec)) return null;
        var raw1 = { slot: spec.slot, kind: spec.kind, t: isNum(spec.t) ? spec.t : tNow };
        var pk = SAMPLED[spec.kind];
        if (pk) {
          var pay = spec.payload !== undefined ? spec.payload : spec[pk];
          if (pay === undefined) pay = readChannel(spec.kind, spec.slot);
          raw1[pk] = pay;
          if (spec.kind === 'move') raw1.propId = spec.propId;
        } else if (isObj(spec.payload)) Object.keys(spec.payload).forEach(function (k) { raw1[k] = spec.payload[k]; });
        if (isNum(spec.hold)) raw1.hold = spec.hold;
        var p = addPin(raw1);
        if (!p) return null;
        touch();
        return minimalPin(p);
      };
      api.remove = function (id) {
        if (needHost('delete beats')) return false;
        for (var i = 0; i < L.length; i++) if (L[i].id === id) { L.splice(i, 1); if (selected === id) selected = null; touch(); return true; }
        return false;
      };
      api.removeBeat = function (id) {
        if (needHost('delete beats')) return false;
        var p = byId(id); if (!p) return false;
        var t = p.t; L = L.filter(function (q) { return q.t !== t; }); selected = null; touch();
        return true;
      };
      api.retime = function (id, t) {
        if (needHost('move beats')) return false;
        var p = byId(id); if (!p || !isNum(t)) return false;
        t = r3(clamp(t, 0, MAX_T));
        if (SAMPLED[p.kind] && L.some(function (q) { return q !== p && q.kind === p.kind && String(q.slot) === String(p.slot) && Math.abs(q.t - t) < 0.0005; })) { say('That figure already has a beat at that time.'); return false; }
        p.t = t; sortList(); if (p.kind === 'look' && enforceLook()) say(LOOK_MSG);
        touch(); return true;
      };
      api.retimeBeat = function (id, t) {
        if (needHost('move beats')) return false;
        var p = byId(id); if (!p || !isNum(t)) return false;
        var t0 = p.t; t = r3(clamp(t, 0, MAX_T));
        if (L.some(function (q) { return q.t !== t0 && Math.abs(q.t - t) < 0.0005 && L.some(function (z) { return z.t === t0 && z.kind === q.kind && String(z.slot) === String(q.slot) && SAMPLED[z.kind]; }); })) { say('A beat is already at that time.'); return false; }
        L.forEach(function (q) { if (q.t === t0) q.t = t; });
        sortList(); if (enforceLook()) say(LOOK_MSG);
        touch(); return true;
      };
      api.setHold = function (id, h) {
        if (needHost('change beats')) return false;
        var p = byId(id); if (!p || !isNum(h)) return false;
        if (h > 0) p.hold = r3(clamp(h, 0, 600)); else delete p.hold;
        touch(); return true;
      };
      api.list = function () { return L.map(copy); };
      api.get = function (id) { return pinCopy(byId(id)); };
      api.length = length;

      /* Add beat: capture the chosen figures, refuse what has not changed, then move the clock on by the gap */
      api.addBeatNow = function (slots, opts) {
        opts = opts || {};
        if (needHost('add beats')) return { ok: false, reason: 'guest' };
        var list = Array.isArray(slots) ? slots.slice() : null;
        if (!list) { var sel = g.call('selectedSlots', null); list = Array.isArray(sel) && sel.length ? sel.slice() : g.figures().map(function (f) { return f && f.slot; }); }
        list = list.filter(function (s) { return cleanSlot(s) !== null; });
        if (!list.length) { say('Select a figure first, then press Add beat.'); return { ok: false, reason: 'nobody' }; }
        if (st === 'playing') pauseNow();
        var t = tNow, base = L.length ? stateAt(t) : {}, jobs = [], skipped = [];
        list.forEach(function (slot) {
          var isProp = typeof slot === 'string' && slot.indexOf('prop:') === 0;
          var want = isProp ? ['move'] : (opts.look ? ['pose', 'look'] : ['pose']);
          want.forEach(function (kind) {
            var v = readChannel(kind, slot);
            if (v === null) { skipped.push(slot + ':' + kind); return; }
            var cur = base[String(slot)] && base[String(slot)][kind];
            if (cur !== undefined && same(cur, v, 1e-4)) { skipped.push(slot + ':' + kind); return; }
            jobs.push({ slot: slot, kind: kind, v: v });
          });
        });
        if (!jobs.length) {
          say(skipped.length ? 'Nothing changed, so no beat was added. Move the figure first.' : 'There is nothing to record. Select a figure first.');
          return { ok: false, reason: skipped.length ? 'unchanged' : 'nothing', skipped: skipped };
        }
        g.pushUndo();
        var ids = [], full = false;
        jobs.forEach(function (j) {
          var spec = { slot: j.slot, kind: j.kind, t: t };
          var pk = SAMPLED[j.kind]; spec[pk] = j.v;
          if (j.kind === 'move') spec.propId = String(j.slot).replace(/^prop:/, '');
          var p = addPin(spec, true); if (p) ids.push(p.id); else full = true;
        });
        if (full) say('That is as many beats as one scene holds. Delete a few first.');
        if (!ids.length) return { ok: false, reason: 'full' };
        setT(r3(t + gap)); startRaw(clamp(tNow, region()[0], Math.max(region()[0], region()[1])));
        if (L.some(function (q) { return q.kind === 'look' && ids.indexOf(q.id) >= 0 && q.t !== t; })) say(LOOK_MSG);
        touch();
        say('Beat added at ' + fmt(t) + ' s.');
        return { ok: true, t: t, ids: ids, skipped: skipped };
      };

      /* old untimed keyframes -> beats at 0, gap, 2 gap ... The frames themselves are never touched */
      function frameBodies(frame) {
        var out = [];
        if (!frame) return out;
        var push = function (slot, pose) { if (cleanSlot(slot) !== null && (isObj(pose) || Array.isArray(pose))) out.push({ slot: slot, pose: pose }); };
        var list = Array.isArray(frame) ? frame : (Array.isArray(frame.bodies) ? frame.bodies : null);
        if (list) { list.forEach(function (b, i) { if (!isObj(b)) return; var slot = b.slot !== undefined ? b.slot : i; var pose = b.pose !== undefined ? b.pose : (function () { var c = Object.assign({}, b); delete c.slot; return c; })(); push(slot, pose); }); return out; }
        if (isObj(frame.poses)) { Object.keys(frame.poses).forEach(function (k) { push(/^\d+$/.test(k) ? Number(k) : k, frame.poses[k]); }); return out; }
        if (isObj(frame)) Object.keys(frame).forEach(function (k) { if (isObj(frame[k]) && k !== 'props' && k !== 'creatures') push(/^\d+$/.test(k) ? Number(k) : k, frame[k]); });
        return out;
      }
      api.convertKeyframes = function (frames, gp, opts) {
        if (needHost('convert keyframes')) return { ok: false, added: 0, beats: [] };
        if (!Array.isArray(frames) || !frames.length) { say('There are no keyframes to convert.'); return { ok: false, added: 0, beats: [] }; }
        var step = isNum(gp) ? clamp(gp, 0.1, 60) : 1.0, t0 = opts && isNum(opts.startAt) ? opts.startAt : 0, added = [];
        g.pushUndo();
        frames.slice(0, 120).forEach(function (fr, i) {
          frameBodies(fr).forEach(function (b) { var p = addPin({ slot: b.slot, kind: 'pose', t: t0 + i * step, pose: copy(b.pose) }, true); if (p) added.push(minimalPin(p)); });
        });
        if (added.length) { touch(); say('Turned ' + frames.length + ' keyframes into beats. The old keyframes are still there.'); }
        return { ok: added.length > 0, added: added.length, beats: added };
      };

      /* ---------- pins, the CastPins-shaped list ---------- */
      api.pins = function () { return L.map(copy); };
      api.pinsSet = function (arr) {
        if (!Array.isArray(arr)) return 0;
        var taken = {}, next = [];
        arr.slice(0, MAX_PINS).forEach(function (r) { var p = cleanPin(r, taken); if (p) next.push(p); });
        L = next; sortList();
        if (enforceLook()) g.log({ who: 'beats', what: 'Some look changes were spread out so nothing flashes' });
        if (selected && !byId(selected)) selected = null;
        touch();
        return L.length;
      };

      /* ---------- clock facade ---------- */
      var clock = {};
      Object.defineProperties(clock, {
        t: { get: function () { return tNow; }, enumerable: true },
        length: { get: length, enumerable: true },
        playing: { get: function () { return st === 'playing'; }, enumerable: true },
        mode: { get: function () { return mode; }, set: function (m) { api.setMode(m); }, enumerable: true },
        bracket: { get: function () { return bracket ? { a: bracket.a, b: bracket.b } : null; }, enumerable: true },
        speed: { get: function () { return speed; }, enumerable: true },
        gap: { get: function () { return gap; }, enumerable: true },
        state: { get: function () { return st; }, enumerable: true }
      });
      api.clock = clock;
      api.time = function () { var s = songT(); return s !== null ? s : tNow; };
      api.play = function (fromT) { if (needHost('press Play')) return false; return playNow(fromT); };
      api.pause = function () { if (needHost('press Pause')) return false; return pauseNow(); };
      api.stop = function () { if (needHost('press Stop')) return false; return stopNow(); };
      api.scrub = function (t) { if (needHost('scrub')) return false; return scrubNow(t); };
      api.setSpeed = function (x) { if (!isNum(x)) return false; speed = clamp(x, 0.1, 4); sendTransport(true); touch(); return true; };
      api.setGap = function (x) { if (!isNum(x)) return false; gap = clamp(x, 0.1, 60); touch(); return true; };
      api.setMode = function (m) {
        if (needHost('change the loop mode')) return false;
        if (MODES.indexOf(m) < 0) return false;
        mode = m; if (st === 'playing') { var r = region(); startRaw(clamp(tNow, r[0], r[1])); }
        sendTransport(true); touch(); return true;
      };
      api.setBracket = function (a, b) {
        if (needHost('set the loop bracket')) return false;
        if (!isNum(a) || !isNum(b)) return false;
        a = r3(clamp(a, 0, MAX_T)); b = r3(clamp(b, 0, MAX_T));
        if (b - a < 0.05) { say('The loop bracket needs a little room. Put the end after the start.'); return false; }
        bracket = { a: a, b: b }; if (st === 'playing') startRaw(clamp(tNow, a, b));
        sendTransport(true); touch(); return true;
      };
      api.clearBracket = function () { if (needHost('clear the loop bracket')) return false; bracket = null; if (st === 'playing') startRaw(clamp(tNow, 0, length())); sendTransport(true); touch(); return true; };
      api.stateAt = stateAt;
      api.applyAt = function (t) { return applyAt(isNum(t) ? t : tNow); };
      api.onPass = function (fn) { if (typeof fn === 'function') passFns.push(fn); return api; };
      api.onPause = function (fn) { if (typeof fn === 'function') pauseFns.push(fn); return api; };
      api.setClock = function (t) {
        if (needHost('move the clock')) return false;
        if (!isNum(t)) return false;
        setT(r3(clamp(t, 0, MAX_T))); startRaw(clamp(tNow, region()[0], Math.max(region()[0], region()[1]))); paintUI(); return true;
      };
      /* named ranges: a trigger (H3) plays one by name, once, from its start to its end */
      api.setRange = function (name, a, b) {
        if (needHost('save a beat range')) return false;
        if (typeof name !== 'string' || !name.length || name.length > 40 || BAD[name] || !isNum(a) || !isNum(b)) return false;
        a = r3(clamp(a, 0, MAX_T)); b = r3(clamp(b, 0, MAX_T));
        if (b - a < 0.05) { say('A beat range needs a little room. Put the end after the start.'); return false; }
        if (!ranges[name] && Object.keys(ranges).length >= 24) { say('That is as many named ranges as a scene holds.'); return false; }
        ranges[name] = { a: a, b: b }; touch(); return true;
      };
      api.delRange = function (name) { if (needHost('delete a beat range')) return false; if (!ranges[name]) return false; delete ranges[name]; touch(); return true; };
      api.getRange = function (name) { var r = ranges[name]; return r ? { name: name, a: r.a, b: r.b } : null; };
      api.listRanges = function () { return Object.keys(ranges).sort().map(function (n) { return { name: n, a: ranges[n].a, b: ranges[n].b }; }); };
      api.playRange = function (name) {
        if (guest()) return false;
        var r = ranges[name];
        if (!r) { say('There is no beat range called ' + String(name).slice(0, 40) + ' yet.'); return false; }
        rng = { a: r.a, b: r.b };
        var ok = playNow(r.a); if (!ok) rng = null;
        return ok;
      };
      api.onStop = function (fn) { if (typeof fn === 'function') stopFns.push(fn); return api; };
      api.math = { smootherstep: smootherstep, mapTime: mapTime, blend: blend, same: same };
      api.icons = ICON;
      api.limits = { maxPins: MAX_PINS, minLookGap: MIN_LOOK_GAP };

      /* ---------- the strip ---------- */
      var strip = {};
      strip.model = function () {
        var cards = [], by = {};
        L.forEach(function (p) {
          var key = String(p.t), c = by[key];
          if (!c) { c = by[key] = { id: p.id, ids: [], t: p.t, slot: p.slot, slots: [], thumbKey: 'slot:' + p.slot, icons: [], hold: 0, selected: false }; cards.push(c); }
          c.ids.push(p.id);
          if (c.slots.indexOf(p.slot) < 0) c.slots.push(p.slot);
          var ic = ICON[p.kind] || 'beat'; if (c.icons.indexOf(ic) < 0) c.icons.push(ic);
          if ((p.hold || 0) > c.hold) c.hold = p.hold;
        });
        cards.forEach(function (c) { c.selected = selected !== null && c.ids.indexOf(selected) >= 0; });
        return cards;
      };
      strip.select = function (id) { selected = byId(id) ? id : null; paintUI(); return selected; };
      strip.selected = function () { return selected; };
      var KIND_WORD = { pose: 'pose', hand: 'hand', look: 'look', move: 'move', say: 'voice', face: 'face', sound: 'sound', ragdoll: 'ragdoll', seat: 'seat', script: 'script', camera: 'camera', effect: 'effects' };
      function cardLabel(c, i) {
        var words = c.icons.map(function (n) { for (var k in ICON) if (ICON[k] === n) return KIND_WORD[k] || n; return n; });
        return (i + 1) + '. ' + fmt(c.t) + ' s, ' + words.join(' and ');
      }
      strip.rows = function (H) {
        H = H || {};
        var h = { say: function (t) { if (typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else say(t); }, redraw: function () { if (typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } };
        var rows = [], cards = strip.model(), nCards = cards.length;
        var R = function (label, ic, act, on) { var r = { label: plain(label), ic: ic, act: act }; if (on) r.on = on; rows.push(r); };
        if (guest()) {
          R('Beat strip: the host plays it for everyone', null, noop);
          R('Beats: ' + nCards + ', ' + (st === 'playing' ? 'playing at ' + fmt(tNow) + ' s' : 'stopped'), null, noop);
          return rows;
        }
        var done = function (msg) { if (msg) h.say(msg); h.redraw(); };
        R('Add beat', 'plus', function () { api.addBeatNow(null); h.redraw(); });
        R('Add beat with look', 'plus', function () { api.addBeatNow(null, { look: true }); h.redraw(); });
        R(st === 'playing' ? 'Pause' : 'Play', st === 'playing' ? 'pause' : 'play', function () { if (st === 'playing') pauseNow(); else playNow(); h.redraw(); }, function () { return st === 'playing'; });
        R('Stop', 'stop', function () { stopNow(); done('Stopped. The figures are back where they were.'); });
        R('Loop mode: ' + mode.charAt(0).toUpperCase() + mode.slice(1), 'loop', function () { api.setMode(MODES[(MODES.indexOf(mode) + 1) % 3]); done('Loop mode: ' + mode); });
        R('Gap between beats: ' + fmt(gap) + ' s', 'clock', function () { var o = [0.5, 1, 1.5, 2, 3], i = o.indexOf(gap); api.setGap(o[(i + 1) % o.length]); done('Gap: ' + fmt(gap) + ' seconds'); });
        R('Speed: ' + speed + 'x', 'clock', function () { var o = [0.5, 1, 2], i = o.indexOf(speed); api.setSpeed(o[(i + 1) % o.length]); done('Speed: ' + speed + 'x'); });
        R('Bracket start here' + (bracket ? ' (now ' + fmt(bracket.a) + ' s)' : ''), 'left', function () { var e = bracket ? bracket.b : Math.max(length(), tNow + 1); if (api.setBracket(Math.min(tNow, e - 0.1), e)) done('Loop starts at ' + fmt(bracket.a) + ' seconds'); });
        R('Bracket end here' + (bracket ? ' (now ' + fmt(bracket.b) + ' s)' : ''), 'right', function () { var s0 = bracket ? bracket.a : 0; if (api.setBracket(s0, Math.max(tNow, s0 + 0.1))) done('Loop ends at ' + fmt(bracket.b) + ' seconds'); });
        if (bracket) R('Clear the bracket', 'trash', function () { api.clearBracket(); done('Bracket cleared'); });
        ['Greeting', 'Intro', 'Outro'].forEach(function (nm) {
          var have = ranges[nm];
          R('Save range: ' + nm + (have ? ' (now ' + fmt(have.a) + ' to ' + fmt(have.b) + ' s)' : ''), 'plus', function () { var rr = region(); if (api.setRange(nm, rr[0], rr[1])) done('Saved the range ' + nm + ', ' + fmt(rr[0]) + ' to ' + fmt(rr[1]) + ' seconds'); });
        });
        if (selected && byId(selected)) {
          var sp = byId(selected);
          R('Play from here', 'play', function () { playNow(sp.t); h.redraw(); });
          R('Move earlier by 0.1 s', 'left', function () { api.retimeBeat(selected, Math.max(0, sp.t - 0.1)); h.redraw(); });
          R('Move later by 0.1 s', 'right', function () { api.retimeBeat(selected, sp.t + 0.1); h.redraw(); });
          R('Delete this beat', 'trash', function () { g.pushUndo(); api.removeBeat(selected); done('Beat deleted'); });
        }
        api.hooks.rows.forEach(function (fn) {
          try { var ex = fn(h); if (Array.isArray(ex)) ex.forEach(function (r) { if (r && r.label != null) R(r.label, r.ic || null, r.act || noop, r.on); }); } catch (e) { /* a stage's rows must not break the strip */ }
        });
        cards.slice(0, MAX_CARDS).forEach(function (c, i) {
          R(cardLabel(c, i), c.icons[0] || null, function () { selected = c.id; scrubNow(c.t); h.redraw(); }, function () { return c.selected; });
        });
        if (nCards > MAX_CARDS) R('And ' + (nCards - MAX_CARDS) + ' more beats', null, noop);
        return rows;
      };
      api.strip = strip;

      /* ---------- the 2D Animate panel ---------- */
      function paintUI() { for (var i = 0; i < ui.length; i++) { try { ui[i](); } catch (e) { /* a panel that went away */ } } }
      api.mountPanel = function (el) {
        var doc = el && (el.ownerDocument || (typeof document !== 'undefined' ? document : null)); if (!doc) return false;
        var mk = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
        var box = mk('div', 'gn-beats'), title = mk('div', 'gn-title', 'Beat strip'), status = mk('div', 'gn-status', ''), cardsEl = mk('div', 'gn-cards', '');
        box.appendChild(title); box.appendChild(status);
        var scr = null;
        if (!guest()) {
          var bar = mk('div', 'gn-bar'), btn = function (txt, fn) { var b = mk('button', 'gn-btn', txt); b.addEventListener('click', function () { try { fn(); } catch (e) { /* ignore */ } paintUI(); }); bar.appendChild(b); return b; };
          btn('Add beat', function () { api.addBeatNow(null); });
          var playB = btn('Play', function () { if (st === 'playing') pauseNow(); else playNow(); });
          btn('Stop', function () { stopNow(); });
          var modeB = btn('Once', function () { api.setMode(MODES[(MODES.indexOf(mode) + 1) % 3]); });
          var delB = btn('Delete beat', function () { if (selected) { g.pushUndo(); api.removeBeat(selected); } });
          box.appendChild(bar);
          scr = mk('input', 'gn-scrub'); scr.type = 'range'; scr.min = 0; scr.max = 1; scr.step = 0.01; scr.value = 0;
          scr.addEventListener('input', function () { scrubNow(Number(scr.value)); });
          box.appendChild(scr);
          ui.push(function () { playB.textContent = st === 'playing' ? 'Pause' : 'Play'; modeB.textContent = mode.charAt(0).toUpperCase() + mode.slice(1); });
        }
        box.appendChild(cardsEl);
        ui.push(function () {
          status.textContent = guest() ? 'Beats: ' + L.length + (st === 'playing' ? ', playing at ' + fmt(tNow) + ' s' : ', stopped') : 'Beats: ' + L.length + ', at ' + fmt(tNow) + ' of ' + fmt(length()) + ' s, ' + st;
          if (scr) { scr.max = Math.max(0.1, length()); scr.value = tNow; }
          cardsEl.textContent = '';
          strip.model().slice(0, MAX_CARDS).forEach(function (c, i) {
            var b = mk(guest() ? 'div' : 'button', 'gn-card' + (c.selected ? ' on' : ''), cardLabel(c, i));
            if (!guest()) b.addEventListener('click', function () { selected = c.id; scrubNow(c.t); });
            cardsEl.appendChild(b);
          });
        });
        el.appendChild(box); paintUI();
        return true;
      };

      /* ---------- save, load, reset: a load applies nothing and starts nothing ---------- */
      function quiet() { st = 'stopped'; rng = null; raw = 0; tNow = 0; started = null; last = {}; selected = null; }
      api.state = function () {
        if (!L.length && gap === 1 && mode === 'once' && speed === 1 && !bracket && !Object.keys(ranges).length) return null;
        return { v: 1, pins: L.map(copy), mode: mode, gap: gap, speed: speed, bracket: bracket ? { a: bracket.a, b: bracket.b } : null, ranges: api.listRanges() };
      };
      api.load = function (s) {
        quiet(); L = []; mode = 'once'; gap = 1; speed = 1; bracket = null; ranges = {};
        if (isObj(s)) {
          if (Array.isArray(s.ranges)) s.ranges.slice(0, 24).forEach(function (r) { if (isObj(r) && typeof r.name === 'string' && r.name.length && r.name.length <= 40 && !BAD[r.name] && isNum(r.a) && isNum(r.b) && r.b - r.a >= 0.05) ranges[r.name] = { a: r3(clamp(r.a, 0, MAX_T)), b: r3(clamp(r.b, 0, MAX_T)) }; });
          var taken = {};
          if (Array.isArray(s.pins)) s.pins.slice(0, MAX_PINS).forEach(function (r) { var p = cleanPin(r, taken); if (p) L.push(p); });
          if (MODES.indexOf(s.mode) >= 0) mode = s.mode;
          if (isNum(s.gap)) gap = clamp(s.gap, 0.1, 60);
          if (isNum(s.speed)) speed = clamp(s.speed, 0.1, 4);
          if (isObj(s.bracket) && isNum(s.bracket.a) && isNum(s.bracket.b) && s.bracket.b - s.bracket.a >= 0.05) bracket = { a: r3(clamp(s.bracket.a, 0, MAX_T)), b: r3(clamp(s.bracket.b, 0, MAX_T)) };
          sortList();
          if (enforceLook()) g.log({ who: 'beats', what: 'Some look changes were spread out so nothing flashes' });
          applyListHooks();
        }
        ver++; g.emit('beat-change', { n: L.length }); paintUI();
      };
      api.reset = function () { quiet(); L = []; mode = 'once'; gap = 1; speed = 1; bracket = null; ranges = {}; ver++; g.emit('beat-change', { n: 0 }); paintUI(); };

      /* ---------- friends: the host's transport, the same pure function of time ---------- */
      function hash() {
        if (cache.hashVer !== ver) { cache.hash = hashStr(JSON.stringify(L)).toString(36); /* text, because the core refuses numbers of ten million and up */ cache.hashVer = ver; }
        return cache.hash;
      }
      api.sync = {
        parts: {
          beats: {
            encode: function () { return { st: st, t: tNow, speed: speed, mode: mode, br: bracket ? [bracket.a, bracket.b] : null, h: hash(), n: L.length }; },
            validate: function (v) {
              return isObj(v) && (v.st === 'stopped' || v.st === 'paused' || v.st === 'playing') && isNum(v.t) && v.t >= 0 && v.t <= MAX_T && isNum(v.speed) && v.speed >= 0.1 && v.speed <= 4 &&
                MODES.indexOf(v.mode) >= 0 && (v.br === null || (Array.isArray(v.br) && v.br.length === 2 && isNum(v.br[0]) && isNum(v.br[1]) && v.br[0] >= 0 && v.br[1] <= MAX_T)) && typeof v.h === 'string' && v.h.length <= 12 && isNum(v.n) && v.n >= 0 && v.n <= MAX_PINS;
            },
            apply: function (v) {
              if (v.h !== hash()) {
                var t = g.now(); if (t - lastWarn > 5000) { lastWarn = t; g.log({ who: 'beats', what: 'The host beats differ from these, so they wait for the host list' }); }
                return;
              }
              speed = v.speed; mode = v.mode; bracket = v.br && v.br[1] - v.br[0] >= 0.05 ? { a: v.br[0], b: v.br[1] } : null;
              if (v.st === 'stopped') { if (st !== 'stopped') stopNowQuiet(); return; }
              if (st === 'stopped' || v.st === 'playing' && Math.abs(tNow - v.t) > 0.15 || v.st === 'paused') { startRaw(v.t); setT(v.t); }
              ensureStart();
              if (v.st === 'playing' && st !== 'playing') { st = 'playing'; g.emit('beat-play', { t: tNow, mode: mode }); }
              else if (v.st === 'paused') st = 'paused';
              applyAt(tNow); paintUI();
            }
          }
        }
      };
      function stopNowQuiet() { st = 'stopped'; raw = 0; setT(0); restoreStart(); g.emit('beat-stop', { was: 'remote' }); paintUI(); }

      /* ---------- the page tile and the frame ---------- */
      g.registerPage({ id: 'beats', title: 'Beat strip', label: 'Beat strip', where: 'animate', rows: function (H) { return strip.rows(H); } });

      api.alwaysTick = true; /* the clock must advance after Play even with Gizmos live off; while stopped or paused this does nothing at all */
      api.tick = function (dt) {
        if (pendingSend > 0) { pendingSend -= dt; if (g.send('beats', api.sync.parts.beats.encode())) pendingSend = 0; }
        if (st === 'playing') {
          advance(dt);
          uiAcc += dt; if (uiAcc >= 0.2) { uiAcc = 0; paintUI(); }
          if (!guest() && !g.isPrivate()) { syncAcc += dt; if (syncAcc >= 2) { syncAcc = 0; sendTransport(false); } }
        }
      };
      api.dispose = function () { ui = []; passFns = []; stopFns = []; pauseFns = []; };
      return api;
    });
  }

  GN._beatsRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
