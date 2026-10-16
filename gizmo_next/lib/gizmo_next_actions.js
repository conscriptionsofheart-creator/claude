/* gizmo_next_actions.js: stage H2, actions on beats. A part that needs the beats part (H1) and hangs on it as g.modules.beats.actions (also GizmoNext.actions).
   Beats carry more than poses: say (a recording), look (only the parts that are ticked: shader, clothes, eyes, skin), face, sound, ragdoll, seat, move (H1), script, camera.
   Later stages add kinds with actions.register(kind, {validate, start, update, stop, hold, looks}).
   Nothing runs on open: an action starts only when the clock passes its beat while a person has pressed Play. A friend's page starts none.
   Host adapters it uses (all optional, a missing one gives a plain message and a quiet beat):
     ctx.narration {voLines(slot) -> [{rec, seconds}], play(slot, rec), stop(slot)?, mouth(slot)?}   ctx.look.allowedClothes() -> [piece ids]
     ctx.sounds.playMode(gizmoId, 'once'|'loop'|'stop')   ctx.clips {play(slot, clipId), stop(slot)}   ctx.seat {sit(slot, seatId), stand(slot)}
     ctx.face.apply(slot, expression)   ctx.scripts.event(kind, id, 'beat', name)   ctx.camera.shot(name) */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_beats.js');

  var MIN_GAP = 0.4, WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  var SAMPLED = { pose: 1, hand: 1, look: 1, move: 1 };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function str(v, n) { return typeof v === 'string' && v.length ? v.slice(0, n) : ''; }
  function copy(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; } }
  var BASE = ['id', 't', 'slot', 'kind', 'hold'];
  function keep(p, extra) { var o = {}; BASE.forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; }); Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o; }

  /* the one-second rule, as a pure function of a list of beats: look-changing beats keep 0.4 s between distinct times, and at most 3 start in any second */
  function clampBeats(beats, isLooks) {
    var list = (Array.isArray(beats) ? beats : []).filter(function (p) { return isObj(p) && isNum(p.t); }).map(copy);
    var looks = isLooks || function (p) { return p.kind === 'look'; };
    var times = [];
    list.forEach(function (p) { if (looks(p) && times.indexOf(r3(p.t)) < 0) times.push(r3(p.t)); });
    times.sort(function (a, b) { return a - b; });
    var out = [], i;
    for (i = 0; i < times.length; i++) {
      var nt = times[i];
      if (i > 0 && nt - out[i - 1] < MIN_GAP - 1e-9) nt = r3(out[i - 1] + MIN_GAP);
      if (i >= 3 && nt - out[i - 3] < 1 - 1e-9) nt = r3(out[i - 3] + 1);
      out.push(nt);
    }
    var map = {}, moved = 0;
    times.forEach(function (T, j) { if (out[j] !== T) { map[T] = out[j]; moved++; } });
    list.forEach(function (p) { if (looks(p) && map[r3(p.t)] !== undefined) p.t = map[r3(p.t)]; });
    var idx = list.map(function (p, j) { return [p, j]; });
    idx.sort(function (a, b) { return a[0].t - b[0].t || a[1] - b[1]; });
    list = idx.map(function (x) { return x[0]; });
    var messages = moved ? [(moved < 10 ? WORDS[moved] : String(moved)) + (moved === 1 ? ' look change was' : ' look changes were') + ' spread out so nothing flashes.'] : [];
    return { beats: list, changed: moved > 0, messages: messages.map(plain) };
  }

  function pieceIds(v) {
    if (Array.isArray(v)) return v.map(function (x) { return typeof x === 'string' ? x : (isObj(x) && typeof x.id === 'string' ? x.id : null); }).filter(Boolean);
    if (isObj(v)) return Object.keys(v);
    return [];
  }

  function register() {
    GN.register('actions', { needs: ['beats'], version: 1 }, function (g) {
      var B = g.modules.beats;
      var reg = {}, active = [], told = {};
      var A = {};
      var ctx = function () { return g.ctx || {}; };
      var obj = function (n) { var o = ctx()[n]; return o && typeof o === 'object' ? o : null; };
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'beats', what: t }); else g.say(t); };
      var once = function (key, t) { if (told[key]) return; told[key] = 1; msg(t); };
      var env = { g: g, say: msg, once: once, ctx: ctx };

      function recSeconds(slot, rec) {
        var N = obj('narration'); if (!N || typeof N.voLines !== 'function') return 0;
        try {
          var lines = N.voLines(slot);
          if (Array.isArray(lines)) for (var i = 0; i < lines.length; i++) {
            var l = lines[i]; if (!l) continue;
            if (l.rec === rec || l.id === rec || l.name === rec) { var s = isNum(l.seconds) ? l.seconds : (isNum(l.length) ? l.length : l.dur); return isNum(s) && s > 0 ? r3(Math.min(s, 600)) : 0; }
          }
        } catch (e) { /* the narration helper failed */ }
        return 0;
      }

      /* ---------- the registry ---------- */
      A.register = function (kind, def) {
        if (typeof kind !== 'string' || !/^[a-z][a-z0-9_]{0,23}$/.test(kind) || !isObj(def)) return false;
        def = Object.assign({}, def);
        reg[kind] = def;
        if (!SAMPLED[kind] || def.validate) {
          B.hooks.pin[kind] = function (p) {
            if (typeof def.validate !== 'function') return p;
            var r = def.validate(p, env);
            if (typeof r === 'string') { msg(r); return null; }
            return r && typeof r === 'object' ? r : null;
          };
        }
        return true;
      };
      A.get = function (kind) { return reg[kind] || null; };
      A.kinds = function () { return Object.keys(reg); };
      A.isKnown = function (kind) { return !!SAMPLED[kind] || !!reg[kind]; };
      A.clamp = function (beats) { return clampBeats(beats, function (p) { var d = reg[p.kind]; return p.kind === 'look' || !!(d && d.looks); }); };
      A.sanitize = function (beats) {
        var list = Array.isArray(beats) ? beats : [], kept = [], dropped = 0;
        list.forEach(function (p) { if (isObj(p) && typeof p.kind === 'string' && A.isKnown(p.kind) && isNum(p.t)) kept.push(copy(p)); else dropped++; });
        return { beats: kept, dropped: dropped };
      };
      A.hold = function (pin) {
        if (!pin) return 0;
        var d = reg[pin.kind];
        if (d && typeof d.hold === 'function') { try { var h = d.hold(pin, env); if (isNum(h) && h >= 0) return h; } catch (e) { /* fall back */ } }
        return isNum(pin.hold) && pin.hold > 0 ? pin.hold : 0;
      };
      A.mouth = function (slot) { var N = obj('narration'); if (!N || typeof N.mouth !== 'function') return 0; try { var v = N.mouth(slot); return isNum(v) ? v : 0; } catch (e) { return 0; } };
      A.recordings = function (slot) {
        var N = obj('narration'); if (!N || typeof N.voLines !== 'function') return [];
        try { var l = N.voLines(slot); return Array.isArray(l) ? l.filter(function (x) { return x && typeof (x.rec || x.id || x.name) === 'string'; }).map(function (x) { return { rec: x.rec || x.id || x.name, seconds: recSeconds(slot, x.rec || x.id || x.name) }; }) : []; } catch (e) { return []; }
      };

      /* ---------- running: when the clock passes a beat, going forward, during Play ---------- */
      function startPin(pin) {
        var d = reg[pin.kind]; if (!d || typeof d.start !== 'function') return;
        var r;
        try { r = d.start(pin, env); } catch (e) { g.log({ who: 'beats', what: 'The ' + pin.kind + ' beat stopped with an error' }); return; }
        var left = A.hold(pin), keepIt = !!(r && r.keep);
        if (left > 0 || keepIt || typeof d.update === 'function' || typeof d.stop === 'function') active.push({ pin: pin, def: d, left: left, keep: keepIt });
      }
      function stopAll() {
        var a = active; active = [];
        a.forEach(function (x) { if (typeof x.def.stop === 'function') { try { x.def.stop(x.pin, env); } catch (e) { /* a stopper must not stop the rest */ } } });
      }
      B.onPass(function (pins) { if (g.isGuest()) return; pins.forEach(startPin); });
      B.onStop(stopAll);
      B.onPause(stopAll);
      g.on('beat-play', function () { told = {}; });

      /* ---------- built in kinds ---------- */
      A.register('say', {
        validate: function (p) { var rec = str(p.rec, 80); return rec ? keep(p, { rec: rec }) : 'A voice beat needs a recording.'; },
        hold: function (p) { return isNum(p.hold) && p.hold > 0 ? p.hold : recSeconds(p.slot, p.rec); },
        start: function (p, e) {
          var N = obj('narration'); if (!N || typeof N.play !== 'function') { e.once('say', 'No voice is connected, so voice beats stay silent.'); return; }
          N.play(p.slot, p.rec);
        },
        stop: function (p) { var N = obj('narration'); if (N && typeof N.stop === 'function') N.stop(p.slot); }
      });
      A.register('look', {
        validate: function (p) {
          if (!isObj(p.look) || p.look.clothes === undefined) return p;
          var K = obj('look'), allowed = null;
          if (K && typeof K.allowedClothes === 'function') { try { var a = K.allowedClothes(); if (Array.isArray(a)) allowed = a; } catch (e) { allowed = null; } }
          var cl = p.look.clothes, ids = pieceIds(cl);
          if (allowed === null) { delete p.look.clothes; msg('The cleared wardrobe list is not connected, so clothes were left out of this look beat.'); return p; }
          var bad = ids.filter(function (x) { return allowed.indexOf(x) < 0; });
          if (!bad.length) return p;
          if (Array.isArray(cl)) p.look.clothes = cl.filter(function (x) { var id = typeof x === 'string' ? x : (isObj(x) ? x.id : null); return allowed.indexOf(id) >= 0; });
          else { var o = {}; Object.keys(cl).forEach(function (k) { if (allowed.indexOf(k) >= 0) o[k] = cl[k]; }); p.look.clothes = o; }
          msg('The piece ' + bad[0] + (bad.length > 1 ? ' and ' + (bad.length - 1) + ' more are' : ' is') + ' not in the cleared wardrobe, so ' + (bad.length > 1 ? 'they were' : 'it was') + ' left out.');
          if (!pieceIds(p.look.clothes).length) delete p.look.clothes;
          return p;
        }
      });
      A.register('move', { sampled: true });
      A.register('face', {
        validate: function (p) { var x = str(p.expression, 40); return x ? keep(p, { expression: x }) : 'A face beat needs an expression.'; },
        start: function (p, e) { var F = obj('face'); if (!F || typeof F.apply !== 'function') { e.once('face', 'Face changes are not connected yet, so face beats do nothing.'); return; } F.apply(p.slot, p.expression); }
      });
      A.register('sound', {
        validate: function (p) { var id = str(p.gizmoId, 80), m = p.mode === 'loop' || p.mode === 'stop' ? p.mode : 'once'; return id ? keep(p, { gizmoId: id, mode: m }) : 'A sound beat needs a sound gizmo.'; },
        start: function (p, e) {
          var S = obj('sounds'); if (!S || typeof S.playMode !== 'function') { e.once('sound', 'Sound is not connected, so sound beats stay silent.'); return; }
          S.playMode(p.gizmoId, p.mode);
          return p.mode === 'stop' ? null : { keep: true };
        },
        stop: function (p) { var S = obj('sounds'); if (S && typeof S.playMode === 'function' && p.mode !== 'stop') S.playMode(p.gizmoId, 'stop'); }
      });
      A.register('ragdoll', {
        validate: function (p) { var c = str(p.clipId, 80); return c ? keep(p, { clipId: c }) : 'A ragdoll beat needs a recorded fall.'; },
        start: function (p, e) { var C = obj('clips'); if (!C || typeof C.play !== 'function') { e.once('ragdoll', 'Ragdoll clips are not connected yet, so this beat does nothing.'); return; } C.play(p.slot, p.clipId); },
        stop: function (p) { var C = obj('clips'); if (C && typeof C.stop === 'function') C.stop(p.slot); }
      });
      A.register('seat', {
        validate: function (p) { return keep(p, { seatId: str(p.seatId, 80) || 'stand' }); },
        start: function (p, e) {
          var S = obj('seat'); var fn = p.seatId === 'stand' ? 'stand' : 'sit';
          if (!S || typeof S[fn] !== 'function') { e.once('seat', 'Seats are not connected yet, so seat beats do nothing.'); return; }
          if (fn === 'stand') S.stand(p.slot); else S.sit(p.slot, p.seatId);
        }
      });
      A.register('script', {
        validate: function (p) { var n = str(p.name, 40); if (!n) return 'A script beat needs a script name.'; var o = { name: n }; if (str(p.objKind, 24)) o.objKind = str(p.objKind, 24); if (str(p.objId, 40)) o.objId = str(p.objId, 40); return keep(p, o); },
        start: function (p, e) { var S = obj('scripts'); if (!S || typeof S.event !== 'function') { e.once('script', 'Scripts are not connected yet, so script beats do nothing.'); return; } S.event(p.objKind || 'scene', p.objId || '', 'beat', p.name); }
      });
      A.register('camera', {
        validate: function (p) { var s = str(p.shot, 40); return s ? keep(p, { shot: s }) : 'A camera beat needs a shot.'; },
        start: function (p, e) { var C = obj('camera'); if (!C || typeof C.shot !== 'function') { e.once('camera', 'Camera shots are not connected yet, so camera beats do nothing.'); return; } C.shot(p.shot); }
      });

      /* ---------- adding beats ---------- */
      function slotNow() { var sel = g.call('selectedSlots', null); if (Array.isArray(sel) && sel.length) return sel[0]; var f = g.figures(); return f.length && f[0] ? f[0].slot : null; }
      function advance(t, h) { B.setClock(r3(t + Math.max(B.clock.gap, h || 0))); }
      /* a voice beat: the hold is the recording's length, so the next beat waits for it */
      A.addSay = function (slot, rec, t) {
        if (g.isGuest()) { g.say('Only the host can add beats.'); return null; }
        if (slot === undefined || slot === null) slot = slotNow();
        if (slot === null || !str(rec, 80)) { msg('Select a figure and a recording first.'); return null; }
        var at = isNum(t) ? t : B.clock.t, h = recSeconds(slot, rec);
        g.pushUndo();
        var p = B.add({ slot: slot, kind: 'say', t: at, hold: h > 0 ? h : undefined, payload: { rec: rec } });
        if (!p) return null;
        if (!isNum(t)) advance(at, h);
        if (!h) msg('The length of that recording is not known, so the hold is zero. Set the hold by hand.');
        return p;
      };
      /* a look beat that carries only the parts you name (or give): the rest of the outfit is never touched */
      A.addLook = function (slot, parts, t) {
        if (g.isGuest()) { g.say('Only the host can add beats.'); return null; }
        if (slot === undefined || slot === null) slot = slotNow();
        if (slot === null) { msg('Select a figure first.'); return null; }
        var at = isNum(t) ? t : B.clock.t, want = {};
        if (Array.isArray(parts)) {
          var K = obj('look'), cur = null;
          try { cur = K && typeof K.get === 'function' ? K.get(slot) : null; } catch (e) { cur = null; }
          if (!isObj(cur)) { msg('That figure has no look to record.'); return null; }
          parts.forEach(function (k) { if (typeof k === 'string' && cur[k] !== undefined) want[k] = copy(cur[k]); });
        } else if (isObj(parts)) want = copy(parts) || {};
        var base = (B.stateAt(at)[String(slot)] || {}).look || {}, fresh = {};
        Object.keys(want).forEach(function (k) { if (!(k in base) || !B.math.same(base[k], want[k], 1e-4)) fresh[k] = want[k]; });
        if (!Object.keys(fresh).length) { msg(Object.keys(want).length ? 'Nothing changed, so no look beat was added.' : 'There is nothing to record. Pick a part to change.'); return null; }
        g.pushUndo();
        var p = B.add({ slot: slot, kind: 'look', t: at, payload: fresh });
        if (!p) return null;
        if (!isNum(t)) B.setClock(r3(p.t + B.clock.gap));
        return p;
      };
      A.add = function (spec) {
        if (!isObj(spec) || typeof spec.kind !== 'string') return null;
        if (spec.kind === 'say') return A.addSay(spec.slot, spec.rec, spec.t);
        if (spec.kind === 'look') return A.addLook(spec.slot, spec.parts, spec.t);
        if (!reg[spec.kind] || SAMPLED[spec.kind]) return null;
        var payload = {}; Object.keys(spec).forEach(function (k) { if (['slot', 'kind', 't', 'hold'].indexOf(k) < 0) payload[k] = spec[k]; });
        g.pushUndo();
        var p = B.add({ slot: spec.slot === undefined ? 'scene' : spec.slot, kind: spec.kind, t: isNum(spec.t) ? spec.t : B.clock.t, hold: spec.hold, payload: payload });
        if (p && !isNum(spec.t)) advance(p.t, A.hold(p));
        return p;
      };

      /* ---------- the strip rows and the 2D panel ---------- */
      A.rows = function (h) {
        var rows = [], slot = slotNow();
        if (slot === null) return rows;
        A.recordings(slot).slice(0, 6).forEach(function (r) {
          rows.push({ label: 'Add voice: ' + r.rec + (r.seconds ? ' (' + r.seconds + ' s)' : ''), ic: 'voice', act: function () { A.addSay(slot, r.rec); h.redraw(); } });
        });
        [['shader', 'Add shader beat'], ['clothes', 'Add clothes beat'], ['eyes', 'Add eyes beat'], ['skin', 'Add skin beat']].forEach(function (x) {
          rows.push({ label: x[1], ic: 'look', act: function () { A.addLook(slot, [x[0]]); h.redraw(); } });
        });
        var sel = B.strip.selected();
        if (sel && B.get(sel)) {
          /* the hold belongs to the voice or sound pin on the selected card, if it has one */
          var card = B.strip.model().filter(function (c) { return c.ids.indexOf(sel) >= 0; })[0], target = sel;
          if (card) card.ids.forEach(function (id) { var q = B.get(id); if (q && !SAMPLED[q.kind] && target === sel) target = id; });
          var hold = function (d) { return function () { var p = B.get(target); if (p) B.setHold(target, Math.max(0, r3((p.hold || 0) + d))); h.redraw(); }; };
          rows.push({ label: 'Hold longer by 0.5 s', ic: 'right', act: hold(0.5) });
          rows.push({ label: 'Hold shorter by 0.5 s', ic: 'left', act: hold(-0.5) });
        }
        return rows;
      };
      B.hooks.rows = B.hooks.rows || [];
      B.hooks.rows.push(function (h) { return A.rows(h); });
      A.mountPanel = function (el) {
        var doc = el && (el.ownerDocument || (typeof document !== 'undefined' ? document : null)); if (!doc || g.isGuest()) return false;
        var mk = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
        var box = mk('div', 'gn-actions'); box.appendChild(mk('div', 'gn-title', 'Beat actions'));
        var bar = mk('div', 'gn-bar'), slot = function () { return slotNow(); };
        var btn = function (txt, fn) { var b = mk('button', 'gn-btn', txt); b.addEventListener('click', function () { try { fn(); } catch (e) { /* ignore */ } }); bar.appendChild(b); };
        btn('Add voice beat', function () { var s = slot(), r = A.recordings(s)[0]; if (!r) { msg('There is no recording for that figure yet.'); return; } A.addSay(s, r.rec); });
        btn('Add shader beat', function () { A.addLook(slot(), ['shader']); });
        btn('Add clothes beat', function () { A.addLook(slot(), ['clothes']); });
        btn('Add eyes beat', function () { A.addLook(slot(), ['eyes']); });
        box.appendChild(bar); el.appendChild(box); return true;
      };

      /* ---------- the frame and the lists ---------- */
      B.hooks.list.push(function (list) {
        var r = A.clamp(list);
        if (r.changed && !g._loading) r.messages.forEach(function (m) { msg(m); });
        return r.changed ? r.beats : null;
      });
      A.alwaysTick = true;
      A.tick = function (dt) {
        if (!active.length || !B.clock.playing) return;
        var step = dt * B.clock.speed;
        for (var i = active.length - 1; i >= 0; i--) {
          var x = active[i];
          if (typeof x.def.update === 'function') { try { x.def.update(x.pin, env, dt); } catch (e) { /* a failing update must not stop the frame */ } }
          x.left -= step;
          if (x.left <= 0 && !x.keep && typeof x.def.update !== 'function') active.splice(i, 1);
        }
      };
      A.activeCount = function () { return active.length; };
      A.stopAll = stopAll;
      B.actions = A;
      return A;
    });
  }

  GN._actionsRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
