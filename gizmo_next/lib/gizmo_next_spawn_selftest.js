/* gizmo_next_spawn_selftest.js: the checks for stage H5 (spawn point v2 and the snap spot). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=spawn     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) require('./gizmo_next_spawn.js');

  function run(T, kit) { return kit.isolate(function () { var G = kit.GizmoNext; G._beatsRegister(); G._triggerRegister(); G._spawnRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var guest = function (id, name, x, z) { return kit.makePeer(id, name, [x, 1.6, z], { guest: true }); };

    /* the page's SpawnPoint, as spawn_point.js has it, with the one-only limit lifted by .max (SEAT EDIT H5-1) */
    function fakeSpawn(max) {
      var SP = { list: [], max: max, H: 0.25, nid: 1 };
      SP.add = function (spec) { if (SP.list.length >= (SP.max || 1)) return null; var m = Object.assign({ id: 'w' + (SP.nid++), name: 'Spawn point', x: 0, y: 0, z: 0, yaw: 0, locked: false, group: '' }, spec || {}); SP.list.push(m); return m; };
      SP.get = function (id) { return SP.list.find(function (m) { return m.id === id; }) || null; };
      SP.first = function () { return SP.list[0] || null; };
      return SP;
    }
    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), SP = fakeSpawn(o.max === undefined ? 4 : o.max), moves = [], sent = [], peers = o.peers || [], solid = o.solid || [];
      var g = kit.makeInst({
        clock: clock, sync: { send: function (n, v) { sent.push([n, v]); }, on: function () {} }, head: o.head || [0, 1.6, 30], peers: peers, props: o.props || [], spawn: SP, guest: !!o.guest,
        floorFn: function (x, z) { return Math.abs(x) > 50 ? null : 0; },
        solidAt: function (x, y, z) { return solid.some(function (b) { return Math.abs(x - b[0]) < b[3] && Math.abs(y - b[1]) < b[4] && Math.abs(z - b[2]) < b[3]; }); },
        teleport: function (v, a) { moves.push({ v: v, a: a, t: clock.now() }); },
        inRoom: function (p) { return Math.abs(p[0]) < 10 && Math.abs(p[2]) < 10; },
        selfId: function () { return o.selfId || 'me'; }
      });
      var R = { g: g, S: g.modules.spawn, SP: SP, moves: moves, sent: sent, peers: peers, clock: clock, ctx: g._ctx };
      R.step = function (sec) { return kit.stepSeconds(g, sec); };
      R.live = function () { g.setLive(true); return R; };
      R.pt = function (spec, fields) { var m = SP.add(spec); if (m && fields) R.S.setFields(m.id, fields); return m; };
      return R;
    }
    var put = function (p, x, y, z) { p.head = [x, y + 1.6, z]; p.feet = [x, y, z]; };

    S('spawn_two_points_exist', function () {
      var R = rig({ max: 2 }), a = R.pt({ name: 'One', x: 1, z: 2 }), b = R.pt({ name: 'Two', x: -3, z: 4 }), c = R.SP.add({}), one = rig({ max: 0 }); one.pt({}); var none = one.SP.add({});
      T.check('spawn_two_points_exist', !!a && !!b && c === null && R.S.count() === 2 && R.S.list().map(function (m) { return m.name; }).join() === 'One,Two' && none === null && one.S.count() === 1);
    });
    S('spawn_first_guest_point1_facing_arrow', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }).live(); R.pt({ name: 'P1', x: 2, z: -3, yaw: 0.8 }, { order: 1 }); R.pt({ name: 'P2', x: -4, z: 5, yaw: -1 }, { order: 2 });
      var a = R.S.onJoin(R.peers[0]);
      T.check('spawn_first_guest_point1_facing_arrow', !!a && a.point === 'w1' && a.x === 2 && a.z === -3 && near(a.yaw, 0.8) && a.fadeSec === 0.4 && a.gravity === 9.81 && a.speed === 4 && a.setPositionOnly === false && R.moves.length === 0 && R.g.logList().some(function (e) { return /Rosa arrived at P1/.test(e.what); }));
    });
    S('spawn_second_guest_point2_take_turns', function () {
      var a = guest('g1', 'Ann', 40, 40), b = guest('g2', 'Ben', 40, 41), c = guest('g3', 'Cleo', 40, 42), R = rig({ peers: [a, b, c] }).live();
      R.pt({ name: 'P1', x: 1 }, { order: 1, pick: 'turns' }); R.pt({ name: 'P2', x: 2 }, { order: 2 });
      var r = [R.S.onJoin(a), R.S.onJoin(b), R.S.onJoin(c)].map(function (x) { return x.point; });
      var dry = R.S.choose(a, { commit: false }), dry2 = R.S.choose(a, { commit: false });
      T.check('spawn_second_guest_point2_take_turns', r.join() === 'w1,w2,w1' && dry.id === 'w2' && dry2.id === 'w2' && R.S.state().turn === 3);
    });
    S('spawn_random_seeded_reproducible', function () {
      var run = function (seed) { var R = rig(); for (var i = 0; i < 4; i++) R.pt({ name: 'P' + i, x: i }, { order: i + 1, pick: i === 0 ? 'random' : 'order' }); R.S.seed(seed); var out = []; for (var k = 0; k < 12; k++) out.push(R.S.choose({ id: 'v' + k, name: 'V', guest: true }).id); return out.join(); };
      var a = run(7), b = run(7), c = run(99), counts = {}; a.split(',').forEach(function (id) { counts[id] = 1; });
      T.check('spawn_random_seeded_reproducible', a === b && a !== c && Object.keys(counts).length >= 2);
    });
    S('spawn_order_lowest_wins', function () {
      var R = rig(); R.pt({ name: 'Late', x: 1 }, { order: 5 }); R.pt({ name: 'First', x: 2 }, { order: 1 }); R.pt({ name: 'Tie', x: 3 }, { order: 1 }); R.pt({ name: 'Trig', x: 4 }, { order: 0, mode: 'trigger' });
      var v = { id: 'v', name: 'V', guest: true };
      T.check('spawn_order_lowest_wins', R.S.choose(v).name === 'First' && R.S.choose(v).name === 'First' && R.S.fields('w4').order === 1 && R.S.choose({ id: 'x' }).name === 'First');
    });
    S('spawn_who_filter_guests', function () {
      var R = rig(); R.pt({ name: 'GuestOnly', x: 1 }, { who: 'guests', order: 1 }); R.pt({ name: 'Anyone', x: 2 }, { who: 'everyone', order: 2 });
      var g1 = { id: 'g', name: 'G', guest: true }, host = { id: 'me', name: 'Me', local: true, guest: false };
      var R2 = rig(); R2.pt({ name: 'NamedOnly', x: 1 }, { who: 'named', names: ['rosa'] }); var none = R2.S.choose({ id: 'a', name: 'Ann', guest: true }), rosa = R2.S.choose({ id: 'r', name: 'Rosa', guest: true });
      T.check('spawn_who_filter_guests', R.S.choose(g1).name === 'GuestOnly' && R.S.choose(host).name === 'Anyone' && none === null && rosa.name === 'NamedOnly');
    });
    S('spawn_who_me', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }).live(); R.pt({ name: 'Mine', x: 1 }, { who: 'me' });
      var forGuest = R.S.choose(R.peers[0]), forHost = R.S.choose({ id: 'me', name: 'Me', local: true });
      var t = R.S.testArrive();
      T.check('spawn_who_me', forGuest === null && forHost.name === 'Mine' && R.S.onJoin(R.peers[0]) === null && !!t && R.moves.length === 1);
    });
    S('spawn_bad_point_no_floor_refused_with_message', function () {
      var R = rig().live(), m = R.pt({ name: 'Void', x: 200, z: 0 }), chk = R.S.floorCheck(R.S.fields(m.id)), said0 = R.ctx._said.length;
      var a = R.S.arrive({ id: 'v', name: 'V', guest: true }, m), said = R.ctx._said.slice(-1)[0], sent = R.S.send({ id: 'v', name: 'V', guest: true }, m.id);
      var good = R.pt({ name: 'Fine', x: 1 });
      T.check('spawn_bad_point_no_floor_refused_with_message', chk.ok === false && /no floor/.test(chk.message) && a === null && /no floor/.test(said) && sent === false && R.moves.length === 0 && !hasDash(said) && R.S.floorCheck(R.S.fields(good.id)).ok === true);
    });
    S('spawn_inside_solid_refused', function () {
      var R = rig({ solid: [[5, 0.9, 5, 1, 1]] }).live(), m = R.pt({ name: 'Wall', x: 5, z: 5 }), a = R.S.arrive({ id: 'v', name: 'V' }, m), said = R.ctx._said.slice(-1)[0];
      T.check('spawn_inside_solid_refused', a === null && /inside something solid/.test(said) && R.S.floorCheck(R.S.fields(m.id)).ok === false && R.S.floorCheck({ x: 8, y: 0, z: 8 }).ok === true);
    });
    S('spawn_respawn_below_y', function () {
      var p = guest('g1', 'Rosa', 3, 3), R = rig({ peers: [p] }).live(); R.pt({ name: 'Home', x: 0, z: 0 }, { respawnBelowY: -5 });
      put(p, 3, -2, 3); R.step(0.3); var none = R.sent.length; put(p, 3, -6, 3); R.step(0.3); var one = R.sent.length; R.step(1); var still = R.sent.length;
      R.step(3.5); var again = R.sent.length;
      T.check('spawn_respawn_below_y', none === 0 && one === 1 && R.sent[0][1].x === 0 && R.sent[0][1].who === 'g1' && still === 1 && again === 2 && /fell below -5 m/.test(R.g.logList().filter(function (e) { return /fell/.test(e.what); })[0].what));
    });
    S('spawn_respawn_if_leave_room', function () {
      var p = guest('g1', 'Rosa', 3, 3), R = rig({ peers: [p] }).live(); R.pt({ name: 'Home', x: 0, z: 0 }, { respawnIfLeave: true });
      R.step(0.3); var none = R.sent.length; put(p, 20, 0, 0); R.step(0.3);
      T.check('spawn_respawn_if_leave_room', none === 0 && R.sent.length === 1 && /left the room/.test(R.g.logList().slice(-1)[0].what));
    });
    S('spawn_arrival_fade_0_4s_no_flash', function () {
      var R = rig().live(), m = R.pt({ name: 'Home', x: 1 }), v = { id: 'me', name: 'Me', local: true };
      var a = R.S.arrive(v, m), first = R.S.send(v, m.id), tooSoon = R.S.send(v, m.id); R.step(0.5); var later = R.S.send(v, m.id);
      var f = R.S.fields(m.id), big = R.S.setFields(m.id, { fadeSec: 0, gravity: 2 });
      T.check('spawn_arrival_fade_0_4s_no_flash', a.fadeSec === 0.4 && first === true && tooSoon === false && later === true && R.moves.length === 2 && R.moves.every(function (x) { return x.a.fadeSec >= 0.4; }) && R.S.FADE === 0.4 && !('fadeSec' in big));
    });
    S('spawn_test_arrive_only_local', function () {
      var p = guest('g1', 'Rosa', 3, 3), R = rig({ peers: [p] }); R.pt({ name: 'Home', x: 1, z: 2, yaw: 0.5 });
      var a = R.S.testArrive(), msgs = R.ctx._said.slice(-1)[0];
      var G = rig({ guest: true }); G.pt({ name: 'H' }); var ga = G.S.testArrive();
      var N = rig(); var na = N.S.testArrive();
      T.check('spawn_test_arrive_only_local', !!a && R.moves.length === 1 && R.moves[0].v.local === true && R.moves[0].v.id === 'me' && R.peers[0].head[0] === 3 && /Tested/.test(msgs) && ga === null && G.moves.length === 0 && na === null && /Place a spawn point/.test(N.ctx._said.slice(-1)[0]));
    });
    S('spawn_snap_spot_aim_snaps', function () {
      var R = rig(); R.pt({ name: 'Snap1', x: 4, z: 4, yaw: 1.2 }, { snap: true }); R.pt({ name: 'Plain', x: -4, z: -4 }, { snap: false }); R.pt({ name: 'SnapPos', x: 8, z: 0, yaw: 2 }, { snap: true, setPositionOnly: true });
      var s = R.S.snapAim(4.6, 3.5), far = R.S.snapAim(6, 6), plain = R.S.snapAim(-4.2, -4.1), pos = R.S.snapAim(8.5, 0.2);
      T.check('spawn_snap_spot_aim_snaps', R.S.snapSpots().length === 2 && s.snapped && s.x === 4 && s.z === 4 && near(s.yaw, 1.2) && far === null && plain === null && pos.x === 8 && pos.yaw === null && R.S.snapAim('x', 1) === null);
    });
    S('spawn_set_position_only_false_turns', function () {
      var R = rig().live(), m = R.pt({ name: 'Home', x: 0, z: 0, yaw: 0.7 }), v = { id: 'me', name: 'Me', local: true };
      var turns = R.S.arrive(v, m).yaw; R.S.setFields(m.id, { setPositionOnly: true }); var keeps = R.S.arrive(v, m);
      var THREE = kit.THREE, o = new THREE.Object3D(); o.position.set(0, 0, -10);
      var R2 = rig({ props: [{ id: 'sign1', name: 'Sign', object: o, tags: [] }] }).live(); var m2 = R2.pt({ name: 'Look', x: 0, z: 0 }, { face: 'object', faceTarget: 'Sign' }); var yawObj = R2.S.arrive({ id: 'v', name: 'V', guest: true }, m2).yaw;
      o.position.set(10, 0, 0); var yawRight = R2.S.arrive({ id: 'v', name: 'V', guest: true }, m2).yaw;
      var R3 = rig({ head: [0, 1.6, 5] }).live(); var m3 = R3.pt({ name: 'Host', x: 0, z: 0 }, { face: 'host' }); var yawHost = R3.S.arrive({ id: 'g', name: 'G', guest: true }, m3).yaw;
      T.check('spawn_set_position_only_false_turns', near(turns, 0.7) && keeps.yaw === null && keeps.setPositionOnly === true && near(yawObj, 0) && near(yawRight, -Math.PI / 2) && near(Math.abs(yawHost), Math.PI));
    });
    S('spawn_gravity_speed_ranges_clamped', function () {
      var R = rig(), m = R.pt({ name: 'A' }), a = R.S.setFields(m.id, { gravity: 99, speed: 500 }), b = R.S.setFields(m.id, { gravity: -3, speed: -1 }), c = R.S.setFields(m.id, { gravity: 'x', speed: NaN, order: 1e9 }), d = R.S.setFields(m.id, { gravity: 4.905, speed: 45.0 });
      T.check('spawn_gravity_speed_ranges_clamped', a.gravity === 9.81 && a.speed === 45 && b.gravity === 0 && b.speed === 0 && c.gravity === 0 && c.order === 99 && d.gravity === 4.905 && d.speed === 45);
    });
    S('spawn_json_roundtrip_nothing_moves_on_open', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }); var a = R.pt({ name: 'A', x: 1 }, { order: 2, pick: 'turns', snap: true, respawnBelowY: -7, names: ['x'], who: 'named' }), b = R.pt({ name: 'B', x: 2 }, { mode: 'trigger', gravity: 3 });
      var saved = cl(R.g.state()), Q = rig({ peers: [guest('g1', 'Rosa', 40, 40)] });
      Q.pt({ name: 'A', x: 1 }); Q.pt({ name: 'B', x: 2 }); Q.g.load(saved); Q.step(3); Q.g.setLive(true); Q.step(3);
      T.check('spawn_json_roundtrip_nothing_moves_on_open', saved.parts.spawn.extras.w1.order === 2 && saved.parts.spawn.extras.w2.gravity === 3 && Q.S.fields('w1').snap === true && Q.S.fields('w1').respawnBelowY === -7 && Q.S.fields('w2').mode === 'trigger' && Q.moves.length === 0 && Q.S.state().turn === 0);
    });
    S('spawn_hostile_clamped', function () {
      var R = rig(), m = R.pt({ name: 'A' }), threw = false, evil = JSON.parse('{"v":1,"extras":{"w1":{"mode":"evil","who":{"a":1},"names":' + JSON.stringify(new Array(80).fill('n')) + ',"order":-5,"gravity":1e99,"speed":"x","respawnBelowY":1e12,"pick":5,"face":"up","__proto__":{"polluted":1}},"__proto__":{"polluted":2},"../x":{},"w9":5},"turn":-3}');
      try { R.g.load({ parts: { spawn: evil } }); R.g.load({ parts: { spawn: 'x' } }); R.g.load({ parts: { spawn: evil } }); R.S.setFields('nope', {}); R.S.setFields(m.id, null); R.S.setFields(m.id, { names: [1, null, 'ok'] }); R.S.send(null, null); R.S.send('nobody', 'w1'); R.S.snapAim(NaN, 1); R.S.choose(null); R.S.arrive(null, null); R.S.rows('nope', {}); }
      catch (e) { threw = e; }
      var f = R.S.fields('w1'); R.S.setFields('w1', { names: [1, null, 'ok'] });
      var ok = R.g.sync.validate('spawn', { who: 'a', x: 1, y: 0, z: 1, yaw: 0, fadeSec: 0.4, gravity: 9, speed: 4 }), bad1 = R.g.sync.validate('spawn', { who: 'a', x: 1e9, y: 0, z: 1, yaw: 0, fadeSec: 0.4, gravity: 9, speed: 4 }), bad2 = R.g.sync.validate('spawn', { who: 5 });
      T.check('spawn_hostile_clamped', !threw && ({}).polluted === undefined && f.mode === 'start' && f.who === 'everyone' && f.names.length <= 24 && f.order >= 1 && f.gravity <= 9.81 && f.pick === 'order' && R.S.fields('w1').names.join() === 'ok' && ok === true && !bad1 && !bad2);
    });
    S('spawn_labels_no_em_dash', function () {
      var p = guest('g1', 'Rosa', 3, 3), R = rig({ peers: [p] }).live(), m = R.pt({ name: 'Home', x: 1 }, { who: 'named', face: 'object' });
      var said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} }, rows = R.S.rows(m.id, H), labels = rows.map(function (r) { return r.label; });
      rows.forEach(function (r) { if (r.label !== 'Test arrive') r.act(); }); rows.filter(function (r) { return r.label === 'Test arrive'; })[0].act();
      var again = R.S.rows(m.id, H).map(function (r) { return r.label; });
      var G = rig({ guest: true }); G.pt({ name: 'g' });
      T.check('spawn_labels_no_em_dash', labels[0] === 'Defaults: Gravity 9.81, Speed 4, Order 1, fade 0.4 s' && labels.indexOf('Test arrive') > 0 && labels.indexOf('Set Position Only: off') > 0 && labels.indexOf('Snap spot: off') > 0 && labels.some(function (l) { return /^Add name: Rosa/.test(l); }) && labels.concat(again, said, R.ctx._said, R.g.logList().map(function (e) { return e.what; })).every(function (l) { return !hasDash(l); }) && G.S.rows('w1', H).length === 0 && R.ctx._undos >= 8);
    });

    /* ---- the rest of the contract ---- */
    S('spawn_join_only_while_live', function () {
      var p = guest('g1', 'Rosa', 40, 40), R = rig({ peers: [p] }); R.pt({ name: 'P1', x: 1 });
      var off = R.S.onJoin(R.peers[0]); R.live(); var on = R.S.onJoin(R.peers[0]);
      var G = rig({ guest: true }); G.pt({ name: 'g' }); G.g._live = true; var gj = G.S.onJoin({ id: 'x', name: 'X', guest: true });
      T.check('spawn_join_only_while_live', off === null && !!on && gj === null && R.moves.length === 0);
    });
    S('spawn_guest_message_obeyed_only_for_self', function () {
      var gm = [], p = guest('g1', 'Rosa', 40, 40), H = kit.makeHostGuest({ host: { spawn: fakeSpawn(3), peers: [p], head: [0, 1.6, 30], teleport: function () {}, floorFn: function () { return 0; } }, guest: { selfId: function () { return 'g1'; }, teleport: function (v, a) { gm.push({ v: v, a: a }); } } });
      var hs = H.host.modules.spawn, gs = H.guest.modules.spawn; H.host.setLive(true);
      H.hostCtx.spawn.add({ name: 'P1', x: 3, z: 4, yaw: 1 });
      var a = hs.onJoin(H.hostCtx._peers[0]); H.step(0.5);
      var other = hs.onJoin({ id: 'g2', name: 'Ben', guest: true }); H.step(0.5);
      var bad = H.guest.sync.apply('spawn', { who: 'g1', x: 1e9, y: 0, z: 0, yaw: 0, fadeSec: 0.4, gravity: 9, speed: 4 }, 'x');
      T.check('spawn_guest_message_obeyed_only_for_self', !!a && gm.length === 1 && gm[0].v.local === true && gm[0].a.x === 3 && gm[0].a.z === 4 && gm[0].a.fadeSec >= 0.4 && !!other && bad === false);
    });
    S('spawn_trigger_start_sends_to_point', function () {
      var p = guest('g1', 'Rosa', 0, 0), R = rig({ peers: [p] }); R.pt({ name: 'Far', x: 9, z: 9 }, { mode: 'trigger' }); R.live();
      R.g.modules.trigger.add({ x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, who: 'guests', starts: [{ do: 'spawn', arg: 'w1', delay: 0 }] });
      R.step(0.3);
      T.check('spawn_trigger_start_sends_to_point', R.g.logList().some(function (e) { return /Rosa arrived at Far/.test(e.what); }) && R.moves.length === 0);
    });
    S('spawn_nothing_runs_when_scene_opens', function () {
      var R = rig(); R.pt({ name: 'A', x: 1 }, { respawnBelowY: -1, respawnIfLeave: true }); var saved = cl(R.g.state());
      var Q = rig({ head: [0, -50, 0] }); Q.pt({ name: 'A', x: 1 }); Q.g.load(saved); Q.step(5);
      var L = rig({ head: [0, -50, 0] }); L.pt({ name: 'A', x: 1 }); L.g.load(saved); L.g.setLive(true); L.step(0.5);
      T.check('spawn_nothing_runs_when_scene_opens', Q.moves.length === 0 && L.moves.length === 1);
    });
  }

  var api = { stage: 'H5', section: 'spawn', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H5 = api;
})();
