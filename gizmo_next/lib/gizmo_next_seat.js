/* gizmo_next_seat.js: stage H6, the seat gizmo's remaining work. A sidecar over the page's SeatGizmo (lib/seat_gizmo.js, already built: chair, sofa, floor, bed and lie presets, the stand lock).
   It does not rebuild that. SeatGizmo keeps the record {id, name, x, y (the floor point), z, yaw (0 faces -z, the way the knees point), preset, lie, locked, group}. This part keeps extra fields in
   its own state, keyed by seat id, in Meta's names where Meta has them: Pose (the default sit, or one from the pose library), Use Custom Exit Direction and Exit Direction, who can use it,
   one person at a time, nudge, height from the surface. It adds the Walk-mode pop-up model, sit and stand with their timings, the head target (seat surface plus 0.46 of stature, the body is never
   scaled), the enter and exit events, and figures that sit (a seat beat, figureSit for scripts).
   Host adapters (all optional): ctx.seat (the page's SeatGizmo: list, get, PRESETS, sitOn(id), stand()), ctx.walk() {on, fly}, ctx.head(), ctx.stature(), ctx.floorAt(x, z), ctx.surfaceAt(x, z),
   ctx.sitRig(who, plan), ctx.standRig(who, plan), ctx.poseLib {list(filter), apply(who, name, k), clear(who)}, ctx.figureSeat {sit(slot, plan), stand(slot, plan)}, ctx.figures().
   Nothing runs on open. A seat takes someone only when a person presses Sit, a Stand, a trigger or a seat beat says so. A friend's page is never seated from here (H9). */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_actions.js');

  var EYE = 0.46, FADE = 0.25, BLEND = 0.6, STAND_BLEND = 0.5, POPUP_R = 0.8, POPUP_ANGLE = 60, EXIT_DIST = 0.7, LIE_HEAD = 0.2, DEF_STATURE = 1.7;
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  var PRESET_H = { chair: 0.46, sofa: 0.40, floor: 0, bed: 0.50 };
  var DEF = { pose: 'default', useExit: false, exit: [0, -1], who: 'everyone', names: [], oneAtATime: true, nudge: [0, 0, 0], autoHeight: false };
  var WHOS = [['everyone', 'Everyone'], ['guests', 'Guests'], ['me', 'Just me'], ['named', 'Named person']];
  var EXITS = [['Front', [0, -1]], ['Right', [1, 0]], ['Back', [0, 1]], ['Left', [-1, 0]]];
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function has(list, v) { return list.some(function (o) { return o[0] === v; }); }
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return String(v); }
  function wrapYaw(n) { var t = 2 * Math.PI; n = n % t; if (n > Math.PI) n -= t; else if (n < -Math.PI) n += t; return n; }
  function unit2(v) { if (!Array.isArray(v) || v.length < 2 || !isNum(v[0]) || !isNum(v[1])) return null; var n = Math.hypot(v[0], v[1]); return n < 1e-6 ? null : [v[0] / n, v[1] / n]; }
  /* the seat's own axes: yaw 0 faces -z; a local (x, z) turns into the world by the seat's yaw */
  function toWorld(yaw, lx, lz) { var c = Math.cos(yaw), s = Math.sin(yaw); return [c * lx + s * lz, -s * lx + c * lz]; }

  function cleanFields(raw, base) {
    var o = Object.assign({}, DEF, base || {}), s = isObj(raw) ? raw : {};
    if (typeof s.pose === 'string' && s.pose.length) o.pose = s.pose.slice(0, 40);
    if (typeof s.useExit === 'boolean') o.useExit = s.useExit;
    var e = unit2(s.exit); if (e) o.exit = [r4(e[0]), r4(e[1])];
    if (has(WHOS, s.who)) o.who = s.who;
    if (Array.isArray(s.names)) o.names = s.names.filter(function (x) { return typeof x === 'string' && x.length; }).slice(0, 24).map(function (x) { return x.slice(0, 40); });
    if (typeof s.oneAtATime === 'boolean') o.oneAtATime = s.oneAtATime;
    if (Array.isArray(s.nudge) && s.nudge.length === 3 && s.nudge.every(isNum)) o.nudge = s.nudge.map(function (x) { return r4(clamp(x, -0.3, 0.3)); });
    if (typeof s.autoHeight === 'boolean') o.autoHeight = s.autoHeight;
    return o;
  }

  function register() {
    GN.register('seat', { needs: ['actions'], version: 1 }, function (g) {
      var A = g.modules.actions, API = {}, extras = {}, occ = {}, sess = {}, told = {};
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'seat', what: t }); else g.say(t); };
      var once = function (k, t) { if (told[k]) return; told[k] = 1; msg(t); };
      var ctx = function () { return g.ctx || {}; };
      var seatsA = function () { var o = ctx().seat; return o && typeof o === 'object' ? o : null; };
      var seats = function () { var s = seatsA(); return s && Array.isArray(s.list) ? s.list.filter(function (m) { return m && typeof m.id === 'string' || (m && isNum(m.id)); }) : []; };
      var seatOf = function (id) { var l = seats(); for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i]; return null; };
      var stature = function () { var s = g.call('stature', null); return isNum(s) && s > 0.5 && s < 2.6 ? s : DEF_STATURE; };
      var meV = function () { return { id: 'me', name: str(ctx().localName, 40) || 'Me', guest: false, local: true }; };
      function posOf(rec) {
        var H = seatsA() && isNum(seatsA().H) ? seatsA().H : 0.25, m = rec._mk;
        if (m && m.position && m.rotation) return { x: m.position.x, y: m.position.y - H, z: m.position.z, yaw: wrapYaw(m.rotation.y || 0) };
        return { x: isNum(rec.x) ? rec.x : 0, y: isNum(rec.y) ? rec.y : 0, z: isNum(rec.z) ? rec.z : 0, yaw: wrapYaw(rec.yaw || 0) };
      }
      function merged(rec) { var p = posOf(rec), f = Object.assign({}, DEF, extras[String(rec.id)] || {}); return Object.assign({ id: String(rec.id), name: str(rec.name, 40) || 'Seat', preset: rec.preset || 'chair', lie: rec.lie === true || (rec.lie == null && rec.preset === 'bed'), group: rec.group || '' }, p, f); }
      var presetH = function (m) { var P = seatsA() && seatsA().PRESETS; var h = P && P[m.preset] && isNum(P[m.preset].h) ? P[m.preset].h : PRESET_H[m.preset]; return isNum(h) ? h : 0.46; };

      /* ---------- the extra fields ---------- */
      API.fields = function (id) { var rec = seatOf(id); return rec ? merged(rec) : null; };
      API.setFields = function (id, patch) {
        if (g.isGuest()) { msg('Only the host can change a seat.'); return null; }
        var rec = seatOf(id); if (!rec) return null;
        extras[String(rec.id)] = cleanFields(patch, extras[String(rec.id)]);
        if (!g._loading) g.persist();
        return merged(rec);
      };
      API.list = function () { return seats().map(merged); };
      API.defaults = function () { return Object.assign({}, DEF, { fadeSec: FADE, blendSec: BLEND, standBlendSec: STAND_BLEND }); };

      /* ---------- heights ---------- */
      /* the seat surface above the floor point: the preset's height, or (Height from the surface) what is under the seat there, plus the nudge */
      API.surfaceHeight = function (m) {
        if (typeof m === 'string') m = API.fields(m); if (!m) return 0;
        var h = presetH(m);
        if (m.autoHeight) { var top = g.call('surfaceAt', null, m.x, m.z), floor = g.call('floorAt', null, m.x, m.z); if (isNum(top) && isNum(floor) && top >= floor && top - floor < 1.5) h = top - floor; }
        return h + (m.nudge ? m.nudge[1] : 0);
      };
      /* where the head goes: the seat surface plus 0.46 of the stature. The body is never scaled: the rig is lifted by this minus the head's height now. */
      API.seatTargetHead = function (m, st) {
        if (typeof m === 'string') m = API.fields(m); if (!m) return null;
        st = isNum(st) && st > 0.5 ? st : stature();
        return r4(m.y + API.surfaceHeight(m) + (m.lie ? LIE_HEAD : EYE * st));
      };
      var anchorOf = function (m) { var n = m.nudge || [0, 0, 0], w = toWorld(m.yaw, n[0], n[2]); return [r4(m.x + w[0]), r4(m.y + API.surfaceHeight(m)), r4(m.z + w[1])]; };

      /* ---------- who may use a seat, and one at a time ---------- */
      function whoOk(m, v) {
        if (m.who === 'everyone') return true;
        if (m.who === 'guests') return !!v.guest;
        if (m.who === 'me') return !!v.local;
        if (m.who === 'named') return (m.names || []).some(function (n) { return String(n).toLowerCase() === String(v.name).toLowerCase(); });
        return false;
      }
      var whoKey = function (v) { return v && v.fig !== undefined ? 'fig:' + v.fig : (v && v.id) || 'me'; };
      function canUse(m, v) {
        if (!whoOk(m, v)) return { ok: false, message: 'That seat is not for you.' };
        var o = occ[m.id]; if (m.oneAtATime && o && o !== whoKey(v)) return { ok: false, message: 'That seat is taken.' };
        return { ok: true };
      }
      API.occupant = function (id) { return occ[String(id)] || null; };
      API.seated = function (who) { var s = sess[whoKey(typeof who === 'string' ? { id: who } : who || meV())]; return s ? s.seatId : null; };

      /* ---------- the Walk-mode pop-up: near, facing it, walking and not flying ---------- */
      API.popup = function (headPos, headDir, st) {
        var w = g.call('walk', null); if (!w || !w.on || w.fly) return null;
        if (!Array.isArray(headPos) || headPos.length < 3 || !headPos.slice(0, 3).every(isNum)) return null;
        var dx0 = Array.isArray(headDir) && isNum(headDir[0]) && isNum(headDir[2]) ? headDir[0] : 0, dz0 = Array.isArray(headDir) && isNum(headDir[2]) ? headDir[2] : 0, dl = Math.hypot(dx0, dz0);
        if (dl < 1e-6) return null;
        var me = meV(), best = null, bd = 1e9;
        API.list().forEach(function (m) {
          if (sess.me && sess.me.seatId === m.id) return;
          var d = Math.hypot(m.x - headPos[0], m.z - headPos[2]); if (d > POPUP_R || d >= bd) return;
          if ((headPos[1] - m.y) > 2.4) return;
          if (!canUse(m, me).ok) return;
          var ang = d < 0.05 ? 0 : Math.acos(clamp(((m.x - headPos[0]) * dx0 + (m.z - headPos[2]) * dz0) / (d * dl), -1, 1)) * 180 / Math.PI;
          if (ang > POPUP_ANGLE) return;
          best = m; bd = d;
        });
        if (!best) return null;
        var a = anchorOf(best);
        return { seatId: best.id, anchor: [a[0], r4(a[1] + 0.45), a[2]], label: 'Sit', distance: r4(bd) };
      };

      /* ---------- sit and stand ---------- */
      function sitPlan(m, v, head) {
        var st = stature(), tgt = API.seatTargetHead(m, st), a = anchorOf(m), h = head || g.head();
        return { seatId: m.id, anchor: a, target: [a[0], tgt, a[2]], headTarget: tgt, lift: h ? r4(tgt - h[1]) : 0, pose: m.pose, lie: !!m.lie, fadeSec: FADE, blendSec: BLEND, walkDisabled: true, yaw: m.yaw };
      }
      function exitPoint(m) {
        var e = m.useExit ? m.exit : [0, -1], w = toWorld(m.yaw, e[0], e[1]), x = m.x + w[0] * EXIT_DIST, z = m.z + w[1] * EXIT_DIST, fl = g.floorAt(x, z);
        return { x: r4(x), y: r4(fl), z: r4(z), yaw: r4(wrapYaw(Math.atan2(-w[0], -w[1]))), fadeSec: FADE, blendSec: STAND_BLEND };
      }
      API.exitPoint = function (id) { var m = API.fields(id); return m ? exitPoint(m) : null; };
      API.sit = function (id, who) {
        var v = typeof who === 'string' ? { id: who, name: who, local: who === 'me' } : (who || meV()), m = API.fields(id);
        if (!m) return false;
        if (v.local === undefined && v.id === 'me') v.local = true;
        var c = canUse(m, v); if (!c.ok) { msg(c.message); return false; }
        var key = whoKey(v); if (sess[key]) API.stand(v);
        var plan = sitPlan(m, v);
        var R = ctx().sitRig; if (v.local && typeof R === 'function') { try { R(v, plan); } catch (e) { g.log({ who: 'seat', what: 'The move onto the seat stopped with an error' }); return false; } }
        else if (v.local) { var S = seatsA(); if (S && typeof S.sitOn === 'function') { try { S.sitOn(m.id); } catch (e) { /* the page's own sit */ } } else { once('rig', 'Seating the rig is not connected yet, so nobody was moved.'); return false; } }
        occ[m.id] = key; sess[key] = { seatId: m.id, phase: 'fade', t: 0, k: 0, who: v, pose: m.pose };
        if (m.pose !== 'default' && !poseLib()) once('lib', 'The pose library is not connected, so the default sit is used.');
        g.emit('seat', { seatId: m.id, who: key, state: 'enter' });
        g.log({ who: 'seat', what: (v.name || 'Someone') + ' sat on ' + m.name });
        return true;
      };
      API.stand = function (who) {
        var v = typeof who === 'string' ? { id: who, local: who === 'me' } : (who || meV()), key = whoKey(v), s = sess[key];
        if (!s) return false;
        var m = API.fields(s.seatId);
        s.phase = 'standing'; s.t = 0; s.exit = m ? exitPoint(m) : null;
        return true;
      };
      function finishStand(key, s) {
        var m = API.fields(s.seatId), pl = poseLib();
        if (pl && s.pose !== 'default' && typeof pl.clear === 'function') { try { pl.clear(s.who); } catch (e) { /* none */ } }
        var R = ctx().standRig; if (s.who.local && typeof R === 'function' && s.exit) { try { R(s.who, s.exit); } catch (e) { /* the rig refused */ } }
        else if (s.who.local && seatsA() && typeof seatsA().stand === 'function') { try { seatsA().stand(); } catch (e) { /* none */ } }
        if (occ[s.seatId] === key) delete occ[s.seatId];
        delete sess[key];
        g.emit('seat', { seatId: s.seatId, who: key, state: 'exit' });
        g.log({ who: 'seat', what: (s.who.name || 'Someone') + ' stood up from ' + (m ? m.name : 'the seat') });
      }
      /* the stick does nothing while seated except Stand (stick back) */
      API.onStick = function (who, x, y) {
        var v = typeof who === 'string' ? { id: who, local: who === 'me' } : (who || meV()), s = sess[whoKey(v)];
        if (!s) return 'free';
        if (isNum(y) && y > 0.6 && s.phase !== 'standing') { API.stand(v); return 'stand'; }
        return 'ignored';
      };
      API.phase = function (who) { var s = sess[whoKey(typeof who === 'string' ? { id: who } : who || meV())]; return s ? s.phase : 'standing-free'; };
      API.blend = function (who) { var s = sess[whoKey(typeof who === 'string' ? { id: who } : who || meV())]; return s ? s.k : 0; };
      function poseLib() { var o = ctx().poseLib; return o && typeof o === 'object' && typeof o.apply === 'function' ? o : null; }
      /* the poses to choose from: the library's sits (a filter), or nothing when the library is not there */
      API.poses = function () { var o = ctx().poseLib; if (!o || typeof o.list !== 'function') return []; try { var l = o.list('sits'); return Array.isArray(l) ? l.map(function (x) { return typeof x === 'string' ? x : (x && x.name); }).filter(function (n) { return typeof n === 'string'; }).slice(0, 40) : []; } catch (e) { return []; } };

      var part = {
        alwaysTick: true,
        tick: function (dt) {
          var keys = Object.keys(sess); if (!keys.length) return;
          keys.forEach(function (key) {
            var s = sess[key]; s.t += dt;
            var pl = poseLib();
            if (s.phase === 'fade') { if (s.t >= FADE) { s.phase = 'blend'; s.t -= FADE; } }
            if (s.phase === 'blend') {
              s.k = clamp(s.t / BLEND, 0, 1);
              if (pl && s.pose !== 'default') { try { pl.apply(s.who, s.pose, s.k); } catch (e) { /* the library failed */ } }
              if (s.k >= 1) { s.phase = 'seated'; s.t = 0; }
            } else if (s.phase === 'seated') s.k = 1;
            if (s.phase === 'standing') {
              s.k = clamp(1 - s.t / STAND_BLEND, 0, 1);
              if (pl && s.pose !== 'default') { try { pl.apply(s.who, s.pose, s.k); } catch (e) { /* the library failed */ } }
              if (s.t >= STAND_BLEND) finishStand(key, s);
            }
          });
        },
        state: function () { var any = false, o = {}; seats().forEach(function (r) { var k = String(r.id); if (extras[k]) { o[k] = extras[k]; any = true; } }); return any ? { v: 1, extras: o } : null; },
        load: function (s) {
          extras = {}; occ = {}; sess = {}; told = {};
          if (isObj(s) && isObj(s.extras)) Object.keys(s.extras).slice(0, 64).forEach(function (id) { if (/^[A-Za-z0-9_-]{1,40}$/.test(id) && !BAD[id]) extras[id] = cleanFields(s.extras[id]); });
        },
        reset: function () { extras = {}; occ = {}; sess = {}; told = {}; },
        dispose: function () { sess = {}; occ = {}; }
      };

      /* ---------- figures sit too ---------- */
      function figureOf(slot) { var f = g.figures(); for (var i = 0; i < f.length; i++) if (f[i] && String(f[i].slot) === String(slot)) return f[i]; return null; }
      API.figureSit = function (slot, seatId) {
        var m = API.fields(seatId); if (!m) { once('noseat:' + seatId, 'There is no seat called ' + String(seatId).slice(0, 40) + '.'); return false; }
        var v = { fig: slot, id: 'fig:' + slot, name: 'Figure ' + slot, guest: false, local: false }, c = canUse(m, { id: v.id, name: v.name, guest: false, local: false, fig: slot });
        if (!c.ok && m.who !== 'everyone') { msg(c.message); return false; }
        var key = 'fig:' + slot; if (m.oneAtATime && occ[m.id] && occ[m.id] !== key) { msg('That seat is taken.'); return false; }
        var f = figureOf(slot), st = f && isNum(f.stature) && f.stature > 0.5 ? f.stature : stature(), a = anchorOf(m);
        var plan = { seatId: m.id, anchor: a, target: [a[0], r4(m.y + API.surfaceHeight(m) + (m.lie ? LIE_HEAD : EYE * st)), a[2]], headTarget: r4(m.y + API.surfaceHeight(m) + (m.lie ? LIE_HEAD : EYE * st)), lift: 0, pose: m.pose, lie: !!m.lie, fadeSec: 0, blendSec: BLEND, walkDisabled: true, yaw: m.yaw };
        var F = ctx().figureSeat; if (!F || typeof F.sit !== 'function') { once('fig', 'Figures cannot sit yet, so the seat beat does nothing.'); return false; }
        if (occ[m.id] !== key) { var prev = Object.keys(occ).filter(function (k) { return occ[k] === key; })[0]; if (prev) delete occ[prev]; }
        try { F.sit(slot, plan); } catch (e) { return false; }
        occ[m.id] = key; g.emit('seat', { seatId: m.id, who: key, state: 'enter' }); g.log({ who: 'seat', what: v.name + ' sat on ' + m.name });
        return true;
      };
      API.figureStand = function (slot) {
        var key = 'fig:' + slot, id = Object.keys(occ).filter(function (k) { return occ[k] === key; })[0];
        if (id === undefined) return false;
        var m = API.fields(id), F = ctx().figureSeat; delete occ[id];
        if (F && typeof F.stand === 'function') { try { F.stand(slot, m ? exitPoint(m) : null); } catch (e) { /* the figure could not stand */ } }
        g.emit('seat', { seatId: id, who: key, state: 'exit' }); g.log({ who: 'seat', what: 'Figure ' + slot + ' stood up' });
        return true;
      };
      /* the seat beat (H2): a figure sits on a seat, or stands ('stand') */
      A.register('seat', {
        validate: function (p) { var o = {}; ['id', 't', 'slot', 'kind', 'hold'].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; }); o.seatId = typeof p.seatId === 'string' && p.seatId.length ? p.seatId.slice(0, 80) : 'stand'; return o; },
        hold: function (p) { return isNum(p.hold) && p.hold > 0 ? p.hold : (p.seatId === 'stand' ? 0 : BLEND); },
        start: function (p) { if (p.seatId === 'stand') API.figureStand(p.slot); else API.figureSit(p.slot, p.seatId); }
      });

      /* ---------- the panel rows (the seat's own object panel appends these) ---------- */
      API.rows = function (id, H) {
        var rec = seatOf(id); if (!rec || g.isGuest()) return [];
        var f = merged(rec), rows = [], hh = { say: function (t) { if (H && typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else msg(t); }, redraw: function () { if (H && typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } };
        var R = function (l, ic, act, on) { var r = { label: plain(l), ic: ic, act: act }; if (on) r.on = on; rows.push(r); };
        var set = function (patch, say) { return function () { g.pushUndo(); API.setFields(id, patch); if (say) hh.say(say); hh.redraw(); }; };
        var poses = API.poses();
        R('Defaults: Pose Default sit, one person at a time, stand in front', null, function () {});
        R('Pose: ' + (f.pose === 'default' ? 'Default sit' : f.pose), null, function () { var all = ['default'].concat(poses), i = all.indexOf(f.pose); var n = all[(i + 1) % all.length]; g.pushUndo(); API.setFields(id, { pose: n }); hh.say('Sit pose: ' + (n === 'default' ? 'Default sit' : n)); hh.redraw(); });
        R('Use Custom Exit Direction: ' + (f.useExit ? 'on' : 'off'), null, set({ useExit: !f.useExit }), function () { return f.useExit; });
        R('Exit Direction: ' + label(EXITS.map(function (e) { return [e[1].join(','), e[0]]; }), f.exit.join(',')), null, function () { var i = EXITS.findIndex(function (e) { return e[1].join(',') === f.exit.join(','); }), n = EXITS[(i + 1) % EXITS.length]; g.pushUndo(); API.setFields(id, { exit: n[1] }); hh.say('Exit Direction: ' + n[0]); hh.redraw(); });
        R('Who can use it: ' + label(WHOS, f.who), null, function () { var i = WHOS.findIndex(function (o) { return o[0] === f.who; }), n = WHOS[(i + 1) % WHOS.length]; g.pushUndo(); API.setFields(id, { who: n[0] }); hh.say('Who can use it: ' + n[1]); hh.redraw(); });
        R('One person at a time: ' + (f.oneAtATime ? 'on' : 'off'), null, set({ oneAtATime: !f.oneAtATime }), function () { return f.oneAtATime; });
        R('Height from the surface: ' + (f.autoHeight ? 'on' : 'off'), null, set({ autoHeight: !f.autoHeight }), function () { return f.autoHeight; });
        [['Nudge up 2 cm', [0, 0.02, 0]], ['Nudge down 2 cm', [0, -0.02, 0]], ['Nudge forward 2 cm', [0, 0, -0.02]], ['Nudge back 2 cm', [0, 0, 0.02]]].forEach(function (n) {
          R(n[0], null, function () { g.pushUndo(); API.setFields(id, { nudge: [f.nudge[0] + n[1][0], f.nudge[1] + n[1][1], f.nudge[2] + n[1][2]] }); hh.redraw(); });
        });
        R('Reset the nudge', null, set({ nudge: [0, 0, 0] }, 'Nudge reset'));
        R(sess.me && sess.me.seatId === f.id ? 'Stand' : 'Sit here', null, function () { if (sess.me && sess.me.seatId === f.id) API.stand(); else API.sit(f.id); hh.redraw(); });
        if (f.who === 'named') g.peers().slice(0, 6).forEach(function (p) { if (p && p.name && f.names.indexOf(p.name) < 0) R('Add name: ' + p.name, 'plus', function () { g.pushUndo(); API.setFields(id, { names: f.names.concat([String(p.name).slice(0, 40)]) }); hh.redraw(); }); });
        return rows;
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      API.constants = { EYE: EYE, FADE: FADE, BLEND: BLEND, STAND_BLEND: STAND_BLEND, POPUP_R: POPUP_R, POPUP_ANGLE: POPUP_ANGLE, EXIT_DIST: EXIT_DIST };
      return API;
    });
  }

  GN._seatRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
