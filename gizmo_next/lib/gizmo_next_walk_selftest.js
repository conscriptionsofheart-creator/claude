/* gizmo_next_walk_selftest.js: the checks for stage H7 (the Walk, run, jump and fly gaps as a pure model). No headset, no page, no three.js needed.
   node gizmo_next_selftest.js --only=walk     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_walk.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._walkRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var W = kit.GizmoNext.WalkModel, DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var flat = { floorAt: function () { return 0; } };
    /* run the model for `sec` seconds at 60 Hz with a fixed input (or a function of the frame) */
    function go(st, inp, sec, env, each) { var n = Math.round(sec * 60); for (var i = 0; i < n; i++) { st = W.step(st, typeof inp === 'function' ? inp(i, st) : inp, 1 / 60, env || flat); if (each) each(st, i); } return st; }

    S('walk_fly_rises_with_stick', function () {
      var st = W.init([0, 0.5, 0], 'fly'), up = go(st, { vertical: 1 }, 1), down = go(up, { vertical: -1 }, 0.5), fwd = go(W.init([0, 5, 0], 'fly'), { move: [0, 1], forward3: [0, 0.5, -1] }, 1);
      var set = go(W.init([0, 0, 0]), { setMode: 'fly' }, 0.1);
      T.check('walk_fly_rises_with_stick', up.pos[1] > 0.5 + 2.5 && near(up.pos[1], 0.5 + 4 * 0.7 * 1, 0.1) && down.pos[1] < up.pos[1] - 1 && fwd.pos[2] < -3 && fwd.pos[1] > 5 + 1 && set.mode === 'fly' && up.mode === 'fly');
    });
    S('walk_fly_no_wall_collision_but_floor_holds', function () {
      var wall = { floorAt: function () { return 0; }, blocked: function (x, z) { return x > 2 && x < 2.5; } };
      var walk = go(W.init([0, 0, 0]), { move: [1, 0], heading: 0 }, 3, wall), fly = go(W.init([0, 1, 0], 'fly'), { move: [1, 0], heading: 0 }, 3, wall);
      var dive = go(W.init([0, 3, 0], 'fly'), { vertical: -1 }, 3, { floorAt: function () { return 0.4; } });
      T.check('walk_fly_no_wall_collision_but_floor_holds', walk.pos[0] <= 2.0 + 1e-3 && walk.pos[0] > 1.9 && fly.pos[0] > 5 && near(dive.pos[1], 0.4, 1e-6) && dive.grounded === true);
    });
    S('walk_fly_off_lands_on_floorAt', function () {
      var env = { floorAt: function (x, z) { return x > 5 ? 1.2 : 0.3; } };
      var st = go(W.init([0, 6, 0], 'fly'), { setMode: 'walk' }, 0.016, env), seen = st.dropping === true && st.mode === 'walk';
      var landed = go(st, {}, 3, env);
      var far = go(W.init([8, 6, 0], 'fly'), { setMode: 'walk' }, 3, env);
      var gz = go(W.init([0, 6, 0], 'fly'), { setMode: 'walk' }, 4, env, null), settings0 = { settings: { gravity: 0 }, floorAt: env.floorAt }, zero = go(W.init([0, 6, 0], 'fly'), { setMode: 'walk' }, 4, settings0);
      T.check('walk_fly_off_lands_on_floorAt', seen && near(landed.pos[1], 0.3, 1e-6) && landed.grounded && landed.dropping === false && near(far.pos[1], 1.2, 1e-6) && near(zero.pos[1], 0.3, 1e-6));
    });
    S('walk_speed_clamped_45', function () {
      var a = W.settings({ speed: 999 }), b = W.settings({ speed: -4 }), c = W.settings({ speed: 'x' }), d = W.settings({ speed: 45, runMul: 3 });
      var fast = go(W.init([0, 0, 0]), { move: [0, 1], run: true }, 1, { floorAt: flat.floorAt, settings: { speed: 45, runMul: 3 } });
      var slow = go(W.init([0, 0, 0]), { move: [0, 1] }, 1, { floorAt: flat.floorAt, settings: { speed: 1 } });
      T.check('walk_speed_clamped_45', a.speed === 45 && b.speed === 0 && c.speed === 4 && d.runMul === 3 && fast.speed <= 45 + 1e-6 && near(fast.speed, 45, 1e-6) && near(Math.hypot(fast.pos[0], fast.pos[2]), 45, 0.8) && near(slow.pos[2], -1, 0.02));
    });
    S('walk_gravity_clamped_9_81_and_0_floats', function () {
      var a = W.settings({ gravity: 99 }), b = W.settings({ gravity: -2 }), c = W.settings({ gravity: 4.905 });
      var jumpAt = function (g) { var st = go(W.init([0, 0, 0]), { jump: true }, 1 / 60, { floorAt: flat.floorAt, settings: { gravity: g } }), top = 0; st = go(st, {}, 4, { floorAt: flat.floorAt, settings: { gravity: g } }, function (s) { top = Math.max(top, s.pos[1]); }); return { top: top, end: st.pos[1], grounded: st.grounded }; };
      var earth = jumpAt(9.81), moon = jumpAt(1.6), zero = jumpAt(0);
      T.check('walk_gravity_clamped_9_81_and_0_floats', a.gravity === 9.81 && b.gravity === 0 && c.gravity === 4.905 && earth.grounded && near(earth.end, 0) && moon.top > 0.4 && zero.end > 0.3 && zero.grounded === false);
    });
    S('walk_run_toggle', function () {
      var env = flat, walk = go(W.init([0, 0, 0]), { move: [0, 1] }, 1, env), held = go(W.init([0, 0, 0]), { move: [0, 1], run: true }, 1, env);
      var st = W.step(W.init([0, 0, 0]), { runToggle: true }, 1 / 60, env), on = st.run; st = go(st, { move: [0, 1] }, 1, env); var toggled = st.speed;
      var off = W.step(st, { runToggle: true }, 1 / 60, env);
      T.check('walk_run_toggle', near(walk.speed, 4, 1e-3) && near(held.speed, 4 * 1.8, 1e-3) && on === true && near(toggled, 7.2, 1e-3) && off.run === false && held.run === false);
    });
    S('walk_jump_apex_and_land_60hz', function () {
      var st = W.init([0, 0, 0]), top = 0, t = 0, airFrames = 0, landedAt = null;
      st = W.step(st, { jump: true }, 1 / 60, flat);
      for (var i = 0; i < 200; i++) { top = Math.max(top, st.pos[1]); if (!st.grounded) airFrames++; else if (i > 3 && landedAt === null) landedAt = i; st = W.step(st, {}, 1 / 60, flat); }
      var flight = 2 * Math.sqrt(2 * 9.81 * 0.5) / 9.81 * 60;
      var low = W.step(W.init([0, 0, 0]), { jump: true }, 1 / 60, flat), air = W.step(low, { jump: true }, 1 / 60, flat);
      T.check('walk_jump_apex_and_land_60hz', near(top, 0.5, 0.03) && near(airFrames, flight, 3) && st.grounded && st.pos[1] === 0 && landedAt !== null && air.vel[1] < low.vel[1]);
    });
    S('walk_crouch_lowers_camera_not_body', function () {
      var st = go(W.init([1, 0.2, 1]), { crouch: true }, 1, { floorAt: function () { return 0.2; } }), up = go(st, {}, 1, { floorAt: function () { return 0.2; } });
      var slow = go(W.init([0, 0, 0]), { move: [0, 1], crouch: true }, 1, flat);
      T.check('walk_crouch_lowers_camera_not_body', st.crouch && near(st.camDrop, 0.35, 1e-6) && st.pos[1] === 0.2 && st.pos[0] === 1 && up.camDrop === 0 && up.crouch === false && near(slow.speed, 2, 1e-3));
    });
    S('walk_vignette_zero_at_walk_speed_and_slews_smoothly', function () {
      var atWalk = go(W.init([0, 0, 0]), { move: [0, 1] }, 2, flat), v = [W.vignetteFor(0), W.vignetteFor(4), W.vignetteFor(8), W.vignetteFor(12), W.vignetteFor(40)];
      var worst = 0, last = 0, maxV = 0;
      var jerky = go(W.init([0, 0, 0]), function (i) { return { move: [0, i % 2 ? 1 : 0], run: i % 7 < 3 }; }, 3, flat, function (s) { worst = Math.max(worst, Math.abs(s.vignette - last)); last = s.vignette; maxV = Math.max(maxV, s.vignette); });
      var fast = go(W.init([0, 0, 0]), { move: [0, 1], run: true }, 2, { floorAt: flat.floorAt, settings: { speed: 15, runMul: 3 } });
      var ramp = []; go(W.init([0, 0, 0]), { move: [0, 1], run: true }, 1, { floorAt: flat.floorAt, settings: { speed: 15, runMul: 3 } }, function (s) { ramp.push(s.vignette); });
      var rw = 0; ramp.forEach(function (x, i) { if (i) rw = Math.max(rw, Math.abs(x - ramp[i - 1])); });
      T.value('walk_vignette_worst_frame_step', Math.round(Math.max(worst, rw) * 100000) / 100000);
      T.check('walk_vignette_zero_at_walk_speed_and_slews_smoothly', atWalk.vignette === 0 && v[0] === 0 && v[1] === 0 && near(v[2], 0.6 * 4 / 8, 1e-3) && v[3] === 0.6 && v[4] === 0.6 && Math.max(worst, rw) <= 0.025 + 1e-9 && maxV <= 0.6 && near(fast.vignette, 0.6, 1e-3) && ramp[0] > 0);
    });
    S('walk_seat_blocks_move', function () {
      var st = go(W.init([2, 0, 3]), { move: [0, 1], jump: true, crouch: true, run: true, seated: true }, 1, flat), flyer = go(W.init([0, 5, 0], 'fly'), { move: [0, 1], seated: true, vertical: 1 }, 1, flat);
      var free = go(st, { move: [0, 1] }, 0.5, flat);
      T.check('walk_seat_blocks_move', st.pos.join() === '2,0,3' && st.vel.join() === '0,0,0' && st.crouch === false && st.mode === 'walk' && flyer.mode === 'walk' && flyer.pos.join() === '0,5,0' && free.pos[2] < 3 - 1);
    });
    S('walk_tick_cost', function () {
      var env = { floorAt: function (x, z) { return 0.1 * Math.sin(x); }, blocked: function (x, z) { return Math.abs(x - 50) < 1; } }, st = W.init([0, 0, 0]);
      var t0 = kit.ms(); for (var i = 0; i < 1000; i++) st = W.step(st, { move: [0.3, 0.9], heading: i * 0.01, jump: i % 90 === 0, run: i % 200 < 100, crouch: i % 300 < 20 }, 1 / 60, env); var per = (kit.ms() - t0) / 1000;
      T.value('walk_tick_cost_ms_per_step', Math.round(per * 10000) / 10000);
      T.check('walk_tick_cost', per < 0.05 && isFinite(st.pos[0]));
    });

    /* ---- the rest of the contract ---- */
    S('walk_heading_and_strafe_directions', function () {
      var f = go(W.init([0, 0, 0]), { move: [0, 1], heading: 0 }, 1, flat), r = go(W.init([0, 0, 0]), { move: [1, 0], heading: 0 }, 1, flat), turned = go(W.init([0, 0, 0]), { move: [0, 1], heading: Math.PI / 2 }, 1, flat), diag = go(W.init([0, 0, 0]), { move: [1, 1] }, 1, flat);
      T.check('walk_heading_and_strafe_directions', near(f.pos[2], -4, 0.05) && near(f.pos[0], 0, 1e-6) && near(r.pos[0], 4, 0.05) && near(turned.pos[0], -4, 0.05) && near(turned.pos[2], 0, 0.05) && near(diag.speed, 4, 1e-3));
    });
    S('walk_wall_blocks_and_slides', function () {
      var env = { floorAt: flat.floorAt, blocked: function (x, z) { return x > 1; } }, st = go(W.init([0, 0, 0]), { move: [1, -1], heading: 0 }, 2, env);
      T.check('walk_wall_blocks_and_slides', st.pos[0] <= 1.0 + 0.1 && st.pos[2] > 2 && st.pos[2] < 6);
    });
    S('walk_flycap_caps_speed', function () {
      var env = { floorAt: flat.floorAt, settings: { speed: 40, runMul: 3, flyCap: 6 } }, st = go(W.init([0, 5, 0], 'fly'), { move: [0, 1], run: true, forward3: [0, 0, -1] }, 1, env);
      T.check('walk_flycap_caps_speed', near(st.speed, 6, 1e-3) && W.settings({ flyCap: 500 }).flyCap === 45);
    });
    S('walk_pure_does_not_mutate', function () {
      var st = W.init([1, 2, 3]), snap = JSON.stringify(st), inp = { move: [1, 1], jump: true }, isn = JSON.stringify(inp), envo = { floorAt: flat.floorAt, settings: { speed: 5 } }, es = JSON.stringify(envo.settings);
      var a = W.step(st, inp, 1 / 60, envo), b = W.step(st, inp, 1 / 60, envo);
      T.check('walk_pure_does_not_mutate', JSON.stringify(st) === snap && JSON.stringify(inp) === isn && JSON.stringify(envo.settings) === es && JSON.stringify(a) === JSON.stringify(b) && a !== st && a.pos !== st.pos);
    });
    S('walk_hostile_input_ok', function () {
      var threw = false, bad = [null, undefined, 5, 'x', [], { pos: 'a', vel: [NaN, 1, 1], mode: 'warp', camDrop: 1e9, vignette: -5, speed: -1 }, { pos: [1e308, 0, 0] }];
      var inputs = [null, 5, 'x', {}, { move: 'a' }, { move: [NaN, Infinity] }, { move: [1e9, 1e9], heading: 'x', forward3: [0, 0, 0], vertical: 1e9 }, { setMode: 'x', jump: 'yes' }], envs = [null, 5, {}, { floorAt: 5 }, { floorAt: function () { throw new Error('boom'); }, blocked: function () { throw new Error('boom'); } }, { settings: 'x' }, { floorAt: function () { return NaN; } }, { floorAt: function () { return null; } }];
      var last = null;
      try { bad.forEach(function (s) { inputs.forEach(function (i) { envs.forEach(function (e) { last = W.step(s, i, 1 / 60, e); W.step(s, i, NaN, e); W.step(s, i, -5, e); W.step(s, i, 1e9, e); }); }); }); } catch (e) { threw = e; }
      var ok = last && last.pos.every(isFinite) && last.vel.every(isFinite) && isFinite(last.vignette) && last.vignette >= 0 && last.vignette <= 0.6 && last.camDrop >= 0 && last.camDrop <= 1;
      T.check('walk_hostile_input_ok', !threw && ok && W.vignetteFor(NaN) === 0 && W.vignetteFor(Infinity) === 0.6 && W.vignetteFor(10, -1) >= 0 && W.settings(null).speed === 4 && W.settings({ speed: NaN, gravity: Infinity, __proto__: { polluted: 1 } }).speed === 4 && ({}).polluted === undefined);
    });
    S('walk_part_settings_rows_and_save', function () {
      var g = kit.makeInst({}), P = g.modules.walk, said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      var def = P.get(), set = P.set({ speed: 99, gravity: 3 }), rows = P.rows(H), labels = rows.map(function (r) { return r.label; });
      var saved = JSON.parse(JSON.stringify(g.state())); var g2 = kit.makeInst({}); g2.load(saved); var back = g2.modules.walk.get();
      var st = P.stepNow(W.init([0, 0, 0]), { move: [0, 1] }, 1, {});
      rows.forEach(function (r) { r.act(); });
      var page = g.pages('settings').filter(function (p) { return p.id === 'walk'; })[0], G = kit.makeInst({ guest: true }), gs = G.modules.walk.set({ speed: 9 });
      var g3 = kit.makeInst({});
      T.check('walk_part_settings_rows_and_save', def.speed === 4 && set.speed === 45 && set.gravity === 3 && /^Check settings for Speed and Gravity/.test(labels[0]) && labels.length === 6 && back.speed === 45 && back.gravity === 3 && !!page && gs.speed === 4 && JSON.stringify(g3.state()).indexOf('"walk"') < 0 && labels.concat(said).every(function (l) { return !hasDash(l); }) && st.speed > 40);
    });
  }

  var api = { stage: 'H7', section: 'walk', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H7 = api;
})();
