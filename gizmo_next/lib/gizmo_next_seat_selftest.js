/* gizmo_next_seat_selftest.js: the checks for stage H6 (the seat gizmo's remaining work and the Walk pop-up). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=seat     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_seat.js');

  function run(T, kit) { return kit.isolate(function () { var G = kit.GizmoNext; G._beatsRegister(); G._actionsRegister(); G._triggerRegister(); G._seatRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var guest = function (id, name, x, z) { return kit.makePeer(id, name, [x, 1.6, z], { guest: true }); };

    /* the page's SeatGizmo as seat_gizmo.js has it: records, presets, sitOn, stand */
    function fakeSeatGizmo() {
      var SG = { list: [], H: 0.25, nid: 1, calls: [], PRESETS: { chair: { h: 0.46 }, sofa: { h: 0.40 }, floor: { h: 0 }, bed: { h: 0.50, lie: true } } };
      SG.add = function (spec) { var m = Object.assign({ id: 'q' + (SG.nid++), name: 'Seat', x: 0, y: 0, z: 0, yaw: 0, preset: 'chair', lie: null, locked: false, group: '' }, spec || {}); SG.list.push(m); return m; };
      SG.get = function (id) { return SG.list.find(function (m) { return m.id === id; }) || null; };
      SG.sitOn = function (id) { SG.calls.push(['sitOn', id]); return true; };
      SG.stand = function () { SG.calls.push(['stand']); return true; };
      return SG;
    }
    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), SG = fakeSeatGizmo(), rigCalls = [], poseCalls = [], figCalls = [], dolly = { y: 0, scale: 1 }, peers = o.peers || [], head = o.head || [0, 1.1, 5];
      var g = kit.makeInst({
        clock: clock, head: head, peers: peers, seat: SG, guest: !!o.guest, figures: o.figures || [{ slot: 'f1', stature: 1.6 }, { slot: 'f2' }],
        stature: o.noStature ? undefined : function () { return o.stature || 1.7; },
        floorFn: function (x, z) { return o.floor === undefined ? 0 : (typeof o.floor === 'function' ? o.floor(x, z) : o.floor); },
        surfaceAt: o.surface ? o.surface : undefined,
        sitRig: o.noRig ? undefined : function (who, plan) { rigCalls.push(['sit', who, plan, clock.now()]); dolly.y += plan.lift; g._ctx._head = [g._ctx._head[0], g._ctx._head[1] + plan.lift, g._ctx._head[2]]; },
        standRig: o.noRig ? undefined : function (who, plan) { rigCalls.push(['stand', who, plan, clock.now()]); },
        poseLib: o.noLib ? undefined : { list: function (f) { poseCalls.push(['list', f]); return ['Sit upright', 'Sit cross legged']; }, apply: function (who, n, k) { poseCalls.push(['apply', n, k]); }, clear: function () { poseCalls.push(['clear']); } },
        figureSeat: { sit: function (slot, plan) { figCalls.push(['sit', slot, plan]); }, stand: function (slot, plan) { figCalls.push(['stand', slot, plan]); } }
      });
      g._ctx._walk = { on: o.walk !== false, fly: !!o.fly };
      var R = { g: g, S: g.modules.seat, B: g.modules.beats, SG: SG, rigCalls: rigCalls, poseCalls: poseCalls, figCalls: figCalls, dolly: dolly, peers: peers, ctx: g._ctx, clock: clock };
      R.step = function (sec, hz) { return kit.stepSeconds(g, sec, hz); };
      R.seat = function (spec, fields) { var m = SG.add(spec); if (fields) R.S.setFields(m.id, fields); return m; };
      return R;
    }

    S('seat_popup_at_0_8m_not_at_2m', function () {
      var R = rig(); R.seat({ name: 'Chair', x: 0, z: 0 });
      var near8 = R.S.popup([0, 1.6, 0.75], [0, 0, -1], 1.7), far = R.S.popup([0, 1.6, 2.0], [0, 0, -1], 1.7), edge = R.S.popup([0, 1.6, 0.85], [0, 0, -1], 1.7);
      T.check('seat_popup_at_0_8m_not_at_2m', !!near8 && near8.seatId === 'q1' && near8.label === 'Sit' && near8.anchor.length === 3 && near8.anchor[1] > 0.46 && far === null && edge === null);
    });
    S('seat_popup_needs_facing', function () {
      var R = rig(); R.seat({ x: 0, z: 0 });
      var toward = R.S.popup([0, 1.6, 0.6], [0, 0, -1], 1.7), side = R.S.popup([0, 1.6, 0.6], [1, 0, 0], 1.7), away = R.S.popup([0, 1.6, 0.6], [0, 0, 1], 1.7), tilt = R.S.popup([0, 1.6, 0.6], [0.5, 0, -1], 1.7), tilt2 = R.S.popup([0, 1.6, 0.6], [1.2, 0, -0.5], 1.7), none = R.S.popup([0, 1.6, 0.6], [0, 1, 0], 1.7);
      T.check('seat_popup_needs_facing', !!toward && side === null && away === null && !!tilt && tilt2 === null && none === null);
    });
    S('seat_popup_not_while_flying', function () {
      var R = rig({ fly: true }); R.seat({ x: 0, z: 0 }); var fly = R.S.popup([0, 1.6, 0.5], [0, 0, -1], 1.7);
      R.ctx._walk = { on: false, fly: false }; var off = R.S.popup([0, 1.6, 0.5], [0, 0, -1], 1.7); R.ctx._walk = { on: true, fly: false }; var on = R.S.popup([0, 1.6, 0.5], [0, 0, -1], 1.7);
      R.S.sit('q1'); var seated = R.S.popup([0, 1.6, 0.5], [0, 0, -1], 1.7);
      T.check('seat_popup_not_while_flying', fly === null && off === null && !!on && seated === null);
    });
    S('seat_head_target_0_46_stature_standing_and_sitting_calibration', function () {
      var ok = true, worst = 0;
      [1.5, 1.7, 1.9].forEach(function (st) {
        var R = rig({ stature: st, head: [0, 0.93 * st, 5] }), m = R.seat({ preset: 'chair', x: 0, z: 0 }), head0 = R.ctx._head[1];
        R.S.sit(m.id); var want = 0.46 + 0.46 * st, got = R.ctx._head[1]; worst = Math.max(worst, Math.abs(got - want)); if (Math.abs(got - want) > 0.03) ok = false;
        if (Math.abs(R.S.seatTargetHead(m.id, st) - want) > 1e-9) ok = false; if (Math.abs(R.rigCalls[0][2].lift - (want - head0)) > 1e-3) ok = false;
      });
      var R2 = rig(), sofa = R2.seat({ preset: 'sofa' }), floor = R2.seat({ preset: 'floor' }), bed = R2.seat({ preset: 'bed' });
      T.value('seat_head_target_worst_cm', Math.round(worst * 10000) / 100);
      T.check('seat_head_target_0_46_stature_standing_and_sitting_calibration', ok && near(R2.S.seatTargetHead(sofa.id, 1.7), 0.40 + 0.782, 1e-9) && near(R2.S.seatTargetHead(floor.id, 1.7), 0.782, 1e-9) && near(R2.S.seatTargetHead(bed.id, 1.7), 0.5 + 0.2, 1e-9));
    });
    S('seat_never_scales_body', function () {
      var R = rig({ head: [0, 1.58, 5] }), m = R.seat({ x: 0, z: 0 }); R.S.sit(m.id); R.step(1.2); R.S.stand(); R.step(0.8);
      var plan = R.rigCalls[0][2], exit = R.rigCalls[1][2];
      T.check('seat_never_scales_body', R.dolly.scale === 1 && !('scale' in plan) && !('bodyScale' in plan) && !('scale' in exit) && plan.lift !== 0 && R.rigCalls.length === 2 && plan.walkDisabled === true);
    });
    S('seat_fade_0_25s_and_blend_0_6s_timings', function () {
      var R = rig(); R.seat({ x: 0, z: 0 }, { pose: 'Sit cross legged' }); R.S.sit('q1');
      var phases = []; for (var i = 0; i < 70; i++) { R.step(1 / 60 * 1); phases.push([Math.round((i + 1) / 60 * 1000) / 1000, R.S.phase('me'), R.S.blend('me')]); }
      var at = function (t) { return phases.filter(function (p) { return Math.abs(p[0] - t) < 0.009; })[0]; };
      var firstApply = R.poseCalls.filter(function (c) { return c[0] === 'apply'; }), ks = firstApply.map(function (c) { return c[2]; }), mono = ks.every(function (k, i) { return i === 0 || k >= ks[i - 1] - 1e-9; });
      R.S.stand(); var s0 = R.rigCalls.length; R.step(0.3); var mid = R.S.blend('me'); R.step(0.3);
      T.check('seat_fade_0_25s_and_blend_0_6s_timings', at(0.2)[1] === 'fade' && at(0.2)[2] === 0 && at(0.3)[1] === 'blend' && near(at(0.5)[2], (0.5 - 0.25) / 0.6, 0.03) && at(0.8)[1] === 'blend' && at(0.9)[1] === 'seated' && at(0.9)[2] === 1 && mono && ks[ks.length - 1] === 1 && ks[0] > 0 && near(mid, 1 - 0.3 / 0.5, 0.05) && R.S.phase('me') === 'standing-free' && R.rigCalls.length === s0 + 1 && R.rigCalls[1][0] === 'stand' && R.rigCalls[0][2].fadeSec === 0.25 && R.rigCalls[0][2].blendSec === 0.6);
    });
    S('seat_stand_returns_to_floor_in_front', function () {
      var R = rig({ floor: function (x, z) { return z < -0.5 ? 0.12 : 0; } }), m = R.seat({ x: 1, z: 2, yaw: 0 }); R.S.sit(m.id); R.step(1); R.S.stand(); R.step(0.6);
      var e = R.rigCalls[1][2], R2 = rig(), m2 = R2.seat({ x: 1, z: 2, yaw: Math.PI / 2 }); R2.S.sit(m2.id); R2.step(1); R2.S.stand(); R2.step(0.6); var e2 = R2.rigCalls[1][2];
      T.check('seat_stand_returns_to_floor_in_front', near(e.x, 1, 1e-3) && near(e.z, 2 - 0.7, 1e-3) && near(e.y, 0) && near(e.yaw, 0, 1e-3) && near(e2.x, 1 - 0.7, 1e-3) && near(e2.z, 2, 1e-3) && near(Math.abs(e2.yaw), Math.PI / 2, 1e-3) && R.S.seated('me') === null && R.S.occupant('q1') === null);
    });
    S('seat_exit_direction_applies', function () {
      var R = rig(), m = R.seat({ x: 0, z: 0, yaw: 0 }, { useExit: true, exit: [1, 0] }); R.S.sit(m.id); R.step(1); R.S.stand(); R.step(0.6);
      var right = R.rigCalls[1][2];
      var R2 = rig(), m2 = R2.seat({ x: 0, z: 0, yaw: 0 }, { useExit: false, exit: [1, 0] }); R2.S.sit(m2.id); R2.step(1); R2.S.stand(); R2.step(0.6); var ignored = R2.rigCalls[1][2];
      var R3 = rig(), m3 = R3.seat({ x: 0, z: 0, yaw: Math.PI / 2 }, { useExit: true, exit: [0, 5] }); var p3 = R3.S.exitPoint(m3.id);
      T.check('seat_exit_direction_applies', near(right.x, 0.7, 1e-3) && near(right.z, 0, 1e-3) && near(right.yaw, -Math.PI / 2, 1e-3) && near(ignored.z, -0.7, 1e-3) && near(ignored.x, 0, 1e-3) && near(p3.x, 0.7, 1e-3) && R3.S.fields(m3.id).exit.join() === '0,1');
    });
    S('seat_stick_ignored_while_seated', function () {
      var R = rig(); R.seat({ x: 0, z: 0 }); var free = R.S.onStick('me', 0, 1); R.S.sit('q1'); R.step(1);
      var a = R.S.onStick('me', 0.9, 0.2), b = R.S.onStick('me', -0.9, -0.9), c = R.S.onStick('me', 0, 0.5), still = R.S.seated('me'), d = R.S.onStick('me', 0, 0.9); R.step(0.6);
      T.check('seat_stick_ignored_while_seated', free === 'free' && a === 'ignored' && b === 'ignored' && c === 'ignored' && still === 'q1' && d === 'stand' && R.S.seated('me') === null && R.S.onStick('me', 0, 1) === 'free');
    });
    S('seat_taken_refuses_second', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }); R.seat({ x: 0, z: 0 });
      var a = R.S.sit('q1'), b = R.S.sit('q1', R.peers[0]), said = R.ctx._said.slice(-1)[0]; R.S.stand(); R.step(0.6); var c = R.S.sit('q1', R.peers[0]);
      var R2 = rig({ peers: [guest('g1', 'Rosa', 40, 40)] }); R2.seat({ x: 0, z: 0 }, { oneAtATime: false }); R2.S.sit('q1'); var d = R2.S.sit('q1', R2.peers[0]);
      T.check('seat_taken_refuses_second', a === true && b === false && /taken/.test(said) && !hasDash(said) && c === true && R.S.occupant('q1') === 'g1' && d === true);
    });
    S('seat_library_pose_applies', function () {
      var R = rig(); R.seat({ x: 0, z: 0 }, { pose: 'Sit cross legged' }); R.S.sit('q1'); R.step(1);
      var applies = R.poseCalls.filter(function (c) { return c[0] === 'apply'; }); R.S.stand(); R.step(0.7);
      var all = applies.concat(R.poseCalls.filter(function (c) { return c[0] === 'apply'; }).slice(applies.length));
      T.check('seat_library_pose_applies', applies.length > 20 && applies.every(function (c) { return c[1] === 'Sit cross legged'; }) && applies[applies.length - 1][2] === 1 && R.poseCalls.some(function (c) { return c[0] === 'clear'; }) && R.S.poses().join() === 'Sit upright,Sit cross legged' && R.poseCalls.filter(function (c) { return c[0] === 'apply'; }).slice(-1)[0][2] === 0);
    });
    S('seat_default_pose_when_library_missing', function () {
      var R = rig({ noLib: true }); R.seat({ x: 0, z: 0 }, { pose: 'Sit cross legged' }); var ok = R.S.sit('q1'); R.step(1.5);
      var R2 = rig(); R2.seat({ x: 0, z: 0 }); R2.S.sit('q1'); R2.step(1);
      T.check('seat_default_pose_when_library_missing', ok === true && R.S.phase('me') === 'seated' && R.poseCalls.length === 0 && /pose library is not connected/.test(R.ctx._said.join(' ')) && R.S.poses().length === 0 && R2.poseCalls.filter(function (c) { return c[0] === 'apply'; }).length === 0);
    });
    S('seat_who_filter', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }); R.seat({ x: 0, z: 0 }, { who: 'guests' });
      var host = R.S.sit('q1'), msg1 = R.ctx._said.slice(-1)[0], gst = R.S.sit('q1', R.peers[0]);
      var R2 = rig({ peers: [guest('g1', 'Rosa', 40, 40)] }); R2.seat({ x: 0, z: 0 }, { who: 'named', names: ['rosa'] }); var meN = R2.S.sit('q1'), rosa = R2.S.sit('q1', R2.peers[0]);
      var R3 = rig({ peers: [guest('g1', 'Rosa', 40, 40)] }); R3.seat({ x: 0, z: 0 }, { who: 'me' }); var gu = R3.S.sit('q1', R3.peers[0]), me = R3.S.sit('q1');
      var pop = rig(); pop.seat({ x: 0, z: 0 }, { who: 'guests' });
      T.check('seat_who_filter', host === false && /not for you/.test(msg1) && gst === true && meN === false && rosa === true && gu === false && me === true && pop.S.popup([0, 1.6, 0.5], [0, 0, -1], 1.7) === null);
    });
    S('seat_figure_sits_and_stands', function () {
      var R = rig(); R.seat({ x: 0, z: 0, preset: 'sofa' }); var a = R.S.figureSit('f1', 'q1'), plan = R.figCalls[0][2];
      var meTry = R.S.sit('q1'), meMsg = R.ctx._said.slice(-1)[0], other = R.S.figureSit('f2', 'q1'); var b = R.S.figureStand('f1'), exit = R.figCalls[1][2], again = R.S.figureStand('f1'), c = R.S.figureSit('f2', 'q1');
      var none = R.S.figureSit('f1', 'nope');
      T.check('seat_figure_sits_and_stands', a === true && near(plan.headTarget, 0.40 + 0.46 * 1.6, 1e-3) && plan.fadeSec === 0 && meTry === false && /taken/.test(meMsg) && other === false && b === true && near(exit.z, -0.7, 1e-3) && again === false && c === true && none === false && R.S.occupant('q1') === 'fig:f2');
    });
    S('seat_beat_action_sits_figure', function () {
      var R = rig(); R.seat({ x: 0, z: 0 }); var B = R.B, A = R.g.modules.actions;
      B.pinsSet([{ id: 'a', t: 0, slot: 'f1', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 4, slot: 'f1', kind: 'pose', pose: { x: 1 } }]);
      var p = A.add({ kind: 'seat', slot: 'f1', seatId: 'q1', t: 1 }), q = A.add({ kind: 'seat', slot: 'f1', seatId: 'stand', t: 2.5 }), v = A.add({ kind: 'seat', slot: 'f1', t: 3 });
      B.play(0); R.step(1.5); var sat = R.figCalls.filter(function (c) { return c[0] === 'sit'; }).length; R.step(1.5); var stood = R.figCalls.filter(function (c) { return c[0] === 'stand'; }).length;
      T.check('seat_beat_action_sits_figure', !!p && !!q && v.seatId === 'stand' && sat === 1 && stood >= 1 && R.S.occupant('q1') === null && A.hold(B.get(p.id)) === 0.6 && R.figCalls[0][1] === 'f1');
    });
    S('seat_events_enter_exit', function () {
      var R = rig(), ev = []; R.g.on('seat', function (e) { ev.push(e.seatId + ':' + e.who + ':' + e.state); }); R.seat({ x: 0, z: 0 });
      R.S.sit('q1'); R.step(1); R.S.stand(); R.step(0.6); R.S.figureSit('f1', 'q1'); R.S.figureStand('f1');
      T.check('seat_events_enter_exit', ev.join() === 'q1:me:enter,q1:me:exit,q1:fig:f1:enter,q1:fig:f1:exit');
    });
    S('seat_json_roundtrip', function () {
      var R = rig(); R.seat({ name: 'A', x: 1 }, { pose: 'Sit upright', useExit: true, exit: [1, 0], who: 'named', names: ['Rosa'], oneAtATime: false, nudge: [0.05, 0.02, -0.04], autoHeight: true }); R.seat({ name: 'B', x: 2 });
      var saved = cl(R.g.state()), Q = rig(); Q.seat({ name: 'A', x: 1 }); Q.seat({ name: 'B', x: 2 }); Q.g.load(saved); Q.step(3); Q.g.setLive(true); Q.step(3);
      var f = Q.S.fields('q1');
      T.check('seat_json_roundtrip', saved.parts.seat.extras.q1.pose === 'Sit upright' && !('q2' in saved.parts.seat.extras) && f.pose === 'Sit upright' && f.useExit === true && f.exit.join() === '1,0' && f.who === 'named' && f.names.join() === 'Rosa' && f.oneAtATime === false && f.nudge.join() === '0.05,0.02,-0.04' && f.autoHeight === true && Q.rigCalls.length === 0 && Q.S.seated('me') === null);
    });
    S('seat_labels_no_em_dash', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }), m = R.seat({ x: 0, z: 0 }, { who: 'named' }), said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      var rows = R.S.rows(m.id, H), labels = rows.map(function (r) { return r.label; });
      rows.forEach(function (r) { if (r.label !== 'Sit here') r.act(); }); var again = R.S.rows(m.id, H).map(function (r) { return r.label; }); R.S.rows(m.id, H).filter(function (r) { return r.label === 'Sit here'; })[0].act(); var stand = R.S.rows(m.id, H).map(function (r) { return r.label; });
      var G = rig({ guest: true }); G.seat({}); G.S.sit('q1');
      T.check('seat_labels_no_em_dash', labels[0] === 'Defaults: Pose Default sit, one person at a time, stand in front' && labels.indexOf('Sit here') > 0 && labels.indexOf('Use Custom Exit Direction: off') > 0 && labels.some(function (l) { return /^Add name: Rosa/.test(l); }) && stand.indexOf('Stand') > 0 && labels.concat(again, stand, said, R.ctx._said, R.g.logList().map(function (e) { return e.what; })).every(function (l) { return !hasDash(l); }) && G.S.rows('q1', H).length === 0 && R.ctx._undos >= 8);
    });

    /* ---- the rest of the contract ---- */
    S('seat_height_auto_from_surface', function () {
      var R = rig({ surface: function (x, z) { return 0.52; } }), m = R.seat({ x: 0, z: 0, preset: 'chair' }), preset = R.S.seatTargetHead(m.id, 1.7);
      R.S.setFields(m.id, { autoHeight: true }); var auto = R.S.seatTargetHead(m.id, 1.7);
      var R2 = rig({ surface: function () { return 5; } }), m2 = R2.seat({ x: 0, z: 0 }, { autoHeight: true }), absurd = R2.S.seatTargetHead(m2.id, 1.7);
      var R3 = rig(), m3 = R3.seat({ x: 0, z: 0 }, { autoHeight: true, nudge: [0, 0.03, 0] }), noAdapter = R3.S.seatTargetHead(m3.id, 1.7);
      T.check('seat_height_auto_from_surface', near(preset, 0.46 + 0.782, 1e-9) && near(auto, 0.52 + 0.782, 1e-9) && near(absurd, 0.46 + 0.782, 1e-9) && near(noAdapter, 0.46 + 0.03 + 0.782, 1e-9));
    });
    S('seat_nudge_moves_anchor_and_is_clamped', function () {
      var R = rig(), m = R.seat({ x: 1, z: 1, yaw: 0 }, { nudge: [0.1, 0, -0.1] }), a = R.S.sit(m.id), plan = R.rigCalls[0][2];
      var f = R.S.setFields(m.id, { nudge: [9, -9, 9] });
      var R2 = rig(), m2 = R2.seat({ x: 1, z: 1, yaw: Math.PI / 2 }, { nudge: [0.1, 0, 0] }); R2.S.sit(m2.id);
      T.check('seat_nudge_moves_anchor_and_is_clamped', a && near(plan.anchor[0], 1.1, 1e-3) && near(plan.anchor[2], 0.9, 1e-3) && f.nudge.join() === '0.3,-0.3,0.3' && near(R2.rigCalls[0][2].anchor[2], 0.9, 1e-3) && near(R2.rigCalls[0][2].anchor[0], 1, 1e-3));
    });
    S('seat_hostile_clamped', function () {
      var R = rig(), m = R.seat({ x: 0, z: 0 }), threw = false, evil = JSON.parse('{"v":1,"extras":{"q1":{"pose":5,"useExit":"y","exit":[0,0],"who":{"a":1},"names":' + JSON.stringify(new Array(80).fill('n')) + ',"nudge":[1e99,"x",null],"oneAtATime":3,"autoHeight":1,"__proto__":{"polluted":1}},"__proto__":{"polluted":2},"../x":{},"q9":5},"turn":-3}');
      try { R.g.load({ parts: { seat: evil } }); R.g.load({ parts: { seat: 'x' } }); R.g.load({ parts: { seat: evil } }); R.S.setFields('nope', {}); R.S.setFields(m.id, null); R.S.sit(null); R.S.sit('nope'); R.S.stand('nobody'); R.S.popup(null, null, null); R.S.popup([NaN, 1, 1], [0, 0, -1], 1); R.S.figureSit(null, null); R.S.onStick(null, NaN, NaN); R.S.rows('nope', {}); R.S.exitPoint('nope'); R.S.seatTargetHead('nope'); }
      catch (e) { threw = e; }
      var f = R.S.fields('q1');
      T.check('seat_hostile_clamped', !threw && ({}).polluted === undefined && f.pose === 'default' && f.useExit === false && f.exit.join() === '0,-1' && f.who === 'everyone' && f.names.length <= 24 && f.oneAtATime === true && f.autoHeight === false && f.nudge.join() === '0,0,0');
    });
    S('seat_popup_skips_taken_and_picks_nearest', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }); R.seat({ name: 'Far', x: 0, z: -0.6 }); R.seat({ name: 'Near', x: 0.1, z: -0.2 });
      var best = R.S.popup([0, 1.6, 0], [0, 0, -1], 1.7); R.S.sit('q2', R.peers[0]); var next = R.S.popup([0, 1.6, 0], [0, 0, -1], 1.7);
      T.check('seat_popup_skips_taken_and_picks_nearest', best.seatId === 'q2' && next.seatId === 'q1');
    });
    S('seat_nothing_runs_when_scene_opens', function () {
      var R = rig(); R.seat({ x: 0, z: 0 }, { pose: 'Sit upright' }); var saved = cl(R.g.state()), Q = rig({ head: [0, 1.6, 0] }); Q.seat({ x: 0, z: 0 }); Q.g.load(saved); Q.step(5); Q.g.setLive(true); Q.step(5);
      T.check('seat_nothing_runs_when_scene_opens', Q.rigCalls.length === 0 && Q.SG.calls.length === 0 && Q.poseCalls.filter(function (c) { return c[0] === 'apply'; }).length === 0 && Q.S.seated('me') === null);
    });
    S('seat_without_rig_uses_page_seat', function () {
      var R = rig({ noRig: true }); R.seat({ x: 0, z: 0 }); var ok = R.S.sit('q1'); R.step(1); R.S.stand(); R.step(0.6);
      T.check('seat_without_rig_uses_page_seat', ok === true && R.SG.calls.map(function (c) { return c[0]; }).join() === 'sitOn,stand');
    });
    S('seat_trigger_start_sits_visitor', function () {
      var p = guest('g1', 'Rosa', 0, 0), R = rig({ peers: [p], head: [0, 1.6, 30] }); R.seat({ name: 'Chair', x: 5, z: 5 }); R.g.setLive(true);
      R.g.modules.trigger.add({ x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, who: 'guests', starts: [{ do: 'seat', arg: 'q1', delay: 0 }] }); R.step(0.3);
      T.check('seat_trigger_start_sits_visitor', R.S.occupant('q1') === 'g1' && R.g.logList().some(function (e) { return /Rosa sat on Chair/.test(e.what); }) && R.rigCalls.length === 0);
    });
  }

  var api = { stage: 'H6', section: 'seat', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H6 = api;
})();
