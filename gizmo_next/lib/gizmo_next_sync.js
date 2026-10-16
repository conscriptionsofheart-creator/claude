/* gizmo_next_sync.js: stage H9, friends and saving. The host decides and the guest follows.
   The core already has the sync table (`GizmoNext.sync.parts/encodeAll/validate/apply`: every part checked, 16 KB a part, 10 messages a second a part, nothing sent in a private project,
   apply refused on the host). This part adds what a friend needs on top:
     snap       a late joiner's snapshot, sent in pieces: live, the beat list, trigger and effects records (no runtime memory), seat and spawn lists and their extras, who sits where
     snapreq    a friend asks the host for it (the host answers at most once in 3 s)
     gizmos     (the core's own part) the Gizmos live flag follows the host; this part sends it when it changes
     seat       a seat taken or freed shows on the friend's page (no rig moves)
   Messages that already exist in other parts: beats {st, t, speed, mode, br, h, n}, trigger {id, fired, who, t}, spawn {who, x, y, z, yaw, fadeSec, ...}, fx {id, mode}.
   A friend sends nothing but `snapreq`, and never saves, exports or downloads. `GizmoNext.guestFiles()` lists the files a friend's page must be allowed to fetch. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') { require('./gizmo_next_trigger.js'); require('./gizmo_next_spawn.js'); require('./gizmo_next_seat.js'); require('./gizmo_next_effects.js'); }

  var CHUNK = 3500, MAX_CHUNKS = 64, PER_SEC = 8, ASK_EVERY = 2, ASK_MAX = 8, ANSWER_EVERY = 3, WATCH_EVERY = 1.5;
  var KINDS_OK = ['trigger', 'effects'], PARTS_OK = ['beats', 'seat', 'spawn', 'effects', 'walk'];
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

  /* the files a friend's page may fetch: the core, every part, this file */
  function guestFiles() {
    var list = ['gizmo_next_core.js'].concat(GN.PARTS || []);
    if (list.indexOf('gizmo_next_sync.js') < 0) list.push('gizmo_next_sync.js');
    return list.filter(function (f, i) { return list.indexOf(f) === i; });
  }

  function register() {
    GN.register('friends', { needs: ['beats', 'actions', 'trigger', 'spawn', 'seat', 'effects'], version: 1 }, function (g) {
      var API = {}, queue = [], seq = 1, lastHash = null, lastBuilt = 0, lastAnswer = -1e9, inbox = {}, received = false, asks = 0, askAt = 0, watchAcc = 0, lastSend = '', sentCount = 0, told = {};
      var sentNames = {};
      var msg = function (t) { if (g._loading) g.log({ who: 'friends', what: t }); else g.say(t); };
      var M = function (n) { return g.modules[n]; };
      var ctx = function () { return g.ctx || {}; };
      var nowS = function () { return g.now() / 1000; };

      /* ---------- what a friend needs to see ---------- */
      function cleanList(l, n) { return (Array.isArray(l) ? l : []).slice(0, n).filter(isObj).map(function (r) { var o = {}; ['id', 'name', 'preset', 'group'].forEach(function (k) { if (typeof r[k] === 'string') o[k] = r[k].slice(0, 60); }); ['x', 'y', 'z', 'yaw'].forEach(function (k) { if (isNum(r[k])) o[k] = Math.max(-1e4, Math.min(1e4, r[k])); }); if (typeof r.lie === 'boolean') o.lie = r.lie; return o; }); }
      function seatsNow() { var s = ctx().seat; return cleanList(s && s.list, 64); }
      function spawnsNow() { var s = ctx().spawn; return cleanList(s && s.list, 64); }
      function occNow() { var o = {}, S = M('seat'); if (S && typeof S.occupant === 'function') seatsNow().forEach(function (r) { var w = S.occupant(r.id); if (w) o[r.id] = String(w).slice(0, 40); }); return o; }
      API.snapshot = function () {
        var st = g.state(), kinds = {}, parts = {};
        KINDS_OK.forEach(function (k) { if (st.kinds && st.kinds[k]) kinds[k] = { items: st.kinds[k].items }; });
        PARTS_OK.forEach(function (p) { if (st.parts && st.parts[p] !== undefined) parts[p] = st.parts[p]; });
        return { v: 1, live: !!g._live, kinds: kinds, parts: parts, seats: seatsNow(), spawns: spawnsNow(), occ: occNow() };
      };
      /* the same on both pages once the snapshot has arrived: one short text for each thing a friend must agree on */
      API.checksum = function () {
        var s = API.snapshot(), B = M('beats'), tr = B && B.sync && B.sync.parts && B.sync.parts.beats ? B.sync.parts.beats.encode() : null;
        var c = {
          beats: tr ? tr.h : '', beatCount: tr ? tr.n : 0,
          triggers: hashStr(JSON.stringify(s.kinds.trigger || null)), effects: hashStr(JSON.stringify(s.kinds.effects || null)),
          seats: hashStr(JSON.stringify([s.seats, s.parts.seat || null, s.occ])), spawns: hashStr(JSON.stringify([s.spawns, s.parts.spawn || null])), live: s.live
        };
        c.all = hashStr(JSON.stringify([c.beats, c.triggers, c.effects, c.seats, c.spawns, c.live]));
        return c;
      };

      /* ---------- the host sends the snapshot in pieces, 8 a second ---------- */
      function startSend() {
        if (g.isGuest() || g.isPrivate() || !ctx().sync) return false;
        var txt = JSON.stringify(API.snapshot()), id = seq++, h = hashStr(txt), n = Math.ceil(txt.length / CHUNK) || 1;
        if (n > MAX_CHUNKS) { once('big', 'The scene is too big to share with a friend in one go. Remove some beats or gizmos.'); return false; }
        queue = []; for (var i = 0; i < n; i++) queue.push({ id: id, i: i, n: n, h: h, d: txt.slice(i * CHUNK, (i + 1) * CHUNK) });
        lastSend = h; lastBuilt = nowS(); sentCount++;
        return true;
      }
      function once(k, t) { if (told[k]) return; told[k] = 1; msg(t); }
      function pump(dt) {
        if (!queue.length) return;
        pumpAcc += dt; var n = Math.min(queue.length, Math.floor(pumpAcc * PER_SEC)); if (n <= 0) return; pumpAcc -= n / PER_SEC;
        for (var i = 0; i < n; i++) { if (!g.send('snap', queue[0])) { pumpAcc = 0; return; } queue.shift(); }
        if (!queue.length) pumpAcc = 0;
      }
      var pumpAcc = 0;
      API.sendSnapshot = function () { if (g.isGuest()) return false; return startSend(); };
      API.onJoin = function () { return API.sendSnapshot(); };
      API.pending = function () { return queue.length; };
      API.received = function () { return received; };

      /* ---------- the friend applies it ---------- */
      function sane(snap) {
        if (!isObj(snap) || snap.v !== 1 || typeof snap.live !== 'boolean') return null;
        var out = { live: snap.live, kinds: {}, parts: {}, seats: cleanList(snap.seats, 64), spawns: cleanList(snap.spawns, 64), occ: {} };
        if (isObj(snap.kinds)) Object.keys(snap.kinds).forEach(function (k) { if (KINDS_OK.indexOf(k) >= 0 && isObj(snap.kinds[k]) && Array.isArray(snap.kinds[k].items)) out.kinds[k] = { items: snap.kinds[k].items.slice(0, 64) }; });
        if (isObj(snap.parts)) Object.keys(snap.parts).forEach(function (p) { if (PARTS_OK.indexOf(p) >= 0 && snap.parts[p] !== undefined) out.parts[p] = snap.parts[p]; });
        if (isObj(snap.occ)) Object.keys(snap.occ).slice(0, 64).forEach(function (id) { if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && !BAD[id] && typeof snap.occ[id] === 'string') out.occ[id] = snap.occ[id].slice(0, 40); });
        return out;
      }
      function applySnap(txt) {
        var snap; try { snap = JSON.parse(txt); } catch (e) { return false; }
        snap = sane(snap); if (!snap) return false;
        /* keep what this page has of other kinds; replace only what the host owns */
        var cur = g.state(); cur.kinds = cur.kinds || {}; cur.parts = cur.parts || {};
        KINDS_OK.forEach(function (k) { if (snap.kinds[k]) cur.kinds[k] = snap.kinds[k]; else delete cur.kinds[k]; });
        PARTS_OK.forEach(function (p) { if (snap.parts[p] !== undefined) cur.parts[p] = snap.parts[p]; else delete cur.parts[p]; });
        cur.live = false;
        g.load(cur);
        var m = ctx().mirror;
        if (m && typeof m === 'object') { try { if (typeof m.seats === 'function') m.seats(snap.seats); if (typeof m.spawns === 'function') m.spawns(snap.spawns); } catch (e) { /* the page could not mirror the lists */ } }
        var S = M('seat'); if (S && typeof S.mirror === 'function') Object.keys(snap.occ).forEach(function (id) { S.mirror(id, mapWho(snap.occ[id]), 'enter'); });
        g.setLive(snap.live);
        received = true; g.emit('snapshot', { n: snap.kinds.trigger ? snap.kinds.trigger.items.length : 0 });
        return true;
      }
      function onChunk(v) {
        var e = inbox[v.id] || (inbox[v.id] = { n: v.n, h: v.h, got: {}, count: 0 });
        if (e.n !== v.n || e.h !== v.h) return false;
        if (!e.got[v.i]) { e.got[v.i] = v.d; e.count++; }
        var ids = Object.keys(inbox); if (ids.length > 2) ids.slice(0, ids.length - 2).forEach(function (k) { delete inbox[k]; });
        if (e.count < e.n) return true;
        var txt = ''; for (var i = 0; i < e.n; i++) txt += e.got[i];
        delete inbox[v.id];
        if (hashStr(txt) !== e.h) { once('hash', 'The host scene did not arrive whole, so it asks again.'); received = false; asks = Math.min(asks, ASK_MAX - 2); return false; }
        return applySnap(txt);
      }

      /* ---------- the host listens for a friend asking; nothing else a friend sends is obeyed ---------- */
      function wireAsk() {
        var s = ctx().sync; if (!s || typeof s.on !== 'function') return;
        try {
          s.on('snapreq', function (obj) {
            if (g.isGuest() || g.isPrivate()) return;
            if (!isObj(obj) || obj.v !== 1 || Object.keys(obj).length > 2) return;
            var t = nowS(); if (t - lastAnswer < ANSWER_EVERY) return; lastAnswer = t;
            startSend();
          });
        } catch (e) { /* alone in the room */ }
      }

      /* ---------- the seat and live follow the host ---------- */
      function wireHost() {
        g.on('live', function (on) { if (!g.isGuest() && !g._loading) g.send('gizmos', { live: !!on }); });
        g.on('seat', function (e) { if (!g.isGuest() && e && typeof e.seatId === 'string') g.send('seat', { id: e.seatId, who: str(e.who, 40), state: e.state === 'exit' ? 'exit' : 'enter' }); });
      }

      /* the host's 'me' is not this page's 'me': a friend's page shows the host as `host` and itself as `me` */
      function mapWho(who) {
        who = str(who, 40); var c = ctx(), self = typeof c.selfId === 'function' ? c.selfId() : null;
        if (who === 'me') return 'host';
        if (self !== null && who === self) return 'me';
        return who || 'someone';
      }
      var part = {
        alwaysTick: true,
        init: function () { wireAsk(); wireHost(); },
        tick: function (dt) {
          if (g.isPrivate()) return;
          if (g.isGuest()) {
            if (received || asks >= ASK_MAX || !ctx().sync) return;
            askAt -= dt; if (askAt > 0) return; askAt = ASK_EVERY; asks++;
            sentNames.snapreq = (sentNames.snapreq || 0) + 1; g.send('snapreq', { v: 1 });
            return;
          }
          pump(dt);
          /* when anything the friend sees has changed, send it again, at most once in 1.5 s */
          watchAcc += dt; if (watchAcc < WATCH_EVERY) return; watchAcc = 0;
          if (queue.length) return;
          var h = hashStr(JSON.stringify(API.snapshot()));
          if (lastHash === null) { lastHash = h; return; }
          if (h !== lastHash) { lastHash = h; if (nowS() - lastBuilt >= WATCH_EVERY) startSend(); }
        },
        reset: function () { queue = []; lastHash = null; told = {}; },
        load: function () { lastHash = null; },
        sync: { parts: {
          snap: {
            encode: function () { return null; },
            validate: function (v) { return isObj(v) && isNum(v.id) && v.id >= 0 && v.id < 1e9 && isNum(v.i) && isNum(v.n) && v.n >= 1 && v.n <= MAX_CHUNKS && v.i >= 0 && v.i < v.n && Math.floor(v.i) === v.i && Math.floor(v.n) === v.n && typeof v.h === 'string' && v.h.length <= 12 && typeof v.d === 'string' && v.d.length <= CHUNK + 16; },
            apply: function (v) { onChunk(v); }
          },
          seat: {
            encode: function () { return null; },
            validate: function (v) { return isObj(v) && typeof v.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v.id) && typeof v.who === 'string' && v.who.length <= 40 && (v.state === 'enter' || v.state === 'exit'); },
            apply: function (v) { var S = M('seat'); if (S && typeof S.mirror === 'function') S.mirror(v.id, mapWho(v.who), v.state); }
          }
        } },
        dispose: function () { queue = []; inbox = {}; }
      };
      API.stats = function () { return { sent: sentCount, asks: asks, pending: queue.length, received: received }; };
      API.guestFiles = guestFiles;
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN.guestFiles = guestFiles;
  GN._friendsRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
