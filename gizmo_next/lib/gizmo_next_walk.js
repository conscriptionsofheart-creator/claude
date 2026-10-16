/* gizmo_next_walk.js: stage H7, the Walk, run, jump and fly gaps, as a pure model the seat can adopt or ignore. Nothing here touches the page: it takes a state, an input and a time step, and gives back the next state.
   WalkModel.step(state, input, dt, env) -> {pos, vel, mode:'walk'|'fly', crouch, camDrop, run, grounded, vignette 0..1, speed, dropping}
   settings {speed, gravity, runMul, flyCap, jump}: Speed 0 to 45 m/s (Meta's Player Speed ceiling), Gravity 0 to 9.81 (0 floats), a run multiplier, a fly speed cap, a jump height.
   vignetteFor(speed): the comfort edge vignette, 0 at walk speed up to 0.6 at three times walk speed, and it never changes by more than 1.5 a second, so it cannot flicker.
   Already in the app (not rebuilt): Walk, run, crouch, jump, Fly, the Walk icon (lkWalkBtn). Whether the Settings page already has Speed and Gravity rows is UNCONFIRMED: check settings for Speed and Gravity before adding the rows this part offers.
   Input: {move:[sx, sy] (strafe right, forward; the stick), heading (yaw, 0 faces -z), forward3:[x,y,z] (the head's forward, for fly), vertical (-1..1, the second stick or two buttons), jump (a press), run (held), runToggle (a press), crouch (held),
           setMode:'walk'|'fly', seated (true while a seat holds you)}. Env: {floorAt(x, z) -> metres or nothing, blocked(x, z) -> true inside a solid (walk only), settings}.
   Nothing runs by itself: the page calls step each frame while Walk is on. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');

  var DEF = { speed: 4, gravity: 9.81, runMul: 1.8, flyCap: 12, jump: 0.5 };
  var LIM = { speedMax: 45, gravityMax: 9.81, runMin: 1, runMax: 3, flyCapMax: 45, jumpMax: 2 };
  var VIG_MAX = 0.6, VIG_SLEW = 1.5, CROUCH_DROP = 0.35, CROUCH_RATE = 2, FLOAT_DRAG = 3, FLOAT_KICK = 1.5, DROP_FLOAT = 3;
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function v3(a, d) { return Array.isArray(a) && a.length >= 3 && isNum(a[0]) && isNum(a[1]) && isNum(a[2]) ? [a[0], a[1], a[2]] : (d || [0, 0, 0]); }

  /* settings forced into range: speed 0 to 45, gravity 0 to 9.81, anything else a number or the default */
  function settings(raw, base) {
    var o = Object.assign({}, DEF, base || {}), s = isObj(raw) ? raw : {};
    if (isNum(s.speed)) o.speed = r4(clamp(s.speed, 0, LIM.speedMax));
    if (isNum(s.gravity)) o.gravity = r4(clamp(s.gravity, 0, LIM.gravityMax));
    if (isNum(s.runMul)) o.runMul = r4(clamp(s.runMul, LIM.runMin, LIM.runMax));
    if (isNum(s.flyCap)) o.flyCap = r4(clamp(s.flyCap, 0, LIM.flyCapMax));
    if (isNum(s.jump)) o.jump = r4(clamp(s.jump, 0, LIM.jumpMax));
    return o;
  }
  /* 0 at walk speed or less, 0.6 at three times walk speed, a straight ramp between */
  function vignetteFor(speed, walkSpeed) {
    var w = isNum(walkSpeed) && walkSpeed > 0 ? walkSpeed : DEF.speed;
    if (speed === Infinity) return VIG_MAX;
    if (!isNum(speed) || speed <= w) return 0;
    return r4(Math.min(VIG_MAX, VIG_MAX * (speed - w) / (2 * w)));
  }
  function init(pos, mode) { return { pos: v3(pos), vel: [0, 0, 0], mode: mode === 'fly' ? 'fly' : 'walk', crouch: false, camDrop: 0, run: false, grounded: true, vignette: 0, speed: 0, dropping: false }; }
  function clean(st) {
    var s = isObj(st) ? st : {};
    return { pos: v3(s.pos).map(function (x) { return clamp(x, -1e6, 1e6); }), vel: v3(s.vel).map(function (x) { return clamp(x, -1e3, 1e3); }), mode: s.mode === 'fly' ? 'fly' : 'walk', crouch: !!s.crouch, camDrop: isNum(s.camDrop) ? clamp(s.camDrop, 0, 1) : 0, run: !!s.run, grounded: s.grounded !== false, vignette: isNum(s.vignette) ? clamp(s.vignette, 0, 1) : 0, speed: isNum(s.speed) ? Math.max(0, s.speed) : 0, dropping: !!s.dropping };
  }

  function step(state, input, dt, env) {
    var st = clean(state), inp = isObj(input) ? input : {}, e = isObj(env) ? env : {}, S = settings(e.settings);
    dt = isNum(dt) ? clamp(dt, 0, 0.1) : 1 / 60;
    var out = { pos: st.pos.slice(), vel: [0, 0, 0], mode: st.mode, crouch: st.crouch, camDrop: st.camDrop, run: st.run, grounded: st.grounded, vignette: st.vignette, speed: 0, dropping: st.dropping };
    var floorAt = function (x, z) { var f; try { f = typeof e.floorAt === 'function' ? e.floorAt(x, z) : 0; } catch (err) { f = null; } return isNum(f) ? f : null; };
    var blocked = function (x, z) { try { return typeof e.blocked === 'function' && !!e.blocked(x, z); } catch (err) { return false; } };
    var seated = !!inp.seated;

    /* a seat holds you still: no move, no jump, no crouch, standing mode */
    if (seated) {
      out.mode = 'walk'; out.crouch = false; out.dropping = false;
      out.camDrop = clamp(st.camDrop - CROUCH_RATE * dt, 0, 1);
      out.vignette = slew(st.vignette, 0, dt);
      return out;
    }

    if (inp.setMode === 'fly' && out.mode !== 'fly') { out.mode = 'fly'; out.dropping = false; }
    else if (inp.setMode === 'walk' && out.mode === 'fly') { out.mode = 'walk'; out.dropping = true; out.grounded = false; }
    if (inp.runToggle === true) out.run = !out.run;
    var run = out.run || inp.run === true;
    out.crouch = out.mode === 'walk' && inp.crouch === true;

    var mv = Array.isArray(inp.move) ? [isNum(inp.move[0]) ? inp.move[0] : 0, isNum(inp.move[1]) ? inp.move[1] : 0] : [0, 0], ml = Math.hypot(mv[0], mv[1]);
    if (ml > 1) { mv[0] /= ml; mv[1] /= ml; }
    var yaw = isNum(inp.heading) ? inp.heading : 0, fh = [-Math.sin(yaw), -Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)];
    var speed = Math.min(LIM.speedMax, S.speed * (run ? S.runMul : 1) * (out.crouch ? 0.5 : 1));
    var x = st.pos[0], y = st.pos[1], z = st.pos[2], vy = st.vel[1], vx = 0, vz = 0;

    if (out.mode === 'fly') {
      var sp = Math.min(S.flyCap, speed), f3 = v3(inp.forward3, [fh[0], 0, fh[1]]), fl = Math.hypot(f3[0], f3[1], f3[2]) || 1;
      f3 = [f3[0] / fl, f3[1] / fl, f3[2] / fl];
      var rh = Math.hypot(rt[0], rt[1]) || 1, vert = isNum(inp.vertical) ? clamp(inp.vertical, -1, 1) : 0;
      vx = (f3[0] * mv[1] + rt[0] / rh * mv[0]) * sp; vy = (f3[1] * mv[1]) * sp + vert * sp * 0.7; vz = (f3[2] * mv[1] + rt[1] / rh * mv[0]) * sp;
      x += vx * dt; y += vy * dt; z += vz * dt; /* no wall stops a flyer; only the floor holds */
      var ff = floorAt(x, z); if (ff !== null && y < ff) { y = ff; if (vy < 0) vy = 0; }
      out.grounded = ff !== null && y <= ff + 1e-4;
    } else {
      var wx = (fh[0] * mv[1] + rt[0] * mv[0]) * speed, wz = (fh[1] * mv[1] + rt[1] * mv[0]) * speed, nx = x + wx * dt, nz = z + wz * dt;
      if (!blocked(nx, z)) { x = nx; vx = wx; }
      if (!blocked(x, nz)) { z = nz; vz = wz; }
      var fl2 = floorAt(x, z), floor = fl2 === null ? y : fl2, g = S.gravity;
      var onFloor = y <= floor + 1e-4 && vy <= 1e-9;
      if (inp.jump === true && onFloor && !out.dropping) { vy = g > 0 ? Math.sqrt(2 * g * S.jump) : FLOAT_KICK; onFloor = false; }
      if (!onFloor) {
        if (out.dropping) vy = g > 0 ? vy - g * dt : -DROP_FLOAT;
        else if (g > 0) vy -= g * dt;
        else vy *= Math.max(0, 1 - FLOAT_DRAG * dt); /* gravity 0 floats: a kick rises and hangs */
        y += vy * dt;
      }
      if (y <= floor) { y = floor; vy = 0; out.grounded = true; out.dropping = false; }
      else out.grounded = false;
    }
    out.pos = [r4(x), r4(y), r4(z)]; out.vel = [r4(vx), r4(vy), r4(vz)];
    out.speed = r4(out.mode === 'fly' ? Math.hypot(vx, vy, vz) : Math.hypot(vx, vz));
    var target = vignetteFor(out.speed, S.speed);
    out.vignette = slew(st.vignette, target, dt);
    out.camDrop = r4(out.crouch ? Math.min(CROUCH_DROP, st.camDrop + CROUCH_RATE * dt) : Math.max(0, st.camDrop - CROUCH_RATE * dt));
    return out;
  }
  function slew(cur, target, dt) { var d = VIG_SLEW * dt; return r4(clamp(cur + clamp(target - cur, -d, d), 0, VIG_MAX)); }

  var WalkModel = { step: step, init: init, settings: settings, vignetteFor: vignetteFor, defaults: function () { return Object.assign({}, DEF); }, limits: Object.assign({}, LIM, { vignetteMax: VIG_MAX, vignetteSlew: VIG_SLEW, crouchDrop: CROUCH_DROP }) };
  GN.WalkModel = WalkModel;

  function register() {
    GN.register('walk', { needs: ['core'], version: 1 }, function (g) {
      var API = {}, cfg = settings(), told = {};
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'walk', what: t }); else g.say(t); };
      Object.keys(WalkModel).forEach(function (k) { API[k] = WalkModel[k]; });
      API.get = function () { return Object.assign({}, cfg); };
      API.set = function (patch) { if (g.isGuest()) { msg('Only the host can change the walk settings.'); return Object.assign({}, cfg); } cfg = settings(patch, cfg); if (!g._loading) g.persist(); return Object.assign({}, cfg); };
      /* step with this scene's settings and the page's floor: the seat can call this or WalkModel.step itself */
      API.stepNow = function (state, input, dt, env) { var e = Object.assign({ floorAt: function (x, z) { return g.call('floorAt', null, x, z); }, blocked: g.ctx && g.ctx.blocked }, env || {}); e.settings = cfg; return step(state, input, dt, e); };
      API.rows = function (H) {
        var rows = [], hh = { say: function (t) { if (H && typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else msg(t); }, redraw: function () { if (H && typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } };
        var R = function (l, act) { rows.push({ label: plain(l), ic: null, act: act }); };
        var cyc = function (key, vals, name, fmt) { return function () { g.pushUndo(); var i = vals.indexOf(cfg[key]), n = vals[(i + 1) % vals.length], p = {}; p[key] = n; API.set(p); hh.say(name + ': ' + fmt(cfg[key])); hh.redraw(); }; };
        R('Check settings for Speed and Gravity: these rows may already exist', function () { hh.say('Check Settings for Speed and Gravity before using these rows.'); });
        R('Player Speed: ' + cfg.speed + ' m/s (0 to 45)', cyc('speed', [1, 2, 4, 8, 16, 45], 'Player Speed', function (v) { return v + ' m/s'; }));
        R('Player Gravity: ' + cfg.gravity + ' (0 floats, 9.81 is Earth)', cyc('gravity', [0, 1.6, 4.9, 9.81], 'Player Gravity', String));
        R('Run: ' + cfg.runMul + 'x', cyc('runMul', [1, 1.5, 1.8, 2.5, 3], 'Run', function (v) { return v + 'x'; }));
        R('Fly speed cap: ' + cfg.flyCap + ' m/s', cyc('flyCap', [3, 6, 12, 24, 45], 'Fly speed cap', function (v) { return v + ' m/s'; }));
        R('Jump height: ' + cfg.jump + ' m', cyc('jump', [0.25, 0.5, 1, 2], 'Jump height', function (v) { return v + ' m'; }));
        return rows;
      };
      g.registerPage({ id: 'walk', title: 'Walk settings', label: 'Walk settings', where: 'settings', rows: function (H) { return API.rows(H); } });
      API.state = function () { var d = settings(); var same = Object.keys(d).every(function (k) { return d[k] === cfg[k]; }); return same ? null : { v: 1, settings: Object.assign({}, cfg) }; };
      API.load = function (s) { cfg = settings(isObj(s) ? s.settings : null); };
      API.reset = function () { cfg = settings(); };
      return API;
    });
  }

  GN._walkRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
