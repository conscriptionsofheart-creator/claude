/* gizmo_next_spawn.js: stage H5, spawn point v2 and the snap spot. A sidecar to the page's SpawnPoint (lib/spawn_point.js): it does not copy it and adds no second gizmo.
   The page's SpawnPoint keeps the record {id, name, x, y (the floor), z, yaw (0 faces -z), locked, group}. This part keeps the extra fields in its own state, keyed by the point's id,
   and adds: several points, Spawn on Start / With a trigger / Script attached, Set Position Only, face the arrow or an object or the host, Player Gravity and Speed, who, order,
   how to pick (in order, take turns, random), respawn rules, a floor check, the snap spot, and a fade (never a flash) when someone arrives.
   Host adapters (all optional): ctx.spawn (the page's SpawnPoint: list, get, where), ctx.teleport(visitor, arrival), ctx.floorAt(x, z) (a number, or nothing when there is no floor),
   ctx.solidAt(x, y, z), ctx.inRoom([x,y,z]), ctx.selfId(), ctx.peers(), ctx.head(), ctx.props().
   Nothing moves on open. Nobody is moved unless Gizmos live is on (a join, a respawn, a trigger) or a person presses Test arrive. A friend's page only obeys a message from the host. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');

  var FADE = 0.4, SNAP_R = 1.0, RESPAWN_COOLDOWN = 3;
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  var DEF = { mode: 'start', setPositionOnly: false, face: 'arrow', faceTarget: '', gravity: 9.81, speed: 4, who: 'everyone', names: [], order: 1, pick: 'order', respawnBelowY: null, respawnIfLeave: false, snap: false };
  var MODES = [['start', 'Spawn on Start'], ['trigger', 'With a trigger'], ['script', 'Script attached']];
  var FACES = [['arrow', 'The arrow'], ['object', 'An object'], ['host', 'The host']];
  var WHOS = [['everyone', 'Everyone'], ['guests', 'Guests'], ['me', 'Just me'], ['named', 'Named person']];
  var PICKS = [['order', 'In order'], ['turns', 'Take turns'], ['random', 'Random']];
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function has(list, v) { return list.some(function (o) { return o[0] === v; }); }
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return String(v); }
  function wrapYaw(n) { var t = 2 * Math.PI; n = n % t; if (n > Math.PI) n -= t; else if (n < -Math.PI) n += t; return n; }
  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* one record of extra fields, forced into range */
  function cleanFields(raw, base) {
    var o = Object.assign({}, DEF, base || {}), s = isObj(raw) ? raw : {};
    if (has(MODES, s.mode)) o.mode = s.mode;
    if (typeof s.setPositionOnly === 'boolean') o.setPositionOnly = s.setPositionOnly;
    if (has(FACES, s.face)) o.face = s.face;
    if (typeof s.faceTarget === 'string') o.faceTarget = s.faceTarget.slice(0, 40);
    if (isNum(s.gravity)) o.gravity = r4(clamp(s.gravity, 0, 9.81));
    if (isNum(s.speed)) o.speed = r4(clamp(s.speed, 0, 45));
    if (has(WHOS, s.who)) o.who = s.who;
    if (Array.isArray(s.names)) o.names = s.names.filter(function (x) { return typeof x === 'string' && x.length; }).slice(0, 24).map(function (x) { return x.slice(0, 40); });
    if (isNum(s.order)) o.order = clamp(Math.round(s.order), 1, 99);
    if (has(PICKS, s.pick)) o.pick = s.pick;
    if (s.respawnBelowY === null) o.respawnBelowY = null; else if (isNum(s.respawnBelowY)) o.respawnBelowY = r4(clamp(s.respawnBelowY, -1000, 1000));
    if (typeof s.respawnIfLeave === 'boolean') o.respawnIfLeave = s.respawnIfLeave;
    if (typeof s.snap === 'boolean') o.snap = s.snap;
    if (isNum(s.spawnOnStart) || typeof s.spawnOnStart === 'boolean') { if (!s.mode) o.mode = s.spawnOnStart ? 'start' : (o.mode === 'start' ? 'trigger' : o.mode); }
    o.spawnOnStart = o.mode === 'start';
    return o;
  }

  function register() {
    GN.register('spawn', { needs: ['core'], version: 1 }, function (g) {
      var API = {}, extras = {}, turn = 0, rnd = mulberry((Math.random() * 4294967296) >>> 0), lastArrive = {}, lastRespawn = {}, told = {};
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'spawn', what: t }); else g.say(t); };
      var once = function (k, t) { if (told[k]) return; told[k] = 1; msg(t); };
      var sp = function () { var o = g.ctx && g.ctx.spawn; return o && typeof o === 'object' ? o : null; };
      var pts = function () { var s = sp(); return s && Array.isArray(s.list) ? s.list.filter(function (m) { return m && typeof m.id === 'string'; }) : []; };
      var nowS = function () { return g.now() / 1000; };

      function posOf(rec) {
        var H = isNum(sp() && sp().H) ? sp().H : 0.25, m = rec._mk;
        if (m && m.position && m.rotation) return { x: m.position.x, y: m.position.y - H, z: m.position.z, yaw: wrapYaw(m.rotation.y || 0) };
        return { x: isNum(rec.x) ? rec.x : 0, y: isNum(rec.y) ? rec.y : 0, z: isNum(rec.z) ? rec.z : 0, yaw: wrapYaw(rec.yaw || 0) };
      }
      function pointOf(id) { var l = pts(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
      function merged(rec) { var p = posOf(rec), f = Object.assign({}, DEF, extras[rec.id] || {}); f.spawnOnStart = f.mode === 'start'; return Object.assign({ id: rec.id, name: str(rec.name, 40) || 'Spawn point', group: rec.group || '', locked: !!rec.locked }, p, f); }

      /* ---------- the extra fields ---------- */
      API.defaults = function () { return Object.assign({}, DEF, { spawnOnStart: true, fadeSec: FADE }); };
      API.fields = function (id) { var rec = pointOf(id); return rec ? merged(rec) : null; };
      API.setFields = function (id, patch) {
        if (g.isGuest()) { msg('Only the host can change a spawn point.'); return null; }
        var rec = pointOf(id); if (!rec) return null;
        extras[id] = cleanFields(patch, extras[id]);
        if (!g._loading) g.persist();
        return merged(rec);
      };
      API.list = function () { return pts().map(merged); };
      API.count = function () { return pts().length; };

      /* ---------- who, and which point ---------- */
      function visitorList() {
        var out = [], head = g.head();
        if (head) out.push({ id: 'me', name: str(g.ctx && g.ctx.localName, 40) || 'Me', guest: false, local: true, head: head, feet: null });
        g.peers().forEach(function (p) { if (p && typeof p.id === 'string' && Array.isArray(p.head)) out.push({ id: p.id, name: str(p.name || p.id, 40), guest: !!p.guest, local: false, head: p.head, feet: Array.isArray(p.feet) ? p.feet : null }); });
        return out;
      }
      function whoOk(f, v) {
        if (f.who === 'everyone') return true;
        if (f.who === 'guests') return !!v.guest;
        if (f.who === 'me') return !!v.local;
        if (f.who === 'named') return (f.names || []).some(function (n) { return String(n).toLowerCase() === String(v.name).toLowerCase(); });
        return false;
      }
      API.seed = function (n) { rnd = mulberry(isNum(n) ? n : 1); };
      /* choose(visitor): the point a new arrival lands on. Points that are Spawn on Start and listen to this visitor, lowest Order first. Take turns and random look at the lowest one's Pick. */
      API.choose = function (v, opts) {
        opts = opts || {};
        var cand = API.list().filter(function (m) { return m.mode === 'start' && whoOk(m, v || {}); });
        if (!cand.length) return null;
        var idx = {}; pts().forEach(function (r, i) { idx[r.id] = i; });
        cand.sort(function (a, b) { return a.order - b.order || idx[a.id] - idx[b.id]; });
        var how = cand[0].pick, pick;
        if (how === 'turns') { pick = cand[turn % cand.length]; if (opts.commit !== false) turn++; }
        else if (how === 'random') pick = cand[Math.floor(rnd() * cand.length) % cand.length];
        else pick = cand[0];
        return pick;
      };

      /* ---------- a point that is safe to stand on ---------- */
      API.floorCheck = function (point) {
        var p = point && isNum(point.x) && isNum(point.z) ? point : null;
        if (!p) return { ok: false, message: 'That spawn point has no place yet.' };
        var raw = g.call('floorAt', null, p.x, p.z);
        if (!isNum(raw) || raw < -500) return { ok: false, message: 'There is no floor under that spawn point, so nobody can land there. Move it over the floor.' };
        var y = isNum(p.y) && Math.abs(p.y - raw) > 0.3 ? p.y : raw;
        var solid = g.call('solidAt', false, p.x, y + 0.9, p.z);
        if (solid) return { ok: false, message: 'That spawn point is inside something solid. Move it into the open.' };
        return { ok: true, y: y, floor: raw };
      };

      /* ---------- arriving ---------- */
      function facing(f, p, v) {
        if (f.setPositionOnly) return null;
        if (f.face === 'object') {
          var o = g.props().find(function (x) { return x && (x.name === f.faceTarget || x.id === f.faceTarget); });
          if (o && o.object && o.object.position) return wrapYaw(Math.atan2(-(o.object.position.x - p.x), -(o.object.position.z - p.z)));
        }
        if (f.face === 'host') { var h = g.head(); if (h && !(v && v.local)) return wrapYaw(Math.atan2(-(h[0] - p.x), -(h[2] - p.z))); }
        return p.yaw;
      }
      API.arrive = function (v, rec) {
        if (!v || !rec) return null;
        var point = typeof rec === 'string' ? pointOf(rec) : rec; if (!point) return null;
        var m = merged(point), chk = API.floorCheck(m);
        if (!chk.ok) { msg(chk.message); return null; }
        return { point: m.id, x: r4(m.x), y: r4(chk.y), z: r4(m.z), yaw: facing(m, m, v), setPositionOnly: !!m.setPositionOnly, gravity: m.gravity, speed: m.speed, fadeSec: FADE };
      };
      function deliver(v, arrival) {
        var last = lastArrive[v.id]; if (last !== undefined && nowS() - last < FADE) return false; /* never more than 2 arrivals a second for one person: no flashing */
        lastArrive[v.id] = nowS();
        var c = g.ctx || {};
        if (v.local) { if (typeof c.teleport === 'function') { try { c.teleport(v, arrival); } catch (e) { g.log({ who: 'spawn', what: 'The move stopped with an error' }); return false; } } else once('tp', 'Moving the rig is not connected yet, so nobody was moved.'); }
        else g.send('spawn', Object.assign({ who: str(v.id, 40) }, arrival));
        g.log({ who: 'spawn', what: (v.name || 'Someone') + ' arrived at ' + str(pointOf(arrival.point) && pointOf(arrival.point).name, 40) });
        g.emit('arrive', { who: v, point: arrival.point, arrival: arrival });
        return true;
      }
      /* send(visitor or id, pointId?): the host moves someone to a point (a trigger, a script, a join). With no point it chooses one. */
      API.send = function (who, pointId) {
        if (g.isGuest()) return false;
        var v = typeof who === 'string' ? visitorList().filter(function (x) { return x.id === who; })[0] : who;
        if (!v) return false;
        var rec = pointId !== undefined && pointId !== null && pointId !== '' ? pointOf(String(pointId)) || API.list().filter(function (m) { return m.name === pointId || String(m.order) === String(pointId); })[0] : API.choose(v);
        if (!rec) { once('nopoint', 'There is no spawn point to send anyone to.'); return false; }
        var a = API.arrive(v, rec); if (!a) return false;
        return deliver(v, a);
      };
      /* a guest joins (H0 number 1: the seat calls this when someone arrives). Only while Gizmos live is on; the page's own first point still works with it off. */
      API.onJoin = function (v) { if (g.isGuest() || !g._live || !v) return null; var rec = API.choose(v); if (!rec) return null; var a = API.arrive(v, rec); if (a && deliver(v, a)) return a; return null; };
      API.testArrive = function (pointId) {
        if (g.isGuest()) { msg('Only the host can test a spawn point.'); return null; }
        var v = { id: 'me', name: str(g.ctx && g.ctx.localName, 40) || 'Me', guest: false, local: true, head: g.head() || [0, 1.6, 0], feet: null };
        var rec = pointId ? pointOf(pointId) : (API.choose(v, { commit: false }) || pts()[0]);
        if (!rec) { msg('Place a spawn point first.'); return null; }
        var a = API.arrive(v, rec); if (!a) return null;
        delete lastArrive.me; if (!deliver(v, a)) return null;
        msg('Tested. You arrived at ' + str(rec.name, 40) + '.');
        return a;
      };
      API.snapSpots = function () { return API.list().filter(function (m) { return m.snap; }).map(function (m) { return { id: m.id, x: m.x, y: m.y, z: m.z, yaw: m.setPositionOnly ? null : m.yaw }; }); };
      /* the walk-teleport aim: close to a snap spot, it goes to the spot's centre and takes its facing */
      API.snapAim = function (x, z) {
        if (!isNum(x) || !isNum(z)) return null;
        var best = null, bd = SNAP_R;
        API.snapSpots().forEach(function (s) { var d = Math.hypot(s.x - x, s.z - z); if (d <= bd) { bd = d; best = s; } });
        return best ? { id: best.id, x: best.x, y: best.y, z: best.z, yaw: best.yaw, snapped: true } : null;
      };

      /* ---------- respawn rules (live only) ---------- */
      function respawnTick() {
        var list = API.list().filter(function (m) { return m.respawnBelowY !== null || m.respawnIfLeave; });
        if (!list.length) return;
        var vs = visitorList(), c = g.ctx || {};
        vs.forEach(function (v) {
          list.forEach(function (m) {
            if (!whoOk(m, v)) return;
            if (lastRespawn[v.id] !== undefined && nowS() - lastRespawn[v.id] < RESPAWN_COOLDOWN) return;
            var feetY = v.feet ? v.feet[1] : (v.head ? v.head[1] - 1.6 : 0), why = null;
            if (m.respawnBelowY !== null && feetY < m.respawnBelowY) why = 'fell';
            else if (m.respawnIfLeave && typeof c.inRoom === 'function') { var inside = true; try { inside = !!c.inRoom(v.feet || v.head); } catch (e) { inside = true; } if (!inside) why = 'left'; }
            if (!why) return;
            lastRespawn[v.id] = nowS();
            var a = API.arrive(v, m); if (a && deliver(v, a)) g.log({ who: 'spawn', what: (v.name || 'Someone') + (why === 'fell' ? ' fell below ' + m.respawnBelowY + ' m' : ' left the room') + ' and went back' });
          });
        });
      }

      /* ---------- the panel rows (the seat's object panel for a spawn point appends these) ---------- */
      API.rows = function (id, H) {
        var rec = pointOf(id); if (!rec || g.isGuest()) return [];
        var f = merged(rec), rows = [], hh = { say: function (t) { if (H && typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else msg(t); }, redraw: function () { if (H && typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } };
        var R = function (l, ic, act, on) { var r = { label: plain(l), ic: ic, act: act }; if (on) r.on = on; rows.push(r); };
        var cyc = function (list, key, name) { return function () { var i = list.findIndex(function (o) { return o[0] === f[key]; }); var n = list[(i + 1) % list.length]; g.pushUndo(); var p = {}; p[key] = n[0]; API.setFields(id, p); hh.say(name + ': ' + n[1]); hh.redraw(); }; };
        var step = function (key, vals, name, fmtv) { return function () { var i = vals.indexOf(f[key]); var n = vals[(i + 1) % vals.length]; g.pushUndo(); var p = {}; p[key] = n; API.setFields(id, p); hh.say(name + ': ' + fmtv(n)); hh.redraw(); }; };
        R('Defaults: Gravity 9.81, Speed 4, Order 1, fade ' + FADE + ' s', null, function () {});
        R(label(MODES, f.mode), 'pin', cyc(MODES, 'mode', 'Mode'));
        R('Set Position Only: ' + (f.setPositionOnly ? 'on' : 'off'), null, function () { g.pushUndo(); API.setFields(id, { setPositionOnly: !f.setPositionOnly }); hh.say('Set Position Only: ' + (!f.setPositionOnly ? 'on' : 'off')); hh.redraw(); }, function () { return f.setPositionOnly; });
        R('Face: ' + label(FACES, f.face), null, cyc(FACES, 'face', 'Face'));
        R('Player Gravity: ' + f.gravity, null, step('gravity', [0, 1.6, 4.9, 9.81], 'Player Gravity', String));
        R('Player Speed: ' + f.speed, null, step('speed', [1, 2, 4, 8, 16, 45], 'Player Speed', String));
        R('Who: ' + label(WHOS, f.who), null, cyc(WHOS, 'who', 'Who'));
        R('Order: ' + f.order, null, step('order', [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Order', String));
        R('Pick: ' + label(PICKS, f.pick), null, cyc(PICKS, 'pick', 'Pick'));
        R('Respawn if I fall below: ' + (f.respawnBelowY === null ? 'off' : f.respawnBelowY + ' m'), null, step('respawnBelowY', [null, -5, -10, -20, -50], 'Respawn below', function (v) { return v === null ? 'off' : v + ' m'; }));
        R('Respawn if I leave the room: ' + (f.respawnIfLeave ? 'on' : 'off'), null, function () { g.pushUndo(); API.setFields(id, { respawnIfLeave: !f.respawnIfLeave }); hh.redraw(); }, function () { return f.respawnIfLeave; });
        R('Snap spot: ' + (f.snap ? 'on' : 'off'), null, function () { g.pushUndo(); API.setFields(id, { snap: !f.snap }); hh.say('Snap spot: ' + (!f.snap ? 'on, the walk aim snaps here' : 'off')); hh.redraw(); }, function () { return f.snap; });
        R('Check this point', null, function () { var c = API.floorCheck(f); hh.say(c.ok ? 'This spawn point is on the floor and in the open.' : c.message); hh.redraw(); });
        R('Test arrive', 'play', function () { API.testArrive(id); hh.redraw(); });
        if (f.who === 'named') g.peers().slice(0, 6).forEach(function (p) { if (p && p.name && f.names.indexOf(p.name) < 0) R('Add name: ' + p.name, 'plus', function () { g.pushUndo(); API.setFields(id, { names: f.names.concat([String(p.name).slice(0, 40)]) }); hh.redraw(); }); });
        if (f.face === 'object') g.props().slice(0, 6).forEach(function (p) { if (p && p.name && p.name !== f.faceTarget) R('Face object: ' + p.name, null, function () { g.pushUndo(); API.setFields(id, { faceTarget: p.name }); hh.redraw(); }); });
        return rows;
      };

      /* ---------- friends: the host sends a spawn message, a friend obeys it for itself ---------- */
      var part = {
        tick: function () { if (g._live && !g.isGuest()) respawnTick(); },
        state: function () {
          var o = {}, any = false;
          pts().forEach(function (r) { if (extras[r.id]) { o[r.id] = extras[r.id]; any = true; } });
          return any || turn ? { v: 1, extras: o, turn: turn } : null;
        },
        load: function (s) {
          extras = {}; turn = 0; lastArrive = {}; lastRespawn = {}; told = {};
          if (!isObj(s)) return;
          if (isObj(s.extras)) Object.keys(s.extras).slice(0, 64).forEach(function (id) { if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && !BAD[id]) extras[id] = cleanFields(s.extras[id]); });
          if (isNum(s.turn)) turn = clamp(Math.floor(s.turn), 0, 1e6);
        },
        reset: function () { extras = {}; turn = 0; lastArrive = {}; lastRespawn = {}; told = {}; },
        onLive: function () { lastArrive = {}; lastRespawn = {}; },
        sync: { parts: { spawn: {
          encode: function () { return null; },
          validate: function (v) { return isObj(v) && typeof v.who === 'string' && v.who.length <= 40 && isNum(v.x) && isNum(v.y) && isNum(v.z) && Math.abs(v.x) < 1e4 && Math.abs(v.y) < 1e4 && Math.abs(v.z) < 1e4 && (v.yaw === null || isNum(v.yaw)) && isNum(v.fadeSec) && v.fadeSec >= 0 && v.fadeSec <= 5 && isNum(v.gravity) && isNum(v.speed); },
          apply: function (v) {
            var c = g.ctx || {}, me = typeof c.selfId === 'function' ? c.selfId() : null;
            if (me === null || v.who !== me || typeof c.teleport !== 'function') return;
            var a = { point: str(v.point, 40), x: v.x, y: v.y, z: v.z, yaw: v.yaw === null ? null : wrapYaw(v.yaw), setPositionOnly: !!v.setPositionOnly, gravity: clamp(v.gravity, 0, 9.81), speed: clamp(v.speed, 0, 45), fadeSec: Math.max(FADE, v.fadeSec) };
            try { c.teleport({ id: 'me', local: true, name: 'Me' }, a); } catch (e) { /* the move failed on this page */ }
          }
        } } },
        dispose: function () { lastArrive = {}; }
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      API.FADE = FADE;
      return API;
    });
  }

  GN._spawnRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
