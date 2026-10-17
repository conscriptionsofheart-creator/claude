/* gizmo_next_script_sandbox.js: a small model of obj_scripts.js, for tests and the demo page only. It is not shipped to the app and not in the guest list.
   It builds scripts exactly the way obj_scripts.js does: new Function('me','world','on','every','after','say','play','log','THREE', ...extras, code),
   events by name, every and after timers that only run while Scripts are on, five errors and a script is dead, and Scripts off drops every handler and timer. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');

  function Sandbox(g, opts) {
    opts = opts || {};
    var S = { on: false, inst: {}, log: [], t: 0, said: [], played: [] };
    var world = { find: function () { return null; }, get: function () { return null; }, all: function () { return []; }, say: function (t) { S.said.push(String(t)); }, play: function (id) { S.played.push(id); }, get time() { return S.t; } };
    function fail(inst, e, where) { inst.errs++; S.log.push({ who: inst.name, msg: 'ERROR ' + where + ': ' + (e && e.message || e), err: true }); if (inst.errs >= 5) inst.dead = true; }
    function safe(inst, f, arg, where) { if (inst.dead) return; try { f(arg); } catch (e) { fail(inst, e, where); } }
    S.start = function (codeByKey) {
      if (S.on) return false;
      S.on = true; S.t = 0; S.inst = {}; S.log = []; S.said = []; S.played = [];
      Object.keys(codeByKey).forEach(function (key) {
        var inst = { key: key, name: key, h: {}, timers: [], errs: 0, dead: false };
        var on = function (ev, fn) { if (typeof fn === 'function') (inst.h[ev] || (inst.h[ev] = [])).push(fn); };
        var every = function (s, fn) { inst.timers.push({ s: Math.max(0.02, +s || 1), fn: fn, t: 0, rep: true }); }, after = function (s, fn) { inst.timers.push({ s: Math.max(0, +s || 0), fn: fn, t: 0, rep: false }); };
        var say = function (t) { S.said.push(String(t)); }, play = function (id) { S.played.push(id); }, log = function () { S.log.push({ who: key, msg: [].slice.call(arguments).join(' ') }); };
        var me = { name: key, kind: 'prop', id: key, position: { x: 0, y: 0, z: 0 } };
        var X = (g.modules.script ? g.modules.script.extend(inst, { world: world }) : { names: [], values: [] });
        S.inst[key] = inst;
        var fn; try { fn = Function.apply(null, ['me', 'world', 'on', 'every', 'after', 'say', 'play', 'log', 'THREE'].concat(X.names, ['"use strict";\n' + codeByKey[key]])); } catch (e) { fail(inst, e, 'syntax'); inst.dead = true; return; }
        try { fn.apply(null, [me, world, on, every, after, say, play, log, null].concat(X.values)); } catch (e) { fail(inst, e, 'start'); }
      });
      Object.keys(S.inst).forEach(function (k) { (S.inst[k].h.start || []).slice().forEach(function (f) { safe(S.inst[k], f, undefined, 'start'); }); });
      return true;
    };
    S.event = function (key, name, arg) { var inst = S.inst[key]; if (!S.on || !inst || !inst.h[name]) return 0; inst.h[name].slice().forEach(function (f) { safe(inst, f, arg, name); }); return inst.h[name].length; };
    S.tick = function (dt) {
      if (!S.on) return; S.t += dt;
      Object.keys(S.inst).forEach(function (k) {
        var inst = S.inst[k]; if (inst.dead) return;
        inst.timers = inst.timers.filter(function (t) { t.t += dt; if (t.t >= t.s) { safe(inst, t.fn, undefined, 'timer'); if (t.rep) { t.t = 0; return true; } return false; } return true; });
        (inst.h.frame || []).slice().forEach(function (f) { safe(inst, f, dt, 'frame'); });
      });
    };
    S.off = function () {
      if (!S.on) return false;
      Object.keys(S.inst).forEach(function (k) { (S.inst[k].h.stop || []).slice().forEach(function (f) { safe(S.inst[k], f, undefined, 'stop'); }); });
      S.on = false; S.inst = {};
      if (g.modules.script) g.modules.script.scriptsOff();
      return true;
    };
    S.timers = function () { var n = 0; Object.keys(S.inst).forEach(function (k) { n += S.inst[k].timers.length; }); return n; };
    S.world = world;
    return S;
  }
  GN.ScriptSandbox = Sandbox;
  if (typeof module !== 'undefined' && module.exports) module.exports = GN;
})();
