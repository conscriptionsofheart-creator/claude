/* gizmo_next_beats_selftest.js: the checks for stage H1 (the scene clock and the Beat strip). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=beats     or the demo page gizmo_next_demo.html.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_beats.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._beatsRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var THREE = kit.THREE, DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 0.002 : e); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };

    /* a fake page: figures with a pose and a look, props, a song clock, and counters for what the host was asked to do */
    function mkPose(x, y) { return { joints: { wrist: [x, y, 0], elbow: [0, 0.9, 0.1], spine: [0, 0, 0] }, pos: [0, 0, 0], turn: 0 }; }
    function rig(o) {
      o = o || {};
      var slots = o.slots || ['s0', 's1'], figs = {}, n = { pose: 0, look: 0 }, song = { t: null };
      slots.forEach(function (s, i) { figs[s] = { pose: mkPose(0, 1.4), look: { shader: 'plain', tint: [1, 0.5, 0.25] } }; });
      var pose = { get: function (s) { return figs[s] ? cl(figs[s].pose) : null; }, apply: function (s, p) { n.pose++; if (figs[s]) figs[s].pose = cl(p); } };
      var look = { get: function (s) { return figs[s] ? cl(figs[s].look) : null; }, apply: function (s, p) { n.look++; if (figs[s]) figs[s].look = cl(p); } };
      var prop = new THREE.Object3D();
      var g = kit.makeInst({ pose: pose, look: look, songTime: function () { return song.t; }, figures: slots.map(function (s) { return { slot: s }; }), props: [{ id: 'p1', object: prop }], guest: !!o.guest });
      var R = { g: g, B: g.modules.beats, figs: figs, n: n, song: song, prop: prop, ctx: g._ctx };
      R.wrist = function (s, x, y) { figs[s].pose.joints.wrist = [x, y === undefined ? 1.4 : y, 0]; };
      R.step = function (sec) { return kit.stepSeconds(g, sec); };
      return R;
    }
    /* three pose beats for s0 with the wrist x at 0, 0.3 and -0.3 (Ruth's example), at 0, 1 and 2 s */
    function three(R, both) {
      [0, 0.3, -0.3].forEach(function (x) { R.wrist('s0', x); if (both) R.wrist('s1', -x, 1.2); R.B.addBeatNow(both ? ['s0', 's1'] : ['s0']); });
      return R;
    }
    var wx = function (R, s) { return R.figs[s || 's0'].pose.joints.wrist[0]; };

    S('beats_add_3_pose_beats_wrist_x_three_values', function () {
      var R = rig(), B = R.B;
      var r1 = (R.wrist('s0', 0), B.addBeatNow(['s0'])), r2 = (R.wrist('s0', 0.3), B.addBeatNow(['s0'])), r3 = (R.wrist('s0', -0.3), B.addBeatNow(['s0']));
      var L = B.list().filter(function (p) { return p.kind === 'pose' && p.slot === 's0'; });
      T.check('beats_add_3_pose_beats_wrist_x_three_values', r1.ok && r2.ok && r3.ok && L.length === 3 && L.map(function (p) { return p.pose.joints.wrist[0]; }).join() === '0,0.3,-0.3' && L.map(function (p) { return p.t; }).join() === '0,1,2' && R.ctx._undos === 3);
    });
    S('beats_unchanged_pose_refused', function () {
      var R = three(rig()), B = R.B, n0 = B.list().length, t0 = B.clock.t;
      var r = B.addBeatNow(['s0']);
      T.check('beats_unchanged_pose_refused', r.ok === false && r.reason === 'unchanged' && B.list().length === n0 && B.clock.t === t0 && /Nothing changed/.test(R.ctx._said[R.ctx._said.length - 1]));
    });
    S('beats_clock_advances_by_gap', function () {
      var R = rig(), B = R.B, t = [];
      R.wrist('s0', 0.1); B.addBeatNow(['s0']); t.push(B.clock.t);
      R.wrist('s0', 0.2); B.addBeatNow(['s0']); t.push(B.clock.t);
      B.setGap(0.5); R.wrist('s0', 0.4); B.addBeatNow(['s0']); t.push(B.clock.t);
      T.check('beats_clock_advances_by_gap', t.join() === '1,2,2.5' && B.clock.gap === 0.5 && B.list().map(function (p) { return p.t; }).join() === '0,1,2');
    });
    S('beats_play_samples_each_beat_time_within_tolerance', function () {
      var R = three(rig()), B = R.B, got = [];
      B.play(0); got.push(wx(R)); R.step(1); got.push(wx(R)); R.step(1); got.push(wx(R));
      T.check('beats_play_samples_each_beat_time_within_tolerance', near(got[0], 0) && near(got[1], 0.3) && near(got[2], -0.3) && B.clock.playing === false && near(B.clock.t, 2, 1e-6));
    });
    S('beats_scrub_equals_join_midway', function () {
      var A = three(rig(), true), Bq = three(rig(), true);
      A.B.play(0); A.step(1.25);
      Bq.B.scrub(1.25);
      var mid = wx(A);
      T.check('beats_scrub_equals_join_midway', A.B.math.same(A.figs, Bq.figs, 1e-9) && mid < 0.3 && mid > -0.3 && near(A.B.clock.t, 1.25, 1e-6) && A.B.math.same(A.B.stateAt(1.25), Bq.B.stateAt(1.25), 0));
    });
    S('beats_pause_resume_same', function () {
      var A = three(rig()), Bq = three(rig());
      A.B.play(0); A.step(0.7); A.B.pause(); var tp = A.B.clock.t, wp = wx(A); A.step(1); var held = A.B.clock.t === tp && wx(A) === wp && !A.B.clock.playing;
      A.B.play(); A.step(0.5);
      Bq.B.play(0); Bq.step(1.2);
      T.check('beats_pause_resume_same', held && A.B.math.same(A.figs, Bq.figs, 1e-9) && near(A.B.clock.t, 1.2, 1e-6));
    });
    S('beats_stop_restores_start_state', function () {
      var R = three(rig(), true), B = R.B, start = cl(R.figs);
      B.play(0); R.step(1.3);
      var moved = !B.math.same(R.figs, start, 1e-6);
      B.stop();
      T.check('beats_stop_restores_start_state', moved && B.math.same(R.figs, start, 1e-9) && B.clock.t === 0 && B.clock.playing === false && B.clock.state === 'stopped');
    });
    S('beats_once_loop_yoyo_math', function () {
      var m = kit.GizmoNext.inst ? null : null, R = rig(), M = R.B.math, mt = function (f, mode) { return M.mapTime(f * 2, 0, 2, mode) / 2; };
      var pts = function (mode, list) { return list.map(function (f) { return mt(f, mode); }).join(); };
      var okMath = pts('once', [0.5, 1.5, 2.5]) === '0.5,1,1' && pts('loop', [0.5, 1.5, 2.5]) === '0.5,0.5,0.5' && pts('yoyo', [0.5, 1.5, 2.5]) === '0.5,0.5,0.5' &&
        pts('once', [0.25, 1.25, 2.25]) === '0.25,1,1' && pts('loop', [0.25, 1.25, 2.25]) === '0.25,0.25,0.25' && pts('yoyo', [0.25, 1.25, 2.25]) === '0.25,0.75,0.25';
      var out = {};
      ['once', 'loop', 'yoyo'].forEach(function (mode) { var Q = three(rig()); Q.B.setMode(mode); Q.B.play(0); Q.step(3); out[mode] = [Q.B.clock.t, Q.B.clock.playing]; });
      T.check('beats_once_loop_yoyo_math', okMath && near(out.once[0], 2, 1e-6) && out.once[1] === false && near(out.loop[0], 1, 1e-6) && out.loop[1] === true && near(out.yoyo[0], 1, 1e-6) && out.yoyo[1] === true);
    });
    S('beats_bracket_loop', function () {
      var R = three(rig()), B = R.B, ok = true;
      var refused = B.setBracket(1.5, 1.52) === false;
      B.setBracket(1, 2); B.setMode('loop'); B.play(1);
      for (var i = 0; i < 150; i++) { R.step(1 / 60 * 1); if (B.clock.t < 1 - 1e-6 || B.clock.t > 2 + 1e-6) ok = false; }
      R.step(0);
      var br = B.clock.bracket;
      B.clearBracket();
      T.check('beats_bracket_loop', refused && ok && br.a === 1 && br.b === 2 && B.clock.bracket === null && B.clock.playing);
    });
    S('beats_smootherstep_monotone_no_overshoot', function () {
      var R = three(rig()), B = R.B, M = B.math, prev = -1, mono = true, inside = true, i;
      for (i = 0; i <= 100; i++) { var v = M.smootherstep(i / 100); if (v < prev - 1e-12) mono = false; if (v < 0 || v > 1) inside = false; prev = v; }
      var path = []; for (i = 0; i <= 100; i++) path.push(B.stateAt(i / 100).s0.pose.joints.wrist[0]);
      var up = path.every(function (v, j) { return j === 0 || v >= path[j - 1] - 1e-12; }) && path[0] === 0 && near(path[100], 0.3, 1e-9) && path.every(function (v) { return v >= -1e-12 && v <= 0.3 + 1e-12; });
      T.check('beats_smootherstep_monotone_no_overshoot', mono && inside && M.smootherstep(0) === 0 && M.smootherstep(1) === 1 && near(M.smootherstep(0.5), 0.5, 1e-12) && up && near(path[50], 0.15, 1e-9));
    });
    S('beats_song_time_wins_when_song_plays', function () {
      var R = three(rig()), B = R.B;
      R.song.t = 5.5; var a = B.time() === 5.5 && B.clock.t === 3;
      R.song.t = 1.0; B.play(0); R.step(0.1);
      var follow = near(B.clock.t, 1.0, 1e-6) && near(wx(R), 0.3);
      R.song.t = null; B.pause();
      T.check('beats_song_time_wins_when_song_plays', a && follow && B.time() === B.clock.t);
    });
    S('beats_fallback_clock_without_song', function () {
      var R = three(rig()), B = R.B;
      B.play(0); R.step(0.5);
      T.check('beats_fallback_clock_without_song', R.song.t === null && near(B.time(), 0.5, 1e-6) && B.time() === B.clock.t);
    });
    S('beats_convert_old_keyframes', function () {
      var R = rig(), B = R.B;
      var frames = [0.1, 0.5, 0.9].map(function (x) { return { poses: { s0: mkPose(x, 1.4), s1: mkPose(-x, 1.2) } }; }), before = JSON.stringify(frames);
      var r = B.convertKeyframes(frames, 1.0);
      var L = B.list().filter(function (p) { return p.slot === 's0'; });
      var R2 = rig(), frames2 = [0.1, 0.2, 0.3].map(function (x) { return { bodies: [{ slot: 's0', pose: mkPose(x, 1.4) }] }; });
      var r2 = R2.B.convertKeyframes(frames2);
      var R3 = rig(), r3 = R3.B.convertKeyframes([mkPose(0, 1), mkPose(1, 1)].map(function (p) { return [{ slot: 's0', pose: p }]; }));
      T.check('beats_convert_old_keyframes', r.ok && L.length === 3 && L.map(function (p) { return p.t; }).join() === '0,1,2' && B.list().length === 6 && JSON.stringify(frames) === before && r2.added === 3 && R2.B.list().map(function (p) { return p.t; }).join() === '0,1,2' && r3.added === 2 &&
        R.B.convertKeyframes([]).ok === false && R.B.convertKeyframes('x').ok === false);
    });
    S('beats_move_prop_beat', function () {
      var R = rig(), B = R.B, P = R.prop;
      P.position.set(0, 0, 0); var a = B.addBeatNow(['prop:p1']);
      P.position.set(2, 0, 0); var b = B.addBeatNow(['prop:p1']);
      var same1 = B.addBeatNow(['prop:p1']);
      var L = B.list().filter(function (p) { return p.kind === 'move'; });
      B.play(0); R.step(0.5);
      var half = near(P.position.x, 1.0, 0.002);
      R.step(0.5); var end = near(P.position.x, 2, 0.002);
      B.stop(); var back = near(P.position.x, 2, 1e-6);
      B.setMode('yoyo'); B.play(0); R.step(1.5); var yo = near(P.position.x, 1.0, 0.002);
      T.check('beats_move_prop_beat', a.ok && b.ok && same1.ok === false && L.length === 2 && L[0].slot === 'prop:p1' && L[0].propId === 'p1' && half && end && back && yo);
    });
    S('beats_save_load_roundtrip', function () {
      var R = three(rig(), true), B = R.B;
      B.add({ slot: 's0', kind: 'look', t: 1, payload: { shader: 'glow', tint: [0.2, 0.4, 0.6] } });
      B.setMode('yoyo'); B.setGap(1.5); B.setSpeed(2); B.setBracket(0.5, 1.5);
      var saved = JSON.parse(JSON.stringify(R.g.state()));
      var Q = rig(); Q.g.load(saved);
      T.check('beats_save_load_roundtrip', saved.parts && saved.parts.beats && B.math.same(Q.B.pins(), B.pins(), 0) && Q.B.pins().length === 7 && Q.B.clock.mode === 'yoyo' && Q.B.clock.gap === 1.5 && Q.B.clock.speed === 2 && Q.B.clock.bracket.a === 0.5);
    });
    S('beats_load_runs_nothing', function () {
      var R = three(rig(), true), saved = cl(R.g.state());
      var Q = rig(); Q.g.load(saved); Q.step(2); Q.g.setLive(true); Q.step(2);
      T.check('beats_load_runs_nothing', Q.B.pins().length === 6 && Q.n.pose === 0 && Q.n.look === 0 && Q.B.clock.playing === false && Q.B.clock.t === 0 && Q.B.clock.state === 'stopped');
    });
    S('beats_hostile_state_ok', function () {
      var R = rig(), B = R.B, threw = false, tries = 0;
      var big = []; for (var i = 0; i < 1000; i++) big.push({ t: i, slot: 's0', kind: 'pose', pose: { a: i } });
      var deep = {}, cur = deep; for (var d = 0; d < 60; d++) { cur.n = {}; cur = cur.n; }
      var evil = JSON.parse('{"pins":[{"id":"__proto__","t":1,"slot":"s0","kind":"pose","pose":{"__proto__":{"polluted":1},"a":1}},{"id":"constructor","t":2,"slot":"__proto__","kind":"pose","pose":{"a":1}}]}');
      var hostile = ['x', 5, null, [], true, { pins: 'x' }, { pins: [1, null, 'a', {}, { t: 'x' }, { t: 1, slot: 's0' }, { t: NaN, slot: 's0', kind: 'pose', pose: { a: 1 } }] }, { pins: big }, { pins: [{ t: 1, slot: 's0', kind: 'pose', pose: deep }] },
        { pins: [{ t: 1e12, slot: 's0', kind: 'pose', pose: { a: 1 } }, { t: -5, slot: 's0', kind: 'pose', pose: { a: 2 } }], mode: 'evil', gap: 'x', speed: 1e9, bracket: { a: 5, b: 1 } }, evil, { pins: [{ t: 1, slot: { x: 1 }, kind: 'pose', pose: { a: 1 } }, { t: 1, slot: 's0', kind: 'Bad Kind!', pose: { a: 1 } }] }];
      hostile.forEach(function (h) {
        tries++;
        try { B.load(h); B.pinsSet(h && h.pins); R.g.load({ parts: { beats: h } }); B.stateAt(1); B.strip.model(); B.strip.rows({}); R.step(0.1); } catch (e) { threw = true; }
      });
      var L = B.list(), clean = L.every(function (p) { return isFinite(p.t) && p.t >= 0 && p.t <= 86400 && typeof p.id === 'string' && p.id !== '__proto__' && p.id !== 'constructor' && p.slot !== '__proto__'; });
      T.check('beats_hostile_state_ok', !threw && tries === hostile.length && clean && L.length <= 300 && ({}).polluted === undefined && B.clock.speed <= 4 && ['once', 'loop', 'yoyo'].indexOf(B.clock.mode) >= 0 && B.pinsSet('nope') === 0);
    });
    S('beats_pins_shape_matches_castpins', function () {
      var R = three(rig(), true), B = R.B;
      B.add({ slot: 's0', kind: 'look', t: 1, payload: { shader: 'glow' } });
      var pins = B.pins(), ok = pins.every(function (p) { return typeof p.id === 'string' && typeof p.t === 'number' && (typeof p.slot === 'string' || typeof p.slot === 'number') && typeof p.kind === 'string' && (p.kind === 'look' ? isObjX(p.look) : isObjX(p.pose)); });
      function isObjX(v) { return !!v && typeof v === 'object'; }
      var again = (B.pinsSet(pins), B.pins());
      var cast = B.pinsSet([{ t: 0, slot: 0, kind: 'pose', pose: { a: 1 } }, { t: 1, slot: 0, kind: 'hand', pose: { f: [0, 1] } }, { t: 2, slot: 0, kind: 'look', look: { s: 'x' } }]);
      var C = B.pins();
      T.check('beats_pins_shape_matches_castpins', ok && pins.length === 7 && B.math.same(again.length, 7, 0) && JSON.stringify(pins) === JSON.stringify(pins.map(function (p) { return p; })) && cast === 3 && C[0].slot === 0 && C[1].kind === 'hand' && C[2].look.s === 'x' && B.stateAt(1)['0'].hand.f[1] === 1);
    });
    S('beats_strip_model_cards', function () {
      var R = three(rig(), true), B = R.B;
      B.add({ slot: 's0', kind: 'look', t: 1, payload: { shader: 'glow' } });
      var M = B.strip.model(), keys = ['id', 't', 'slot', 'thumbKey', 'icons', 'hold'];
      B.setHold(M[1].id, 0.5);
      var M2 = B.strip.model();
      B.strip.select(M2[2].id);
      var M3 = B.strip.model();
      T.check('beats_strip_model_cards', M.length === 3 && keys.every(function (k) { return k in M[0]; }) && M.map(function (c) { return c.t; }).join() === '0,1,2' && M[0].slots.length === 2 && M[0].icons.join() === 'pose' && M[1].icons.indexOf('look') >= 0 && M[0].thumbKey === 'slot:s0' &&
        M2[1].hold === 0.5 && M3[2].selected === true && M3[1].selected === false && M[0].ids.length === 2);
    });
    S('beats_rows_labels_no_em_dash', function () {
      var R = rig(), B = R.B, said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      R.wrist('s0', 0.1); var rows = B.strip.rows(H), labels = rows.map(function (r) { return r.label; });
      var add = rows.filter(function (r) { return r.label === 'Add beat'; })[0];
      add.act(); R.wrist('s0', 0.5); add.act();
      three(R); var rows2 = B.strip.rows(H); rows2.filter(function (r) { return /^Play/.test(r.label); })[0].act();
      var playing = B.clock.playing, label2 = B.strip.rows(H).map(function (r) { return r.label; });
      var all = rows.concat(rows2, B.strip.rows(H)).map(function (r) { return r.label; });
      var G = rig({ guest: true }), grows = G.B.strip.rows(H).map(function (r) { return r.label; });
      var page = R.g.pages('animate').filter(function (p) { return p.id === 'beats'; })[0], prows = R.g.pageRows('beats', H);
      T.check('beats_rows_labels_no_em_dash', labels.indexOf('Add beat') === 0 && labels.indexOf('Stop') > 0 && labels.indexOf('Play') > 0 && labels.indexOf('Loop mode: Once') > 0 && all.every(function (l) { return typeof l === 'string' && !hasDash(l); }) &&
        B.list().length > 0 && playing && label2.indexOf('Pause') >= 0 && grows.every(function (l) { return !/^(Add beat|Play|Stop|Pause|Delete)/.test(l); }) && grows.length >= 1 && !!page && page.label === 'Beat strip' && prows.length >= 5);
    });
    S('beats_tick_cost', function () {
      var R = rig({ slots: ['a', 'b', 'c', 'd'] }), B = R.B;
      for (var i = 0; i < 12; i++) { ['a', 'b', 'c', 'd'].forEach(function (s, j) { R.wrist(s, 0.1 * i + j * 0.01, 1 + j * 0.1); }); B.addBeatNow(['a', 'b', 'c', 'd']); }
      B.setMode('loop'); B.play(0);
      var t0 = kit.ms(); for (var k = 0; k < 1000; k++) R.g.tick(1 / 60); var per = (kit.ms() - t0) / 1000;
      T.value('beats_tick_cost_ms_per_tick', Math.round(per * 10000) / 10000);
      T.check('beats_tick_cost', B.list().length === 48 && B.clock.playing && per < 0.5);
    });

    /* ---- the rules that never bend, and the parts around the clock ---- */
    S('beats_nothing_runs_when_scene_opens', function () {
      var R = three(rig(), true), B = R.B, n0 = R.n.pose;
      R.g.load(cl(R.g.state())); R.g.reset(); three(R); R.g.load(cl(R.g.state()));
      var before = R.n.pose; R.step(10); R.g.setLive(true); R.step(10); R.g.setLive(false);
      T.check('beats_nothing_runs_when_scene_opens', B.clock.playing === false && R.n.pose === before && B.clock.t === 0 && R.g.isLive() === false);
    });
    S('beats_look_spacing_flash_rule', function () {
      var R = rig(), B = R.B, said = R.ctx._said;
      B.add({ slot: 's0', kind: 'look', t: 0, payload: { tint: [0, 0, 0], shader: 'a' } });
      B.add({ slot: 's0', kind: 'look', t: 0.2, payload: { tint: [1, 1, 1], shader: 'b' } });
      B.add({ slot: 's1', kind: 'look', t: 0.3, payload: { tint: [1, 0, 0], shader: 'c' } });
      var times = B.list().filter(function (p) { return p.kind === 'look'; }).map(function (p) { return p.t; });
      var distinct = times.filter(function (t, i) { return times.indexOf(t) === i; }).sort(function (a, b) { return a - b; });
      var spaced = distinct.every(function (t, i) { return i === 0 || t - distinct[i - 1] >= 0.4 - 1e-9; });
      var window1s = distinct.every(function (t) { return distinct.filter(function (u) { return u >= t && u < t + 1; }).length <= 3; });
      var half = B.stateAt(0.4).s0.look.tint[0]; /* s0 blends from 0 to 0.8 s, so 0.4 s is the middle */
      B.load({ pins: [{ t: 0, slot: 's0', kind: 'look', look: { tint: [0, 0, 0] } }, { t: 0.1, slot: 's0', kind: 'look', look: { tint: [1, 1, 1] } }, { t: 0.2, slot: 's0', kind: 'look', look: { tint: [1, 1, 1] }, hold: 9 }] });
      var lt = B.list().map(function (p) { return p.t; });
      T.check('beats_look_spacing_flash_rule', spaced && window1s && times.length === 3 && distinct.join() === '0,0.4,0.8' && near(half, 0.5, 0.05) && said.some(function (t) { return /0\.4 seconds apart/.test(t); }) && lt.join() === '0,0.4,0.8');
    });
    S('beats_guest_cannot_edit_or_play', function () {
      var G = rig({ guest: true }), B = G.B;
      G.wrist('s0', 0.9);
      var r = B.addBeatNow(['s0']), a = B.add({ slot: 's0', kind: 'pose', t: 0, payload: mkPose(0, 1) });
      var seeded = B.pinsSet([{ t: 0, slot: 's0', kind: 'pose', pose: mkPose(0, 1) }, { t: 1, slot: 's0', kind: 'pose', pose: mkPose(1, 1) }]);
      var p = B.play(0), s = B.scrub(1), st = B.stop(), rm = B.remove(B.list()[0].id), md = B.setMode('loop'), cv = B.convertKeyframes([{ poses: { s0: mkPose(0, 1) } }]);
      var dom = kit.makeFakeDom(), host = dom.createElement('div'); B.mountPanel(host);
      var txt = kit.domText(host), buttons = kit.domFind(host, function (e) { return e.tagName === 'BUTTON'; });
      G.g.persist(); var stored = Object.keys(G.ctx.storage._m).length;
      T.check('beats_guest_cannot_edit_or_play', r.ok === false && a === null && seeded === 2 && p === false && s === false && st === false && rm === false && md === false && cv.ok === false && buttons.length === 0 && !/save|export|download/.test(txt) && /beats: 2/.test(txt) && stored === 0 && G.n.pose === 0);
    });
    S('beats_sync_host_guest', function () {
      var mkSide = function () { var f = { s0: { pose: mkPose(0, 1.4), look: { a: 1 } }, s1: { pose: mkPose(0, 1.4), look: { a: 1 } } }; var o = { f: f, n: 0 }; o.pose = { get: function (s) { return cl(f[s].pose); }, apply: function (s, p) { o.n++; f[s].pose = cl(p); } }; o.look = { get: function (s) { return cl(f[s].look); }, apply: function (s, p) { f[s].look = cl(p); } }; return o; };
      var H = mkSide(), Gs = mkSide();
      var hg = kit.makeHostGuest({ host: { pose: H.pose, look: H.look, figures: [{ slot: 's0' }, { slot: 's1' }] }, guest: { pose: Gs.pose, look: Gs.look, figures: [{ slot: 's0' }, { slot: 's1' }] } });
      var hb = hg.host.modules.beats, gb = hg.guest.modules.beats;
      [0, 0.3, -0.3].forEach(function (x) { H.f.s0.pose.joints.wrist = [x, 1.4, 0]; hb.addBeatNow(['s0']); });
      gb.pinsSet(hb.pins());
      hb.play(0); hg.step(0.1);
      var started = gb.clock.playing && gb.clock.state === 'playing';
      hg.step(1.0);
      var together = Math.abs(gb.clock.t - hb.clock.t) < 0.25 && Math.abs(Gs.f.s0.pose.joints.wrist[0] - H.f.s0.pose.joints.wrist[0]) < 0.12;
      hb.pause(); hg.step(0.2);
      var paused = gb.clock.state === 'paused' && !gb.clock.playing;
      var startG = cl(Gs.f.s0.pose);
      hb.stop(); hg.step(0.2);
      var stopped = gb.clock.state === 'stopped' && gb.clock.t === 0 && Gs.f.s0.pose.joints.wrist[0] !== startG.joints.wrist[0];
      var enc = hg.host.sync.encodeAll({});
      var bad = hg.guest.sync.validate('beats', { st: 'playing', t: -1 }) || hg.guest.sync.validate('beats', { st: 'x' }) || hg.guest.sync.validate('beats', { st: 'playing', t: 1, speed: 99, mode: 'once', br: null, h: 'x', n: 1 });
      /* a friend whose list differs waits for the host list */
      var hg2 = kit.makeHostGuest({ host: { pose: mkSide().pose, look: mkSide().look, figures: [{ slot: 's0' }] }, guest: { pose: Gs.pose, look: Gs.look, figures: [{ slot: 's0' }] } });
      var hb2 = hg2.host.modules.beats, gb2 = hg2.guest.modules.beats;
      hb2.add({ slot: 's0', kind: 'pose', t: 0, payload: mkPose(0, 1) }); hb2.add({ slot: 's0', kind: 'pose', t: 1, payload: mkPose(1, 1) });
      hb2.play(0); hg2.step(0.5);
      T.check('beats_sync_host_guest', started && together && paused && stopped && enc.beats && enc.beats.n === 3 && !bad && gb2.clock.playing === false && gb2.list().length === 0);
    });
    S('beats_events_pass_once_per_pass', function () {
      var R = three(rig()), B = R.B, got = [];
      B.add({ slot: 's0', kind: 'say', t: 0.5, payload: { rec: 'vo1' } });
      B.onPass(function (pins, info) { pins.forEach(function (p) { got.push(+(info.to).toFixed(3) + ':' + p.kind); }); });
      var inState = 'say' in (B.stateAt(0.5).s0 || {});
      B.setMode('loop'); B.play(0); R.step(5);
      var loop = got.length; var ts = got.slice();
      got.length = 0; B.stop(); B.setMode('once'); B.play(0); R.step(1); B.pause(); R.step(0.5); B.play(); R.step(1.2); var once = got.length;
      got.length = 0; B.scrub(0.2); B.scrub(1.9); var scrubbed = got.length;
      got.length = 0; B.stop(); B.setMode('yoyo'); B.play(0); R.step(5); var yoyo = got.length;
      T.check('beats_events_pass_once_per_pass', !inState && loop === 3 && once === 1 && scrubbed === 0 && yoyo === 2 && B.list().some(function (p) { return p.kind === 'say' && p.rec === 'vo1'; }) && ts[0].indexOf(':say') > 0);
    });
    S('beats_events_bus_and_stop_listeners', function () {
      var R = three(rig()), B = R.B, ev = [], stops = 0;
      R.g.on('beat-play', function () { ev.push('play'); }); R.g.on('beat-stop', function () { ev.push('stop'); }); B.onStop(function () { stops++; });
      B.play(0); B.stop();
      T.check('beats_events_bus_and_stop_listeners', ev.join() === 'play,stop' && stops === 1);
    });
    S('beats_edit_retime_remove_limits', function () {
      var R = three(rig(), true), B = R.B, M = B.strip.model();
      var one = B.list().filter(function (p) { return p.slot === 's0'; })[1];
      var moved = B.retime(one.id, 1.5) && B.get(one.id).t === 1.5;
      var clash = B.retime(one.id, 0) === false;
      var bm = B.retimeBeat(M[2].id, 3);
      var rmBeat = B.removeBeat(M[0].id);
      var after = B.strip.model();
      var R2 = rig(); for (var i = 0; i < 305; i++) R2.B.add({ slot: 's0', kind: 'pose', t: i, payload: mkPose(i, 1) });
      var gone = B.remove('nothing') === false && B.add(null) === null && B.add({ slot: 's0', kind: 'nonsense kind', t: 0 }) === null;
      var one1 = rig(); one1.wrist('s0', 0.3); one1.B.addBeatNow(['s0']); var cantPlay = one1.B.play(0) === false;
      T.check('beats_edit_retime_remove_limits', moved && clash && bm && rmBeat && after.map(function (c) { return c.t; }).join() === '1,1.5,3' && R2.B.list().length === 300 && gone && cantPlay && R.B.limits.minLookGap === 0.4);
    });
    S('beats_panel_host', function () {
      var R = rig(), B = R.B, dom = kit.makeFakeDom(), host = dom.createElement('div');
      var ok = B.mountPanel(host);
      var btns = kit.domFind(host, function (e) { return e.tagName === 'BUTTON'; }), txt0 = kit.domText(host);
      var byText = function (w) { return btns.filter(function (b) { return b._text === w; })[0]; };
      R.wrist('s0', 0.4); byText('Add beat').click();
      R.wrist('s0', 0.8); byText('Add beat').click();
      var cards = kit.domFind(host, function (e) { return /(^| )gn-card( |$)/.test(e.className || ''); });
      byText('Play').click(); var playing = B.clock.playing;
      var txt = kit.domText(host);
      T.check('beats_panel_host', ok && !!byText('Add beat') && !!byText('Stop') && cards.length === 2 && B.list().length === 3 && playing && !/save|export|download/.test(txt0 + txt) && /beats: 3/.test(txt) && !hasDash(txt));
    });
    S('beats_unchanged_look_and_partial_add', function () {
      var R = rig(), B = R.B;
      R.wrist('s0', 0.2); R.wrist('s1', 0.2);
      var r1 = B.addBeatNow(['s0', 's1'], { look: true });
      R.wrist('s0', 0.9);
      var r2 = B.addBeatNow(['s0', 's1'], { look: true });
      var ids = B.list();
      T.check('beats_unchanged_look_and_partial_add', r1.ok && ids.filter(function (p) { return p.kind === 'look'; }).length === 2 && r2.ok && r2.skipped.length === 3 && ids.filter(function (p) { return p.kind === 'pose'; }).length === 3 && R.ctx._undos === 2);
    });
    S('beats_no_em_dash_in_module_text', function () {
      var R = rig(), B = R.B, said = R.ctx._said, bad = false;
      R.wrist('s0', 0.1); B.addBeatNow(['s0']); B.addBeatNow(['s0']); B.addBeatNow([]); B.play(0); B.convertKeyframes([]); B.add({ slot: 's0', kind: 'look', t: 0, payload: { a: 1 } }); B.add({ slot: 's0', kind: 'look', t: 0.1, payload: { a: 2 } });
      said.forEach(function (t) { if (hasDash(t)) bad = true; });
      T.check('beats_no_em_dash_in_module_text', !bad && said.length >= 4);
    });
  }

  var api = { stage: 'H1', section: 'beats', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H1 = api;
})();
