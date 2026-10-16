/* gizmo_next_testkit.js: the test equipment every gizmo stage uses (stage G0). It needs no headset and no real three.js.
   makeT()          the recorder: T.check(name, cond) prints "name: 1" or "name: 0", T.value(name, number) prints a measurement, T.finish() prints "RESULT passed/total".
   makeClock()      a fake clock, advance(sec). Everything in a test reads time through ctx.now(), so nothing waits for real time.
   makeCtx(opts)    a full fake ctx: clock, scene (stub THREE), say log, redraw and undo counters, head, floor, peers you can move, storage, audio with an analyser,
                    a fake Gizmos registry, and a sync endpoint. opts.guest / opts.private set the role of the page.
   makeInst(opts)   GizmoNext.create(makeCtx(opts)).   makeHostGuest(opts)   a host and a guest wired through a bus with fake latency.
   makeBusPair()    two sync endpoints, messages delivered after latencyMs of fake time.   stepSeconds(g, sec, hz)   tick one or more instances at 60 Hz by default.
   makeFakeDom()    a tiny document, enough for mountPanel;  domText(el)  every word, class and attribute under an element.
   countingKind()   a ready-made kind spec that counts builds, frames and live changes.
   Test use only. Works in node (module.exports) and in a test page (window.__GizmoNextTestkit). */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  var THREE_STUB = inNode ? require('./gizmo_next_three_stub.js') : (W.__GizmoNextThreeStub || W.THREE);
  var GN = function () { return inNode ? require('./gizmo_next_core.js') : W.GizmoNext; };

  /* ---------- the recorder ---------- */
  function makeT(opts) {
    opts = opts || {};
    var T = { lines: [], passed: 0, total: 0, failed: [] };
    var line = function (s) { T.lines.push(s); if (typeof opts.sink === 'function') opts.sink(s); else if (opts.print !== false && typeof console !== 'undefined') console.log(s); };
    T.check = function (name, cond) { var ok = !!cond; T.total++; if (ok) T.passed++; else T.failed.push(name); line(name + ': ' + (ok ? 1 : 0)); return ok; };
    T.eq = function (name, a, b) { var ok; try { ok = JSON.stringify(a) === JSON.stringify(b); } catch (e) { ok = false; } if (!ok && opts.print !== false && typeof console !== 'undefined') console.log('  expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); return T.check(name, ok); };
    T.value = function (name, v) { line(name + ': ' + v); };
    T.error = function (name, e) {
      T.total++; T.failed.push(name + '_error'); line(name + '_error: 0');
      if (opts.print !== false && typeof console !== 'undefined') console.log('  ' + String((e && e.stack) || e).split('\n').slice(0, 4).join('\n  '));
    };
    T.section = function (name, fn) { try { fn(); } catch (e) { T.error(name, e); } };
    T.finish = function () {
      line('RESULT ' + T.passed + '/' + T.total);
      if (typeof process !== 'undefined' && T.passed !== T.total) process.exitCode = 1;
      return T.passed === T.total;
    };
    return T;
  }

  /* ---------- time ---------- */
  function makeClock(startMs) {
    var t = startMs === undefined ? 100000 : startMs, fns = [];
    return {
      now: function () { return t; },
      advance: function (sec) { t += sec * 1000; fns.slice().forEach(function (f) { f(t); }); return t; },
      onAdvance: function (f) { fns.push(f); }
    };
  }
  function ms() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /* ---------- storage, Gizmos, audio, DOM ---------- */
  function makeStorage() {
    var m = {};
    return { get: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, set: function (k, v) { m[k] = String(v); }, del: function (k) { delete m[k]; }, _m: m };
  }
  /* the same surface as lib/gizmos.js: register, hidden, setHidden, show, photoMode, apply, kinds */
  function makeFakeGizmos() {
    var REG = [], st = { all: false, kinds: {} }, pm = null;
    var G = {
      registered: REG,
      register: function (k) { var i = REG.findIndex(function (x) { return x.id === k.id; }); if (i >= 0) REG[i] = k; else REG.push(k); return k; },
      kindOf: function (id) { return REG.find(function (k) { return k.id === id; }); },
      kinds: function () { return REG.filter(function (k) { try { return k.avail(); } catch (e) { return false; } }); },
      hidden: function (id) { return !!(st.all || st.kinds[id]); },
      visible: function (id) { var k = G.kindOf(id); try { return !!k && k.markersOn() && !G.hidden(id); } catch (e) { return false; } },
      setHidden: function (id, on) { st.kinds[id] = !!on; G.apply(); },
      setAll: function (on) { st.all = !!on; G.apply(); },
      show: function (id) { st.all = false; st.kinds[id] = false; var k = G.kindOf(id); try { if (k && k.avail()) k.setMarkers(true); } catch (e) { /* none */ } },
      apply: function () { REG.forEach(function (k) { try { if (k.avail()) k.setMarkers(k.markersOn()); } catch (e) { /* none */ } }); },
      photoMode: function (on) {
        if (on) { pm = G.kinds().map(function (k) { return { k: k, on: k.markersOn() }; }); pm.forEach(function (x) { x.k.setMarkers(false); }); }
        else if (pm) { pm.forEach(function (x) { x.k.setMarkers(x.on); }); pm = null; }
      },
      thumb: function () { return null }
    };
    return G;
  }
  /* an AudioContext stand-in with an analyser whose level you set; readLevel() reads it the way a muted-audio check does */
  function makeFakeAudio() {
    var level = 0;
    var analyser = {
      fftSize: 256, frequencyBinCount: 128,
      getByteTimeDomainData: function (a) { for (var i = 0; i < a.length; i++) a[i] = 128 + Math.round(level * 127 * Math.sin(i * 0.7)); },
      getFloatTimeDomainData: function (a) { for (var i = 0; i < a.length; i++) a[i] = level * Math.sin(i * 0.7); },
      connect: function () {}, disconnect: function () {}
    };
    var destination = { connect: function () {} };
    var context = { state: 'running', currentTime: 0, sampleRate: 48000, destination: destination, createAnalyser: function () { return analyser; }, createGain: function () { return { gain: { value: 1 }, connect: function () {}, disconnect: function () {} }; }, resume: function () { return { then: function (f) { f(); } }; } };
    return {
      context: context, destination: destination, analyser: analyser,
      setLevel: function (v) { level = Math.max(0, Math.min(1, v)); },
      readLevel: function () { var a = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(a); var m = 0; for (var i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - 128)); return m / 127; }
    };
  }
  function makeFakeDom() {
    var doc = {};
    function El(tag) {
      var e = { tagName: String(tag).toUpperCase(), children: [], className: '', attrs: {}, listeners: {}, ownerDocument: doc, parent: null, style: {}, _text: '' };
      Object.defineProperty(e, 'textContent', { get: function () { return e._text; }, set: function (v) { e._text = String(v); e.children = []; } });
      e.appendChild = function (c) { c.parent = e; e.children.push(c); return c; };
      e.setAttribute = function (k, v) { e.attrs[k] = String(v); };
      e.getAttribute = function (k) { return e.attrs[k]; };
      e.addEventListener = function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); };
      e.click = function () { (e.listeners.click || []).forEach(function (f) { f({}); }); };
      return e;
    }
    doc.createElement = El; doc.body = El('body');
    return doc;
  }
  /* every word, class name, tag and attribute (names and values) under an element, lower-cased */
  function domText(el) {
    var parts = [el.tagName || '', el.className || '', el._text || ''];
    Object.keys(el.attrs || {}).forEach(function (k) { parts.push(k, el.attrs[k]); });
    (el.children || []).forEach(function (c) { parts.push(domText(c)); });
    return parts.join(' ').toLowerCase();
  }
  function domFind(el, pred, out) { out = out || []; if (pred(el)) out.push(el); (el.children || []).forEach(function (c) { domFind(c, pred, out); }); return out; }

  /* ---------- people ---------- */
  function makePeer(id, name, head, o) {
    o = o || {};
    return { id: id, name: name || id, head: head.slice(), feet: o.feet === undefined ? [head[0], head[1] - 1.6, head[2]] : o.feet, guest: !!o.guest };
  }
  function movePeer(p, x, y, z) { var dy = p.head[1] - (p.feet ? p.feet[1] : p.head[1] - 1.6); p.head = [x, y, z]; if (p.feet) p.feet = [x, y - (dy || 1.6), z]; return p; }

  /* ---------- the bus: two sync endpoints with fake latency ---------- */
  function makeBusPair(o) {
    o = o || {};
    var clock = o.clock || makeClock(), latency = o.latencyMs || 0, q = [], sent = { a: 0, b: 0 };
    function endpoint(side, other) {
      var ep = {
        _handlers: {}, _online: true,
        send: function (name, obj) { sent[side]++; q.push({ at: clock.now() + latency, to: other, name: name, obj: JSON.parse(JSON.stringify(obj === undefined ? null : obj)), from: side }); pump(clock.now()); },
        on: function (name, fn) { (ep._handlers[name] = ep._handlers[name] || []).push(fn); },
        peersOnline: function () { return ep._online ? 1 : 0; }
      };
      return ep;
    }
    var a = endpoint('a'), b = endpoint('b');
    function target(side) { return side === 'a' ? b : a; }
    function pump(t) {
      var due = q.filter(function (m) { return m.at <= t; });
      q = q.filter(function (m) { return m.at > t; });
      due.forEach(function (m) { var to = target(m.from); (to._handlers[m.name] || []).slice().forEach(function (fn) { try { fn(m.obj, m.from); } catch (e) { /* a handler must not break the bus */ } }); });
    }
    clock.onAdvance(pump);
    return { a: a, b: b, clock: clock, sent: sent, pending: function () { return q.length; }, pump: function () { pump(clock.now()); } };
  }

  /* ---------- the ctx ---------- */
  function makeCtx(o) {
    o = o || {};
    var T = o.THREE || THREE_STUB, clock = o.clock || makeClock(), scene = new T.Scene();
    var audio = makeFakeAudio();
    var ctx = {
      THREE: T, quiet: true,
      scene: function () { return scene; },
      now: function () { return clock.now(); },
      say: function (t) { ctx._said.push(t); },
      redraw: function () { ctx._redraws++; },
      pushUndo: function () { ctx._undos++; },
      head: function () { return ctx._head; },
      floorAt: function (x, z) { return ctx._floorFn(x, z); },
      dolly: function () { return ctx._dolly; }, dollyScale: function () { return 1; },
      walk: function () { return ctx._walk; },
      isHost: function () { return !ctx._guest; }, isGuest: function () { return !!ctx._guest; }, isPrivate: function () { return !!ctx._private; },
      peers: function () { return ctx._peers; }, figures: function () { return ctx._figures; }, props: function () { return ctx._props; },
      audio: { context: audio.context, destination: audio.destination },
      storage: o.storage || makeStorage(),
      gizmos: o.gizmos === undefined ? makeFakeGizmos() : o.gizmos,
      sync: o.sync || null,
      log: function (m) { ctx._logs.push(String(m)); }
    };
    ['look', 'pose', 'pins', 'narration', 'sounds', 'seat', 'spawn', 'poseLib', 'clips', 'objCfg', 'scripts', 'ragdoll', 'face', 'camera', 'openScene', 'sharedScenes'].forEach(function (k) { if (o[k] !== undefined) ctx[k] = o[k]; });
    ctx._clock = clock; ctx._scene = scene; ctx._audio = audio; ctx._said = []; ctx._logs = []; ctx._redraws = 0; ctx._undos = 0;
    ctx._head = o.head || [0, 1.6, 0]; ctx._floorFn = o.floorFn || function () { return 0; }; ctx._dolly = new T.Group(); ctx._walk = { on: false, fly: false };
    ctx._guest = !!o.guest; ctx._private = !!o.private; ctx._peers = o.peers || []; ctx._figures = o.figures || []; ctx._props = o.props || [];
    return ctx;
  }
  var made = [];
  function makeInst(o) { var ctx = makeCtx(o); var g = GN().create(ctx); g._ctx = ctx; made.push(g); return g; }
  /* run fn with no parts registered and no other instance alive, then put them back: the core's own checks must not depend on which stages are loaded */
  function isolate(fn) {
    var G = GN(), R = G._registry, I = G._instances, savedR = R.splice(0), savedI = I.splice(0);
    try { return fn(); } finally { R.splice(0); savedR.forEach(function (e) { R.push(e); }); I.splice(0); savedI.forEach(function (g) { I.push(g); }); }
  }
  function track(g) { made.push(g); return g; }
  /* free every instance this kit made, so a test that registers a part does not run it inside old instances */
  function disposeAll() { made.splice(0).forEach(function (g) { try { g.dispose(); } catch (e) { /* gone already */ } }); }
  function makeHostGuest(o) {
    o = o || {};
    var clock = o.clock || makeClock(), bus = makeBusPair({ clock: clock, latencyMs: o.latencyMs || 0 });
    var hostCtx = makeCtx(Object.assign({}, o, o.host || {}, { clock: clock, sync: bus.a, guest: false }));
    var guestCtx = makeCtx(Object.assign({}, o, o.guest || {}, { clock: clock, sync: bus.b, guest: true }));
    var G = GN(), host = G.create(hostCtx), guest = G.create(guestCtx);
    made.push(host, guest);
    return { host: host, guest: guest, hostCtx: hostCtx, guestCtx: guestCtx, clock: clock, bus: bus, step: function (sec, hz) { return stepSeconds([host, guest], sec, hz); } };
  }
  /* tick one instance, an array of them, or {host, guest}: advance each distinct clock once per step, then tick everyone */
  function stepSeconds(x, sec, hz) {
    hz = hz || 60;
    var list = [];
    if (Array.isArray(x)) list = x; else if (x && typeof x.tick === 'function') list = [x]; else if (x && typeof x === 'object') list = Object.keys(x).map(function (k) { return x[k]; }).filter(function (v) { return v && typeof v.tick === 'function' && v.ctx; });
    list = list.filter(Boolean);
    if (!list.length) return 0;
    var clocks = [];
    list.forEach(function (g) { var c = g.ctx && g.ctx._clock; if (c && clocks.indexOf(c) < 0) clocks.push(c); });
    var dt = 1 / hz, n = Math.round(sec * hz);
    for (var i = 0; i < n; i++) { clocks.forEach(function (c) { c.advance(dt); }); list.forEach(function (g) { g.tick(dt); }); }
    return n;
  }

  /* a kind spec that counts what happens to it. Armed is off by default, like a trigger. */
  function countingKind(id, over) {
    var counts = { build: 0, frame: 0, liveOn: 0, liveOff: 0, frames: [] };
    var spec = Object.assign({
      id: id || 'demo', name: 'Demo box', plural: 'Demo boxes', col: '#ff8a5c', H: 0.25, max: 12, copyable: true, resize: 'size',
      defaults: function () { return { size: [1, 1, 1], enabled: true, armed: false, who: 'anyone', cooldown: 0, tags: [] }; },
      fields: [
        { key: 'enabled', label: 'Enabled', type: 'bool' },
        { key: 'who', label: 'Triggered By', type: 'enum', opts: [['anyone', 'Anyone'], ['guests', 'Guests only']] },
        { key: 'cooldown', label: 'Cooldown (s)', type: 'num', min: 0, max: 600, step: 1 },
        { key: 'tags', label: 'Tags', type: 'list' }
      ],
      onFrame: function (rec, dt) { counts.frame++; },
      onLiveChange: function (rec, on) { if (on) counts.liveOn++; else counts.liveOff++; }
    }, over || {});
    var userBuild = spec.build;
    spec.build = function (rec, T) { counts.build++; return userBuild ? userBuild(rec, T) : null; };
    return { spec: spec, counts: counts };
  }

  var kit = {
    makeT: makeT, makeClock: makeClock, ms: ms, makeStorage: makeStorage, makeFakeGizmos: makeFakeGizmos, makeFakeAudio: makeFakeAudio, makeFakeDom: makeFakeDom,
    domText: domText, domFind: domFind, makePeer: makePeer, movePeer: movePeer, makeBusPair: makeBusPair, makeCtx: makeCtx, makeInst: makeInst, isolate: isolate, track: track, disposeAll: disposeAll, makeHostGuest: makeHostGuest,
    stepSeconds: stepSeconds, countingKind: countingKind, THREE: THREE_STUB, inNode: inNode,
    get GizmoNext() { return GN(); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = kit;
  W.__GizmoNextTestkit = kit;
})();
