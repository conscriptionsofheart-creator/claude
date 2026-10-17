/* gizmo_next_actions_selftest.js: the checks for stage H2 (actions on beats). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=actions     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_actions.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._beatsRegister(); kit.GizmoNext._actionsRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 0.002 : e); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    function mkPose(x, y) { return { joints: { wrist: [x, y, 0] }, pos: [0, 0, 0], turn: 0 }; }

    /* a fake page with every adapter the actions use, each recording what it was asked */
    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), calls = [], playing = {}, figs = { s0: { pose: mkPose(0, 1.4), look: { shader: 'plain', tint: [1, 0.5, 0.25], clothes: ['shirt'], skin: [0.8, 0.6, 0.5] } } };
      var now = function () { return clock.now(); };
      var pose = { get: function (s) { return figs[s] ? cl(figs[s].pose) : null; }, apply: function (s, p) { if (figs[s]) figs[s].pose = cl(p); } };
      var look = { get: function (s) { return figs[s] ? cl(figs[s].look) : null; }, apply: function (s, p) { calls.push(['look', s, Object.keys(p).join('+')]); if (figs[s]) figs[s].look = Object.assign({}, figs[s].look, cl(p)); } };
      if (o.allowed !== null) look.allowedClothes = function () { return o.allowed || ['shirt', 'hat']; };
      var ctxo = {
        clock: clock, pose: pose, look: look, figures: [{ slot: 's0' }], guest: !!o.guest,
        narration: o.noVoice ? undefined : {
          voLines: function () { return [{ rec: 'vo_hello', seconds: 1.5 }, { rec: 'vo_bye', seconds: 0.8 }]; },
          play: function (s, r) { calls.push(['play', s, r, now()]); playing[s] = { until: now() + 1500 }; },
          stop: function (s) { calls.push(['vstop', s]); delete playing[s]; },
          mouth: function (s) { var p = playing[s]; return p && now() < p.until ? 0.4 : 0; }
        },
        sounds: { playMode: function (id, m) { calls.push(['sound', id, m]); } },
        clips: { play: function (s, c) { calls.push(['clip', s, c]); }, stop: function (s) { calls.push(['clipstop', s]); } },
        seat: { sit: function (s, id) { calls.push(['sit', s, id]); }, stand: function (s) { calls.push(['stand', s]); } },
        scripts: { event: function (k, id, ev, n) { calls.push(['script', k, id, ev, n]); } },
        camera: { shot: function (n) { calls.push(['shot', n]); } }
      };
      if (o.face) ctxo.face = { apply: function (s, e) { calls.push(['face', s, e]); } };
      var g = kit.makeInst(ctxo);
      var R = { g: g, B: g.modules.beats, A: g.modules.actions, figs: figs, calls: calls, ctx: g._ctx, clock: clock };
      R.step = function (sec) { return kit.stepSeconds(g, sec); };
      R.count = function (k) { return calls.filter(function (c) { return c[0] === k; }).length; };
      return R;
    }
    /* two pose beats, 0 and 4 s, so a clock has a length */
    function base(R, len) {
      R.figs.s0.pose = mkPose(0, 1.4); R.B.addBeatNow(['s0']);
      R.B.setClock(len === undefined ? 4 : len); R.figs.s0.pose = mkPose(0.3, 1.4); R.B.addBeatNow(['s0']);
      R.B.setClock(0);
      return R;
    }

    S('actions_hello_friend_fake_mic', function () {
      var R = base(rig()), A = R.A, B = R.B;
      var p = A.addSay('s0', 'vo_hello', 0.5);
      B.play(0); R.step(0.4);
      var before = R.count('play'), m0 = A.mouth('s0');
      R.step(0.2);
      var started = R.count('play') === 1 && near(R.calls.filter(function (c) { return c[0] === 'play'; })[0][3] - 100000, 500, 40) && R.calls.filter(function (c) { return c[0] === 'play'; })[0][2] === 'vo_hello';
      var mid = A.mouth('s0'); R.step(0.5); var mid2 = A.mouth('s0');
      R.step(1.0); var after = A.mouth('s0');
      R.step(2); /* the clock ends at 4 s: the voice did not start again */
      T.check('actions_hello_friend_fake_mic', !!p && before === 0 && m0 === 0 && started && mid > 0.05 && mid2 > 0.05 && after === 0 && R.count('play') === 1);
    });
    S('actions_say_hold_equals_recording_length', function () {
      var R = base(rig()), A = R.A, B = R.B;
      var p = A.addSay('s0', 'vo_hello', 0.5), q = A.addSay('s0', 'vo_bye', 2.5);
      var h1 = B.get(p.id).hold === 1.5 && A.hold(B.get(p.id)) === 1.5, h2 = B.get(q.id).hold === 0.8;
      B.setHold(p.id, 2.2);
      var edited = A.hold(B.get(p.id)) === 2.2;
      var r2 = rig(); base(r2); var t0 = r2.B.clock.t; var s2 = r2.A.addSay('s0', 'vo_hello');
      T.check('actions_say_hold_equals_recording_length', h1 && h2 && edited && s2.t === t0 && near(r2.B.clock.t, t0 + 1.5, 1e-6) && B.length() >= 3.3);
    });
    S('actions_look_partial_keeps_other_parts', function () {
      var R = base(rig(), 4), A = R.A, B = R.B;
      B.add({ slot: 's0', kind: 'look', t: 0, payload: { shader: 'plain', clothes: ['shirt'], tint: [1, 0, 0] } });
      A.addLook('s0', { shader: 'glow' }, 2);
      var s1 = B.stateAt(3).s0.look, s0 = B.stateAt(0.5).s0.look;
      B.play(0); R.step(3.5);
      var f = R.figs.s0.look;
      T.check('actions_look_partial_keeps_other_parts', s1.shader === 'glow' && s1.clothes[0] === 'shirt' && near(s1.tint[0], 1, 1e-9) && s0.shader === 'plain' && f.clothes[0] === 'shirt' && f.shader === 'glow' && !!f.skin);
    });
    S('actions_look_clothes_refused_when_not_cleared', function () {
      var R = rig({ allowed: ['hat'] }), A = R.A, B = R.B;
      var p = A.addLook('s0', { clothes: ['hat', 'cape'], eyes: 'blue' }, 0), said = R.ctx._said.join(' | ');
      var q = A.addLook('s0', { clothes: ['cape'] }, 2), q2 = B.get(q && q.id);
      var R2 = rig({ allowed: null }); var p2 = R2.A.addLook('s0', { clothes: ['hat'], eyes: 'green' }, 0);
      T.check('actions_look_clothes_refused_when_not_cleared', p.look.clothes.join() === 'hat' && p.look.eyes === 'blue' && /cape/.test(said) && /cleared wardrobe/.test(said) && (!q || !q2.look.clothes) && !('clothes' in p2.look) && p2.look.eyes === 'green' && /not connected/.test(R2.ctx._said.join(' ')));
    });
    S('actions_shader_blend_at_least_0_4s', function () {
      var R = rig(), A = R.A, B = R.B;
      B.add({ slot: 's0', kind: 'look', t: 0, payload: { tint: [0, 0, 0], shader: 'a' } });
      B.add({ slot: 's0', kind: 'look', t: 0.1, payload: { tint: [1, 1, 1], shader: 'b' } });
      var tt = B.list().filter(function (p) { return p.kind === 'look'; }).map(function (p) { return p.t; });
      var a39 = B.stateAt(0.39).s0.look.tint[0], a40 = B.stateAt(0.4).s0.look.tint[0], a20 = B.stateAt(0.2).s0.look.tint[0];
      T.check('actions_shader_blend_at_least_0_4s', tt.join() === '0,0.4' && a39 < 1 && a39 > 0.9 && a40 === 1 && near(a20, 0.5, 0.05));
    });
    S('actions_clamp_trips_on_bad_scene', function () {
      var R = rig(), A = R.A;
      var bad = [0, 0.1, 0.2, 0.3, 0.35].map(function (t, i) { return { id: 'b' + i, t: t, slot: 's' + i, kind: 'look', look: { tint: [i, 0, 0] } }; });
      var r = A.clamp(bad), times = r.beats.map(function (p) { return p.t; });
      var worst = 0; times.forEach(function (t) { var n = times.filter(function (u) { return u >= t && u < t + 1; }).length; if (n > worst) worst = n; });
      var good = A.clamp([{ id: 'x', t: 0, slot: 's0', kind: 'look', look: {} }, { id: 'y', t: 1, slot: 's0', kind: 'look', look: {} }]);
      /* a scene loaded with a bad list is cleaned by the beats part itself */
      R.B.pinsSet(bad); var live = R.B.list().map(function (p) { return p.t; });
      T.check('actions_clamp_trips_on_bad_scene', r.changed && worst <= 3 && times.join() === '0,0.4,0.8,1.2,1.6' && r.beats.length === 5 && good.changed === false && good.messages.length === 0 && live.join() === '0,0.4,0.8,1.2,1.6');
    });
    S('actions_clamp_idempotent', function () {
      var R = rig(), A = R.A;
      var bad = [0, 0.1, 0.15, 0.3, 0.5, 0.52].map(function (t, i) { return { id: 'b' + i, t: t, slot: 's0', kind: i % 2 ? 'look' : 'look', look: { n: i } }; });
      bad.push({ id: 'e', t: 0.05, slot: 's0', kind: 'say', rec: 'vo' });
      var once = A.clamp(bad), twice = A.clamp(once.beats);
      T.check('actions_clamp_idempotent', once.changed && twice.changed === false && JSON.stringify(once.beats) === JSON.stringify(twice.beats) && once.beats.some(function (p) { return p.kind === 'say' && p.t === 0.05; }) && twice.messages.length === 0);
    });
    S('actions_clamp_message_no_em_dash', function () {
      var R = rig(), A = R.A;
      var r = A.clamp([0, 0.1].map(function (t, i) { return { id: 'q' + i, t: t, slot: 's0', kind: 'look', look: {} }; })), r4 = A.clamp([0, 0.05, 0.1, 0.15].map(function (t, i) { return { id: 'q' + i, t: t, slot: 's0', kind: 'look', look: {} }; }));
      var said = []; R.A.addSay('s0', ''); R.A.addLook('s0', ['shader']);
      T.check('actions_clamp_message_no_em_dash', r.messages.length === 1 && !hasDash(r.messages[0]) && /nothing flashes/.test(r.messages[0]) && /^One /.test(r.messages[0]) && /^Three /.test(r4.messages[0]) && R.ctx._said.every(function (m) { return !hasDash(m); }));
    });
    S('actions_sound_once_calls_playMode_once', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.add({ kind: 'sound', slot: 'sound:bell', gizmoId: 'bell', mode: 'once', t: 1 });
      B.play(0); R.step(2);
      var sounds = R.calls.filter(function (c) { return c[0] === 'sound'; });
      T.check('actions_sound_once_calls_playMode_once', sounds.length === 1 && sounds[0][1] === 'bell' && sounds[0][2] === 'once');
    });
    S('actions_unknown_kind_dropped_not_thrown', function () {
      var R = rig(), A = R.A, B = R.B, threw = false, r = null;
      try { r = A.sanitize([{ id: 'a', t: 0, slot: 's0', kind: 'pose', pose: {} }, { id: 'b', t: 1, slot: 's0', kind: 'warp', x: 1 }, null, 5, { t: 'x', kind: 'say' }, { id: 'c', t: 2, slot: 's0', kind: 'say', rec: 'v' }]); B.pinsSet([{ t: 1, slot: 's0', kind: 'warp', x: 1 }]); B.play(0); R.step(1); } catch (e) { threw = true; }
      var fired = R.calls.length;
      T.check('actions_unknown_kind_dropped_not_thrown', !threw && r.beats.length === 2 && r.dropped === 4 && fired === 0 && A.isKnown('say') && !A.isKnown('warp'));
    });
    S('actions_deterministic_scrub', function () {
      var mk = function () { var R = base(rig()); R.B.add({ slot: 's0', kind: 'look', t: 0, payload: { tint: [0, 0, 0], clothes: ['shirt'] } }); R.A.addLook('s0', { tint: [1, 1, 1] }, 2); return R; };
      var P = mk(), Q = mk();
      P.B.play(0); P.step(1.7); Q.B.scrub(1.7);
      T.check('actions_deterministic_scrub', P.B.math.same(P.figs, Q.figs, 1e-9) && P.B.math.same(P.B.stateAt(1.7), Q.B.stateAt(1.7), 0));
    });
    S('actions_stop_stops_sound_and_voice', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.addSay('s0', 'vo_hello', 0.5); A.add({ kind: 'sound', slot: 'sound:rain', gizmoId: 'rain', mode: 'loop', t: 0.6 });
      B.play(0); R.step(1);
      var live = R.count('play') === 1 && A.activeCount() >= 2 && A.mouth('s0') > 0.05;
      B.stop();
      var stopped = R.calls.filter(function (c) { return c[0] === 'sound' && c[2] === 'stop'; }).length === 1 && R.count('vstop') === 1 && A.activeCount() === 0 && A.mouth('s0') === 0;
      var P = base(rig()); P.A.addSay('s0', 'vo_hello', 0.5); P.B.play(0); P.step(1); P.B.pause();
      T.check('actions_stop_stops_sound_and_voice', live && stopped && P.count('vstop') === 1 && P.A.activeCount() === 0);
    });
    S('actions_face_absent_message', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.add({ kind: 'face', slot: 's0', expression: 'smile', t: 0.5 });
      B.play(0); R.step(1.5); B.stop(); B.play(0); R.step(1);
      var said = R.ctx._said.filter(function (m) { return /Face changes are not connected/.test(m); });
      var W = base(rig({ face: true })); W.A.add({ kind: 'face', slot: 's0', expression: 'smile', t: 0.5 }); W.B.play(0); W.step(1);
      T.check('actions_face_absent_message', said.length === 2 && W.count('face') === 1 && W.calls.filter(function (c) { return c[0] === 'face'; })[0][2] === 'smile' && !W.ctx._said.some(function (m) { return /Face changes/.test(m); }));
    });
    S('actions_hostile_input_ok', function () {
      var R = rig(), A = R.A, B = R.B, threw = false;
      var evil = JSON.parse('{"a":{"__proto__":{"polluted":1}}}');
      var junk = [null, 5, 'x', [], {}, { t: 1 }, { t: 1, slot: 's0', kind: 'say' }, { t: 1, slot: 's0', kind: 'say', rec: 5 }, { t: 1, slot: 's0', kind: 'sound', gizmoId: { x: 1 } }, { t: 1, slot: 's0', kind: 'look', look: { clothes: 7 } }, { t: 1, slot: 's0', kind: 'look', look: { clothes: [null, 5, { id: 5 }, 'hat'] } }, { t: 1, slot: 's0', kind: 'seat', seatId: { a: 1 } }, { t: 1, slot: '__proto__', kind: 'say', rec: 'x' }, { t: 1, slot: 's0', kind: 'script', name: evil }];
      try {
        A.clamp(junk); A.clamp(null); A.clamp('x'); A.sanitize(junk); A.sanitize(null); B.pinsSet(junk); B.load({ pins: junk });
        A.addSay(null, null); A.addSay('s0', 'x'.repeat(500)); A.addLook('nobody', ['shader']); A.addLook('s0', 5); A.addLook('s0', [5, null]); A.add(null); A.add({ kind: 'nonsense' }); A.add({ kind: 'sound' }); A.hold(null); A.hold({ kind: 'say', slot: 's0', rec: {} });
        A.register('Bad Kind', {}); A.register('x', null); A.register('ok_kind', { start: function () { throw new Error('boom'); } });
        B.add({ slot: 's0', kind: 'ok_kind', t: 0.2, payload: {} }); base(R); B.play(0); R.step(1); B.stop(); A.rows({ say: function () {}, redraw: function () {} });
      } catch (e) { threw = e; }
      T.check('actions_hostile_input_ok', !threw && ({}).polluted === undefined && B.list().length <= 300);
    });
    S('actions_tick_cost', function () {
      var R = rig(), A = R.A, B = R.B;
      for (var i = 0; i < 12; i++) { R.figs.s0.pose = mkPose(i * 0.1, 1.4); B.addBeatNow(['s0']); }
      for (var j = 0; j < 6; j++) A.add({ kind: 'sound', slot: 'sound:s' + j, gizmoId: 's' + j, mode: 'loop', t: j * 0.7 + 0.05 });
      A.addSay('s0', 'vo_hello', 0.5); A.add({ kind: 'script', slot: 'scene', name: 'tick', t: 1 });
      B.setMode('loop'); B.play(0);
      var t0 = kit.ms(); for (var k = 0; k < 1000; k++) R.g.tick(1 / 60); var per = (kit.ms() - t0) / 1000;
      T.value('actions_tick_cost_ms_per_tick', Math.round(per * 10000) / 10000);
      T.check('actions_tick_cost', B.clock.playing && per < 0.5 && A.activeCount() >= 1);
    });

    /* ---- the rest of the contract ---- */
    S('actions_register_custom_kind', function () {
      var R = base(rig()), A = R.A, B = R.B, log = [];
      var ok = A.register('spark', { looks: true, validate: function (p) { return typeof p.colour === 'string' ? Object.assign({}, p, { colour: p.colour.slice(0, 7) }) : 'A spark needs a colour.'; }, hold: function () { return 0.7; }, start: function (p) { log.push('start:' + p.colour); }, stop: function () { log.push('stop'); } });
      var good = A.add({ kind: 'spark', slot: 'scene', colour: '#ff00ffaaaa', t: 1 }), bad = A.add({ kind: 'spark', slot: 'scene', t: 2 });
      B.add({ slot: 's0', kind: 'look', t: 1.1, payload: { tint: [1, 0, 0] } });
      var times = B.list().filter(function (p) { return p.kind === 'look' || p.kind === 'spark'; }).map(function (p) { return p.kind + p.t; });
      B.play(0); R.step(1.5); var mid = A.activeCount(); B.stop();
      T.check('actions_register_custom_kind', ok && !!good && good.colour === '#ff00ff' && bad === null && log.join() === 'start:#ff00ff,stop' && mid === 1 && A.kinds().indexOf('spark') >= 0 && A.clamp([{ id: 'a', t: 0, slot: 'x', kind: 'spark' }, { id: 'b', t: 0.1, slot: 'x', kind: 'look', look: {} }]).changed);
    });
    S('actions_other_kinds_call_adapters', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.add({ kind: 'ragdoll', slot: 's0', clipId: 'fall1', t: 0.2 });
      A.add({ kind: 'seat', slot: 's0', seatId: 'chair1', t: 0.4 }); A.add({ kind: 'seat', slot: 's0', seatId: 'stand', t: 0.6 });
      A.add({ kind: 'script', slot: 'scene', name: 'hello', t: 0.8 }); A.add({ kind: 'camera', slot: 'scene', shot: 'wide', t: 1.0 });
      B.play(0); R.step(2); B.stop();
      var c = R.calls.map(function (x) { return x.slice(0, 3).join(':'); }).join();
      T.check('actions_other_kinds_call_adapters', /clip:s0:fall1/.test(c) && /sit:s0:chair1/.test(c) && /stand:s0/.test(c) && /script:scene:/.test(c) && R.calls.some(function (x) { return x[0] === 'script' && x[3] === 'beat' && x[4] === 'hello'; }) && /shot:wide/.test(c));
    });
    S('actions_guest_runs_nothing', function () {
      var G = rig({ guest: true }), A = G.A, B = G.B;
      B.pinsSet([{ id: 'a', t: 0, slot: 's0', kind: 'pose', pose: mkPose(0, 1) }, { id: 'b', t: 2, slot: 's0', kind: 'pose', pose: mkPose(1, 1) }, { id: 'c', t: 0.5, slot: 's0', kind: 'say', rec: 'vo_hello' }, { id: 'd', t: 0.6, slot: 'sound:x', kind: 'sound', gizmoId: 'x', mode: 'once' }]);
      var added = A.addSay('s0', 'vo_hello', 1), look = A.addLook('s0', { shader: 'a' }, 1);
      var drove = B.play(0); G.step(1);
      T.check('actions_guest_runs_nothing', added === null && look === null && drove === false && G.calls.length === 0 && B.list().length === 4);
    });
    S('actions_nothing_runs_when_scene_opens', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.addSay('s0', 'vo_hello', 0.5); A.add({ kind: 'sound', slot: 'sound:a', gizmoId: 'a', mode: 'loop', t: 0.1 });
      var saved = cl(R.g.state()), Q = rig(); Q.g.load(saved); Q.step(5); Q.g.setLive(true); Q.step(5);
      T.check('actions_nothing_runs_when_scene_opens', Q.B.list().length === 4 && Q.calls.length === 0 && Q.A.activeCount() === 0 && Q.B.clock.playing === false);
    });
    S('actions_rows_and_panel', function () {
      var R = base(rig(), 4), B = R.B, A = R.A, said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      var rows = B.strip.rows(H), labels = rows.map(function (r) { return r.label; });
      var addVoice = rows.filter(function (r) { return /^Add voice: vo_hello/.test(r.label); })[0];
      addVoice.act();
      var sh = B.strip.rows(H).filter(function (r) { return r.label === 'Add shader beat'; })[0]; sh.act();
      var card = B.strip.model().filter(function (c) { return c.icons.indexOf('voice') >= 0; })[0]; B.strip.select(card.id);
      var rows2 = B.strip.rows(H), longer = rows2.filter(function (r) { return /^Hold longer/.test(r.label); })[0]; var sayPin = B.list().filter(function (p) { return p.kind === 'say'; })[0], h0 = sayPin.hold; longer.act();
      var all = labels.concat(rows2.map(function (r) { return r.label; }));
      var dom = kit.makeFakeDom(), host = dom.createElement('div'); R.g.mountPanel(host);
      var btns = kit.domFind(host, function (e) { return e.tagName === 'BUTTON'; }).map(function (b) { return b._text; });
      var G = rig({ guest: true }), gd = kit.makeFakeDom(), gh = gd.createElement('div'); G.g.mountPanel(gh);
      var gtxt = kit.domText(gh);
      T.check('actions_rows_and_panel', labels.some(function (l) { return /^Add voice: vo_bye/.test(l); }) && labels.indexOf('Add clothes beat') > 0 && B.list().some(function (p) { return p.kind === 'say'; }) && B.get(sayPin.id).hold === h0 + 0.5 && h0 === 1.5 && all.every(function (l) { return !hasDash(l); }) &&
        btns.indexOf('Add voice beat') >= 0 && btns.indexOf('Add shader beat') >= 0 && !/add voice|add shader/.test(gtxt) && !/save|export|download/.test(kit.domText(host)));
    });
    S('actions_no_em_dash_in_module_text', function () {
      var R = rig({ allowed: ['hat'], noVoice: true }), A = R.A;
      A.addLook('s0', { clothes: ['cape'], tint: [1, 1, 1] }, 0); A.addSay('s0', 'vo_hello', 1); A.add({ kind: 'face', slot: 's0', expression: 'x', t: 0.5 });
      base(R); R.B.play(0); R.step(2);
      T.check('actions_no_em_dash_in_module_text', R.ctx._said.length >= 3 && R.ctx._said.every(function (m) { return !hasDash(m); }));
    });
    S('actions_once_end_does_not_restart_first_beat', function () {
      var R = base(rig()), A = R.A, B = R.B;
      A.addSay('s0', 'vo_hello', 0);
      B.play(0); R.step(5);
      var once = R.count('play'); B.setMode('loop'); B.play(0); R.step(9); var loops = R.count('play') - once; B.stop();
      T.check('actions_once_end_does_not_restart_first_beat', once === 1 && loops === 3);
    });
  }

  var api = { stage: 'H2', section: 'actions', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H2 = api;
})();
