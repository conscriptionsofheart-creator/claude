/* gizmo_next_effects_selftest.js: the checks for stage H8 (the Effects gizmo, particles and trail). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=effects     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_effects.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._beatsRegister(); kit.GizmoNext._actionsRegister(); kit.GizmoNext._effectsRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };

    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), props = o.props || [], hands = { left: [0, 1, 0], right: [0, 1, 0] };
      var g = kit.makeInst({ clock: clock, props: props, guest: !!o.guest, hand: function (side) { return hands[side]; }, particleFlow: o.particleFlow });
      var R = { g: g, E: g.modules.effects, B: g.modules.beats, A: g.modules.actions, clock: clock, props: props, hands: hands, ctx: g._ctx };
      R.step = function (sec, hz) { return kit.stepSeconds(g, sec, hz); };
      R.live = function () { g.setLive(true); return R; };
      R.add = function (over) { return R.E.add(Object.assign({ x: 0, y: 1, z: 0, tab: 'particles', preset: 'sparks' }, over || {})); };
      R.layerCount = function () { var L = R.E.layer(); return L ? L.children.length : 0; };
      return R;
    }

    S('fx_kind_registered_and_placeable', function () {
      var R = rig(), a = R.add(), n = 1; while (R.E.add({}) ) n++;
      var rec = R.E.get(a.id), mk = rec._mk;
      T.check('fx_kind_registered_and_placeable', !!a && a.id.indexOf('effects') === 0 && n === 12 && R.E.list().length === 12 && !!R.g._kinds.effects && R.g._kinds.effects.spec.col === '#e86cd2' && !!mk && mk.userData.gizmoKind === 'effects' && rec.looping === false && rec.playOnStart === false && rec.startColor === '#ffd166' && rec.follow === null);
    });
    S('fx_silent_on_open_state_stop', function () {
      var R = rig().live(), a = R.add({ playOnStart: true, looping: true, preset: 'smoke' });
      var saved = JSON.parse(JSON.stringify(R.g.state())), txt = JSON.stringify(saved);
      var R2 = rig(); R2.g.load(saved); R2.step(1);
      var b = R2.E.list()[0];
      /* a scene saved live reopens live and still plays nothing; turning live on by hand starts Play on Start */
      var R3 = rig(); saved.live = true; R3.g.load(saved); R3.step(1); var quiet = R3.E.total() + (R3.E.modeOf(a.id) === 'stop' ? 0 : 1);
      R3.g.setLive(false); R3.g.setLive(true); R3.step(0.5);
      T.check('fx_silent_on_open_state_stop', !!b && b.playOnStart === true && R2.E.modeOf(b.id) === 'stop' && R2.E.total() === 0 && txt.indexOf('"mode"') < 0 && txt.indexOf('sims') < 0 && R2.layerCount() === 0 && R3.g.isLive() && quiet === 0 && R3.E.modeOf(a.id) === 'loop' && R3.E.total() > 0);
    });
    S('fx_play_once_ends_alone', function () {
      var R = rig().live(), a = R.add({ preset: 'sparks' }), ends = 0; R.g.on('fx', function (e) { if (e.state === 'end') ends++; });
      R.E.play(a.id, 'once'); R.step(0.1); var during = R.E.count(a.id), mode1 = R.E.modeOf(a.id);
      R.step(3); var after = R.E.count(a.id), mode2 = R.E.modeOf(a.id);
      T.check('fx_play_once_ends_alone', during > 0 && mode1 === 'once' && after === 0 && mode2 === 'stop' && ends === 1);
    });
    S('fx_loop_runs_until_stop', function () {
      var R = rig().live(), a = R.add({ preset: 'confetti' });
      R.E.play(a.id, 'loop'); R.step(6); var c1 = R.E.count(a.id); R.step(6); var c2 = R.E.count(a.id), m = R.E.modeOf(a.id);
      R.E.stop(a.id); R.step(0.1);
      T.check('fx_loop_runs_until_stop', c1 > 20 && c2 > 20 && m === 'loop' && R.E.modeOf(a.id) === 'stop' && R.E.count(a.id) === 0);
    });
    S('fx_stop_clears_all_particles', function () {
      var R = rig().live(), a = R.add({ preset: 'smoke' });
      R.E.play(a.id, 'loop'); R.step(3); var before = R.E.count(a.id), o = R.E.object(a.id), draw1 = o && o.geometry.drawRange.count;
      R.E.stop(a.id); var after = R.E.count(a.id), draw2 = o.geometry.drawRange.count;
      T.check('fx_stop_clears_all_particles', before > 30 && draw1 === before && after === 0 && draw2 === 0 && R.E.total() === 0);
    });
    S('fx_trail_follows_moving_target', function () {
      var R = rig().live(), prop = { id: 'ball', name: 'Ball', object: { position: { x: 0, y: 1, z: 0 } }, tags: [] }; R.props.push(prop);
      var a = R.add({ tab: 'trail', preset: 'default', follow: 'ball', length: 2 });
      R.E.play(a.id, 'loop');
      for (var i = 0; i < 120; i++) { prop.object.position.x += 0.02; R.step(1 / 60); }
      var pts = R.E.trail(a.id), head = pts[pts.length - 1], tail = pts[0], path = 0;
      for (var j = 1; j < pts.length; j++) path += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z);
      var hand = R.add({ tab: 'trail', follow: 'hand-right' }); R.E.play(hand.id, 'loop'); for (var k = 0; k < 30; k++) { R.hands.right = [k * 0.03, 1, 0.5]; R.step(1 / 60); }
      var hp = R.E.trail(hand.id);
      T.check('fx_trail_follows_moving_target', pts.length > 10 && near(head.x, prop.object.position.x, 0.03) && tail.x < head.x - 0.5 && path <= 2.05 && hp.length > 5 && near(hp[hp.length - 1].x, R.hands.right[0], 0.04) && !!R.E.object(a.id));
    });
    S('fx_trail_stop_clears', function () {
      var R = rig().live(), prop = { id: 'ball', name: 'Ball', object: { position: { x: 0, y: 1, z: 0 } }, tags: [] }; R.props.push(prop);
      var a = R.add({ tab: 'trail', follow: 'ball' }); R.E.play(a.id, 'loop');
      for (var i = 0; i < 60; i++) { prop.object.position.x += 0.03; R.step(1 / 60); }
      var before = R.E.trail(a.id).length, vis = R.E.object(a.id).visible; R.E.stop(a.id);
      T.check('fx_trail_stop_clears', before > 10 && vis === true && R.E.trail(a.id).length === 0 && R.E.modeOf(a.id) === 'stop');
    });
    S('fx_stop_play_same_frame_waits_two_frames', function () {
      var R = rig().live(), a = R.add({ preset: 'sparks' });
      R.E.play(a.id, 'loop'); R.step(1); R.E.stop(a.id); R.E.play(a.id, 'loop');
      var waiting = R.E.waiting(a.id), c0 = R.E.count(a.id);
      R.step(1 / 60); var c1 = R.E.count(a.id), w1 = R.E.waiting(a.id);
      R.step(1 / 60); R.step(1 / 60); var c2 = R.E.count(a.id), w2 = R.E.waiting(a.id);
      /* two frames apart is not a same-frame restart */
      var b = R.add({ x: 3 }); R.E.play(b.id, 'loop'); R.step(1); R.E.stop(b.id); R.step(2 / 60); R.E.play(b.id, 'loop'); var direct = R.E.waiting(b.id);
      T.check('fx_stop_play_same_frame_waits_two_frames', waiting === true && c0 === 0 && c1 === 0 && w1 === true && w2 === false && c2 > 0 && direct === false);
    });
    S('fx_budget_cap_600_holds_with_many_gizmos', function () {
      var R = rig().live(), ids = [], i;
      for (i = 0; i < 12; i++) ids.push(R.add({ x: i, preset: i % 2 ? 'sparks' : 'smoke' }).id);
      ids.forEach(function (id) { R.E.play(id, 'loop'); });
      var worst = 0, seen = 0; for (i = 0; i < 360; i++) { R.step(1 / 60); var t = R.E.total(); if (t > worst) worst = t; }
      seen = R.E.total();
      var half = rig({ particleFlow: { budget: function () { return 1000; }, used: function () { return 700; } } }).live(), hs = [0, 1, 2, 3, 4, 5].map(function (n) { return half.add({ x: n, preset: 'sparks' }); }); hs.forEach(function (h) { half.E.play(h.id, 'loop'); }); var worst2 = 0; for (i = 0; i < 240; i++) { half.step(1 / 60); worst2 = Math.max(worst2, half.E.total()); }
      T.value('fx_budget_worst_total', worst);
      T.check('fx_budget_cap_600_holds_with_many_gizmos', worst <= 600 && seen > 400 && R.E.budget() === 600 && R.E.setBudget(100000) === 2000 && R.E.setBudget(1) === 50 && worst2 <= 300 && worst2 > 200);
    });
    S('fx_colour_changes_at_most_3_per_second', function () {
      var R = rig().live(), a = R.add({ preset: 'sparks', startColor: '#000000', endColor: '#000000' });
      R.E.play(a.id, 'loop'); R.step(0.2);
      var raw = [], shown = [], worstStep = 0, last = null;
      for (var i = 0; i < 180; i++) {
        var c = i % 2 ? '#ffffff' : '#000000'; R.E.setFields(a.id, { startColor: c, endColor: c }); raw.push(i % 2 ? 1 : 0);
        R.step(1 / 60); var sc = R.E.shownColors(a.id).start[0]; shown.push(sc); if (last !== null) worstStep = Math.max(worstStep, Math.abs(sc - last)); last = sc;
      }
      /* a slow ask: each swap held for 0.5 s is 2 a second, and passes */
      var slow = []; for (var j = 0; j < 240; j++) slow.push(Math.floor(j / 30) % 2);
      T.value('fx_colour_worst_step_per_frame', Math.round(worstStep * 100000) / 100000);
      T.check('fx_colour_changes_at_most_3_per_second', R.E.flashSafe(shown) === true && R.E.flashSafe(raw) === false && worstStep <= 2.5 / 60 + 1e-6 && R.E.flashSafe(slow) === true);
    });
    S('fx_alpha_fade_at_least_0_4s', function () {
      var R = rig(), A = R.E.alphaAt, worst = 0, last = A(0, 1), x;
      [[0.8], [1.6], [2.6]].forEach(function (L) { last = 0; for (var t = 0; t <= L[0] + 1e-9; t += 1 / 60) { x = A(t, L[0]); worst = Math.max(worst, Math.abs(x - last) * 60); last = x; } });
      var P = R.E.presets(), minLife = Math.min.apply(null, Object.keys(P).map(function (k) { return P[k].life[0]; }));
      /* the trail ribbon fades in over at least 0.4 s too */
      var a = R.live().add({ tab: 'trail' }); var prop = { id: 'b', name: 'b', object: { position: { x: 0, y: 1, z: 0 } }, tags: [] }; R.props.push(prop); R.E.setFields(a.id, { follow: 'b' }); R.E.play(a.id, 'loop');
      var gains = [], lastG = 0, gw = 0; for (var i = 0; i < 60; i++) { prop.object.position.x += 0.02; R.step(1 / 60); var o = R.E.object(a.id); gains.push(o ? o.geometry.attributes.color.array[o.geometry.attributes.color.array.length - 1] : 0); }
      T.value('fx_alpha_worst_per_second', Math.round(worst * 1000) / 1000);
      T.check('fx_alpha_fade_at_least_0_4s', worst <= 2.5 + 1e-6 && minLife >= 0.8 && near(R.E.alphaAt(0.2, 2), 0.5, 1e-9) && R.E.alphaAt(1, 2) === 1 && near(R.E.alphaAt(1.8, 2), 0.5, 1e-9));
    });
    S('fx_flashSafe_rejects_strobe', function () {
      var R = rig(), E = R.E, strobe = [], slow = [], steady = [], i;
      for (i = 0; i < 120; i++) { strobe.push(Math.floor(i / 5) % 2); slow.push(Math.floor(i / 30) % 2); steady.push(0.5 + 0.1 * Math.sin(i / 7)); }
      var timed = []; for (i = 0; i < 20; i++) timed.push({ t: i * 0.1, v: i % 2 }); 
      var edge3 = [0, 1, 0, 1].reduce(function (a, v) { for (var k = 0; k < 20; k++) a.push(v); return a; }, []);
      T.check('fx_flashSafe_rejects_strobe', E.flashSafe(strobe) === false && E.flashSafe(slow) === true && E.flashSafe(steady) === true && E.flashSafe(timed) === false && E.flashSafe(edge3) === true && E.flashSafe([]) === true && E.flashSafe(null) === true && E.flashSafe([0, 1, 0, 1, 0, 1], 1) === true && E.flashSafe([0, 1, 0, 1, 0, 1], 60) === false);
    });
    S('fx_beat_starts_and_stops_it', function () {
      var R = rig().live(), a = R.add({ preset: 'confetti' }), B = R.B, A = R.A;
      B.pinsSet([{ id: 'p0', t: 0, slot: 'f1', kind: 'pose', pose: { x: 0 } }, { id: 'p1', t: 8, slot: 'f1', kind: 'pose', pose: { x: 1 } }]);
      var p = A.add({ kind: 'effect', slot: 'f1', gizmoId: a.id, mode: 'loop', t: 1 }), q = A.add({ kind: 'effect', slot: 'f1', gizmoId: a.id, mode: 'stop', t: 4 }), bad = A.add({ kind: 'effect', slot: 'f1', t: 6, mode: 'weird' });
      B.play(0); R.step(0.5); var before = R.E.modeOf(a.id); R.step(1.5); var running = R.E.modeOf(a.id), n = R.E.count(a.id); R.step(2.5); var stopped = R.E.modeOf(a.id);
      /* Stop on the strip also stops a loop a beat started */
      var b2 = R.add({ x: 4 }); var r = A.add({ kind: 'effect', slot: 'f1', gizmoId: b2.id, mode: 'loop', t: 1 }); B.play(0); R.step(2); var up = R.E.modeOf(b2.id); B.stop(); var down = R.E.modeOf(b2.id);
      T.check('fx_beat_starts_and_stops_it', !!p && !!q && bad.mode === 'once' && before === 'stop' && running === 'loop' && n > 0 && stopped === 'stop' && R.E.count(a.id) === 0 && up === 'loop' && down === 'stop' && R.A.isKnown('effect'));
    });
    S('fx_live_off_never_plays', function () {
      var R = rig(), a = R.add({ playOnStart: true }), p = R.E.play(a.id, 'loop'), msg = R.ctx._said.slice(-1)[0];
      R.step(2); var off = R.E.total();
      /* Preview is her own press and plays once even with live off */
      var pv = R.E.preview(a.id); R.step(0.3); var prev = R.E.count(a.id);
      R.live(); R.E.stop(a.id); R.step(0.1); R.g.setLive(false); R.step(0.1);
      var gh = rig({ guest: true }), gp = gh.E.play('effects1', 'loop'), gm = gh.ctx._said.slice(-1)[0];
      T.check('fx_live_off_never_plays', p === false && /live/i.test(msg) && off === 0 && pv === true && prev > 0 && R.E.total() === 0 && gp === false && /host/i.test(gm));
    });
    S('fx_hide_gizmos_hides_box_not_effect', function () {
      var R = rig().live(), a = R.add({ preset: 'smoke' }), rec = R.E.get(a.id);
      R.E.play(a.id, 'loop'); R.step(1.5);
      R.ctx.gizmos.setAll(true); R.step(1.2);
      var boxHidden = rec._mk.visible === false, obj = R.E.object(a.id), fxVisible = !!obj && obj.visible === true && obj.geometry.drawRange.count > 0 && obj.userData.isMarker !== true;
      var inMarkerGroup = !!(obj && obj.parent === rec._mk);
      R.ctx.gizmos.setAll(false); R.step(0.5);
      T.check('fx_hide_gizmos_hides_box_not_effect', boxHidden && fxVisible && !inMarkerGroup && rec._mk.visible === true && R.E.count(a.id) > 0);
    });
    S('fx_json_roundtrip_nothing_plays', function () {
      var R = rig().live(), a = R.add({ preset: 'splash', startColor: '#5ae0ff', endColor: '#ffffff', size: 2, looping: true, follow: 'hand-left' }), t = R.add({ tab: 'trail', preset: 'tapered', length: 3, width: 0.1, x: 2 });
      R.E.play(a.id, 'loop'); R.E.setBudget(300); R.step(1);
      var saved = JSON.parse(JSON.stringify(R.g.state())), R2 = rig(); R2.g.load(saved); R2.step(1);
      var b = R2.E.get(a.id), c = R2.E.get(t.id), again = JSON.parse(JSON.stringify(R2.g.state()));
      var junk = JSON.parse(JSON.stringify(saved)); junk.kinds = junk.kinds || {}; var R3 = rig(); var ok3 = true;
      try { var j = JSON.parse(JSON.stringify(saved)); R3.g.load(j); R3.E.list().forEach(function (r) { R3.E.setFields(r.id, { startColor: 'red', preset: 'nope', size: 1e9, length: -5, follow: 7 }); }); } catch (e) { ok3 = false; }
      var r3 = R3.E.list()[0];
      T.check('fx_json_roundtrip_nothing_plays', !!b && !!c && b.preset === 'splash' && b.startColor === '#5ae0ff' && b.size === 2 && b.looping === true && b.follow === 'hand-left' && c.tab === 'trail' && c.preset === 'tapered' && c.length === 3 && c.width === 0.1 && R2.E.budget() === 300 && R2.E.total() === 0 && R2.E.modeOf(a.id) === 'stop' && JSON.stringify(again.parts && again.parts.effects) === JSON.stringify(saved.parts && saved.parts.effects) && ok3 && r3.startColor === '#ffd166' && r3.size === 4 && r3.length >= 0.1 && r3.follow === null);
    });
    S('fx_tick_cost_at_cap', function () {
      var R = rig().live(), ids = [], i;
      for (i = 0; i < 12; i++) ids.push(R.add({ x: i, preset: i % 3 ? 'sparks' : 'confetti' }).id);
      ids.forEach(function (id) { R.E.play(id, 'loop'); });
      R.step(5); var t0 = kit.ms(), N = 300; for (i = 0; i < N; i++) R.g.tick(1 / 60);
      var per = (kit.ms() - t0) / N;
      T.value('fx_tick_cost_ms_at_cap', Math.round(per * 1000) / 1000); T.value('fx_particles_at_cap', R.E.total());
      T.check('fx_tick_cost_at_cap', per < 2 && R.E.total() > 300 && R.E.total() <= 600);
    });
    S('fx_labels_no_em_dash', function () {
      var R = rig().live(), a = R.add({ tab: 'trail' }), said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      var rows = R.g._kinds.effects.spec.rows(R.E.get(a.id), H), labels = rows.map(function (r) { return r.label; });
      rows.forEach(function (r) { try { r.act(); } catch (e) { /* none */ } });
      var rows2 = R.g._kinds.effects.spec.rows(R.E.get(a.id), H);
      var fields = R.g._kinds.effects.spec.fields.map(function (f) { return f.label + ' ' + (f.opts || []).map(function (o) { return o[1]; }).join(' '); });
      var all = labels.concat(rows2.map(function (r) { return r.label; }), said, fields, R.ctx._said);
      T.check('fx_labels_no_em_dash', labels[0] === 'Play once' && labels[1] === 'Loop' && labels[2] === 'Stop' && labels.length >= 10 && all.every(function (l) { return !hasDash(l); }));
    });

    /* ---- the rest of the contract ---- */
    S('fx_stop_play_waits_at_least_0_4s_between_starts', function () {
      var R = rig().live(), a = R.add({ preset: 'sparks' }), starts = 0; R.g.on('fx', function (e) { if (e.state === 'once' || e.state === 'loop') starts++; });
      for (var i = 0; i < 120; i++) { R.E.stop(a.id); R.E.play(a.id, 'loop'); R.step(1 / 60); }
      T.check('fx_stop_play_waits_at_least_0_4s_between_starts', starts >= 1 && starts <= 6);
    });
    S('fx_guest_mirrors_host_play_and_stop', function () {
      var H = kit.makeHostGuest ? kit.makeHostGuest({ parts: true }) : null;
      var ok = !!H;
      if (H) {
        var hr = H.host.modules.effects, gr = H.guest.modules.effects, a = hr.add({ preset: 'confetti' });
        H.host.setLive(true); H.guest.load(JSON.parse(JSON.stringify(H.host.state()))); 
        hr.play(a.id, 'loop'); H.step(1);
        var guestPlays = gr.modeOf(a.id) === 'loop' && gr.count(a.id) > 0;
        hr.stop(a.id); H.step(0.2);
        var guestStops = gr.modeOf(a.id) === 'stop' && gr.count(a.id) === 0;
        var guestTry = gr.play(a.id, 'loop');
        var bad = H.guest.sync.validate('fx', { id: 'x'.repeat(50), mode: 'loop' }), bad2 = H.guest.sync.validate('fx', { id: 'a', mode: 'explode' }), good = H.guest.sync.validate('fx', { id: 'a', mode: 'stop' });
        ok = guestPlays && guestStops && guestTry === false && bad === false && bad2 === false && good === true;
      }
      T.check('fx_guest_mirrors_host_play_and_stop', ok);
    });
    S('fx_deleted_gizmo_cleans_up', function () {
      var R = rig().live(), a = R.add({ preset: 'smoke' }); R.E.play(a.id, 'loop'); R.step(1);
      var had = R.layerCount(), tot = R.E.total();
      R.E.kind.remove ? R.E.kind.remove(a.id) : R.g._kinds.effects.api.remove(a.id); R.step(0.1);
      T.check('fx_deleted_gizmo_cleans_up', had === 1 && tot > 0 && R.E.total() === 0 && R.layerCount() === 0);
    });
    S('fx_ribbon_pure_shapes', function () {
      var pts = [0, 1, 2, 3].map(function (i) { return { x: i, y: 1, z: 0 }; }), E = rig().E;
      var d = E.ribbon(pts, 0.2, 'default', [1, 1, 1], [0, 0, 0], 1), t = E.ribbon(pts, 0.2, 'tapered', [1, 1, 1], [0, 0, 0], 1), s = E.ribbon(pts, 0.2, 'simple', [1, 1, 1], [0, 0, 0], 1), z = E.ribbon(pts, 0.2, 'default', [1, 1, 1], [0, 0, 0], 0);
      var wid = function (r, i) { return Math.abs(r.positions[i * 6 + 2] - r.positions[i * 6 + 5]); };
      T.check('fx_ribbon_pure_shapes', d.count === 8 && near(wid(d, 3), 0.2, 1e-9) && near(wid(t, 3), 0.2, 1e-9) && near(wid(t, 0), 0, 1e-9) && near(wid(s, 2), 0.1, 1e-9) && d.colors[0] === 0 && d.colors[d.colors.length - 1] === 1 && z.colors.every(function (c) { return c === 0; }) && E.ribbon([], 0.1, 'default', [1, 1, 1], [1, 1, 1], 1).count === 0 && E.ribbon([{ x: 0, y: 0, z: 0 }], 0.1, 'default', [1, 1, 1], [1, 1, 1], 1).count === 2);
    });
    S('fx_rows_and_fields_hostile_ok', function () {
      var R = rig().live(), a = R.add(), E = R.E, bad = [null, 5, 'x', [], { startColor: 12, preset: {}, size: NaN, length: Infinity, width: 'a', follow: [], tab: 'x' }];
      var threw = false; try { bad.forEach(function (b) { E.setFields(a.id, b); E.add(b); }); E.play('nope', 'loop'); E.stop('nope'); E.preview('nope'); E.modeOf(null); E.count(undefined); E.setBudget('x'); E.setBudget(NaN); } catch (e) { threw = e; }
      R.E.play(a.id, 'loop'); R.step(1);
      var rec = E.get(a.id);
      T.check('fx_rows_and_fields_hostile_ok', !threw && rec.tab === 'particles' && /^#[0-9a-f]{6}$/.test(rec.startColor) && isFinite(rec.size) && isFinite(rec.length) && isFinite(rec.width) && E.total() >= 0);
    });
  }
  var api = { stage: 'H8', section: 'effects', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H8 = api;
})();
