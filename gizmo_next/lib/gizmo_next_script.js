/* gizmo_next_script.js: stage H10, the scripting layer on top of obj_scripts.js. The app's scripts stay real code; this adds what a script can reach, and blocks that write that code.
   Nothing here runs by itself: it does something only for a script the page has started (Scripts on) or when she presses Test it with me.
   SEAT EDIT H10-1, in obj_scripts.js make(): build the world once, ask this part for its extras, and append them to the sandbox:
       const W = makeWorld(), X = (window.GizmoNext && GizmoNext.script) ? GizmoNext.script.extend(inst, { world: W }) : { names: [], values: [] };
       fn = new Function('me','world','on','every','after','say','play','log','THREE', ...X.names, '"use strict";\n' + code);   fn(h, W, on, every, after, say, play, log, window.THREE, ...X.values);
   and in setOn(false) after the stop handlers: GizmoNext.script.scriptsOff().
   Extra names inside a script: emit(name, payload), fields(defs) and fields.<name>, visitor.count(name), spawnObj(kind), onEnter([name], fn), onLeave([name], fn).
   world gains: raycast(from, dir, {tag, distance}), spawn(kind, pos), despawn(thing), vars (saved with the scene).
   emit('gizmo', {do, arg, ...}) is how a script or a block starts a beat range, a sound, a seat, a spawn point, an effect, shows or hides an object, says something, or sets a variable. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') { require('./gizmo_next_blocks.js'); require('./gizmo_next_trigger.js'); require('./gizmo_next_spawn.js'); require('./gizmo_next_seat.js'); require('./gizmo_next_effects.js'); }

  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var NAMES = ['emit', 'fields', 'visitor', 'spawnObj', 'onEnter', 'onLeave'];
  var MAX_DEPTH = 6, EMITS_PER_SEC = 200, SPAWN_BUDGET = 20, MAX_FIELDS = 12, MAX_VARS = 64, MAX_RAY = 200, RUN_SHOW = 1.5;
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function vec(p) { if (Array.isArray(p) && p.length >= 3 && isNum(p[0]) && isNum(p[1]) && isNum(p[2])) return [p[0], p[1], p[2]]; if (isObj(p) && isNum(p.x) && isNum(p.y) && isNum(p.z)) return [p.x, p.y, p.z]; return null; }
  function posOf(o) { var p = o && (o.position || (o.object && o.object.position)); return p && isNum(p.x) ? [p.x, p.y, p.z] : null; }
  function same(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }

  function register() {
    GN.register('script', { needs: ['beats', 'trigger', 'seat', 'spawn', 'effects'], version: 1 }, function (g) {
      var B = GN.Blocks, API = {};
      var reg = {}, scripts = {}, fv = {}, vars = {}, budget = SPAWN_BUDGET, spawned = {}, nspawn = 0, undo = [], told = {}, visitors = {}, counts = null, countsOn = false;
      var runLog = [], running = null, runAt = 0, emitsAt = [], depth = 0, seen = {};
      var nowS = function () { return g.now() / 1000; };
      var ctx = function () { return g.ctx || {}; };
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'script', what: t }); else g.say(t); };
      var once = function (k, t) { if (told[k]) return; told[k] = 1; msg(t); };
      var M = function (n) { return g.modules[n]; };
      var host = function () { return !g.isGuest(); };

      /* ---------- the log: shared with the page's what-ran list, plus which block is running ---------- */
      function note(s, text) {
        var e = { t: Math.round(nowS() * 100) / 100, key: s && s.s || '', rule: s && isNum(s.rule) ? s.rule : -1, step: s && isNum(s.step) ? s.step : -1, text: plain(text) };
        runLog.push(e); if (runLog.length > 300) runLog.shift();
        if (e.rule >= 0) { running = { key: e.key, rule: e.rule, step: e.step }; runAt = nowS(); }
        g.log({ who: 'script', what: e.text });
        return e;
      }
      API.runLog = function () { return runLog.map(function (e) { return Object.assign({}, e); }); };
      API.running = function () { if (running && nowS() - runAt > RUN_SHOW) running = null; return running ? Object.assign({}, running) : null; };

      /* ---------- resolving names to the page's things ---------- */
      function byName(list, n) { n = String(n); return (Array.isArray(list) ? list : []).filter(Boolean).filter(function (r) { return same(r.name, n) || same(r.id, n); })[0] || null; }
      function seatOf(n) { var s = ctx().seat; return byName(s && s.list, n); }
      function spawnOf(n) { var s = ctx().spawn; return byName(s && s.list, n); }
      function fxOf(n) { var E = M('effects'); return byName(E && E.list(), n); }
      function whoOf(id) { if (id && visitors[id]) return visitors[id]; if (typeof id === 'string' && id) return { id: id, name: id, guest: true, kind: 'player' }; return { id: 'test', name: 'A test visitor', guest: true, kind: 'player' }; }

      /* ---------- the one door a script or a block uses to start something ---------- */
      var DO_OK = ['beats', 'sound', 'seat', 'spawn', 'effect', 'show', 'hide', 'say', 'set', 'emit'];
      API.run = function (p, how) {
        how = how || {};
        if (!host()) return false;
        if (!isObj(p) || DO_OK.indexOf(p.do) < 0) { once('do', 'A script asked for something that is not one of the blocks.'); return false; }
        var arg = B.text(typeof p.arg === 'string' ? p.arg : '', 80), c = ctx(), key = { s: str(p.s, 40), rule: isNum(p.rule) ? p.rule : -1, step: isNum(p.step) ? p.step : -1 }, ok = false, tag = how.test ? ' (test)' : '';
        if (!arg && p.do !== 'seat') return false;
        try {
          if (p.do === 'beats') { var Bt = M('beats'); ok = !!(Bt && Bt.playRange(arg)); if (!ok) once('beats:' + arg, 'The beats ' + arg + ' could not play.'); }
          else if (p.do === 'sound') { var mode = p.mode === 'loop' || p.mode === 'stop' ? p.mode : 'once'; if (!c.sounds || typeof c.sounds.playMode !== 'function') { once('sound', 'Sound is not connected, so a script cannot start one.'); } else { c.sounds.playMode(arg, mode); ok = true; } }
          else if (p.do === 'seat') {
            var S = M('seat'), v = whoOf(p.who);
            if (arg === 'stand' || !arg) ok = !!(S && S.stand(v.id === 'test' ? undefined : v));
            else { var st = seatOf(arg); if (!st) once('seat:' + arg, 'There is no seat called ' + arg + '.'); else ok = !!(S && S.sit(st.id, v)); }
          }
          else if (p.do === 'spawn') { var SP = M('spawn'), sp = spawnOf(arg); if (!sp) once('spawn:' + arg, 'There is no spawn point called ' + arg + '.'); else ok = !!(SP && SP.send(whoOf(p.who), sp.id)); }
          else if (p.do === 'effect') {
            var E = M('effects'), fx = fxOf(arg), em = p.mode === 'loop' || p.mode === 'stop' ? p.mode : 'once';
            if (!fx) once('fx:' + arg, 'There is no effects gizmo called ' + arg + '.'); else ok = em === 'stop' ? !!E.stop(fx.id) : !!E.play(fx.id, em);
          }
          else if (p.do === 'show' || p.do === 'hide') {
            if (typeof c.setObjectVisible !== 'function') once('show', 'Showing and hiding objects is not connected yet.');
            else {
              var on = p.do === 'show', was = typeof c.objectVisible === 'function' ? !!c.objectVisible(arg) : !on;
              if (!seen['vis:' + arg]) { seen['vis:' + arg] = 1; undo.push(function () { c.setObjectVisible(arg, was); }); }
              c.setObjectVisible(arg, on); ok = true;
            }
          }
          else if (p.do === 'say') { g.say(plain(arg)); ok = true; }
          else if (p.do === 'set') { ok = setVar(arg, p.value); }
          else if (p.do === 'emit') { broadcast(arg, isObj(p.payload) ? p.payload : {}); ok = true; }
        } catch (e) { g.log({ who: 'script', what: 'A step stopped with an error' }); ok = false; }
        if (key.rule >= 0 || how.test) note(key, (how.words || (p.do + ' ' + arg)) + tag + (ok ? '' : ' (did not run)'));
        return ok;
      };

      /* ---------- world.vars: small, saved with the scene ---------- */
      function setVar(k, v) {
        if (typeof k !== 'string' || !k || k.length > 40 || BAD[k]) return false;
        if (typeof v === 'number') { if (!isFinite(v) || Math.abs(v) >= 1e7) return false; }
        else if (typeof v === 'string') { if (v.length > 200) return false; }
        else if (typeof v !== 'boolean') return false;
        if (!(k in vars) && Object.keys(vars).length >= MAX_VARS) { once('vars', 'Scene variables are full (' + MAX_VARS + ').'); return false; }
        vars[k] = v; if (!g._loading) g.persist();
        return true;
      }
      var varsProxy = (typeof Proxy === 'function') ? new Proxy({}, {
        get: function (_, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : undefined; },
        set: function (_, k, v) { setVar(k, v); return true; },
        has: function (_, k) { return Object.prototype.hasOwnProperty.call(vars, k); },
        deleteProperty: function (_, k) { if (Object.prototype.hasOwnProperty.call(vars, k)) { delete vars[k]; g.persist(); } return true; },
        ownKeys: function () { return Object.keys(vars); },
        getOwnPropertyDescriptor: function (_, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? { value: vars[k], enumerable: true, configurable: true, writable: true } : undefined; }
      }) : vars;
      API.vars = function () { return JSON.parse(JSON.stringify(vars)); };
      API.setVar = function (k, v) { if (!host()) return false; return setVar(k, v); };

      /* ---------- events between objects, and enter and leave ---------- */
      function call(inst, f, arg, where) {
        if (!inst || inst.dead) return;
        try { f(arg); } catch (e) {
          inst.errs = (inst.errs || 0) + 1;
          g.log({ who: inst.name || inst.key || 'script', what: 'ERROR ' + where + ': ' + plain(e && e.message || e) });
          if (inst.errs >= 5 && !inst.dead) { inst.dead = true; g.log({ who: inst.name || 'script', what: 'This script stopped after 5 errors. Fix it, then turn Scripts off and on.' }); }
        }
      }
      function broadcast(name, payload) {
        var t = nowS(); emitsAt = emitsAt.filter(function (x) { return t - x < 1; });
        if (emitsAt.length >= EMITS_PER_SEC) { once('rate', 'Events are coming too fast, so some were skipped.'); return 0; }
        if (depth >= MAX_DEPTH) { once('depth', 'Events sent from events went too deep, so the rest were skipped.'); return 0; }
        emitsAt.push(t); depth++; var n = 0;
        try {
          Object.keys(reg).forEach(function (k) { var r = reg[k]; if (!r || r.inst.dead) return; var hs = r.inst.h && r.inst.h[name]; if (!hs) return; hs.slice().forEach(function (f) { n++; call(r.inst, f, payload, name); }); });
        } finally { depth--; }
        return n;
      }
      function dispatch(type, e) {
        var keys = Object.keys(reg); if (!keys.length) return 0;
        var n = 0;
        keys.forEach(function (k) {
          var r = reg[k]; if (!r || r.inst.dead) return;
          (r.hs[type] || []).slice().forEach(function (h) {
            if (h.name !== null && !same(h.name, e.target.name) && !same(h.name, e.target.id)) return;
            n++; call(r.inst, function () { h.fn(e); }, undefined, type);
          });
        });
        return n;
      }
      function visitorOf(v, kind) { return { id: str(v && v.id, 40) || 'someone', name: str(v && v.name, 40) || 'Someone', guest: !!(v && v.guest), kind: str(v && v.kind, 12) || 'player' }; }
      function onBus(type) {
        return function (e) {
          if (!e || !Object.keys(reg).length) return;
          var v = visitorOf(e.who), rec = e.trigger || {};
          visitors[v.id] = v;
          if (type === 'enter' && countsOn) bump(v.name);
          dispatch(type, { type: type, who: v, target: { kind: 'trigger', id: str(e.id, 60), name: str(rec.name, 60) || str(e.id, 60) }, test: false });
        };
      }
      function onSeat(e) {
        if (!e || typeof e.seatId !== 'string' || !Object.keys(reg).length) return;
        var s = seatOf(e.seatId), v = visitorOf({ id: e.who, name: e.who, guest: false }), type = e.state === 'exit' ? 'leave' : 'enter';
        dispatch(type, { type: type, who: v, target: { kind: 'seat', id: e.seatId, name: s ? str(s.name, 60) : e.seatId }, test: false });
      }

      /* ---------- visitor counts: off by default, kept on her machine (not in the scene, not sent) ---------- */
      function loadCounts() { if (counts) return counts; counts = {}; var raw = g.getFile('script_visitors'); if (raw) { try { var o = JSON.parse(raw); if (isObj(o)) Object.keys(o).slice(0, 500).forEach(function (k) { if (isNum(o[k]) && o[k] >= 0) counts[k] = Math.floor(o[k]); }); } catch (e) { /* start empty */ } } return counts; }
      function bump(name) { var c = loadCounts(), k = String(name).toLowerCase().slice(0, 40); if (BAD[k]) return; c[k] = (c[k] || 0) + 1; g.putFile('script_visitors', JSON.stringify(c)); }
      API.setVisitorCounts = function (on) { if (!host()) return false; countsOn = !!on; g.putFile('script_prefs', JSON.stringify({ visitorCounts: countsOn })); return countsOn; };
      API.visitorCountsOn = function () { return countsOn; };
      API.visitorCount = function (name) { if (!countsOn) return 0; return loadCounts()[String(name).toLowerCase().slice(0, 40)] || 0; };
      API.clearVisitorCounts = function () { counts = {}; g.delFile('script_visitors'); return true; };

      /* ---------- the extras a script gets ---------- */
      function fieldsFor(key, inst) {
        var defs = {}, F = function (d) {
          if (!isObj(d)) return F;
          Object.keys(d).slice(0, MAX_FIELDS).forEach(function (n) {
            if (BAD[n] || !/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(n) || n in F || !isObj(d[n])) return;
            var f = d[n], t = f.type === 'number' || f.type === 'bool' || f.type === 'text' ? f.type : 'text', o = { type: t };
            if (t === 'number') { o.min = isNum(f.min) ? f.min : -1e6; o.max = isNum(f.max) ? f.max : 1e6; o.step = isNum(f.step) && f.step > 0 ? f.step : 1; o.default = clamp(isNum(f.default) ? f.default : 0, o.min, o.max); }
            else if (t === 'bool') o.default = f.default === true;
            else { o.default = str(f.default, 120); if (Array.isArray(f.choices)) o.choices = f.choices.slice(0, 12).map(function (c) { return str(String(c), 40); }); }
            o.label = str(f.label, 40) || n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, ' ');
            defs[n] = o;
            Object.defineProperty(F, n, { enumerable: true, configurable: true, get: function () { var v = (fv[key] || {})[n]; return v === undefined ? o.default : v; } });
          });
          reg[key].fields = defs; return F;
        };
        return F;
      }
      function raycast(from, dir, opts) {
        var o = vec(from), d = vec(dir); if (!o || !d) return null;
        var len = Math.hypot(d[0], d[1], d[2]); if (len < 1e-9) return null; d = [d[0] / len, d[1] / len, d[2] / len];
        opts = isObj(opts) ? opts : {}; var maxD = clamp(isNum(opts.distance) ? opts.distance : 50, 0.01, MAX_RAY), tag = typeof opts.tag === 'string' ? opts.tag : null;
        var fn = ctx().raycast; if (typeof fn === 'function') { try { var r = fn(o, d, { tag: tag, distance: maxD }); if (r && isNum(r.distance) && r.distance <= maxD) return { name: str(r.name, 60), id: str(String(r.id), 60), distance: r.distance, point: vec(r.point) }; if (r === null) return null; } catch (e) { /* fall back to the props' spheres */ } }
        var best = null;
        g.props().forEach(function (p) {
          if (!p || !p.object) return; if (tag !== null && (p.tags || []).indexOf(tag) < 0) return;
          var c = posOf(p); if (!c) return; var rad = isNum(p.radius) && p.radius > 0 ? p.radius : 0.5;
          var ox = c[0] - o[0], oy = c[1] - o[1], oz = c[2] - o[2], tc = ox * d[0] + oy * d[1] + oz * d[2]; if (tc < 0) return;
          var d2 = ox * ox + oy * oy + oz * oz - tc * tc; if (d2 > rad * rad) return;
          var t = tc - Math.sqrt(rad * rad - d2); if (t < 0) t = 0; if (t > maxD) return;
          if (!best || t < best.distance) best = { name: str(p.name || p.id, 60), id: str(String(p.id), 60), distance: Math.round(t * 1e4) / 1e4, point: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] };
        });
        return best;
      }
      function spawn(kind, pos) {
        if (!host()) return null;
        kind = str(kind, 40); if (!/^[A-Za-z0-9 _-]{1,40}$/.test(kind)) { once('spawnkind', 'A script asked to spawn something with a name that is not allowed.'); return null; }
        if (nspawn >= budget) { once('budget', 'Spawn budget reached (' + budget + '). Despawn something first.'); note(null, 'Spawn refused: budget ' + budget + ' reached'); return null; }
        var fn = ctx().spawnObject; if (typeof fn !== 'function') { once('spawnobj', 'Spawning objects is not connected yet.'); return null; }
        var id = null; try { id = fn(kind, vec(pos)); } catch (e) { id = null; }
        if (id === null || id === undefined) return null;
        var k = String(isObj(id) && id.id !== undefined ? id.id : id).slice(0, 60); spawned[k] = { kind: kind, thing: id }; nspawn++;
        return id;
      }
      function despawn(thing) {
        var k = String(isObj(thing) && thing.id !== undefined ? thing.id : thing).slice(0, 60); if (!spawned[k]) return false;
        var fn = ctx().despawnObject; try { if (typeof fn === 'function') fn(spawned[k].thing); } catch (e) { /* gone already */ }
        delete spawned[k]; nspawn--; return true;
      }
      API.spawned = function () { return nspawn; };
      API.setSpawnBudget = function (n) { if (!host() || !isNum(n)) return budget; budget = clamp(Math.floor(n), 1, 100); if (!g._loading) g.persist(); return budget; };
      API.spawnBudget = function () { return budget; };

      API.extend = function (inst, c) {
        c = c || {};
        if (!isObj(inst)) return { names: [], values: [] };
        var key = str(String(inst.key || inst.name || 'script'), 60);
        inst.h = inst.h || {};
        var r = reg[key] = { inst: inst, hs: { enter: [], leave: [] }, fields: {} };
        var emit = function (name, payload) {
          name = str(typeof name === 'string' ? name : '', 60); if (!name) return 0;
          if (name === 'gizmo') { return API.run(isObj(payload) ? payload : {}) ? 1 : 0; }
          return broadcast(name, payload);
        };
        var F = fieldsFor(key, inst);
        var listen = function (type) {
          return function (a, b) {
            var name = typeof a === 'string' ? a : null, fn = typeof a === 'function' ? a : b;
            if (typeof fn !== 'function') return; if (r.hs[type].length >= 24) return;
            r.hs[type].push({ name: name === null ? null : str(name, 60), fn: fn });
          };
        };
        var visitor = { count: function (n) { return API.visitorCount(n); } };
        var w = c.world;
        if (isObj(w)) {
          w.raycast = raycast; w.spawn = spawn; w.despawn = despawn;
          Object.defineProperty(w, 'vars', { get: function () { return varsProxy; }, configurable: true, enumerable: true });
        }
        note(null, 'Script ready: ' + (inst.name || key));
        return { names: NAMES.slice(), values: [emit, F, visitor, spawn, listen('enter'), listen('leave')] };
      };
      API.names = NAMES.slice();

      /* Scripts went off: handlers and timers were dropped by the page; this part lets go of what it started */
      API.scriptsOff = function () {
        Object.keys(spawned).forEach(function (k) { despawn(k); });
        undo.splice(0).reverse().forEach(function (f) { try { f(); } catch (e) { /* gone */ } });
        reg = {}; seen = {}; depth = 0; emitsAt = []; running = null; visitors = {};
        g.log({ who: 'script', what: 'Scripts off: everything put back' });
        return true;
      };
      API.instances = function () { return Object.keys(reg); };

      /* ---------- fields as panel rows ---------- */
      API.fieldsOf = function (key) {
        var r = reg[key], defs = r ? r.fields : {}, out = {};
        Object.keys(defs).forEach(function (n) { var v = (fv[key] || {})[n]; out[n] = Object.assign({}, defs[n], { value: v === undefined ? defs[n].default : v }); });
        return out;
      };
      API.setField = function (key, n, v) {
        if (!host()) return false;
        var d = reg[key] && reg[key].fields[n]; if (!d) return false;
        if (d.type === 'number') { if (!isNum(v)) return false; v = clamp(v, d.min, d.max); }
        else if (d.type === 'bool') v = v === true;
        else { v = str(typeof v === 'string' ? v : String(v), 120); if (d.choices && d.choices.length && d.choices.indexOf(v) < 0) return false; }
        (fv[key] = fv[key] || {})[n] = v; if (!g._loading) g.persist();
        return true;
      };
      API.fieldRows = function (key, H) {
        var rows = [], hh = { say: function (t) { if (H && typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else msg(t); }, redraw: function () { if (H && typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } };
        if (!host()) return rows;
        var f = API.fieldsOf(key);
        Object.keys(f).forEach(function (n) {
          var d = f[n];
          if (d.type === 'number') {
            rows.push({ label: plain(d.label + ': ' + d.value), ic: null, act: function () { g.pushUndo(); var nv = d.value + d.step; if (nv > d.max) nv = d.min; API.setField(key, n, Math.round(nv * 1e6) / 1e6); hh.say(d.label + ': ' + API.fieldsOf(key)[n].value); hh.redraw(); } });
            rows.push({ label: plain(d.label + ' lower'), ic: null, act: function () { g.pushUndo(); var nv = d.value - d.step; if (nv < d.min) nv = d.max; API.setField(key, n, Math.round(nv * 1e6) / 1e6); hh.say(d.label + ': ' + API.fieldsOf(key)[n].value); hh.redraw(); } });
          } else if (d.type === 'bool') {
            rows.push({ label: plain(d.label + ': ' + (d.value ? 'on' : 'off')), ic: null, on: function () { return !!API.fieldsOf(key)[n].value; }, act: function () { g.pushUndo(); API.setField(key, n, !API.fieldsOf(key)[n].value); hh.redraw(); } });
          } else {
            rows.push({ label: plain(d.label + ': ' + (d.value || 'none')), ic: null, act: function () {
              g.pushUndo(); var opts = d.choices && d.choices.length ? d.choices : [''].concat(g.peers().map(function (p) { return p && p.name; }).filter(Boolean).slice(0, 6)), cur = API.fieldsOf(key)[n].value, nx = opts[(opts.indexOf(cur) + 1) % opts.length];
              API.setField(key, n, nx); hh.say(d.label + ': ' + (nx || 'none')); hh.redraw();
            } });
          }
        });
        return rows;
      };

      /* ---------- blocks, kept beside the code ---------- */
      function genFor(key, clean) { return B.generate(clean, { key: key }); }
      API.setBlocks = function (key, json) {
        if (!host()) return { ok: false, errors: ['Only the host edits scripts.'], code: '' };
        key = str(String(key), 60); if (!key || BAD[key]) return { ok: false, errors: ['That script has no name.'], code: '' };
        var v = B.validate(json); if (!v.ok) return { ok: false, errors: v.errors, code: '' };
        var code = genFor(key, v.clean);
        scripts[key] = { blocks: v.clean, gen: B.hash(code), edited: false };
        if (!g._loading) g.persist();
        var oc = ctx().objCfg; if (oc && typeof oc.setCode === 'function') { try { oc.setCode(key, code); } catch (e) { /* the page keeps its own code */ } }
        return { ok: true, errors: [], code: code };
      };
      API.getBlocks = function (key) { var s = scripts[key]; return s ? { blocks: JSON.parse(JSON.stringify(s.blocks)), code: genFor(key, s.blocks), edited: !!s.edited } : null; };
      API.codeFor = function (key) { var s = scripts[key]; return s ? genFor(key, s.blocks) : ''; };
      API.clearBlocks = function (key) { if (!host() || !scripts[key]) return false; delete scripts[key]; g.persist(); return true; };
      /* the code in the Scripts tab changed: if it is no longer what the blocks make, this script is edited as code and the blocks grey out. Going back is by setBlocks again. */
      API.codeEdited = function (key, code) {
        var s = scripts[key]; if (!s) return false;
        s.edited = B.hash(String(code)) !== s.gen; if (!g._loading) g.persist();
        return s.edited;
      };
      API.blocksState = function (key) { var s = scripts[key]; if (!s) return { mode: 'none', greyed: false }; return s.edited ? { mode: 'code', greyed: true, note: 'Edited as code. The blocks are grey and do not change the code.' } : { mode: 'blocks', greyed: false }; };
      API.scriptKeys = function () { return Object.keys(scripts); };
      API.describe = function (key) { var s = scripts[key]; return s ? s.blocks.rules.map(function (r) { return B.describe(r); }) : []; };

      /* Test it with me: a fake visitor (a guest called A test visitor) goes through the blocks. Delayed steps need Gizmos live on. */
      API.testIt = function (key, ruleIx) {
        if (!host()) { msg('Only the host can test a script.'); return false; }
        var s = scripts[key]; if (!s) { msg('That script has no blocks to test.'); return false; }
        var fake = { id: 'test', name: 'A test visitor', guest: true, kind: 'player' }, ran = 0;
        if (s.edited) {
          var n = 0; Object.keys(reg).forEach(function (k) { if (k === key) { n += dispatch('enter', { type: 'enter', who: fake, target: { kind: 'trigger', id: 'test', name: 'test' }, test: true }); } });
          msg(n ? 'Tested ' + key + ' as code.' : 'Turn Scripts on to test code. The blocks are grey because the code was edited.'); return n > 0;
        }
        s.blocks.rules.forEach(function (r, ri) {
          if (isNum(ruleIx) && ri !== ruleIx) return;
          if (r.when.event === 'starts' || (r.when.event === 'enters' || r.when.event === 'leaves' || r.when.event === 'hears')) { ran++; exec(r, ri, key, fake, 0); }
        });
        if (s.blocks.rules.some(function (r) { return r.then.some(function (x) { return x.do === 'wait'; }); }) && !g._live) once('testlive', 'Delayed steps need Gizmos live on.');
        return ran > 0;
      };
      function exec(rule, ri, key, who, from) {
        for (var i = from; i < rule.then.length; i++) {
          var st = rule.then[i];
          if (st.do === 'wait') { (function (idx) { if (g._live) g.after(st.sec, function () { exec(rule, ri, key, who, idx + 1); }, 'script:' + key); })(i); return; }
          var p = Object.assign({ s: key, rule: ri, step: i, who: who.id }, st);
          API.run(p, { test: true, words: B.stepWords(rule, i) });
        }
      }

      /* ---------- templates ---------- */
      API.templates = function () { return GN.Templates ? GN.Templates.list() : []; };
      API.installTemplate = function (id) {
        if (!host()) { msg('Only the host can add a template.'); return null; }
        if (!GN.Templates) return null;
        var t = GN.Templates.get(id); if (!t) return null;
        var made = [];
        (t.gizmos || []).forEach(function (gz) {
          var mod = M(gz.kind); if (!mod || typeof mod.add !== 'function') return;
          var rec = mod.add(Object.assign({}, gz.record, { armed: gz.record && gz.record.armed === true ? true : false }));
          if (rec) made.push({ kind: gz.kind, id: rec.id, name: rec.name });
        });
        (t.ranges || []).forEach(function (rg) { var Bt = M('beats'); if (Bt && !Bt.getRange(rg.name) && Bt.length() >= 0.05) Bt.setRange(rg.name, 0, Math.min(rg.b, Bt.length())); });
        var key = 'tpl_' + t.id, res = API.setBlocks(key, t.blocks);
        if (!res.ok) return null;
        return { id: t.id, name: t.name, key: key, code: res.code, blocks: JSON.parse(JSON.stringify(t.blocks)), gizmos: made, note: t.note };
      };

      /* ---------- the Scripts tab strip ---------- */
      API.mountBlocks = function (el) {
        if (!el) return false;
        var doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null); if (!doc) return false;
        function mk(tag, txt, cls) { var n = doc.createElement(tag); if (txt !== undefined) n.textContent = txt; if (cls) n.className = cls; return n; }
        el.innerHTML = ''; var box = mk('div', undefined, 'gn-blocks');
        if (!host()) { box.appendChild(mk('div', 'Only the host edits scripts.', 'gn-dim')); el.appendChild(box); return true; }
        box.appendChild(mk('h4', 'Blocks'));
        API.templates().forEach(function (t) {
          var b = mk('button', 'Template: ' + t.name); b.type = 'button';
          b.addEventListener('click', function () { var r = API.installTemplate(t.id); msg(r ? t.name + ' added. Turn Scripts on, then press Test it with me.' : 'That template could not be added.'); API.mountBlocks(el); });
          box.appendChild(b);
        });
        API.scriptKeys().forEach(function (k) {
          var st = API.blocksState(k), row = mk('div', undefined, st.greyed ? 'gn-grey' : 'gn-row');
          row.appendChild(mk('div', k + (st.greyed ? ' (edited as code)' : ''), 'gn-name'));
          API.describe(k).forEach(function (line, i) { var l = mk('div', (i + 1) + '. ' + line); var run = API.running(); if (run && run.key === k && run.rule === i) l.className = 'gn-run'; row.appendChild(l); });
          var t = mk('button', 'Test it with me'); t.type = 'button'; t.addEventListener('click', function () { API.testIt(k); API.mountBlocks(el); }); row.appendChild(t);
          if (st.greyed) row.appendChild(mk('div', st.note, 'gn-dim'));
          box.appendChild(row);
        });
        if (!API.scriptKeys().length) box.appendChild(mk('div', 'No blocks yet. Pick a template to start.', 'gn-dim'));
        el.appendChild(box); return true;
      };

      var part = {
        init: function () {
          var raw = g.getFile('script_prefs'); if (raw) { try { var o = JSON.parse(raw); if (isObj(o)) countsOn = o.visitorCounts === true; } catch (e) { /* default off */ } }
          g.on('enter', onBus('enter')); g.on('leave', onBus('leave')); g.on('seat', onSeat);
        },
        state: function () {
          var any = Object.keys(scripts).length || Object.keys(fv).length || Object.keys(vars).length || budget !== SPAWN_BUDGET;
          return any ? { v: 1, scripts: scripts, fv: fv, vars: vars, budget: budget } : null;
        },
        load: function (s) {
          scripts = {}; fv = {}; vars = {}; budget = SPAWN_BUDGET;
          if (!isObj(s)) return;
          if (isObj(s.scripts)) Object.keys(s.scripts).slice(0, 48).forEach(function (k) {
            if (BAD[k] || k.length > 60 || !isObj(s.scripts[k])) return;
            var v = B.validate(s.scripts[k].blocks); if (!v.ok) return;
            var gen = B.hash(genFor(k, v.clean)); scripts[k] = { blocks: v.clean, gen: gen, edited: s.scripts[k].edited === true };
          });
          if (isObj(s.fv)) Object.keys(s.fv).slice(0, 48).forEach(function (k) { if (BAD[k] || !isObj(s.fv[k])) return; fv[k] = {}; Object.keys(s.fv[k]).slice(0, MAX_FIELDS).forEach(function (n) { var v = s.fv[k][n]; if (!BAD[n] && (isNum(v) || typeof v === 'boolean' || typeof v === 'string')) fv[k][n] = typeof v === 'string' ? v.slice(0, 120) : v; }); });
          if (isObj(s.vars)) Object.keys(s.vars).slice(0, MAX_VARS).forEach(function (k) { var v = s.vars[k]; if (!BAD[k] && k.length <= 40 && ((isNum(v) && Math.abs(v) < 1e7) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 200))) vars[k] = v; });
          if (isNum(s.budget)) budget = clamp(Math.floor(s.budget), 1, 100);
        },
        reset: function () { scripts = {}; fv = {}; vars = {}; budget = SPAWN_BUDGET; told = {}; },
        dispose: function () { reg = {}; }
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN._scriptRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
