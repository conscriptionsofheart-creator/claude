/* gizmo_next_ragdoll_selftest.js: the checks for stage H4 (record a rag doll fall, play it back). Pure logic, three.js stub, no headset.
   The falls are made up here by a small formula (a hip drop with the joints folding). No motion data from any outside source is used.
   node gizmo_next_selftest.js --only=ragdoll     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_ragdoll.js');

  function run(T, kit) { return kit.isolate(function () { var G = kit.GizmoNext; G._beatsRegister(); G._actionsRegister(); G._ragdollRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013), DEG = 180 / Math.PI;
    var S = function (n, fn) { T.section(n, fn); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var ss = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    var angle = function (a, b) { var d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * DEG; };
    var qdiff = function (a, b) { var sg = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) < 0 ? -1 : 1; return Math.max(Math.abs(a[0] - sg * b[0]), Math.abs(a[1] - sg * b[1]), Math.abs(a[2] - sg * b[2]), Math.abs(a[3] - sg * b[3])); };
    var mul = function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; };
    var yawQ = function (y) { return [0, Math.sin(y / 2), 0, Math.cos(y / 2)]; };
    var rot = function (v, y) { var c = Math.cos(y), s = Math.sin(y); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };

    /* a made-up fall: the hips drop, roll, drift, the joints fold, the knees bend (never backwards unless asked) */
    function gen(t, o) {
      o = o || {};
      var a = ss(t / 1.5), rr = 1.2 * ss(t / 1.2), q = {};
      for (var j = 1; j <= 20; j++) {
        var amp = (j === 4 || j === 5) ? (o.backKnees ? -1.2 : 2.0) : 0.3 + 0.02 * j, ang = amp * a, h = Math.sin(ang / 2), c = Math.cos(ang / 2);
        q[j] = j % 2 ? [h, 0, 0, c] : [0, 0, h, c];
      }
      return { root: { p: [0.5 * t, (o.low ? 1.0 - 1.3 * ss(t) : 1.0 - 0.9 * ss(t)), 0.2 * t], q: [0, 0, Math.sin(rr / 2), Math.cos(rr / 2)] }, q: q };
    }
    /* a stand-in for the page's clip player: yaw of the first frame removed, the figure's own facing and place put on */
    function player(slotStarts) {
      var P = { calls: [], playing: {} };
      P.play = function (slot, clip, opts) { P.calls.push(['play', slot, clip, opts]); P.playing[slot] = { clip: clip, start: slotStarts[slot] || { pos: [0, 0, 0], yaw: 0 }, t0: null }; };
      P.stop = function (slot) { P.calls.push(['stop', slot]); delete P.playing[slot]; };
      P.setTime = function (t) { P.calls.push(['time', t]); };
      P.pose = function (slot, k) {
        var pl = P.playing[slot]; if (!pl) return null; var f = pl.clip.frames[k], f0 = pl.clip.frames[0], y0 = Math.atan2(2 * (f0.q[0][3] * f0.q[0][1] + f0.q[0][0] * f0.q[0][2]), 1 - 2 * (f0.q[0][0] * f0.q[0][0] + f0.q[0][1] * f0.q[0][1]));
        var R = pl.start.yaw - y0, d = rot([f.root[0] - f0.root[0], f.root[1] - f0.root[1], f.root[2] - f0.root[2]], R);
        return { rootQ: mul(yawQ(R), f.q[0]), rootP: [pl.start.pos[0] + d[0], f0.root[1] + d[1], pl.start.pos[2] + d[2]], q: f.q, R: R };
      };
      return P;
    }

    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), st = { falling: o.falling !== false, t0: 0, opts: o.gen || {} }, P = player(o.starts || {});
      var adapter = { joints: function () { return gen(Math.max(0, (clock.now() - st.t0) / 1000), st.opts); }, isFalling: function () { return st.falling; } };
      var g = kit.makeInst({ clock: clock, storage: o.storage, guest: !!o.guest, figures: [{ slot: 'f0' }], ragdoll: o.noAdapter ? undefined : adapter, clips: P });
      var R = { g: g, T: g.modules.ragdoll, B: g.modules.beats, A: g.modules.actions, P: P, st: st, clock: clock, ctx: g._ctx };
      R.step = function (sec, hz) { return kit.stepSeconds(g, sec, hz); };
      /* record a fall of `sec` seconds, started now, ticking at `hz` */
      R.fall = function (sec, hz) { st.t0 = clock.now(); R.T.record('f0'); R.step(sec, hz || 30); return R.T.stop(); };
      return R;
    }

    S('ragdoll_synthetic_fall_records_3s_at_30hz', function () {
      var R = rig(), id = R.fall(3, 30), m = R.T.get(id), clip = R.T.toClip(id);
      var f0 = gen(0), fl = gen((m.frames - 1) / 30);
      T.check('ragdoll_synthetic_fall_records_3s_at_30hz', !!id && m.frames >= 90 && m.frames <= 92 && clip.fps === 30 && clip.frames.length === m.frames && clip.frames[0].q.length === 22 && Object.keys(clip.frames[0].q).length === 21 && m.joints === 20 &&
        angle(clip.frames[0].q[0], f0.root.q) < 0.5 && angle(clip.frames[m.frames - 1].q[12], fl.q[12]) < 0.5 && Math.abs(clip.frames[m.frames - 1].root[0] - fl.root.p[0]) < 0.002);
    });
    S('ragdoll_quantise_error_under_0_5_degrees', function () {
      var R = rig(), id = R.fall(3, 30), clip = R.T.toClip(id), worst = 0, worstP = 0;
      clip.frames.forEach(function (f, k) {
        var g0 = gen(k / 30); worst = Math.max(worst, angle(f.q[0], g0.root.q));
        for (var j = 1; j <= 20; j++) worst = Math.max(worst, angle(f.q[j], g0.q[j]));
        for (var a = 0; a < 3; a++) worstP = Math.max(worstP, Math.abs(f.root[a] - g0.root.p[a]));
      });
      T.value('ragdoll_quantise_worst_degrees', Math.round(worst * 10000) / 10000);
      T.check('ragdoll_quantise_error_under_0_5_degrees', worst < 0.5 && worstP < 0.0011);
    });
    S('ragdoll_size_under_100KB_per_10s', function () {
      var R = rig(), id = R.fall(10, 30), m = R.T.get(id), raw = R.ctx.storage.get('jb_gizmonext_file_ragdoll_' + id);
      var numbers = m.frames * (20 * 4 + 4 + 3);
      T.value('ragdoll_bytes_for_10s', m.bytes);
      T.check('ragdoll_size_under_100KB_per_10s', m.bytes < 100000 && typeof raw === 'string' && raw.length === m.bytes && numbers > 20000 && numbers < 30000 && m.frames >= 300 && m.frames <= 302);
    });
    S('ragdoll_play_twice_from_two_start_positions_same_pose_shape', function () {
      var R = rig({ starts: { a: { pos: [0, 0, 0], yaw: 0 }, b: { pos: [5, 0, 3], yaw: Math.PI / 2 } } }), id = R.fall(3, 30);
      R.T.play('a', id); R.T.play('b', id);
      var same = true, moved = false, shapeOk = true, n = R.T.get(id).frames;
      for (var k = 0; k < n; k++) {
        var pa = R.P.pose('a', k), pb = R.P.pose('b', k);
        /* take each figure's own facing back off: what is left is the fall itself */
        var qa = mul(yawQ(-pa.R), pa.rootQ), qb = mul(yawQ(-pb.R), pb.rootQ), ra = rot([pa.rootP[0] - 0, pa.rootP[1], pa.rootP[2] - 0], -pa.R), rb = rot([pb.rootP[0] - 5, pb.rootP[1], pb.rootP[2] - 3], -pb.R);
        if (qdiff(qa, qb) > 1e-12 || Math.abs(ra[0] - rb[0]) > 1e-9 || Math.abs(ra[1] - rb[1]) > 1e-9 || Math.abs(ra[2] - rb[2]) > 1e-9) same = false;
        for (var j = 1; j <= 20; j++) if (qdiff(pa.q[j], pb.q[j]) > 1e-12) shapeOk = false;
        if (Math.abs(pa.rootP[0] - pb.rootP[0]) > 1) moved = true;
      }
      var conds = { same: same, shapeOk: shapeOk, moved: moved, twoPlays: R.P.calls.filter(function (c) { return c[0] === 'play'; }).length === 2, sameClip: R.P.calls[0][2] === R.P.calls[1][2], noLoop: R.P.calls[0][3].loop === false }, bad = Object.keys(conds).filter(function (k) { return !conds[k]; });
      if (bad.length) T.value('ragdoll_play_twice_failed_parts', bad.join(' '));
      T.check('ragdoll_play_twice_from_two_start_positions_same_pose_shape', !bad.length);
    });
    S('ragdoll_knees_never_bend_backwards', function () {
      var R = rig(), id = R.fall(3, 30), au = R.T.audit(id);
      var Q = rig({ gen: { backKnees: true } }), id2 = Q.fall(3, 30), au2 = Q.T.audit(id2);
      var raw = R.T.toClip(id).frames.every(function (f) { return [4, 5].every(function (j) { return 2 * Math.atan2(f.q[j][0], f.q[j][3]) * DEG > -0.5; }); });
      T.check('ragdoll_knees_never_bend_backwards', au.kneeMinDeg >= -0.5 && au.samples >= 170 && raw && au2.kneeMinDeg < -20 && au.seconds >= 2.9);
    });
    S('ragdoll_root_height_never_below_floor', function () {
      var R = rig({ gen: { low: true } }), id = R.fall(3, 30), au = R.T.audit(id), clip = R.T.toClip(id);
      var floorHigh = rig(); floorHigh.ctx._floorFn = function () { return 0.4; }; var id2 = floorHigh.fall(2, 30), au2 = floorHigh.T.audit(id2);
      T.check('ragdoll_root_height_never_below_floor', au.rootMinY >= 0.05 - 1e-9 && clip.frames.every(function (f) { return f.root[1] >= 0.05 - 1e-9; }) && au2.rootMinY >= 0.45 - 1e-9);
    });
    S('ragdoll_undo_removes_last', function () {
      var R = rig(), S0 = JSON.parse(JSON.stringify(R.g.state())), u0 = R.ctx._undos;
      var a = R.fall(1, 30), b = R.fall(1, 30), had2 = R.T.clips().length === 2, fileB = R.ctx.storage.get('jb_gizmonext_file_ragdoll_' + b) !== null;
      R.T.undoLast(); var one = R.T.clips().length === 1 && R.T.clips()[0].id === a && R.ctx.storage.get('jb_gizmonext_file_ragdoll_' + b) === null;
      R.g.load(S0); var none = R.T.clips().length === 0;
      T.check('ragdoll_undo_removes_last', had2 && fileB && one && none && R.ctx._undos - u0 === 2 && R.T.undoLast() === false);
    });
    S('ragdoll_stop_returns_pose', function () {
      var R = rig(), id = R.fall(1, 30); R.T.play('f0', id); var on = R.T.isPlaying('f0'); R.T.stopPlay('f0');
      T.check('ragdoll_stop_returns_pose', on && R.P.calls.some(function (c) { return c[0] === 'stop' && c[1] === 'f0'; }) && R.P.pose('f0', 0) === null && R.P.playing.f0 === undefined);
    });
    S('ragdoll_too_long_message', function () {
      var R = rig(); R.T.limits.maxBytes = 40000; var id = R.fall(10, 30), said = R.ctx._said.slice(-1)[0];
      var R2 = rig(); var id2 = R2.fall(2, 30);
      T.check('ragdoll_too_long_message', id === null && /too long, shorten it/.test(said) && !hasDash(said) && R.T.clips().length === 0 && !R.T.recording() && R.ctx.storage.get('jb_gizmonext_file_ragdoll_rg1') === null && !!id2);
    });
    S('ragdoll_save_load_roundtrip_nothing_plays', function () {
      var store = kit.makeStorage(), R = rig({ storage: store }), id = R.fall(2, 30), saved = JSON.parse(JSON.stringify(R.g.state()));
      var Q = rig({ storage: store }); Q.g.load(saved); Q.step(2);
      var same = JSON.stringify(Q.T.toClip(id)) === JSON.stringify(R.T.toClip(id));
      var C = rig(); C.g.load(saved); var gone = C.T.clips().length === 1 && C.T.clips()[0].here === false; var ok = C.T.play('f0', id); var said = C.ctx._said.join(' ');
      var n = C.T.restoreFiles(R.T.files()); var back = C.T.clips()[0].here === true && C.T.play('f0', id) === true;
      T.check('ragdoll_save_load_roundtrip_nothing_plays', saved.parts.ragdoll.clips.length === 1 && saved.parts.ragdoll.files[0] === 'ragdoll_' + id && !('q' in saved.parts.ragdoll.clips[0]) && same && Q.P.calls.length === 0 && gone && ok === false && /not on this computer/.test(said) && C.P.calls.filter(function (c) { return c[0] === 'play'; }).length === 1 && n === 1 && back);
    });
    S('ragdoll_beat_action_plays_once_per_pass', function () {
      var R = rig(), id = R.fall(1, 30), B = R.B, A = R.A;
      B.pinsSet([{ id: 'a', t: 0, slot: 'f0', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 3, slot: 'f0', kind: 'pose', pose: { x: 1 } }]);
      var p = A.add({ kind: 'ragdoll', slot: 'f0', clipId: id, t: 0.5 }), bad = A.add({ kind: 'ragdoll', slot: 'f0', t: 1 });
      var plays = function () { return R.P.calls.filter(function (c) { return c[0] === 'play'; }).length; };
      B.setMode('loop'); B.play(0); R.step(2); var first = plays(); R.step(5);
      B.stop();
      T.check('ragdoll_beat_action_plays_once_per_pass', !!p && p.hold === undefined && A.hold(B.get(p.id)) === R.T.seconds(id) && R.T.seconds(id) >= 0.9 && bad === null && first === 1 && plays() === 3 && R.P.calls.some(function (c) { return c[0] === 'stop'; }));
    });
    S('ragdoll_play_tick_cost', function () {
      var R = rig(), id = R.fall(10, 30);
      var t0 = kit.ms(); R.T.kind; R.T.toClip(id); var conv = kit.ms() - t0;
      R.T.play('f0', id); var t1 = kit.ms(); for (var i = 0; i < 1000; i++) R.g.tick(1 / 60); var idle = (kit.ms() - t1) / 1000;
      R.st.t0 = R.clock.now(); R.T.record('f0'); var t2 = kit.ms(); for (var k = 0; k < 1000; k++) { R.clock.advance(1 / 60); R.g.tick(1 / 60); } var rec = (kit.ms() - t2) / 1000; R.T.stop();
      T.value('ragdoll_clip_conversion_ms_10s', Math.round(conv * 100) / 100); T.value('ragdoll_play_tick_cost_ms_per_tick', Math.round(idle * 10000) / 10000); T.value('ragdoll_record_tick_cost_ms_per_tick', Math.round(rec * 10000) / 10000);
      T.check('ragdoll_play_tick_cost', conv < 100 && idle < 0.5 && rec < 1);
    });

    /* ---- the rest of the contract ---- */
    S('ragdoll_slow_ticks_still_30fps', function () {
      var R = rig(), id = R.fall(3, 8), m = R.T.get(id), clip = R.T.toClip(id), worst = 0;
      clip.frames.forEach(function (f, k) { var g0 = gen(k / 30); for (var j = 1; j <= 20; j++) worst = Math.max(worst, angle(f.q[j], g0.q[j])); });
      T.check('ragdoll_slow_ticks_still_30fps', m.frames >= 88 && m.frames <= 92 && worst < 6 && clip.frames.every(function (f) { return Object.keys(f.q).length === 21; }));
    });
    S('ragdoll_record_refusals', function () {
      var R = rig({ falling: false }), a = R.T.record('f0'), m1 = R.ctx._said.slice(-1)[0];
      var G = rig({ guest: true }), b = G.T.record('f0'), m2 = G.ctx._said.slice(-1)[0];
      var N = rig({ noAdapter: true }), c = N.T.record('f0'), m3 = N.ctx._said.slice(-1)[0];
      var D = rig(); D.st.t0 = D.clock.now(); var d1 = D.T.record('f0'), d2 = D.T.record('f0'), m4 = D.ctx._said.slice(-1)[0]; D.T.stop(); var d3 = D.T.stop();
      T.check('ragdoll_record_refusals', a === false && /Gravity/.test(m1) && b === false && /Only the host/.test(m2) && c === false && /not connected/.test(m3) && d1 === true && d2 === false && /already being recorded/.test(m4) && d3 === null && [m1, m2, m3, m4].every(function (m) { return !hasDash(m); }));
    });
    S('ragdoll_hostile_input_ok', function () {
      var store = kit.makeStorage(), R = rig({ storage: store }), threw = false, evil = JSON.parse('{"v":1,"clips":[{"id":"rg1","name":"x","frames":1e9,"seconds":-4,"__proto__":{"polluted":1}},{"id":"../x","frames":5,"seconds":1},5,null,{"id":"rg2","frames":30,"seconds":1,"bytes":"a","joints":99}],"next":-5}');
      try {
        R.g.load({ parts: { ragdoll: evil } }); R.g.load({ parts: { ragdoll: 'x' } }); R.g.load({ parts: { ragdoll: [] } });
        store.set('jb_gizmonext_file_ragdoll_rg2', '{"joints":[1],"n":30,"p0":[0,0,0],"q":"AAAA","rq":"zz","rp":5}'); R.g.load({ parts: { ragdoll: evil } }); R.T.toClip('rg2'); R.T.play('f0', 'rg2'); R.T.audit('rg2'); R.T.play('f0', '../../x'); R.T.remove('nope'); R.T.rename('nope', 5); R.T.restoreFiles({ '../evil': 'x', ragdoll_rg9: 5 }); R.T.restoreFiles('x'); R.T.undoLast();
        R.B.hooks.rows.forEach(function (f) { f({ say: function () {}, redraw: function () {} }); });
      } catch (e) { threw = e; }
      var m = R.T.clips();
      T.check('ragdoll_hostile_input_ok', !threw && ({}).polluted === undefined && m.length <= 24 && m.every(function (c) { return /^rg\d+$/.test(c.id) && c.frames >= 2 && c.frames <= 4502; }) && R.T.toClip('rg2') === null);
    });
    S('ragdoll_rows_and_panel', function () {
      var R = rig(), id = R.fall(1, 30), H = { say: function () {}, redraw: function () {} }, rows = R.B.strip.rows(H), labels = rows.map(function (r) { return r.label; });
      var add = rows.filter(function (r) { return /^Add ragdoll beat: Fall 1/.test(r.label); })[0]; add.act();
      var rec = rows.filter(function (r) { return r.label === 'Record fall'; })[0]; R.st.t0 = R.clock.now(); rec.act(); var on = R.T.recording(); R.step(1, 30);
      var stopRow = R.B.strip.rows(H).filter(function (r) { return r.label === 'Stop recording the fall'; })[0]; stopRow.act();
      var dom = kit.makeFakeDom(), host = dom.createElement('div'); R.g.mountPanel(host); var btns = kit.domFind(host, function (e) { return e.tagName === 'BUTTON'; }).map(function (b) { return b._text; });
      var G = rig({ guest: true }), gd = kit.makeFakeDom(), gh = gd.createElement('div'); G.g.mountPanel(gh);
      T.check('ragdoll_rows_and_panel', labels.indexOf('Record fall') >= 0 && !!add && R.B.list().some(function (p) { return p.kind === 'ragdoll' && p.clipId === id; }) && on && R.T.clips().length === 2 && btns.indexOf('Record fall') >= 0 && btns.indexOf('Undo last recording') >= 0 && !/record fall/.test(kit.domText(gh)) && labels.every(function (l) { return !hasDash(l); }));
    });
    S('ragdoll_nothing_runs_when_scene_opens', function () {
      var store = kit.makeStorage(), R = rig({ storage: store }), id = R.fall(1, 30); R.A.add({ kind: 'ragdoll', slot: 'f0', clipId: id, t: 0.2 });
      var saved = JSON.parse(JSON.stringify(R.g.state())), Q = rig({ storage: store }); Q.g.load(saved); Q.step(5); Q.g.setLive(true); Q.step(5);
      T.check('ragdoll_nothing_runs_when_scene_opens', Q.P.calls.length === 0 && Q.B.list().some(function (p) { return p.kind === 'ragdoll'; }) && !Q.T.recording() && Q.T.clips().length === 1);
    });
  }

  var api = { stage: 'H4', section: 'ragdoll', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H4 = api;
})();
