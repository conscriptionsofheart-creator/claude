/* gizmo_next_h12_selftest.js: the checks for stage H12 (Ruth's example as one runnable scenario). A host page and a friend's page, fake time, no headset.
   node gizmo_next_selftest.js --only=h12     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_h12_scenario.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext.H12.register(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var H12 = kit.GizmoNext.H12;
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 0.02 : e); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    /* the room, built and live, with the friend already holding the scene */
    var room = function (o) { o = o || {}; var W = H12.world(kit, o).build(); if (o.live !== false) W.live(); if (o.arm === false) W.hm.trigger.kind.set(W.door.id, { armed: false }); W.step(3); return W; };
    var xAt = function (W, t) { var s = W.hm.beats.stateAt(t); return s && s.s0 && s.s0.pose ? s.s0.pose.joints.wrist[0] : null; };

    S('h12_strip_has_3_pose_cards_wrist_x_three_values', function () {
      var W = H12.world(kit).build(), pins = W.hm.beats.pins(), poses = pins.filter(function (p) { return p.kind === 'pose'; }), says = pins.filter(function (p) { return p.kind === 'say'; });
      var xs = poses.map(function (p) { return xAt(W, p.t); }), up = poses[0].pose.joints.wrist;
      T.check('h12_strip_has_3_pose_cards_wrist_x_three_values', poses.length === 3 && says.length === 1 && poses.map(function (p) { return p.t; }).join() === '0,1,2' && near(xs[0], 0) && near(xs[1], 0.5) && near(xs[2], -0.5) && up[1] > 1.8 && says[0].t === 0 && says[0].hold === 1.5 && says[0].rec === 'vo_hello' && !!W.hm.beats.getRange('Greeting') && W.hm.beats.length() === 2);
    });
    S('h12_say_plays_once_and_mouth_moves_while_it_plays', function () {
      var W = room(), B = W.hm.beats, A = W.hm.actions, m = [];
      B.play(0); for (var i = 0; i < 150; i++) { W.step(1 / 60); m.push(A.mouth('s0')); }
      var during = m.slice(0, 80).filter(function (x) { return x > 0.05; }).length, after = m.slice(100).filter(function (x) { return x > 0; }).length;
      W.step(2);
      T.check('h12_say_plays_once_and_mouth_moves_while_it_plays', W.log.voice.length === 1 && W.log.voice[0].rec === 'vo_hello' && during >= 70 && after === 0 && B.clock.playing === false && A.mouth('s0') === 0);
    });
    S('h12_play_waves_and_speaks_then_stop_restores', function () {
      var W = room(), B = W.hm.beats, before = cl(W.hostFig.pose), xs = [];
      B.play(0); for (var i = 0; i < 100; i++) { W.step(1 / 60); xs.push(W.wrist()[0]); }
      var max = Math.max.apply(null, xs), min = Math.min.apply(null, xs), spoke = W.log.voice.length;
      B.stop(); W.step(0.2);
      T.check('h12_play_waves_and_speaks_then_stop_restores', max > 0.3 && min < -0.1 && spoke === 1 && JSON.stringify(W.hostFig.pose) === JSON.stringify(before) && W.hm.actions.mouth('s0') === 0);
    });
    S('h12_guest_enters_exactly_one_start', function () {
      var W = room(), c = W.count(), p = W.friend('g1', 'Rosa'); W.step(0.5); var idle = c.host;
      W.walkIn(p); W.step(4);
      T.check('h12_guest_enters_exactly_one_start', idle === 0 && c.host === 1 && c.fires === 1 && c.guest === 1 && W.log.voice.length === 1 && W.log.guestVoice.length === 0);
    });
    S('h12_second_guest_fires_again', function () {
      var W = room(), c = W.count(), a = W.friend('g1', 'Rosa'), b = W.friend('g2', 'Ben'); W.step(0.3);
      W.walkIn(a); W.step(3.5); W.walkOut(a); W.step(1); W.walkIn(b); W.step(3.5);
      T.check('h12_second_guest_fires_again', c.host === 2 && c.fires === 2 && c.guest === 2 && W.log.voice.length === 2);
    });
    S('h12_same_guest_reenter_same_visit_no_second_fire', function () {
      var W = room(), c = W.count(), a = W.friend('g1', 'Rosa'); W.step(0.3);
      W.walkIn(a); W.step(3.5); W.walkOut(a); W.step(1); W.walkIn(a); W.step(3.5); var same = c.fires;
      /* a new visit: she leaves the room and comes back */
      W.walkOut(a); W.leaveRoom(a); W.step(1); W.friend('g1', 'Rosa'); var a2 = W.peers[W.peers.length - 1]; W.walkIn(a2); W.step(3.5);
      T.check('h12_same_guest_reenter_same_visit_no_second_fire', same === 1 && c.fires === 2 && c.host === 2);
    });
    S('h12_live_off_nothing_fires', function () {
      var W = room({ live: false }), c = W.count(), a = W.friend('g1', 'Rosa'); W.step(0.3); W.walkIn(a); W.step(4);
      T.check('h12_live_off_nothing_fires', c.fires === 0 && c.host === 0 && c.guest === 0 && W.log.voice.length === 0 && W.hm.trigger.visitors(W.door.id).length === 0);
    });
    S('h12_disarmed_nothing_fires', function () {
      var W = room({ arm: false }), c = W.count(), a = W.friend('g1', 'Rosa'); W.step(0.3); W.walkIn(a); W.step(4);
      var quiet = c.fires === 0 && c.host === 0 && W.log.voice.length === 0 && W.hm.trigger.list()[0].armed === false;
      W.hm.trigger.kind.set(W.door.id, { armed: true }); W.step(4);
      T.check('h12_disarmed_nothing_fires', quiet && c.fires === 1 && c.host === 1);
    });
    S('h12_save_reload_keeps_everything_nothing_plays_on_open', function () {
      var W = room(), saved = cl(W.host.state()), txt = JSON.stringify(saved);
      var N = H12.world(kit); N.host.load(saved); N.step(4);
      var pins = N.hm.beats.pins(), rec = N.hm.trigger.list()[0];
      T.check('h12_save_reload_keeps_everything_nothing_plays_on_open', pins.length === 4 && pins.filter(function (p) { return p.kind === 'say'; })[0].hold === 1.5 && !!N.hm.beats.getRange('Greeting') && !!rec && rec.armed === true && rec.who === 'guests' && rec.often === 'visit' && rec.starts[0].arg === 'Greeting' && N.host.isLive() === true && N.hm.beats.time() === 0 && N.log.voice.length === 0 && JSON.stringify(N.hostFig.pose) === JSON.stringify(H12.mkPose(0, 1.4)) && txt.indexOf('_seen') < 0);
    });
    S('h12_guest_page_no_export_download_save', function () {
      var W = room(), dom = kit.makeFakeDom(), el = dom.createElement('div'), words = [];
      var ok = W.guest.mountPanel(el); words.push(kit.domText(el));
      Object.keys(W.guest.modules).forEach(function (n) { var m = W.guest.modules[n]; if (m && typeof m.mountPanel === 'function') { var e2 = dom.createElement('div'); try { m.mountPanel(e2); } catch (e) { /* none */ } words.push(kit.domText(e2)); } });
      W.guest.pages().forEach(function (pg) { W.guest.pageRows(pg.id, { say: function (t) { words.push(String(t)); }, redraw: function () {} }).forEach(function (r) { words.push(String(r.label)); }); });
      var all = words.join(' ').toLowerCase(), hits = ['save', 'export', 'download'].filter(function (w) { return all.indexOf(w) >= 0; });
      var wrote = 0, put = W.guest.putFile('x', 'y'), pers = W.guest.persist(), add = W.gm.beats.addBeatNow(['s0']);
      T.check('h12_guest_page_no_export_download_save', ok === true && all.length > 200 && hits.length === 0 && put === false && pers === false && add.ok === false);
    });
    S('h12_guest_sees_wave_within_0_3s', function () {
      var W = room(), a = W.friend('g1', 'Rosa'); W.step(0.3);
      var tH = null, tGv = null, gMove = null; var t0 = null;
      W.host.on('beat-play', function () { if (tH === null) tH = W.clock.now(); });
      W.walkIn(a); var moved0 = W.wrist(W.guestFig)[0];
      var worst = 0, i, hostVoiceAt = null;
      for (i = 0; i < 240; i++) {
        W.step(1 / 60);
        if (tH !== null && gMove === null && Math.abs(W.wrist(W.guestFig)[0] - moved0) > 0.005) gMove = W.clock.now();
        if (hostVoiceAt === null && W.log.voice.length) hostVoiceAt = W.log.voice[0].t;
        if (tH !== null && W.hm.beats.time() > 0.2 && W.hm.beats.time() < 1.7) worst = Math.max(worst, Math.abs(W.hm.beats.time() - W.gm.beats.time()));
      }
      var lag = gMove !== null && tH !== null ? (gMove - tH) / 1000 : -1;
      T.value('h12_guest_wave_lag_s', Math.round(lag * 1000) / 1000); T.value('h12_guest_beat_gap_s', Math.round(worst * 1000) / 1000);
      T.check('h12_guest_sees_wave_within_0_3s', lag >= 0 && lag <= 0.3 && worst <= 0.3 && hostVoiceAt !== null && Math.abs(hostVoiceAt - tH) <= 100 && W.gm.beats.time() >= 0);
    });
    S('h12_hide_gizmos_still_fires', function () {
      var W = room(), c = W.count(), a = W.friend('g1', 'Rosa'); W.step(0.3);
      W.H.hostCtx.gizmos.setAll(true); W.step(0.2); var hidden = W.hm.trigger.list()[0]._mk.visible === false;
      W.walkIn(a); W.step(3.5);
      T.check('h12_hide_gizmos_still_fires', hidden && c.fires === 1 && c.host === 1 && W.log.voice.length === 1);
    });
    S('h12_tick_cost_whole_scene', function () {
      var W = room(), a = W.friend('g1', 'Rosa'), b = W.friend('g2', 'Ben'); W.step(0.3); W.walkIn(a); W.walkIn(b); W.hm.beats.play(0);
      var N = 600, t0 = kit.ms(); for (var i = 0; i < N; i++) { W.H.clock.advance(1 / 60); W.host.tick(1 / 60); W.guest.tick(1 / 60); } var per = (kit.ms() - t0) / N;
      T.value('h12_tick_cost_ms_host_and_guest', Math.round(per * 10000) / 10000);
      T.check('h12_tick_cost_whole_scene', per < 2 && isFinite(per));
    });
    S('h12_no_flash', function () {
      var W = H12.world(kit), B = W.hm.beats;
      /* the example, plus a busy look track: five colour changes asked for 0.1 s apart. The rule is looks no faster than every 0.4 s and no more than three a second; a full swing in 0.4 s eased by smootherstep peaks at 1.875 / 0.4 a second, and that is the bound read here */
      W.handUp(); W.addBeat(); W.attachVoice(0); W.handRight(); W.addBeat(); W.handLeft(); W.addBeat();
      [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1]].forEach(function (c, i) { W.hostFig.look.tint = c; B.setClock(i * 0.1); B.addBeatNow(['s0'], { look: true }); });
      W.host.setLive(true); W.step(3);
      var looks = B.pins().filter(function (p) { return p.kind === 'look'; }).map(function (p) { return p.t; }).sort(function (a, b) { return a - b; }), gaps = looks.slice(1).map(function (t, k) { return t - looks[k]; });
      var perSec = 0; looks.forEach(function (t) { var n = looks.filter(function (u) { return u >= t && u < t + 1; }).length; if (n > perSec) perSec = n; });
      B.setClock(0); B.play(0);
      var last = W.hostFig.look.tint.slice(), worst = 0, frames = 0;
      for (var i = 0; i < 60 * 8; i++) { W.step(1 / 60); var cur = W.hostFig.look.tint; for (var k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(cur[k] - last[k]) * 60); last = cur.slice(); frames++; }
      T.value('h12_look_pins', looks.length); T.value('h12_min_look_gap_s', gaps.length ? Math.round(Math.min.apply(null, gaps) * 1000) / 1000 : -1); T.value('h12_worst_colour_rate_per_s', Math.round(worst * 1000) / 1000);
      T.check('h12_no_flash', looks.length >= 4 && Math.min.apply(null, gaps) >= 0.4 - 1e-9 && perSec <= 3 && worst <= 1.875 / 0.4 + 0.05);
    });
    S('h12_run_example_lines_pass', function () {
      var lines = H12.runExample(kit), bad = lines.filter(function (l) { return /: 0$/.test(l); });
      T.check('h12_run_example_lines_pass', lines.length === 5 && bad.length === 0 && lines.every(function (l) { return !hasDash(l); }));
    });
  }

  var api = { stage: 'H12', section: 'h12', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H12 = api;
})();
