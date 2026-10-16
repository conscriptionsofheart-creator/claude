/* gizmo_next_core.js: the plug-in kit every gizmo stage stands on (stage G0). window.GizmoNext
   WHAT IT IS: the generic form of what seat_gizmo.js does by hand. A part (a stage module) calls g.defineKind(spec) and the core builds everything around the spec:
   the records, the see-through marker box with its pick sphere, the object entry that lets the page's own grab, handles, two-hand resize, lock, copy, delete, Undo and
   Recently deleted work, the registration with Gizmos (so Hide gizmos and Photo leave the box out), save and load, and the menu rows made from the fields.
   WHAT IT IS NOT: a second grab, undo, copy, lock or attach. Those already exist in vr_objects.js and vr_core.js. This file only hands them one entry per marker.
   RULES BUILT IN: nothing runs on open. Gizmos live is a saved per-scene switch and is OFF by default. A guest page never goes live from a file, never places or deletes
   a gizmo and never saves. Every call into the host is guarded. A missing ctx field means the feature is off, never an exception.
   Plain classic JavaScript, one IIFE, THREE r128 as a global (or ctx.THREE). Node can load it too (module.exports). */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  if (W.GizmoNext && W.GizmoNext._isGN) { if (typeof module !== 'undefined') module.exports = W.GizmoNext; return; }

  var KEY = 'jb_gizmonext_atelier_v1', FILEKEY = 'jb_gizmonext_file_';
  var BAD = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  var WHERE = ['animate', 'objects', 'settings'];
  var SRC = '';
  try { if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) SRC = document.currentScript.src; } catch (e) { /* no script tag */ }

  /* ---------- small helpers ---------- */
  function safe(fn, fb) { try { var r = fn(); return r === undefined ? fb : r; } catch (e) { return fb; } }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) : s; }
  /* the one place that guards her copy: no em dash or en dash ever reaches a toast or a row */
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g'); /* built from char codes so this file holds no dash character at all */
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function wrapYaw(n) { if (!isNum(n) || Math.abs(n) > 1e4) return 0; var t = 2 * Math.PI; n = n % t; if (n > Math.PI) n -= t; else if (n < -Math.PI) n += t; return n; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function fmt(v) { return String(Math.round(v * 100) / 100); }
  function titleLabel(t) { t = String(t); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); }
  function noop() {}
  function deep(v, depth) {
    if (v === null) return null;
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? clamp(v, -1e6, 1e6) : 0;
    if (t === 'boolean') return v;
    if (t === 'string') return cut(v, 80);
    if (depth <= 0) return null;
    if (Array.isArray(v)) return v.slice(0, 24).map(function (x) { return deep(x, depth - 1); });
    if (t === 'object') {
      var o = {}, n = 0;
      for (var k in v) { if (!Object.prototype.hasOwnProperty.call(v, k) || BAD[k]) continue; if (++n > 16) break; o[cut(k, 40)] = deep(v[k], depth - 1); }
      return o;
    }
    return null;
  }
  /* shape check for anything that arrives from a friend: finite numbers, short strings, bounded arrays and keys */
  function okVal(v, d) {
    if (d > 8) return false;
    if (v === null) return true;
    var t = typeof v;
    if (t === 'number') return isFinite(v) && Math.abs(v) < 1e7;
    if (t === 'boolean') return true;
    if (t === 'string') return v.length <= 4000;
    if (Array.isArray(v)) { if (v.length > 600) return false; for (var i = 0; i < v.length; i++) if (!okVal(v[i], d + 1)) return false; return true; }
    if (t === 'object') {
      var ks = Object.keys(v); if (ks.length > 400) return false;
      for (var j = 0; j < ks.length; j++) { if (BAD[ks[j]] || ks[j].length > 120) return false; if (!okVal(v[ks[j]], d + 1)) return false; }
      return true;
    }
    return false;
  }
  /* one value of a record, forced to the shape of its default */
  function coerce(v, d, key, F) {
    var t = typeof d, f = F && F[key];
    if (d === null) {
      if (v === null || v === undefined) return null;
      if (isNum(v)) return clamp(v, -1e6, 1e6);
      if (typeof v === 'string') return cut(v, 80);
      if (typeof v === 'boolean') return v;
      return null;
    }
    if (t === 'number') {
      var n = isNum(v) ? v : d;
      if (key === 'x' || key === 'y' || key === 'z') n = clamp(n, -1e4, 1e4);
      else if (key === 'yaw') n = wrapYaw(n);
      else n = clamp(n, -1e6, 1e6);
      if (f && f.type === 'num') { if (isNum(f.min)) n = Math.max(f.min, n); if (isNum(f.max)) n = Math.min(f.max, n); }
      return n;
    }
    if (t === 'boolean') return typeof v === 'boolean' ? v : d;
    if (t === 'string') {
      var s = typeof v === 'string' ? cut(v, 80) : d;
      if (f && f.type === 'enum' && Array.isArray(f.opts) && !f.opts.some(function (o) { return o[0] === s; })) s = d;
      return s;
    }
    if (Array.isArray(d)) {
      if (d.length === 3 && d.every(isNum)) {
        var lo = -1e4, hi = 1e4;
        if (key === 'size') { lo = 0.02; hi = 100; } else if (key === 'sc') { lo = 0.04; hi = 20; }
        if (Array.isArray(v) && v.length === 3 && v.every(isNum)) return v.map(function (x) { return clamp(x, lo, hi); });
        return d.slice();
      }
      if (!Array.isArray(v)) return deep(d, 3);
      if (f && f.type === 'list') return v.filter(function (x) { return typeof x === 'string'; }).slice(0, 24).map(function (x) { return cut(x, 80); });
      return deep(v, 3);
    }
    if (t === 'object') return v && typeof v === 'object' && !Array.isArray(v) ? deep(v, 3) : deep(d, 3);
    return d;
  }
  function cleanRec(raw, tmpl, F) {
    var o = {};
    Object.keys(tmpl).forEach(function (k) { if (BAD[k] || k.charAt(0) === '_') return; o[k] = coerce(raw ? raw[k] : undefined, tmpl[k], k, F); });
    return o;
  }
  function disposeObj(root) {
    try {
      root.traverse(function (o) {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        var m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(function (x) { if (x.map && x.map.dispose) x.map.dispose(); if (x.dispose) x.dispose(); });
      });
    } catch (e) { /* nothing to free */ }
  }
  function defaultNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /* ---------- the global ---------- */
  var REG = [], INST = [], ATTACHED = {}, LOADED = {}, PENDING_FILES = 0;
  var GN = {
    _isGN: true, inst: null, PARTS: ['gizmo_next_beats.js', 'gizmo_next_actions.js', 'gizmo_next_trigger.js', 'gizmo_next_ragdoll.js', 'gizmo_next_spawn.js', 'gizmo_next_seat.js', 'gizmo_next_walk.js', 'gizmo_next_effects.js'], icons: {},
    get version() { return '0.' + (1 + REG.length); },
    get ready() { return !!(GN.inst && GN.inst._installed && PENDING_FILES <= 0); },
    safe: safe, plain: plain, _instances: INST, _registry: REG
  };

  GN.register = function (name, meta, factory) {
    if (typeof meta === 'function') { factory = meta; meta = {}; }
    if (typeof name !== 'string' || typeof factory !== 'function') return GN;
    var entry = { name: name, meta: meta || {}, factory: factory }, i = REG.findIndex(function (e) { return e.name === name; });
    if (i >= 0) REG[i] = entry; else REG.push(entry);
    INST.slice().forEach(function (g) { try { g._addPart(entry); } catch (e) { /* a late part must never break a page */ } });
    return GN;
  };

  /* ---------- one instance ---------- */
  function create(ctx) {
    ctx = ctx || {};
    var g = {
      ctx: ctx, modules: {}, warnings: [], parts: {}, THREE: ctx.THREE || W.THREE || null,
      _kinds: {}, _order: [], _orderParts: [], _pages: {}, _pageOrder: [], _bus: {}, _live: false, _timers: [], _tid: 1, _log: [], _sel: null,
      _rate: {}, _dropped: 0, _loading: 0, _orphanKinds: {}, _orphanParts: {}, _ready: false, _inited: false, _pending: [], _wired: {},
      _lastHouse: -1e9, _errAt: {}, _env: { t: 0, g: null }, _global: false, _installed: false
    };
    g._env.g = g;
    g.safe = safe;
    g.call = function (name, fb, a, b, c) { var f = ctx[name]; if (typeof f !== 'function') return fb; try { var r = f.call(ctx, a, b, c); return r === undefined ? fb : r; } catch (e) { return fb; } };

    /* -- the host, always guarded -- */
    g.now = function () { var t = g.call('now', null); return isNum(t) ? t : defaultNow(); };
    g.isGuest = function () { return !!g.call('isGuest', false); };
    g.isHost = function () { return typeof ctx.isHost === 'function' ? !!g.call('isHost', true) : !g.isGuest(); };
    g.isPrivate = function () { return !!g.call('isPrivate', false); };
    g.say = function (t) { t = plain(t); g.call('say', null, t); return t; };
    g.redraw = function () { g.call('redraw', null); };
    g.pushUndo = function () { g.call('pushUndo', null); };
    g.scene = function () { return g.call('scene', null); };
    g.head = function () { var h = g.call('head', null); return Array.isArray(h) && h.length >= 3 && isNum(h[0]) && isNum(h[1]) && isNum(h[2]) ? h : null; };
    g.floorAt = function (x, z) { var f = g.call('floorAt', 0, x, z); return isNum(f) ? f : 0; };
    g.peers = function () { var p = g.call('peers', []); return Array.isArray(p) ? p : []; };
    g.figures = function () { var p = g.call('figures', []); return Array.isArray(p) ? p : []; };
    g.props = function () { var p = g.call('props', []); return Array.isArray(p) ? p : []; };
    g.warn = function (msg) {
      msg = 'GizmoNext: ' + msg; g.warnings.push(msg);
      if (typeof ctx.log === 'function') g.call('log', null, msg); else if (typeof console !== 'undefined' && console.warn && !ctx.quiet) console.warn(msg);
    };
    var gizmosApi = function () { return ctx.gizmos || W.Gizmos || null; };

    /* -- the "what ran" log: a ring of 200 -- */
    g.log = function (entry) {
      var e = (entry && typeof entry === 'object')
        ? { t: isNum(entry.t) ? entry.t : g.now(), who: cut(entry.who == null ? '' : entry.who, 40), what: cut(entry.what == null ? '' : entry.what, 160) }
        : { t: g.now(), who: '', what: cut(entry == null ? '' : entry, 160) };
      g._log.push(e); if (g._log.length > 200) g._log.shift();
      return e;
    };
    g.logList = function () { return g._log.slice(); };

    /* -- the internal bus. Fixed events: live, tick, scene-load, scene-reset, kind-add, kind-remove, enter, leave, fire, beat-play, beat-stop, seat, arrive.
       Extra: kind-change {kind,id}. 'tick' fires only while Gizmos live is on. -- */
    g.on = function (evt, fn) { if (typeof fn === 'function') (g._bus[evt] = g._bus[evt] || []).push(fn); return g; };
    g.off = function (evt, fn) { var a = g._bus[evt]; if (a) { var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } return g; };
    g.emit = function (evt, payload) {
      var a = g._bus[evt]; if (!a || !a.length) return 0;
      a = a.slice();
      for (var i = 0; i < a.length; i++) { try { a[i](payload); } catch (e) { g.log({ who: 'bus', what: 'A listener for ' + evt + ' failed' }); } }
      return a.length;
    };

    /* -- timers on the tick, not on the wall clock: they die when live goes off, a scene loads or resets -- */
    g.after = function (sec, fn, tag) {
      if (typeof fn !== 'function') return 0;
      var id = g._tid++; g._timers.push({ id: id, at: g.now() + Math.max(0, +sec || 0) * 1000, fn: fn, tag: tag || '' });
      return id;
    };
    g.cancel = function (idOrTag) { g._timers = g._timers.filter(function (t) { return t.id !== idOrTag && t.tag !== idOrTag; }); };
    function runTimers(t) {
      if (!g._timers.length) return;
      var due = [], keep = [];
      g._timers.forEach(function (tm) { (tm.at <= t ? due : keep).push(tm); });
      g._timers = keep;
      due.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
      due.forEach(function (tm) { try { tm.fn(); } catch (e) { g.log({ who: 'timer', what: 'A timed step failed' }); } });
    }

    /* -- Gizmos live -- */
    g.isLive = function () { return g._live; };
    g.setLive = function (on) {
      on = !!on; if (on === g._live) return g._live;
      g._live = on; if (!on) g._timers = [];
      g._orderParts.forEach(function (n) { var m = g.modules[n]; if (m && typeof m.onLive === 'function') safe(function () { m.onLive(on); }); });
      g._order.forEach(function (kid) { var k = g._kinds[kid]; if (typeof k.spec.onLiveChange === 'function') k.list.slice().forEach(function (rec) { safe(function () { k.spec.onLiveChange(rec, on); }); }); });
      g.emit('live', on);
      g.log({ who: 'core', what: on ? 'Gizmos live is on' : 'Gizmos live is off' });
      g.persist();
      return g._live;
    };

    /* ---------- kinds ---------- */
    g.defineKind = function (spec) {
      if (!spec || typeof spec !== 'object' || typeof spec.id !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/i.test(spec.id)) { g.warn('defineKind needs an id'); return null; }
      var id = spec.id, S = { id: id };
      S.name = cut(spec.name || id, 40); S.plural = cut(spec.plural || (S.name + 's'), 40);
      S.col = /^#[0-9a-f]{3,8}$/i.test(spec.col || '') ? spec.col : '#99aadd';
      S.H = isNum(spec.H) ? clamp(spec.H, 0, 5) : 0;
      S.max = isNum(spec.max) ? clamp(Math.floor(spec.max), 1, 64) : 12;
      S.copyable = spec.copyable !== false;
      S.resize = (spec.resize === 'none' || spec.resize === 'size' || spec.resize === 'scale') ? spec.resize : 'scale';
      S.rebuildOn = ['size'].concat(Array.isArray(spec.rebuildOn) ? spec.rebuildOn.filter(function (x) { return typeof x === 'string'; }) : []);
      S.dupReset = Array.isArray(spec.dupReset) ? spec.dupReset.filter(function (x) { return typeof x === 'string'; }) : [];
      ['defaults', 'build', 'glyph', 'rows', 'validate', 'onFrame', 'onLiveChange'].forEach(function (f) { if (typeof spec[f] === 'function') S[f] = spec[f]; });
      S.sync = spec.sync && typeof spec.sync === 'object' ? { part: cut(spec.sync.part || id, 40), send: spec.sync.send !== false } : null;
      S.fields = (Array.isArray(spec.fields) ? spec.fields : []).filter(function (f) { return f && typeof f.key === 'string' && !BAD[f.key] && ['bool', 'enum', 'num', 'list'].indexOf(f.type) >= 0; }).map(function (f) {
        return { key: f.key, label: cut(f.label || f.key, 40), type: f.type, ic: f.ic || null, opts: Array.isArray(f.opts) ? f.opts.filter(function (o) { return Array.isArray(o) && o.length >= 2; }).map(function (o) { return [String(o[0]), cut(o[1], 40)]; }) : null,
          min: isNum(f.min) ? f.min : undefined, max: isNum(f.max) ? f.max : undefined, step: isNum(f.step) && f.step > 0 ? f.step : 1, choices: Array.isArray(f.choices) ? f.choices.map(function (x) { return cut(x, 40); }).slice(0, 24) : null };
      });
      var k = { spec: S, list: [], nid: 1, markers: !g.isGuest(), api: null, F: {}, reg: false, thumbs: {} };
      S.fields.forEach(function (f) { k.F[f.key] = f; });
      var hiddenNow = function () { var G = gizmosApi(); try { return !!(G && typeof G.hidden === 'function' && G.hidden(id)); } catch (e) { return false; } };
      var persistKind = function () { if (!g._loading) g.persist(); };

      function template() {
        var d = {};
        if (S.defaults) { d = safe(function () { return S.defaults(); }, {}); if (!d || typeof d !== 'object' || Array.isArray(d)) d = {}; }
        var t = { name: S.name, x: 0, y: 0, z: 0, yaw: 0, locked: false, group: '' };
        if (S.resize === 'size') t.size = [1, 1, 1]; else if (S.resize === 'scale') t.sc = [1, 1, 1];
        Object.keys(d).forEach(function (key) { if (!BAD[key] && key.charAt(0) !== '_') t[key] = d[key]; });
        S.fields.forEach(function (f) {
          if (f.key in t) return;
          t[f.key] = f.type === 'bool' ? false : f.type === 'num' ? (isNum(f.min) ? f.min : 0) : f.type === 'enum' ? (f.opts && f.opts[0] ? f.opts[0][0] : '') : [];
        });
        return t;
      }
      var findIdx = function (rid) { for (var i = 0; i < k.list.length; i++) if (k.list[i].id === rid) return i; return -1; };
      var get = function (rid) { var i = findIdx(String(rid)); return i >= 0 ? k.list[i] : null; };

      function mkRecord(raw) {
        var rec = cleanRec(raw, template(), k.F);
        if (!rec.name) rec.name = S.name;
        var rid = raw && typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id) && !BAD[raw.id] ? raw.id : null;
        if (rid && findIdx(rid) >= 0) rid = null;
        if (rid) { var n = parseInt(rid.replace(/\D/g, ''), 10); if (n >= k.nid) k.nid = n + 1; }
        else { while (findIdx(id + k.nid) >= 0) k.nid++; rid = id + (k.nid++); }
        var out = Object.assign({ id: rid }, rec);
        if (S.validate) { var ok = true; try { ok = S.validate(out) !== false; } catch (e) { ok = false; } if (!ok) return null; }
        Object.defineProperty(out, '_mk', { value: null, writable: true, enumerable: false, configurable: true });
        return out;
      }

      /* -- the marker: a group, children[0] is the invisible pick sphere, everything isMarker, decorations never take a ray -- */
      function pickSphere(T) { return new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: S.col, transparent: true, opacity: 0, depthWrite: false })); }
      function faceTexture(rec, T) {
        if (typeof document === 'undefined' || !T.CanvasTexture) return null;
        try {
          var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d'); if (!c) return null;
          c.fillStyle = '#15111d'; c.fillRect(0, 0, 128, 128); c.globalAlpha = 0.35; c.fillStyle = S.col; c.fillRect(0, 0, 128, 128); c.globalAlpha = 1;
          c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
          if (S.glyph) { try { S.glyph(c, 64, 52); } catch (e) { /* no picture */ } }
          c.font = '600 15px sans-serif'; c.textAlign = 'center'; c.fillText(cut(rec.name || S.name, 16), 64, 114);
          return new T.CanvasTexture(cv);
        } catch (e) { return null; }
      }
      function defaultGroup(rec, T) {
        var grp = new T.Group(); grp.add(pickSphere(T));
        var sz = S.resize === 'size' && rec.size ? rec.size : [0.25, 0.25, 0.25], geom = new T.BoxGeometry(sz[0], sz[1], sz[2]), map = faceTexture(rec, T);
        grp.add(new T.Mesh(geom, new T.MeshBasicMaterial({ color: map ? 0xffffff : S.col, map: map || null, transparent: true, opacity: map ? 0.55 : 0.12, depthWrite: false })));
        grp.add(new T.LineSegments(new T.EdgesGeometry(geom), new T.LineBasicMaterial({ color: S.col, transparent: true, opacity: 0.85, depthWrite: false })));
        return grp;
      }
      function makeGroup(rec) {
        var T = g.THREE; if (!T) return null;
        var grp = null;
        if (S.build) { try { grp = S.build(rec, T); } catch (e) { g.warn('The picture for ' + id + ' could not be built'); grp = null; } }
        if (!grp || typeof grp.add !== 'function') grp = defaultGroup(rec, T);
        var c0 = grp.children[0];
        if (!c0 || !c0.isMesh) { var hit = pickSphere(T); grp.add(hit); grp.children.pop(); grp.children.unshift(hit); }
        return grp;
      }
      function flagAll(grp) {
        var pick = grp.children[0];
        grp.traverse(function (o) { o.userData = o.userData || {}; o.userData.isMarker = true; if (o !== grp && o !== pick) o.raycast = noop; });
        grp.userData.gizmoDone = 1; grp.userData.gizmoKind = id; grp.userData.gizmoNext = id; grp.name = 'gizmoNext_' + id;
      }
      function mkFlags(rec) {
        var mk = rec._mk; if (!mk) return;
        mk.userData.locked = !!rec.locked;
        if (rec.group) mk.userData.groupId = rec.group; else delete mk.userData.groupId;
        mk.visible = k.markers && !hiddenNow();
      }
      function applyTransform(rec) {
        var mk = rec._mk; if (!mk) return;
        mk.position.set(rec.x, rec.y + S.H, rec.z); mk.rotation.set(0, rec.yaw || 0, 0);
        if (S.resize === 'scale' && rec.sc) mk.scale.set(rec.sc[0], rec.sc[1], rec.sc[2]); else mk.scale.set(1, 1, 1);
        mkFlags(rec);
      }
      function buildMarker(rec) {
        if (!g.THREE || rec._mk) return rec._mk;
        var sc = g.scene(); if (!sc || typeof sc.add !== 'function') return null;
        var mk = makeGroup(rec); if (!mk) return null;
        flagAll(mk); rec._mk = mk; applyTransform(rec); sc.add(mk);
        return mk;
      }
      /* rebuild keeps the same marker object (the page may be holding it) and swaps what is inside */
      function rebuild(rec) {
        if (!g.THREE) return;
        if (!rec._mk) { buildMarker(rec); return; }
        var fresh = makeGroup(rec); if (!fresh) return;
        var mk = rec._mk;
        while (mk.children.length) { var ch = mk.children[0]; mk.remove(ch); disposeObj(ch); }
        while (fresh.children.length) mk.add(fresh.children[0]);
        Object.keys(fresh.userData).forEach(function (key) { mk.userData[key] = fresh.userData[key]; });
        flagAll(mk); applyTransform(rec);
      }
      function removeMarker(rec) {
        var mk = rec._mk; if (!mk) return;
        if (mk.parent) mk.parent.remove(mk);
        disposeObj(mk); rec._mk = null;
      }
      /* what the marker says now, without changing it */
      function readBack(rec) {
        var mk = rec._mk, out = { x: rec.x, y: rec.y, z: rec.z, yaw: rec.yaw };
        if (!mk) return out;
        var T = g.THREE, e = new T.Euler().setFromQuaternion(mk.quaternion, 'YXZ');
        out.x = mk.position.x; out.y = mk.position.y - S.H; out.z = mk.position.z; out.yaw = wrapYaw(e.y);
        if (S.resize === 'size' && rec.size) out.size = [0, 1, 2].map(function (i) { return clamp(rec.size[i] * [mk.scale.x, mk.scale.y, mk.scale.z][i], 0.02, 100); });
        else if (S.resize === 'scale') out.sc = [mk.scale.x, mk.scale.y, mk.scale.z].map(function (v) { return clamp(v, 0.04, 20); });
        return out;
      }
      /* a record's saved data: runtime fields a part keeps on it (names starting with _) are never saved or copied */
      function dataOf(rec) { var o = {}; Object.keys(rec).forEach(function (key) { if (key.charAt(0) !== '_') o[key] = rec[key]; }); return o; }
      function toJSONOne(rec) {
        var o = dataOf(rec), rb = readBack(rec);
        o.x = r4(rb.x); o.y = r4(rb.y); o.z = r4(rb.z); o.yaw = r4(rb.yaw);
        if (rb.size) o.size = rb.size.map(r4); if (rb.sc) o.sc = rb.sc.map(r4);
        return o;
      }

      var api = {
        id: id, H: S.H, spec: S,
        get list() { return k.list; },
        get: get,
        add: function (specIn) {
          if (k.list.length >= S.max) { g.say('Only ' + S.max + ' ' + S.plural.toLowerCase() + ' fit in a scene'); return null; }
          var rec = mkRecord(specIn); if (!rec) return null;
          k.list.push(rec); buildMarker(rec);
          g.emit('kind-add', { kind: id, id: rec.id }); persistKind();
          return rec;
        },
        remove: function (rid) {
          var i = findIdx(String(rid)); if (i < 0) return false;
          var rec = k.list[i]; removeMarker(rec); k.list.splice(i, 1);
          if (g._sel && g._sel.kind === id && g._sel.id === rec.id) g._sel = null;
          g.emit('kind-remove', { kind: id, id: rec.id }); persistKind();
          return true;
        },
        set: function (rid, patch) {
          var rec = get(rid); if (!rec || !patch || typeof patch !== 'object') return null;
          var old = dataOf(rec), cl = cleanRec(Object.assign({}, old, patch), template(), k.F);
          if (!cl.name) cl.name = S.name;
          var changed = Object.keys(patch).filter(function (key) { return key in cl && JSON.stringify(cl[key]) !== JSON.stringify(old[key]); });
          Object.assign(rec, cl);
          if (S.validate) { var ok = true; try { ok = S.validate(rec) !== false; } catch (e) { ok = false; } if (!ok) { Object.assign(rec, old); return null; } }
          if (rec._mk) applyTransform(rec);
          if (changed.some(function (key) { return S.rebuildOn.indexOf(key) >= 0; })) rebuild(rec);
          if (changed.length) g.emit('kind-change', { kind: id, id: rec.id });
          persistKind();
          return rec;
        },
        /* the marker is what you move: read where it is now back into the record */
        commit: function (rid) {
          var rec = get(rid); if (!rec || !rec._mk) return null;
          var rb = readBack(rec), mk = rec._mk, resized = false;
          rec.x = rb.x; rec.y = rb.y; rec.z = rb.z; rec.yaw = rb.yaw; mk.rotation.set(0, rec.yaw, 0);
          if (S.resize === 'size' && rb.size) {
            resized = [0, 1, 2].some(function (i) { return Math.abs(rb.size[i] - rec.size[i]) > 1e-6; });
            rec.size = rb.size; mk.scale.set(1, 1, 1);
            if (resized) rebuild(rec);
          } else if (S.resize === 'scale' && rb.sc) { rec.sc = rb.sc; }
          else mk.scale.set(1, 1, 1);
          mkFlags(rec);
          g.emit('kind-change', { kind: id, id: rec.id });
          persistKind();
          return rec;
        },
        rebuild: function (rid) { var rec = get(rid); if (rec) rebuild(rec); return !!rec; },
        clear: function () { k.list.slice().forEach(function (rec) { removeMarker(rec); }); k.list.length = 0; },
        toJSON: function () { return { v: 1, items: k.list.map(toJSONOne) }; },
        toJSONOne: function (rid) { var rec = get(rid); return rec ? toJSONOne(rec) : null; },
        fromJSON: function (d) {
          g._loading++;
          try {
            api.clear();
            var a = Array.isArray(d) ? d : ((d && Array.isArray(d.items)) ? d.items : []);
            a.slice(0, S.max).forEach(function (raw) {
              if (!raw || typeof raw !== 'object') return;
              var rec = mkRecord(raw); if (!rec) return;
              k.list.push(rec); buildMarker(rec); g.emit('kind-add', { kind: id, id: rec.id });
            });
          } finally { g._loading--; }
          return k.list;
        },
        persist: persistKind,
        setMarkers: function (on) { k.markers = !!on; k.list.forEach(mkFlags); },
        markersOn: function () { return k.markers; }
      };
      k.api = api; k.rebuild = rebuild; k.mkFlags = mkFlags; k.ensure = function () { k.list.forEach(function (rec) { if (!rec._mk) buildMarker(rec); }); };
      k.dataOf = dataOf; k.template = template; k.mkRecord = mkRecord; k.buildMarker = buildMarker; k.persist = persistKind;
      if (!g._kinds[id]) g._order.push(id);
      g._kinds[id] = k;

      /* a list field opens a small page; it works on the gizmo whose panel is open */
      S.fields.forEach(function (f) {
        if (f.type !== 'list') return;
        g.registerPage({
          id: 'list:' + id + ':' + f.key, title: f.label.toUpperCase(), where: 'objects', hidden: true,
          rows: function (H) {
            var sel = g._sel, rec = sel && sel.kind === id ? get(sel.id) : null; if (!rec) return [];
            var items = Array.isArray(rec[f.key]) ? rec[f.key] : [], rows = [];
            items.forEach(function (it, i) {
              rows.push({ label: it, ic: 'trash', act: function () { g.pushUndo(); api.set(rec.id, mk1(f.key, items.filter(function (_, j) { return j !== i; }))); H.say('Removed ' + it); H.redraw(); } });
            });
            (f.choices || []).filter(function (c) { return items.indexOf(c) < 0; }).forEach(function (c) {
              rows.push({ label: 'Add ' + c, ic: 'plus', act: function () { g.pushUndo(); api.set(rec.id, mk1(f.key, items.concat([c]))); H.say('Added ' + c); H.redraw(); } });
            });
            return rows;
          }
        });
      });

      var orphan = g._orphanKinds[id];
      if (orphan) { delete g._orphanKinds[id]; api.fromJSON(orphan); }
      regGizmos();
      return api;
    };
    function mk1(key, val) { var p = {}; p[key] = val; return p; }

    /* -- Hide gizmos, Photo and the thumbnail go through the page's own Gizmos registry -- */
    function regGizmos() {
      var G = gizmosApi(); if (!G || typeof G.register !== 'function') return;
      var any = false;
      g._order.forEach(function (kid) {
        var k = g._kinds[kid]; if (k.reg) return;
        try {
          G.register({ id: kid, name: k.spec.name, plural: k.spec.plural, col: k.spec.col, avail: function () { return !g.isGuest(); }, items: function () { return k.api.list; }, markersOn: function () { return k.api.markersOn(); }, setMarkers: function (on) { k.api.setMarkers(on); } });
          k.reg = true; any = true;
        } catch (e) { /* try again at the next house call */ }
      });
      if (any && typeof G.apply === 'function') { try { G.apply(); } catch (e) { /* fine */ } }
    }
    g.thumb = function (kid, off) {
      var k = g._kinds[kid]; if (!k || typeof document === 'undefined') return null;
      var ck = off ? 'off' : 'on'; if (k.thumbs[ck]) return k.thumbs[ck];
      try {
        var N = 112, cv = document.createElement('canvas'); cv.width = cv.height = N; var c = cv.getContext('2d'); if (!c) return null;
        c.fillStyle = '#15111d'; c.fillRect(0, 0, N, N);
        var col = k.spec.col, cx = 56, cy = 60, w = 34, h = 22, P = function (x, y) { return [cx + x, cy + y]; };
        var top = [P(0, -h - 24), P(w, -24), P(0, h - 24), P(-w, -24)], lef = [P(-w, -24), P(0, h - 24), P(0, h + 22), P(-w, 22)], rig = [P(w, -24), P(0, h - 24), P(0, h + 22), P(w, 22)];
        var poly = function (pts, a) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.globalAlpha = a; c.fillStyle = col; c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 2; c.stroke(); };
        poly(lef, 0.16); poly(rig, 0.28); poly(top, 0.42);
        c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
        if (k.spec.glyph) { try { k.spec.glyph(c, 56, 62); } catch (e) { /* no symbol */ } }
        if (off) { c.fillStyle = 'rgba(21,17,29,.62)'; c.fillRect(0, 0, N, N); c.strokeStyle = '#cfc8d8'; c.lineWidth = 5; c.beginPath(); c.moveTo(22, 22); c.lineTo(90, 92); c.stroke(); }
        k.thumbs[ck] = cv; return cv;
      } catch (e) { return null; }
    };

    /* ---------- the generated object entry, copy, delete, restore, panel rows ---------- */
    function kindOfOb(ob) { return ob && typeof ob.kind === 'string' ? g._kinds[ob.kind] || null : null; }
    function entryFor(k, rec) {
      var mk = rec._mk, S = k.spec;
      return {
        id: rec.id, name: rec.name || S.name, object: mk, get pickObj() { return mk.children[0] || mk; }, kind: S.id,
        group: function () { return rec.group || ''; },
        setGroup: function (v) { rec.group = cut(v == null ? '' : v, 40); k.mkFlags(rec); k.persist(); },
        setLocked: function (v) { rec.locked = !!v; k.mkFlags(rec); k.persist(); },
        commit: function () { if (k.list.indexOf(rec) >= 0) k.api.commit(rec.id); }
      };
    }
    g.entries = function (o) {
      o = o || [];
      if (g.isGuest()) return o;
      g._order.forEach(function (kid) {
        var k = g._kinds[kid];
        k.list.forEach(function (rec) { if (!rec._mk) return; k.mkFlags(rec); if (rec._mk.visible) o.push(entryFor(k, rec)); });
      });
      return o;
    };
    g.has = function (kid) { return !!g._kinds[kid]; };
    g.get = function (kid, rid) { var k = g._kinds[kid]; return k ? k.api.get(rid) : null; };
    g.addAt = function (kid, at) {
      var k = g._kinds[kid]; if (!k) return null;
      if (g.isGuest()) { g.say('Only the host places gizmos'); return null; }
      var raw = {};
      if (at && isNum(at.x) && isNum(at.y) && isNum(at.z)) { raw.x = at.x; raw.y = at.y - k.spec.H; raw.z = at.z; }
      var rec = k.api.add(raw); return rec ? rec.id : null;
    };
    g.addNearHead = function (kid) {
      var k = g._kinds[kid]; if (!k || g.isGuest()) return null;
      var h = g.head() || [0, 1.6, 0], x = h[0], z = h[2] - 1;
      g.pushUndo();
      var rec = k.api.add({ x: x, y: g.floorAt(x, z), z: z }); return rec ? rec.id : null;
    };
    g.dup = function (ob, at, groupId) {
      var k = kindOfOb(ob); if (!k || !k.spec.copyable) return null;
      if (g.isGuest()) { g.say('Only the host copies gizmos'); return null; }
      var rec = k.api.get(ob.id); if (!rec) return null;
      k.api.commit(rec.id);
      var raw = JSON.parse(JSON.stringify(k.api.toJSONOne(rec.id)));
      delete raw.id; raw.group = groupId ? cut(groupId, 40) : ''; raw.locked = false;
      var t = k.template(); k.spec.dupReset.forEach(function (key) { if (key in t) raw[key] = t[key]; });
      if (at && isNum(at.x) && isNum(at.y) && isNum(at.z)) { raw.x = at.x; raw.y = at.y - k.spec.H; raw.z = at.z; } else { raw.x += 0.3; }
      var nr = k.api.add(raw); return nr ? nr.id : null;
    };
    g.del = function (ob) {
      var k = kindOfOb(ob); if (!k) return null;
      if (g.isGuest()) { g.say('Only the host deletes gizmos'); return null; }
      var rec = k.api.get(ob.id); if (!rec) return null;
      k.api.commit(rec.id);
      var spec = JSON.parse(JSON.stringify(k.api.toJSONOne(rec.id)));
      k.api.remove(rec.id);
      return spec;
    };
    g.restore = function (kid, spec) {
      var k = g._kinds[kid]; if (!k || !spec || typeof spec !== 'object') return null;
      if (g.isGuest()) return null;
      if (typeof spec.id === 'string' && k.api.get(spec.id)) { g.say('An Undo already brought it back'); return null; }
      var rec = k.api.add(Object.assign({}, spec)); return rec ? rec.id : null;
    };
    function wrapH(H) {
      H = H || {};
      var open = typeof H.openPage === 'function' ? H.openPage : (typeof H.page === 'function' ? H.page : null);
      return {
        say: function (t) { t = plain(t); if (typeof H.say === 'function') { try { H.say(t); } catch (e) { /* toast failed */ } } else g.say(t); },
        redraw: function () { if (typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); },
        back: H.back, openPage: open
      };
    }
    g.rows = function (ob, H) {
      var k = kindOfOb(ob); if (!k) return [];
      var rec = k.api.get(ob.id); if (!rec) return [];
      g._sel = { kind: k.spec.id, id: rec.id };
      var h = wrapH(H), rows = [];
      if (k.spec.rows) { var own = safe(function () { return k.spec.rows(rec, h); }, []); if (Array.isArray(own)) rows = rows.concat(own); }
      k.spec.fields.forEach(function (f) {
        var key = f.key, v = rec[key];
        if (f.type === 'bool') {
          rows.push({ label: f.label + ': ' + (v ? 'on' : 'off'), ic: f.ic, on: function () { return !!rec[key]; }, act: function () { g.pushUndo(); k.api.set(rec.id, mk1(key, !rec[key])); h.say(f.label + (rec[key] ? ' on' : ' off')); h.redraw(); } });
        } else if (f.type === 'enum' && f.opts && f.opts.length) {
          var cur = f.opts.findIndex(function (o) { return o[0] === v; }); if (cur < 0) cur = 0;
          rows.push({ label: f.label + ': ' + f.opts[cur][1], ic: f.ic, act: function () { var n = f.opts[(cur + 1) % f.opts.length]; g.pushUndo(); k.api.set(rec.id, mk1(key, n[0])); h.say(f.label + ': ' + n[1]); h.redraw(); } });
        } else if (f.type === 'num') {
          var step = function (d) { return function () { var n = clamp(rec[key] + d * f.step, isNum(f.min) ? f.min : -1e6, isNum(f.max) ? f.max : 1e6); g.pushUndo(); k.api.set(rec.id, mk1(key, n)); h.say(f.label + ': ' + fmt(rec[key])); h.redraw(); }; };
          rows.push({ label: f.label + ': ' + fmt(v) + ' (more)', ic: f.ic, act: step(1) }, { label: f.label + ': ' + fmt(v) + ' (less)', ic: f.ic, act: step(-1) });
        } else if (f.type === 'list') {
          var items = Array.isArray(v) ? v : [];
          rows.push({ label: f.label + ': ' + items.length, ic: f.ic, act: function () { if (h.openPage) h.openPage('list:' + k.spec.id + ':' + key, rec); else h.say(items.length ? items.join(', ') : 'Nothing in the list yet'); } });
        }
      });
      rows.forEach(function (r) { if (r && r.label != null) r.label = plain(r.label); });
      return rows;
    };

    /* ---------- menu pages ---------- */
    g.registerPage = function (spec) {
      if (!spec || typeof spec.id !== 'string') return null;
      var p = {
        id: cut(spec.id, 60), title: cut(spec.title || spec.id, 40), where: WHERE.indexOf(spec.where) >= 0 ? spec.where : 'animate',
        rows: typeof spec.rows === 'function' ? spec.rows : null, thumb: typeof spec.thumb === 'function' ? spec.thumb : null, panel: typeof spec.panel === 'function' ? spec.panel : null,
        hidden: !!spec.hidden
      };
      p.label = cut(spec.label || titleLabel(p.title), 40);
      if (!g._pages[p.id]) g._pageOrder.push(p.id);
      g._pages[p.id] = p;
      return p;
    };
    g.pages = function (where) {
      return g._pageOrder.map(function (i) { return g._pages[i]; }).filter(function (p) { return !p.hidden && (!where || p.where === where); })
        .map(function (p) { return { id: p.id, title: plain(p.title), label: plain(p.label), thumb: p.thumb }; });
    };
    g.pageRows = function (pid, H) {
      var p = g._pages[pid]; if (!p || !p.rows) return [];
      var rows = safe(function () { return p.rows(wrapH(H)); }, []);
      if (!Array.isArray(rows)) return [];
      rows.forEach(function (r) { if (r && r.label != null) r.label = plain(r.label); });
      return rows;
    };

    /* ---------- parts ---------- */
    function initPart(name) {
      var api = g.modules[name];
      if (api && typeof api.init === 'function') { try { api.init(); } catch (e) { g.warn('part ' + name + ' could not start: ' + (e && e.message)); } }
      if (g._orphanParts[name] !== undefined && api && typeof api.load === 'function') {
        g._loading++; try { api.load(g._orphanParts[name]); } catch (e) { /* a bad saved part loads empty */ } g._loading--; delete g._orphanParts[name];
      }
      wireSync();
    }
    function buildPart(e) {
      var api;
      try { api = e.factory(g); } catch (err) { g.warn('part ' + e.name + ' failed to start: ' + (err && err.message)); return; }
      if (!api || typeof api !== 'object') api = {};
      g.modules[e.name] = api; g.parts[e.name] = e; g._orderParts.push(e.name);
      if (g._global) attachGlobal(e.name);
      if (g._inited) initPart(e.name);
    }
    function resolve() {
      var progress = true;
      while (progress) {
        progress = false;
        for (var i = 0; i < g._pending.length; i++) {
          var e = g._pending[i];
          if ((e.meta.needs || []).every(function (n) { return n === 'core' || g.modules[n]; })) { g._pending.splice(i, 1); buildPart(e); progress = true; break; }
        }
      }
    }
    function warnPending() {
      g._pending.forEach(function (e) {
        if (e._warned) return;
        e._warned = true;
        var miss = (e.meta.needs || []).filter(function (n) { return n !== 'core' && !g.modules[n]; });
        g.warn('part ' + e.name + ' needs ' + miss.join(', ') + ', which is not installed. It stays off');
      });
    }
    g._addPart = function (entry) {
      if (g.parts[entry.name] || g._pending.some(function (p) { return p.name === entry.name; })) return;
      g._pending.push(entry); resolve();
    };

    /* ---------- friends: parts, validation, the host decides ---------- */
    var coreSync = {
      encode: function () { return { live: g._live }; },
      validate: function (v) { return !!v && typeof v === 'object' && typeof v.live === 'boolean'; },
      apply: function (v) { g.setLive(v.live); }
    };
    function syncTable() {
      var T = {};
      g._order.forEach(function (kid) {
        var k = g._kinds[kid], sy = k.spec.sync; if (!sy) return;
        T[sy.part] = {
          encode: function () { return (sy.send && k.list.length) ? k.api.toJSON() : null; },
          validate: function (v) { return !!v && typeof v === 'object' && Array.isArray(v.items) && v.items.length <= k.spec.max; },
          apply: function (v) { k.api.fromJSON(v); }
        };
      });
      Object.keys(g.modules).forEach(function (mn) {
        var m = g.modules[mn], sp = m && m.sync && m.sync.parts;
        if (sp && typeof sp === 'object') Object.keys(sp).forEach(function (pn) { if (sp[pn] && typeof sp[pn] === 'object' && !BAD[pn]) T[pn] = sp[pn]; });
      });
      T.gizmos = coreSync;
      return T;
    }
    g.sync = {
      parts: function () { return Object.keys(syncTable()); },
      encodeAll: function (P) {
        P = P || {}; var T = syncTable();
        Object.keys(T).forEach(function (n) { if (typeof T[n].encode !== 'function') return; var v = safe(function () { return T[n].encode(); }, null); if (v !== null && v !== undefined) P[n] = v; });
        return P;
      },
      validate: function (name, v) {
        var p = syncTable()[name]; if (!p || typeof p.validate !== 'function') return false;
        var s; try { s = JSON.stringify(v); } catch (e) { return false; }
        if (typeof s !== 'string' || s.length >= 16384) return false;
        if (!okVal(v, 0)) return false;
        return !!safe(function () { return p.validate(v); }, false);
      },
      apply: function (name, v, from) {
        if (g.isHost() || g.isPrivate()) return false;
        if (!g.sync.validate(name, v)) return false;
        var p = syncTable()[name];
        if (!p || typeof p.apply !== 'function') return false;
        try { p.apply(v, from); return true; } catch (e) { return false; }
      }
    };
    function wireSync() {
      var s = ctx.sync; if (!s || typeof s.on !== 'function') return;
      Object.keys(syncTable()).forEach(function (name) {
        if (g._wired[name]) return;
        g._wired[name] = 1;
        try { s.on(name, function (obj, from) { g.sync.apply(name, obj, from); }); } catch (e) { /* alone in the room */ }
      });
    }
    /* send one event between snapshots: private projects send nothing, at most 10 a second for each part */
    g.send = function (name, obj) {
      if (g.isPrivate()) return false;
      var s = ctx.sync; if (!s || typeof s.send !== 'function') return false;
      var t = g.now(), a = g._rate[name] || (g._rate[name] = []);
      while (a.length && t - a[0] >= 1000) a.shift();
      if (a.length >= 10) { g._dropped++; return false; }
      a.push(t);
      try { s.send(name, obj); return true; } catch (e) { return false; }
    };

    /* ---------- save, load, New scene ---------- */
    g.state = function () {
      var kinds = {}, parts = {};
      g._order.forEach(function (kid) { kinds[kid] = { items: g._kinds[kid].api.toJSON().items }; });
      Object.keys(g._orphanKinds).forEach(function (kid) { if (!kinds[kid]) kinds[kid] = g._orphanKinds[kid]; });
      g._orderParts.forEach(function (n) { var m = g.modules[n]; if (m && typeof m.state === 'function') { var s = safe(function () { return m.state(); }, null); if (s !== null && s !== undefined) parts[n] = s; } });
      Object.keys(g._orphanParts).forEach(function (n) { if (!(n in parts)) parts[n] = g._orphanParts[n]; });
      return { v: 1, live: g._live, kinds: kinds, parts: parts };
    };
    function clearAll() {
      g._timers = []; g._sel = null;
      g._order.forEach(function (kid) { g._kinds[kid].api.clear(); });
      g._orderParts.forEach(function (n) { var m = g.modules[n]; if (m && typeof m.reset === 'function') safe(function () { m.reset(); }); });
      g._orphanKinds = {}; g._orphanParts = {}; g._live = false;
    }
    g.load = function (s) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return g.reset();
      g._loading++;
      try {
        clearAll();
        var kinds = s.kinds;
        if (kinds && typeof kinds === 'object') Object.keys(kinds).forEach(function (kid) {
          if (BAD[kid]) return;
          var items = kinds[kid] && kinds[kid].items; if (!Array.isArray(items)) return;
          var k = g._kinds[kid];
          if (k) k.api.fromJSON({ items: items }); else g._orphanKinds[kid] = { items: items.slice(0, 64) };
        });
        var parts = s.parts;
        if (parts && typeof parts === 'object') Object.keys(parts).forEach(function (n) {
          if (BAD[n]) return;
          var m = g.modules[n];
          if (m && typeof m.load === 'function') safe(function () { m.load(parts[n]); });
          else if (!m) { var sz = safe(function () { return JSON.stringify(parts[n]).length; }, 1e9); if (sz < 1e6) g._orphanParts[n] = parts[n]; }
        });
        g._live = s.live === true && !g.isGuest();
      } finally { g._loading--; }
      g.emit('scene-load', { live: g._live });
      g.persist();
      return true;
    };
    g.reset = function () {
      g._loading++; try { clearAll(); g._log = []; } finally { g._loading--; }
      g.emit('scene-reset', {}); g.persist();
      return true;
    };
    /* a guest never saves: its page holds the host's scene for this visit only */
    g.persist = function () {
      if (g._loading || !g._ready || g.isGuest()) return false;
      var st = ctx.storage; if (!st || typeof st.set !== 'function') return false;
      try { st.set(KEY, JSON.stringify(g.state())); return true; } catch (e) { return false; }
    };
    g.loadFromStorage = function () {
      if (g.isGuest()) return false;
      var st = ctx.storage; if (!st || typeof st.get !== 'function') return false;
      var raw = safe(function () { return st.get(KEY); }, null);
      if (typeof raw !== 'string' || raw.length > 6e6) return false;
      var s = null; try { s = JSON.parse(raw); } catch (e) { return false; }
      if (!s || typeof s !== 'object') return false;
      return g.load(s);
    };
    g.fileKey = function (name) { return FILEKEY + cut(String(name).replace(/[^A-Za-z0-9_-]/g, '_'), 60); };
    g.putFile = function (name, text) {
      if (g.isGuest()) return false;
      if (typeof text !== 'string' || text.length > 1000000) { g.say('Too long. Shorten it and try again'); return false; }
      var st = ctx.storage; if (!st || typeof st.set !== 'function') return false;
      try { st.set(g.fileKey(name), text); return true; } catch (e) { return false; }
    };
    g.getFile = function (name) { var st = ctx.storage; if (!st || typeof st.get !== 'function') return null; var v = safe(function () { return st.get(g.fileKey(name)); }, null); return typeof v === 'string' ? v : null; };
    g.delFile = function (name) { var st = ctx.storage; if (st && typeof st.del === 'function') safe(function () { st.del(g.fileKey(name)); }); };

    /* ---------- the frame ---------- */
    function ensureMarkers() { g._order.forEach(function (kid) { g._kinds[kid].ensure(); }); }
    function errOnce(key, what) { var t = g.now(); if (!g._errAt[key] || t - g._errAt[key] > 5000) { g._errAt[key] = t; g.log({ who: 'core', what: what }); } }
    g.tick = function (dt) {
      if (!isNum(dt) || dt < 0) dt = 1 / 60;
      if (dt > 0.25) dt = 0.25;
      var t = g.now();
      if (t - g._lastHouse >= 1000) { g._lastHouse = t; ensureMarkers(); regGizmos(); if (g._pending.length) warnPending(); }
      var live = g._live;
      if (live) { runTimers(t); g.emit('tick', dt); }
      for (var i = 0; i < g._orderParts.length; i++) {
        var n = g._orderParts[i], m = g.modules[n];
        if (m && typeof m.tick === 'function' && (live || m.alwaysTick)) { try { m.tick(dt); } catch (e) { errOnce('part:' + n, 'The part ' + n + ' stopped one frame with an error'); } }
      }
      if (!live) return;
      var env = g._env; env.t = t / 1000;
      for (var j = 0; j < g._order.length; j++) {
        var k = g._kinds[g._order[j]], f = k.spec.onFrame;
        if (!f || !k.list.length) continue;
        var recs = k.list.length === 1 ? k.list : k.list.slice();
        for (var r = 0; r < recs.length; r++) {
          var rec = recs[r];
          if (rec.armed === false) continue;
          try { f.call(k.spec, rec, dt, env); } catch (e) { errOnce('rec:' + rec.id, 'The gizmo ' + (rec.name || rec.id) + ' stopped one frame with an error'); }
        }
      }
    };

    /* ---------- the 2D twin (BSA and Atelier right panel) ---------- */
    g.mountPanel = function (el) {
      if (!el) return false;
      var doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null); if (!doc) return false;
      var guest = g.isGuest();
      var mk = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
      var box = mk('div', 'gn-panel'), head = mk('div', 'gn-title', 'Gizmos'), liveBtn = mk('button', 'gn-live', '');
      var paint = function () { liveBtn.textContent = 'Gizmos live: ' + (g._live ? 'on' : 'off'); };
      paint(); g.on('live', paint); g.on('scene-load', paint); g.on('scene-reset', paint);
      box.appendChild(head);
      if (guest) { var st = mk('div', 'gn-status', ''); st.textContent = 'Gizmos live: ' + (g._live ? 'on' : 'off'); box.appendChild(st); g.on('live', function () { st.textContent = 'Gizmos live: ' + (g._live ? 'on' : 'off'); }); }
      else {
        liveBtn.addEventListener('click', function () { g.setLive(!g._live); });
        box.appendChild(liveBtn);
        var add = mk('div', 'gn-add');
        g._order.forEach(function (kid) {
          var k = g._kinds[kid], b = mk('button', 'gn-addbtn', 'Add ' + k.spec.name.toLowerCase());
          b.addEventListener('click', function () { var nid = g.addNearHead(kid); if (nid) g.say(k.spec.name + ' added'); });
          add.appendChild(b);
        });
        box.appendChild(add);
      }
      g._orderParts.forEach(function (n) {
        var m = g.modules[n]; if (!m || typeof m.mountPanel !== 'function') return;
        var sub = mk('div', 'gn-part'); box.appendChild(sub);
        try { m.mountPanel(sub); } catch (e) { g.warn('The panel for ' + n + ' could not be drawn'); }
      });
      g._pageOrder.forEach(function (pid) {
        var p = g._pages[pid]; if (!p.panel) return;
        var sub = mk('div', 'gn-page'); box.appendChild(sub);
        try { p.panel(sub); } catch (e) { g.warn('The panel for ' + pid + ' could not be drawn'); }
      });
      el.appendChild(box);
      return true;
    };

    g.dispose = function () {
      g._order.forEach(function (kid) { g._kinds[kid].api.clear(); });
      g._timers = []; var i = INST.indexOf(g); if (i >= 0) INST.splice(i, 1);
    };

    /* ---------- the Gizmos live switch and the "what ran" list, as one Settings page (the 2D twin is in mountPanel) ---------- */
    g.registerPage({
      id: 'live', title: 'GIZMOS LIVE', label: 'Gizmos live', where: 'settings',
      rows: function (H) {
        var rows = [], on = g._live;
        if (g.isGuest()) rows.push({ label: 'Gizmos live: ' + (on ? 'on' : 'off'), ic: null, on: function () { return g._live; }, act: function () { H.say('The host decides this. You see what the host has on'); } });
        else rows.push({ label: 'Gizmos live: ' + (on ? 'on' : 'off'), ic: null, on: function () { return g._live; }, act: function () { g.setLive(!g._live); H.say(g._live ? 'Gizmos live. Armed gizmos run now' : 'Gizmos live is off. Nothing runs'); H.redraw(); } });
        var l = g.logList().slice(-6).reverse();
        if (!l.length) rows.push({ label: 'What ran: nothing yet', ic: null, act: function () {} });
        l.forEach(function (e) { rows.push({ label: (e.who ? e.who + ': ' : '') + e.what, ic: null, act: function () {} }); });
        return rows;
      }
    });

    /* ---------- go ---------- */
    INST.push(g);
    REG.forEach(function (e) { g._pending.push(e); });
    resolve();
    g._inited = true;
    g._orderParts.slice().forEach(initPart);
    warnPending();
    wireSync();
    g._ready = true;
    return g;
  }

  function attachGlobal(name) {
    var g = GN.inst; if (!g || !g.modules[name]) return;
    if ((name in GN) && !ATTACHED[name]) { g.warn('The part name ' + name + ' is taken by the core, so it is only at g.modules.' + name); return; }
    GN[name] = g.modules[name]; ATTACHED[name] = 1;
  }

  GN.create = create;
  GN.install = function (ctx) {
    if (GN.inst) { try { GN.inst.dispose(); } catch (e) { /* old page state */ } }
    var g = create(ctx); g._global = true; GN.inst = g;
    Object.keys(g.modules).forEach(attachGlobal);
    g.loadFromStorage();
    g._installed = true;
    return g;
  };

  /* every convenience function is a no-op before install, so a hook line can never break a page */
  function wrap(name, fb, method) {
    GN[name] = function () {
      var g = GN.inst, f = typeof fb === 'function' ? fb : function () { return fb; };
      if (!g) return f.apply(null, arguments);
      try { return g[method || name].apply(g, arguments); } catch (e) { return f.apply(null, arguments); }
    };
  }
  wrap('has', false); wrap('entries', function (o) { return o || []; }); wrap('dup', null); wrap('del', null); wrap('restore', null);
  wrap('get', null); wrap('addAt', null); wrap('rows', []); wrap('thumb', null); wrap('tick', undefined); wrap('state', null);
  wrap('load', false); wrap('reset', false); wrap('isLive', false); wrap('setLive', false); wrap('pages', []); wrap('pageRows', []); wrap('mountPanel', false);
  GN.sync = {
    parts: function () { var g = GN.inst; return g ? safe(function () { return g.sync.parts(); }, []) : []; },
    encodeAll: function (P) { var g = GN.inst; return g ? safe(function () { return g.sync.encodeAll(P); }, P || {}) : (P || {}); },
    validate: function (n, v) { var g = GN.inst; return g ? !!safe(function () { return g.sync.validate(n, v); }, false) : false; },
    apply: function (n, v, from) { var g = GN.inst; return g ? !!safe(function () { return g.sync.apply(n, v, from); }, false) : false; }
  };

  /* load the other parts from the same folder: GizmoNext.PARTS is an array of file names, each appended as a script tag, onload counted */
  GN.loadParts = function (base) {
    if (typeof document === 'undefined' || !document.createElement) return 0;
    if (base == null) base = SRC.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
    var q = (SRC.split('?')[1] || '').split('#')[0], n = 0;
    GN.PARTS.forEach(function (f) {
      if (LOADED[f]) return;
      LOADED[f] = 1; n++; PENDING_FILES++;
      var s = document.createElement('script');
      s.src = base + f + (q ? '?' + q : ''); s.async = false;
      s.onload = function () { PENDING_FILES--; };
      s.onerror = function () { PENDING_FILES--; if (GN.inst) GN.inst.warn('The file ' + f + ' did not load. Its gizmos stay off'); };
      (document.head || document.documentElement).appendChild(s);
    });
    return n;
  };

  /* the test kit is only handed out under node or when a test page asks for it */
  Object.defineProperty(GN, 'testkit', {
    configurable: true,
    get: function () {
      try { if (typeof require === 'function' && typeof module !== 'undefined') return require('./gizmo_next_testkit.js'); } catch (e) { /* not under node */ }
      return (typeof window !== 'undefined' && window.__GIZMO_NEXT_TEST) ? window.__GizmoNextTestkit : undefined;
    }
  });

  W.GizmoNext = GN;
  if (typeof module !== 'undefined') module.exports = GN;
  if (typeof document !== 'undefined' && !W.__GIZMO_NEXT_TEST && GN.PARTS.length) GN.loadParts();
})();
