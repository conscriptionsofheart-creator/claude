/* gizmo_next_trigger_selftest.js: the checks for stage H3 (the Trigger box). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=trigger     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_trigger.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._beatsRegister(); kit.GizmoNext._triggerRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var guestPeer = function (id, name, x, z) { return kit.makePeer(id, name, [x, 1.6, z], { guest: true }); };

    /* a fake room: the host's head far away, friends you can move, and every adapter a start can call */
    function rig(o) {
      o = o || {};
      var calls = [], clock = kit.makeClock();
      var peers = o.peers || [];
      var g = kit.makeInst({
        clock: clock, head: o.head || [0, 1.6, 20], peers: peers, props: o.props || [], figures: o.figures || [], guest: !!o.guest,
        sounds: { playMode: function (id, m) { calls.push(['sound', id, m, clock.now()]); } },
        scripts: { event: function (k, id, ev, n) { calls.push(['script', k, ev, n, clock.now()]); } },
        seat: { sit: function (who, id) { calls.push(['sit', who, id]); } },
        spawn: { send: function (who, id) { calls.push(['spawn', who, id]); } },
        setObjectVisible: function (n, on) { calls.push(['show', n, on]); },
        triggerChoices: function () { return { sound: ['bell'], seat: ['chair1'], script: ['hello'] }; }
      });
      var R = { g: g, T: g.modules.trigger, B: g.modules.beats, peers: peers, calls: calls, clock: clock, ctx: g._ctx };
      R.step = function (sec) { return kit.stepSeconds(g, sec); };
      R.count = function (k) { return calls.filter(function (c) { return c[0] === k; }).length; };
      R.live = function () { g.setLive(true); return R; };
      /* one trigger at the origin, 2 m cube whose centre is 1 m up (the floor is its bottom), armed unless told not to */
      R.box = function (over) { return R.T.add(Object.assign({ x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, who: 'anyone', when: 'enter', often: 'visit', starts: [{ do: 'script', arg: 'hi', delay: 0 }] }, over || {})); };
      R.fires = function () { return g.logList().filter(function (e) { return / (entered|left)/.test(e.what); }).length; };
      R.fireLog = function () { return g.logList().filter(function (e) { return / (entered|left)/.test(e.what); }); };
      R.evs = function (name) { var n = 0; g.on(name, function () { n++; }); return function () { return n; }; };
      return R;
    }
    /* a check made of labelled conditions: when it fails, the names of the ones that failed are printed */
    var all = function (name, conds) { var bad = Object.keys(conds).filter(function (k) { return !conds[k]; }); if (bad.length) T.value(name + '_failed_parts', bad.join(' ')); return T.check(name, !bad.length); };
    var put = function (p, x, z) { kit.movePeer(p, x, 1.6, z); };

    S('trigger_kind_registered', function () {
      var R = rig(), g = R.g, rec = R.box({ armed: false });
      var labels = g._kinds.trigger.spec.fields.map(function (f) { return f.label; });
      var mk = rec._mk, c0 = mk && mk.children[0], flagged = true; mk.traverse(function (o) { if (!o.userData || o.userData.isMarker !== true) flagged = false; });
      var e = g.entries([]).filter(function (x) { return x.kind === 'trigger'; })[0];
      T.check('trigger_kind_registered', g.has('trigger') && !!R.T && g._kinds.trigger.spec.max === 12 && g._kinds.trigger.spec.copyable && g._kinds.trigger.spec.resize === 'size' && g._kinds.trigger.spec.col === '#ff8a5c' &&
        ['Triggered By', 'Enabled', 'Armed', 'When', 'How often', 'Cooldown (s)', 'Objects Tagged'].every(function (l) { return labels.indexOf(l) >= 0; }) && rec.armed === false && flagged && c0.isMesh && !!e && e.object === mk && R.ctx._said.length >= 0);
    });
    S('trigger_enter_fires_once', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box(); var en = R.evs('enter');
      R.step(0.2); put(p, 0.2, 0); R.step(0.5); R.step(2);
      T.check('trigger_enter_fires_once', R.fires() === 1 && en() === 1 && R.count('script') === 1 && R.calls[0][3] === 'hi' && R.fireLog()[0].who === 'Trigger box' && /Rosa entered/.test(R.fireLog()[0].what));
    });
    S('trigger_leave_fires', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); var r = R.box({ when: 'leave', starts: [{ do: 'script', arg: 'bye', delay: 0 }] }); var lv = R.evs('leave'), en = R.evs('enter');
      put(p, 0, 0); R.step(0.3); var a = R.count('script'); put(p, 5, 0); R.step(0.3);
      var R2 = rig({ peers: [guestPeer('p2', 'Ann', 5, 0)] }); R2.live(); R2.box({ when: 'both' }); put(R2.peers[0], 0, 0); R2.step(0.3); put(R2.peers[0], 5, 0); R2.step(0.3);
      T.check('trigger_leave_fires', a === 0 && R.count('script') === 1 && lv() === 1 && en() === 1 && R2.count('script') === 2 && /left/.test(R.g.logList().slice(-1)[0].what));
    });
    S('trigger_hysteresis_15cm_no_flap', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box({ when: 'both', often: 'every' }); var lv = R.evs('leave'), en = R.evs('enter');
      var path = [0.95, 1.05, 0.98, 1.1, 0.99, 1.14, 1.0, 1.12]; path.forEach(function (x) { put(p, x, 0); R.step(0.1); });
      var noFlap = en() === 1 && lv() === 0;
      put(p, 1.2, 0); R.step(0.1);
      T.check('trigger_hysteresis_15cm_no_flap', noFlap && lv() === 1 && en() === 1);
    });
    S('trigger_once_per_visitor_two_presences', function () {
      var a = guestPeer('a', 'Ann', 6, 0), b = guestPeer('b', 'Ben', -6, 0), R = rig({ peers: [a, b] }); R.live(); R.box({ often: 'visit' });
      put(a, 0, 0); R.step(0.3); var n1 = R.count('script'); put(b, 0, 0.5); R.step(0.3); var n2 = R.count('script');
      put(a, 6, 0); R.step(0.3); put(a, 0, 0); R.step(0.3); var n3 = R.count('script');
      T.check('trigger_once_per_visitor_two_presences', n1 === 1 && n2 === 2 && n3 === 2);
    });
    S('trigger_second_guest_fires_again', function () {
      var a = guestPeer('a', 'Ann', 6, 0), R = rig({ peers: [a] }); R.live(); R.box({ often: 'visit' });
      put(a, 0, 0); R.step(0.3); var n1 = R.count('script');
      R.peers.splice(0, 1); R.step(0.3); /* Ann left the room: her visit is over */
      var a2 = guestPeer('a', 'Ann', 0, 0); R.peers.push(a2); R.step(0.3); var n2 = R.count('script');
      var c = guestPeer('c', 'Cleo', 0, 0); R.peers.push(c); R.step(0.3);
      T.check('trigger_second_guest_fires_again', n1 === 1 && n2 === 2 && R.count('script') === 3);
    });
    S('trigger_every_time_mode', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box({ often: 'every' });
      for (var i = 0; i < 3; i++) { put(p, 0, 0); R.step(0.2); put(p, 5, 0); R.step(0.2); }
      T.check('trigger_every_time_mode', R.count('script') === 3);
    });
    S('trigger_cooldown_blocks_then_allows', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box({ often: 'cooldown', cooldown: 5 });
      put(p, 0, 0); R.step(0.2); put(p, 5, 0); R.step(0.2); put(p, 0, 0); R.step(0.2); var blocked = R.count('script');
      put(p, 5, 0); R.step(6); put(p, 0, 0); R.step(0.2);
      T.check('trigger_cooldown_blocks_then_allows', blocked === 1 && R.count('script') === 2);
    });
    S('trigger_guests_only_ignores_host_head', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p], head: [0, 1.6, 0] }); R.live(); R.box({ who: 'guests' });
      R.step(1); var none = R.count('script'); put(p, 0.3, 0); R.step(0.3);
      T.check('trigger_guests_only_ignores_host_head', none === 0 && R.count('script') === 1 && R.g.logList().slice(-1)[0].what.indexOf('Rosa') === 0);
    });
    S('trigger_me_only', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p], head: [0, 1.6, 20] }); R.live(); R.box({ who: 'me' });
      R.step(0.5); var none = R.count('script'); R.ctx._head = [0, 1.6, 0]; R.step(0.3);
      T.check('trigger_me_only', none === 0 && R.count('script') === 1 && /Me entered/.test(R.g.logList().slice(-1)[0].what));
    });
    S('trigger_named_person', function () {
      var a = guestPeer('a', 'Ann', 0, 0), r = guestPeer('r', 'rosa', 5, 0), R = rig({ peers: [a, r] }); R.live(); R.box({ who: 'named', names: ['Rosa'] });
      R.step(0.3); var none = R.count('script'); put(r, 0, 0); R.step(0.3);
      T.check('trigger_named_person', none === 0 && R.count('script') === 1 && /rosa entered/.test(R.g.logList().slice(-1)[0].what));
    });
    S('trigger_objects_tagged_list', function () {
      var THREE = kit.THREE, coin = new THREE.Object3D(), rock = new THREE.Object3D(), key = new THREE.Object3D();
      coin.position.set(5, 1, 0); rock.position.set(0, 1, 0); key.position.set(6, 1, 0);
      var R = rig({ props: [{ id: 'coin1', name: 'Coin', object: coin, tags: ['coin'] }, { id: 'rock1', name: 'Rock', object: rock, tags: ['rock'] }, { id: 'key1', name: 'Key', object: key, tags: ['key', 'gold'] }] }); R.live();
      R.box({ by: 'objects', tags: ['key', 'coin'] }); R.step(0.3); var none = R.count('script');
      coin.position.set(0.5, 1, 0); R.step(0.3); var one = R.count('script'); key.position.set(0, 1, 0.5); R.step(0.3);
      T.check('trigger_objects_tagged_list', none === 0 && one === 1 && R.count('script') === 2 && /Coin entered/.test(R.fireLog()[0].what));
    });
    S('trigger_disarmed_on_open_never_fires', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.live();
      var r = R.T.add({ x: 0, y: 1, z: 0, size: [2, 2, 2], starts: [{ do: 'script', arg: 'hi', delay: 0 }] }), wasArmed = r.armed;
      R.step(2);
      var copyId = R.g.dup({ kind: 'trigger', id: r.id }, { x: 0, y: 1, z: 0 }, ''); R.T.get(r.id) && R.g.setLive(true);
      kapiSet(R, r.id, { armed: true }); var dup = R.g.dup({ kind: 'trigger', id: r.id }, { x: 0, y: 1, z: 0 }, '');
      all('trigger_disarmed_on_open_never_fires', { added_disarmed: wasArmed === false, no_script: R.count('script') === 0, copy_disarmed: R.T.get(copyId).armed === false, dup_disarmed: R.T.get(dup).armed === false, no_fires: R.fires() === 0 });
    });
    function kapiSet(R, id, patch) { return R.T.kind.set(id, patch); }
    S('trigger_live_off_never_fires', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.box(); R.step(3);
      var off = R.fires() === 0 && R.count('script') === 0; R.g.setLive(true); R.step(0.3); var on = R.count('script') === 1; R.g.setLive(false); put(p, 5, 0); R.step(0.3); put(p, 0, 0); R.step(0.3);
      T.check('trigger_live_off_never_fires', off && on && R.count('script') === 1);
    });
    S('trigger_enabled_false_never_fires', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.live(); R.box({ enabled: false }); R.step(2);
      T.check('trigger_enabled_false_never_fires', R.count('script') === 0 && R.fires() === 0);
    });
    S('trigger_guest_page_never_fires', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p], guest: true });
      R.g.load({ kinds: { trigger: { items: [{ id: 'trigger1', x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, starts: [{ do: 'script', arg: 'hi', delay: 0 }] }] } } });
      R.g._live = true; R.step(2);
      T.check('trigger_guest_page_never_fires', R.count('script') === 0 && R.fires() === 0 && R.T.test('trigger1') === false);
    });
    S('trigger_resize_changes_detection', function () {
      var p = guestPeer('p1', 'Rosa', 1.5, 0), R = rig({ peers: [p] }); R.live(); var r = R.box({ often: 'every' }); R.step(0.3); var out = R.count('script');
      R.T.kind.set(r.id, { size: [4, 2, 4] }); R.step(0.3);
      T.check('trigger_resize_changes_detection', out === 0 && R.count('script') === 1 && r.size[0] === 4);
    });
    S('trigger_rotated_box', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box({ yaw: Math.PI / 4, when: 'both', often: 'every' }); var en = R.evs('enter'), lv = R.evs('leave');
      put(p, 1.3, 0); R.step(0.2); var corner = en() === 1; put(p, 5, 0); R.step(0.2);
      put(p, 0.9, 0.9); R.step(0.2); var cornerOut = en() === 1; put(p, 0.6, 0.6); R.step(0.2); var cornerIn = en() === 2;
      T.check('trigger_rotated_box', corner && cornerOut && cornerIn && lv() === 1);
    });
    S('trigger_sleeps_over_25m', function () {
      var p = guestPeer('p1', 'Rosa', 30, 0), R = rig({ peers: [p], head: [0, 1.6, 40] }); R.live(); var r = R.box(); R.step(0.3);
      var far = R.T.isAsleep(r.id) && R.T.stats.sleeping === 1 && R.T.stats.tests === 0; put(p, 20, 0); R.step(0.3);
      T.check('trigger_sleeps_over_25m', far && !R.T.isAsleep(r.id) && R.T.stats.tests > 0);
    });
    S('trigger_box_tests_capped_40', function () {
      var ps = [0, 1, 2, 3].map(function (i) { return guestPeer('p' + i, 'P' + i, 5, 0); }), R = rig({ peers: ps, head: [0, 1.6, 20] }); R.live();
      for (var i = 0; i < 12; i++) R.box({ x: i * 0.1, z: 0, name: 'T' + i, often: 'every' });
      var worst = 0; R.step(0.1); put(ps[3], 0.2, 0); for (var k = 0; k < 8; k++) { R.step(1 / 60); if (R.T.stats.lastTests > worst) worst = R.T.stats.lastTests; }
      T.check('trigger_box_tests_capped_40', worst <= 40 && worst >= 30 && R.T.stats.maxTests <= 40 && R.count('script') >= 1);
    });
    S('trigger_hide_gizmos_keeps_logic', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); var r = R.box();
      R.ctx.gizmos.setHidden('trigger', true); R.step(0.2); var hidden = r._mk.visible === false; put(p, 0, 0); R.step(0.3);
      T.check('trigger_hide_gizmos_keeps_logic', hidden && R.count('script') === 1);
    });
    S('trigger_starts_run_in_order_with_delays', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live();
      R.box({ starts: [{ do: 'sound', arg: 'bell:loop', delay: 0 }, { do: 'script', arg: 'hello', delay: 0.5 }, { do: 'sound', arg: 'bell:stop', delay: 1 }, { do: 'seat', arg: 'chair1', delay: 1 }, { do: 'spawn', arg: '2', delay: 1.5 }, { do: 'show', arg: 'Sign', delay: 1.5 }, { do: 'hide', arg: 'Lock', delay: 2 }] });
      put(p, 0, 0); R.step(0.1); var t0 = R.calls.length; R.step(3);
      var order = R.calls.map(function (c) { return c[0] + ':' + (c[1] === 'script' ? '' : c[1]); }).join(','), t = R.calls.map(function (c) { return c[c.length - 1]; });
      var first = R.calls[0][0] === 'sound' && R.calls[0][2] === 'loop';
      T.check('trigger_starts_run_in_order_with_delays', t0 === 1 && first && R.calls.map(function (c) { return c[0]; }).join() === 'sound,script,sound,sit,spawn,show,show' && R.calls[4][2] === '2' && R.calls[5][2] === true && R.calls[6][2] === false && R.calls[2][2] === 'stop');
    });
    S('trigger_start_beats_calls_beats_range', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); var B = R.B;
      B.pinsSet([{ id: 'a', t: 0, slot: 's0', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 3, slot: 's0', kind: 'pose', pose: { x: 1 } }]); B.setRange('Greeting', 0, 2);
      R.box({ starts: [{ do: 'beats', arg: 'Greeting', delay: 0 }] });
      put(p, 0, 0); R.step(0.5); var playing = B.clock.playing && B.clock.t > 0.3 && B.clock.t < 0.7; R.step(2);
      var ended = !B.clock.playing && B.clock.t === 2 && B.clock.bracket === null && B.clock.mode === 'once';
      var R2 = rig({ peers: [guestPeer('q', 'Quin', 0, 0)] }); R2.live(); R2.box({ starts: [{ do: 'beats', arg: 'Nope', delay: 0 }] }); R2.step(0.3);
      T.check('trigger_start_beats_calls_beats_range', playing && ended && R2.B.clock.playing === false && R2.ctx._said.some(function (m) { return /Nope/.test(m); }) && B.getRange('Greeting').b === 2);
    });
    S('trigger_test_it_fake_visitor', function () {
      var R = rig(), r = R.box({ armed: false, starts: [{ do: 'sound', arg: 'bell', delay: 0 }, { do: 'script', arg: 'late', delay: 1 }] });
      var ok = R.T.test(r.id), mid = R.calls.length; R.g.setLive(true); R.step(1.5);
      var rows = R.g.rows({ kind: 'trigger', id: r.id }, { say: function () {}, redraw: function () {} }), testRow = rows.filter(function (x) { return x.label === 'Test it'; })[0];
      testRow.act();
      T.check('trigger_test_it_fake_visitor', ok && mid === 1 && R.calls[0][0] === 'sound' && R.fireLog()[0].what === 'A test visitor entered (test)' && R.count('script') === 1 && R.count('sound') === 2 && r._count === 2 && R.T.test('nothing') === false);
    });
    S('trigger_template_greeting_fields', function () {
      var R = rig(); R.B.pinsSet([{ id: 'a', t: 0, slot: 's0', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 2, slot: 's0', kind: 'pose', pose: { x: 1 } }]);
      var r = R.T.template('greeting');
      R.T.kind.set(r.id, { armed: true }); var p = guestPeer('p1', 'Rosa', r.x, r.z); R.peers.push(p); R.live(); R.step(0.5);
      all('trigger_template_greeting_fields', { rec: !!r, name: r.name === 'Greeting at the door', by: r.by === 'players', who: r.who === 'guests', when: r.when === 'enter', often: r.often === 'visit', start: r.starts[0].do === 'beats' && r.starts[0].arg === 'Greeting', range: R.B.getRange('Greeting').b === 2, playing: R.B.clock.playing === true, nope: R.T.template('nope') === null });
    });
    S('trigger_hostile_record_clamped', function () {
      var R = rig(), evil = JSON.parse('{"x":1e12,"y":"a","z":-1e12,"yaw":1e9,"size":[-5,1e9,"x"],"enabled":"yes","armed":1,"by":"nope","who":{"a":1},"names":' + JSON.stringify(new Array(100).fill('n')) + ',"tags":[1,null,"ok"],"when":"never","often":5,"cooldown":-9,"starts":[{"do":"__proto__","arg":"x"},{"do":"beats","arg":' + JSON.stringify('z'.repeat(500)) + ',"delay":-5},{"do":"sound","arg":"b","delay":1e9},5,null,{"__proto__":{"polluted":1}}],"__proto__":{"polluted":2},"name":' + JSON.stringify('N'.repeat(200)) + '}');
      var r = R.T.add(evil);
      T.check('trigger_hostile_record_clamped', !!r && r.size.every(function (v) { return v >= 0.02 && v <= 100; }) && r.names.length <= 24 && r.tags.join() === 'ok' && r.by === 'players' && r.when === 'enter' && r.cooldown === 0 && r.starts.length === 2 && r.starts[0].arg.length === 80 && r.starts[0].delay === 0 && r.starts[1].delay === 600 &&
        r.name.length <= 80 && Math.abs(r.x) <= 1e4 && ({}).polluted === undefined && r.armed === false);
    });
    S('trigger_json_roundtrip_nothing_runs', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.live(); R.box({ name: 'Door', armed: true, tags: ['a'], names: ['Rosa'], cooldown: 3 });
      R.g.setLive(false); var saved = cl(R.g.state());
      var Q = rig({ peers: [guestPeer('p1', 'Rosa', 0, 0)] }); Q.g.load(saved); Q.step(3);
      var back = Q.T.list()[0], same = JSON.stringify(Q.T.kind.toJSON()) === JSON.stringify(R.T.kind.toJSON());
      all('trigger_json_roundtrip_nothing_runs', { one_saved: saved.kinds.trigger.items.length === 1, same: same, armed: back.armed === true, name: back.name === 'Door', quiet: Q.count('script') === 0, no_fires: Q.fires() === 0, not_live: Q.g.isLive() === false, no_runtime: !('_count' in saved.kinds.trigger.items[0]) });
    });
    S('trigger_12_triggers_tick_cost', function () {
      var ps = [0, 1, 2].map(function (i) { return guestPeer('p' + i, 'P' + i, 4 + i, 0); }), R = rig({ peers: ps }); R.live();
      for (var i = 0; i < 12; i++) R.box({ x: i * 0.5, name: 'T' + i, often: 'every', starts: [] });
      var t0 = kit.ms(); for (var k = 0; k < 1000; k++) R.g.tick(1 / 60); var per = (kit.ms() - t0) / 1000;
      T.value('trigger_12_triggers_tick_cost_ms_per_tick', Math.round(per * 10000) / 10000);
      T.check('trigger_12_triggers_tick_cost', R.T.list().length === 12 && per < 0.5);
    });
    S('trigger_labels_no_em_dash', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }), r = R.box({ who: 'named', by: 'players' });
      var rows = R.g.rows({ kind: 'trigger', id: r.id }, { say: function (t) { R.ctx._said.push(t); }, redraw: function () {} });
      var labels = rows.map(function (x) { return x.label; }), tpl = R.T.template('greeting'); R.live(); put(p, 0, 0); R.step(0.3); R.T.test(r.id);
      var all = labels.concat(R.g._kinds.trigger.spec.fields.map(function (f) { return f.label; }), R.T.whenOptions().map(function (o) { return o.label; }), R.g.logList().map(function (e) { return e.what; }), R.ctx._said);
      T.check('trigger_labels_no_em_dash', all.length > 20 && all.every(function (l) { return !hasDash(l); }) && labels.indexOf('Test it') === 0 && labels.some(function (l) { return /^Add: Play a sound bell/.test(l); }) && labels.some(function (l) { return /^Add name: Rosa/.test(l); }) && R.T.whenOptions().some(function (o) { return o.event === 'leave'; }));
    });

    /* ---- the rest of the contract ---- */
    S('trigger_volume_shows_when_selected_or_hovered', function () {
      var R = rig(), r = R.box({ armed: false }), vol = r._vol;
      R.step(0.1); var hidden = !r._vol[0].visible && !r._vol[1].visible && !R.T.volumeShown(r.id);
      R.g.rows({ kind: 'trigger', id: r.id }, { say: function () {}, redraw: function () {} }); R.step(0.1); var sel = R.T.volumeShown(r.id) && r._vol[0].visible && r._vol[1].visible;
      R.g._sel = null; R.step(0.1); var off = !R.T.volumeShown(r.id); R.T.setHover(r.id, true); var hov = R.T.volumeShown(r.id); R.T.setHover(r.id, false);
      R.T.kind.set(r.id, { size: [3, 2, 3] }); R.T.setHover(r.id, true); var rebuilt = R.T.volumeShown(r.id) && r._vol !== vol;
      T.check('trigger_volume_shows_when_selected_or_hovered', hidden && sel && off && hov && !R.T.volumeShown(r.id) === false && rebuilt);
    });
    S('trigger_remember_names_off_by_default', function () {
      var p = guestPeer('p1', 'Rosa', 5, 0), R = rig({ peers: [p] }); R.live(); R.box({ often: 'ever' });
      var off = R.T.rememberNames === false; put(p, 0, 0); R.step(0.3); R.peers.splice(0, 1); R.step(0.3); R.peers.push(guestPeer('p9', 'Rosa', 0, 0)); R.step(0.3);
      var twice = R.count('script') === 2, stored0 = R.ctx.storage.get('jb_gizmonext_file_trigger_ever');
      var Q = rig({ peers: [guestPeer('p1', 'Rosa', 5, 0)] }); Q.live(); Q.T.rememberNames = true; Q.box({ often: 'ever' }); put(Q.peers[0], 0, 0); Q.step(0.3); Q.peers.splice(0, 1); Q.step(0.3); Q.peers.push(guestPeer('p9', 'Rosa', 0, 0)); Q.step(0.3);
      var once1 = Q.count('script') === 1, stored1 = Q.ctx.storage.get('jb_gizmonext_file_trigger_ever');
      T.check('trigger_remember_names_off_by_default', off && twice && stored0 === null && Q.T.rememberNames === true && once1 && typeof stored1 === 'string' && Q.ctx.storage.get('jb_gizmonext_file_trigger_prefs') !== null);
    });
    S('trigger_figures_if_ticked', function () {
      var f = { slot: 7, name: 'Statue', head: [0, 1.6, 0.2] }, R = rig({ figures: [f] }); R.live(); var r = R.box({ often: 'every' }); R.step(0.3); var off = R.count('script') === 0;
      R.T.kind.set(r.id, { figures: true }); R.step(0.3);
      T.check('trigger_figures_if_ticked', off && R.count('script') === 1 && /Statue entered/.test(R.fireLog()[0].what));
    });
    S('trigger_rows_edit_starts', function () {
      var R = rig(), r = R.box({ starts: [] }); R.B.pinsSet([{ id: 'a', t: 0, slot: 's0', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 2, slot: 's0', kind: 'pose', pose: { x: 1 } }]); R.B.setRange('Wave', 0, 2);
      var H = { say: function () {}, redraw: function () {} }, rows = function () { return R.g.rows({ kind: 'trigger', id: r.id }, H); };
      rows().filter(function (x) { return x.label === 'Add: Play beats Wave'; })[0].act(); rows().filter(function (x) { return x.label === 'Add: Play a sound bell'; })[0].act();
      var a = R.T.starts(r.id), delayRow = rows().filter(function (x) { return /^1\. Play beats: Wave, after 0 s/.test(x.label); })[0]; delayRow.act();
      var after = R.T.starts(r.id)[0].delay; rows().filter(function (x) { return x.label === 'Remove start 2'; })[0].act();
      T.check('trigger_rows_edit_starts', a.length === 2 && a[0].do === 'beats' && after === 0.5 && R.T.starts(r.id).length === 1 && R.ctx._undos >= 3 && R.T.addStart('nope', { do: 'sound' }) === false);
    });
    S('trigger_nothing_runs_when_scene_opens', function () {
      var p = guestPeer('p1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.box(); var saved = cl(R.g.state());
      var Q = rig({ peers: [guestPeer('p1', 'Rosa', 0, 0)] }); Q.g.load(saved); Q.step(5);
      var R3 = rig({ peers: [guestPeer('p1', 'Rosa', 0, 0)] }); R3.g.load(saved); R3.g.setLive(true); R3.step(0.3);
      T.check('trigger_nothing_runs_when_scene_opens', Q.count('script') === 0 && Q.fires() === 0 && R3.count('script') === 1);
    });
  }

  var api = { stage: 'H3', section: 'trigger', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H3 = api;
})();
