/* gizmo_next_sync_selftest.js: the checks for stage H9 (friends and saving). A host page and a guest page joined by a fake room with 80 ms of delay, fake time, no headset.
   node gizmo_next_selftest.js --only=sync     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  var fs = inNode ? require('fs') : null, path = inNode ? require('path') : null;
  if (inNode) require('./gizmo_next_sync.js');

  function run(T, kit) {
    return kit.isolate(function () {
      var G = kit.GizmoNext; G._beatsRegister(); G._actionsRegister(); G._triggerRegister(); G._spawnRegister(); G._seatRegister(); G._effectsRegister(); G._friendsRegister();
      return runAll(T, kit);
    });
  }
  function runAll(T, kit) {
    var G = kit.GizmoNext;
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };

    function fakeList(prefix, extra) {
      var L = { list: [], nid: 1 };
      L.add = function (spec) { var m = Object.assign({ id: prefix + (L.nid++), name: prefix + ' ' + L.nid, x: 0, y: 0, z: 0, yaw: 0, preset: 'chair', locked: false, group: '' }, spec || {}); L.list.push(m); return m; };
      L.get = function (id) { return L.list.find(function (m) { return m.id === id; }) || null; };
      L.first = function () { return L.list[0] || null; };
      L.H = 0.25; L.max = 8; L.PRESETS = { chair: { h: 0.46 } };
      return L;
    }
    /* a host page and a guest page; the host has one seat, one spawn point, two beats named Greeting, a trigger that plays them, and an effects gizmo */
    function world(o) {
      o = o || {};
      var peers = [], gm = [], gstore = kit.makeStorage(), gwrites = 0, setOrig = gstore.set;
      gstore.set = function (k, v) { gwrites++; return setOrig.apply(gstore, arguments); };
      var hs = fakeList('q'), hp = fakeList('w'), gs = fakeList('q'), gp = fakeList('w');
      var H = kit.makeHostGuest({
        latencyMs: o.latency === undefined ? 80 : o.latency, private: !!o.priv,
        host: { peers: peers, head: [0, 1.6, 30], spawn: hp, seat: hs, floorFn: function () { return 0; }, teleport: function () {}, sitRig: function () {}, standRig: function () {}, stature: function () { return 1.7; }, selfId: function () { return 'host'; }, },
        guest: { storage: gstore, spawn: gp, seat: gs, floorFn: function () { return 0; }, teleport: function (v, a) { gm.push({ v: v, a: a }); }, sitRig: function () {}, standRig: function () {}, stature: function () { return 1.7; }, selfId: function () { return 'g1'; }, head: [5, 1.6, 5],
          mirror: { seats: function (l) { gs.list = cl(l); }, spawns: function (l) { gp.list = cl(l); } } }
      });
      var sentA = {}, so = H.hostCtx.sync.send; H.hostCtx.sync.send = function (n, v) { sentA[n] = (sentA[n] || 0) + 1; return so.apply(this, arguments); };
      var W = { sentA: sentA, H: H, host: H.host, guest: H.guest, hm: H.host.modules, gm: H.guest.modules, peers: peers, tele: gm, seats: hs, spawns: hp, gstore: gstore, gwrites: function () { return gwrites; }, bus: H.bus };
      W.step = function (s) { return H.step(s); };
      if (!o.empty) {
        hs.add({ x: 3, z: -1, yaw: 0 }); hp.add({ x: 1, z: 2, yaw: 0.5 });
        var B = W.hm.beats;
        B.pinsSet([{ id: 'a', t: 0, slot: 'f1', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 3, slot: 'f1', kind: 'pose', pose: { x: 1 } }]);
        B.setRange('Greeting', 0, 3);
        W.trig = W.hm.trigger.add({ x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, who: 'anyone', when: 'enter', often: 'visit', starts: [{ do: 'beats', arg: 'Greeting', delay: 0 }] });
        W.fx = W.hm.effects.add({ x: 2, y: 1, z: 0, preset: 'confetti' });
        W.hm.seat.setFields('q1', { who: 'everyone', pose: 'default' });
      }
      return W;
    }
    var peer = function (id, name, x, z) { return kit.makePeer(id, name, [x, 1.6, z], { guest: true }); };

    S('sync_late_joiner_snapshot', function () {
      var W = world(); W.host.setLive(true); W.step(0.1);
      var before = W.gm.friends.received();
      W.step(4);
      var gs = W.guest.state(), hs = W.host.state();
      T.check('sync_late_joiner_snapshot', before === false && W.gm.friends.received() === true && W.gm.trigger.list().length === 1 && W.gm.effects.list().length === 1 && W.gm.beats.pins().length === 2 && !!W.gm.beats.getRange('Greeting') && W.guest.isLive() === true &&
        W.gm.trigger.list()[0].starts[0].arg === 'Greeting' && gs.kinds.trigger.items[0]._count === undefined && JSON.stringify(gs).indexOf('_seen') < 0 && W.gm.friends.stats().asks >= 1 && hs.kinds.trigger.items.length === 1);
    });
    S('sync_checksums_agree', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var a = W.hm.friends.checksum(), b = W.gm.friends.checksum();
      var th = W.hm.beats.sync.parts.beats.encode(), tg = W.gm.beats.sync.parts.beats.encode();
      /* an edit on the host reaches the guest by itself, and the sums agree again */
      W.hm.beats.setRange('Second', 0, 1.5); W.hm.trigger.kind.set(W.trig.id, { name: 'Door' }); W.step(5);
      var a2 = W.hm.friends.checksum(), b2 = W.gm.friends.checksum();
      T.check('sync_checksums_agree', a.all === b.all && a.beats === b.beats && th.h === tg.h && th.n === 2 && a.triggers === b.triggers && a.effects === b.effects && a.seats === b.seats && a.spawns === b.spawns &&
        a2.all === b2.all && a2.all !== a.all && W.gm.trigger.list()[0].name === 'Door' && !!W.gm.beats.getRange('Second'));
    });
    S('sync_host_fire_guest_plays_within_0_3s', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var p = peer('g1', 'Rosa', 0, 20); W.peers.push(p);
      var tH = null, tG = null; W.host.on('beat-play', function () { if (tH === null) tH = W.H.clock.now(); }); W.guest.on('beat-play', function () { if (tG === null) tG = W.H.clock.now(); });
      W.step(0.2); kit.movePeer(p, 0, 1.6, 0);
      var worst = 0, i;
      for (i = 0; i < 90; i++) { W.step(1 / 60); if (tG !== null && W.hm.beats.time() > 0.2 && W.hm.beats.time() < 2.5) worst = Math.max(worst, Math.abs(W.hm.beats.time() - W.gm.beats.time())); }
      T.value('sync_guest_lag_s', tH !== null && tG !== null ? Math.round((tG - tH)) / 1000 : -1); T.value('sync_beat_time_gap_s', Math.round(worst * 1000) / 1000);
      T.check('sync_host_fire_guest_plays_within_0_3s', tH !== null && tG !== null && tG - tH >= 0 && tG - tH <= 300 && worst <= 0.3 && W.gm.beats.time() > 0.5);
    });
    S('sync_stop_stops_guest', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      W.hm.beats.play(0); W.step(1); var playing = W.gm.beats.time() > 0.5;
      W.hm.beats.stop(); W.step(0.5); var t = W.gm.beats.time(); W.step(0.5);
      W.hm.effects.play(W.fx.id, 'loop'); W.step(1); var fxOn = W.gm.effects.modeOf(W.fx.id) === 'loop';
      W.hm.effects.stop(W.fx.id); W.step(0.4);
      T.check('sync_stop_stops_guest', playing && t === 0 && W.gm.beats.time() === 0 && fxOn && W.gm.effects.modeOf(W.fx.id) === 'stop' && W.gm.effects.total() === 0);
    });
    S('sync_guest_never_fires_trigger', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var fires = 0; W.guest.on('fire', function () { fires++; });
      /* the guest's own head and a friend walk through the box on the guest page: nothing is fired there */
      W.guestHead = W.H.guestCtx; W.H.guestCtx._head = [0, 1.6, 0]; W.step(2);
      var gp = peer('x', 'Pat', 0, 0); W.H.guestCtx._peers && W.H.guestCtx._peers.push(gp); W.step(1);
      var say = W.H.guestCtx._said.length;
      var direct = W.gm.trigger.test(W.trig.id);
      T.check('sync_guest_never_fires_trigger', fires === 0 && direct === false && W.gm.beats.time() === 0 && W.gm.trigger.visitors(W.trig.id).length === 0);
    });
    S('sync_second_guest_fires_again', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var a = peer('g1', 'Rosa', 0, 20), b = peer('g2', 'Ben', 0, 20); W.peers.push(a, b);
      var plays = 0, hostPlays = 0; W.guest.on('beat-play', function () { plays++; }); W.host.on('beat-play', function () { hostPlays++; });
      W.step(0.2); kit.movePeer(a, 0, 1.6, 0); W.step(4.5); kit.movePeer(a, 0, 1.6, 20); W.step(1);
      var first = plays, hf = hostPlays;
      kit.movePeer(b, 0, 1.6, 0); W.step(4.5);
      T.check('sync_second_guest_fires_again', first === 1 && hf === 1 && plays === 2 && hostPlays === 2 && W.gm.beats.time() >= 0);
    });
    S('sync_no_echo', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var gsent0 = W.bus.sent.b, hsent0 = W.bus.sent.a;
      W.hm.beats.play(0); W.step(1); W.hm.beats.stop(); W.hm.effects.play(W.fx.id, 'loop'); W.step(1); W.hm.effects.stop(W.fx.id); W.step(1);
      var gsent = W.bus.sent.b - gsent0;
      /* the guest asked once at the start, and has said nothing since it got the snapshot */
      T.check('sync_no_echo', gsent === 0 && W.bus.sent.a - hsent0 > 0 && W.gm.friends.stats().asks === 1 && W.bus.sent.b <= 2);
    });
    S('sync_validator_rejects_bad', function () {
      var W = world(), V = function (n, v) { return W.guest.sync.validate(n, v); };
      var big = 'x'.repeat(100 * 1024), deep = {}, cur = deep; for (var i = 0; i < 40; i++) { cur.n = {}; cur = cur.n; }
      var ok = [V('beats', { st: 'playing', t: 1, speed: 1, mode: 'once', br: null, h: 'abc', n: 2 }), V('trigger', { id: 'trigger1', fired: true, who: 'Rosa', t: 5 }), V('seat', { id: 'q1', who: 'g1', state: 'enter' }), V('fx', { id: 'effects1', mode: 'loop' }), V('gizmos', { live: true }), V('snap', { id: 1, i: 0, n: 1, h: 'abc', d: '{}' })];
      var bad = [
        V('beats', { st: 'playing', t: NaN, speed: 1, mode: 'once', br: null, h: 'abc', n: 2 }),
        V('beats', { st: 'playing', t: 1, speed: 1, mode: 'once', br: new Array(5000).fill(1), h: 'abc', n: 2 }),
        V('beats', { st: 'hacked', t: 1, speed: 1, mode: 'once', br: null, h: 'abc', n: 2 }),
        V('trigger', { id: big, fired: true, who: 'x', t: 1 }),
        V('trigger', { id: 'a', fired: 'yes', who: 'x', t: 1 }),
        V('seat', { id: 'q1', who: 'g1', state: 'explode' }),
        V('seat', { id: '../etc', who: 'g1', state: 'enter' }),
        V('spawn', { who: 'g1', x: 1e9, y: 0, z: 0, yaw: 0, fadeSec: 0.4, gravity: 9, speed: 4 }),
        V('fx', { id: 'a', mode: 'explode' }),
        V('gizmos', { live: 'yes' }),
        V('snap', { id: 1, i: 5, n: 2, h: 'abc', d: '{}' }),
        V('snap', { id: 1, i: 0, n: 1, h: 'abc', d: big }),
        V('nonsense', { a: 1 }), V('beats', null), V('beats', [1, 2, 3]), V('beats', deep), V('__proto__', {}), V('beats', Infinity)
      ];
      T.value('sync_rejected_count', bad.filter(function (b) { return b === false; }).length);
      T.check('sync_validator_rejects_bad', ok.every(function (x) { return x === true; }) && bad.length >= 12 && bad.every(function (b) { return b === false; }));
    });
    S('sync_hostile_part_changes_nothing', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var before = JSON.stringify(W.guest.state()) + JSON.stringify(W.gm.friends.checksum()), live = W.guest.isLive(), occ = W.gm.seat.occupant('q1');
      var hostile = [['snap', { id: 9, i: 0, n: 1, h: 'zz', d: '{"v":1,"live":false,"kinds":{"trigger":{"items":[]}},"parts":{}}' }], ['snap', { id: 2, i: 0, n: 2, h: 'q', d: 'x'.repeat(50000) }], ['beats', { st: 'playing', t: 99999999, speed: 1, mode: 'once', br: null, h: 'abc', n: 2 }],
        ['seat', { id: 'q1', who: 'x', state: 'weird' }], ['trigger', { id: 'x', fired: true, who: 1, t: 1 }], ['fx', { id: 'a'.repeat(99), mode: 'loop' }], ['gizmos', { live: 1 }], ['spawn', { who: 'g1', x: NaN }], ['unknown', {}], ['beats', { __proto__: { polluted: 1 } }]];
      var results = hostile.map(function (h) { return W.guest.sync.apply(h[0], h[1], 'evil'); });
      /* a wrong-hash chunk set that completes is dropped whole */
      W.guest.sync.apply('snap', { id: 11, i: 0, n: 1, h: 'wrong', d: '{"v":1,"live":false,"kinds":{},"parts":{}}' }, 'evil');
      /* and the host refuses to be changed by anyone */
      var hb = JSON.stringify(W.host.state()), hr = W.host.sync.apply('beats', { st: 'playing', t: 1, speed: 1, mode: 'once', br: null, h: 'abc', n: 2 }, 'evil');
      T.check('sync_hostile_part_changes_nothing', results[0] === true && results.slice(1).every(function (r) { return r === false; }) && before === JSON.stringify(W.guest.state()) + JSON.stringify(W.gm.friends.checksum()) && W.guest.isLive() === live && W.gm.seat.occupant('q1') === occ && hr === false && hb === JSON.stringify(W.host.state()) && ({}).polluted === undefined);
    });
    S('sync_rate_limit_10_per_s', function () {
      var W = world({ empty: true }), n0 = W.sentA.fx || 0;
      for (var i = 0; i < 40; i++) W.host.send('fx', { id: 'effects1', mode: 'stop' });
      var first = (W.sentA.fx || 0) - n0; W.step(1.1);
      for (i = 0; i < 40; i++) W.host.send('fx', { id: 'effects1', mode: 'stop' });
      T.check('sync_rate_limit_10_per_s', first === 10 && (W.sentA.fx || 0) - n0 === 20 && W.host._dropped >= 60);
    });
    S('sync_private_sends_nothing', function () {
      var W = world({ priv: true }); W.host.setLive(true); W.hm.beats.play(0); W.hm.effects.play(W.fx.id, 'loop'); W.step(5);
      var sent = W.bus.sent.a + W.bus.sent.b, snap = W.hm.friends.sendSnapshot();
      T.check('sync_private_sends_nothing', sent === 0 && snap === false && W.gm.friends.received() === false && W.gm.trigger.list().length === 0);
    });
    S('sync_seat_taken_shows_occupied_for_guest', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var s0 = W.gm.seat.occupant('q1'); W.hm.seat.sit('q1'); W.step(1);
      var taken = W.gm.seat.occupant('q1'), refused = W.gm.seat.sit('q1');
      W.hm.seat.stand(); W.step(1);
      var late = world(); late.host.setLive(true); late.hm.seat.sit('q1'); late.step(5);
      T.check('sync_seat_taken_shows_occupied_for_guest', s0 === null && taken === 'host' && late.gm.seat.occupant('q1') === 'host' && refused === false && W.gm.seat.occupant('q1') === null && !!late.gm.seat.occupant('q1'));
    });
    S('sync_spawn_message_moves_guest_rig_with_fade', function () {
      var W = world(); W.host.setLive(true); var p = peer('g1', 'Rosa', 30, 30); W.peers.push(p); W.step(4);
      var r = W.hm.spawn.onJoin(p); W.step(0.5);
      T.check('sync_spawn_message_moves_guest_rig_with_fade', !!r && W.tele.length === 1 && W.tele[0].v.local === true && near(W.tele[0].a.x, 1, 1e-6) && near(W.tele[0].a.z, 2, 1e-6) && W.tele[0].a.fadeSec >= 0.4);
    });
    S('sync_save_load_all_kinds_nothing_plays_on_open', function () {
      var W = world(); W.host.setLive(true);
      W.hm.effects.setFields(W.fx.id, { playOnStart: true, looping: true }); W.hm.seat.setFields('q1', { pose: 'default', nudge: [0, 0.02, 0] });
      W.hm.spawn.setFields('w1', { order: 2 });
      W.hm.beats.play(0); W.step(1); W.hm.effects.play(W.fx.id, 'loop'); W.step(0.5);
      var saved = cl(W.host.state()), txt = JSON.stringify(saved);
      var N = world(); N.host.load(saved); N.step(3);
      var again = cl(N.host.state());
      var kinds = Object.keys(saved.kinds);
      T.check('sync_save_load_all_kinds_nothing_plays_on_open', kinds.indexOf('trigger') >= 0 && kinds.indexOf('effects') >= 0 && N.hm.beats.pins().length === 2 && !!N.hm.beats.getRange('Greeting') && N.hm.effects.total() === 0 && N.hm.effects.modeOf(W.fx.id) === 'stop' && N.hm.beats.time() === 0 && N.hm.trigger.list().length === 1 &&
        N.hm.trigger.list()[0].armed === true && N.hm.trigger.visitors(W.trig.id).length === 0 && !N.host.logList().some(function (e) { return / entered/.test(e.what); }) && JSON.stringify(again.kinds) === JSON.stringify(saved.kinds) && JSON.stringify(again.parts) === JSON.stringify(saved.parts) && txt.indexOf('_seen') < 0);
    });
    S('sync_live_flag_follows_host_but_guest_cannot_save', function () {
      var W = world(); W.step(4);
      var off = W.guest.isLive(); W.host.setLive(true); W.step(0.5); var on = W.guest.isLive();
      var w0 = W.gwrites(); W.guest.persist(); var saved = W.guest.persist(); W.gm.beats.setGap(2); var put = W.guest.putFile('x', 'y'), add = W.gm.trigger.add({}), lg = W.guest.setLive(false) ;
      W.step(0.2);
      T.check('sync_live_flag_follows_host_but_guest_cannot_save', off === false && on === true && saved === false && put === false && add === null && W.gwrites() === w0 && W.guest.isLive() === false && W.host.isLive() === true);
    });
    S('sync_guest_ui_has_no_save_export_download', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var dom = kit.makeFakeDom(), el = dom.createElement('div'), sub = dom.createElement('div');
      var ok1 = W.guest.mountPanel(el), words = [kit.domText(el)];
      Object.keys(W.guest.modules).forEach(function (n) { var m = W.guest.modules[n]; if (m && typeof m.mountPanel === 'function') { var e2 = dom.createElement('div'); try { m.mountPanel(e2); } catch (e) { /* none */ } words.push(kit.domText(e2)); } });
      W.guest.pages().forEach(function (pg) { W.guest.pageRows(pg.id, { say: function (t) { words.push(String(t)); }, redraw: function () {} }).forEach(function (r) { words.push(String(r.label)); }); });
      ['trigger', 'effects', 'seat', 'spawn'].forEach(function (k) { var kind = W.guest._kinds[k]; if (!kind) return; kind.api.list.forEach(function (rec) { try { kind.spec.rows && kind.spec.rows(rec, { say: function (t) { words.push(String(t)); }, redraw: function () {} }).forEach(function (r) { words.push(String(r.label)); }); } catch (e) { /* none */ } }); });
      var all = words.join(' ').toLowerCase(), hits = ['save', 'export', 'download'].filter(function (w) { return all.indexOf(w) >= 0; });
      T.value('sync_guest_ui_words_scanned', all.length);
      T.check('sync_guest_ui_has_no_save_export_download', ok1 === true && all.length > 200 && hits.length === 0);
    });
    S('sync_manifest_list_complete', function () {
      var files = G.guestFiles(), need = ['gizmo_next_core.js'].concat(G.PARTS);
      var complete = need.every(function (f) { return files.indexOf(f) >= 0; }) && files.indexOf('gizmo_next_sync.js') >= 0 && files.every(function (f) { return /^gizmo_next_[a-z0-9_]+\.js$/.test(f) && f.indexOf('selftest') < 0 && f !== 'gizmo_next_probe.js' && f !== 'gizmo_next_testkit.js'; });
      var onDisk = true, listed = true, loads = true;
      if (fs) {
        var dir = __dirname, txt = fs.readFileSync(path.join(dir, 'guest_files_list.txt'), 'utf8').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        listed = files.every(function (f) { return txt.indexOf(f) >= 0; }) && txt.every(function (f) { return files.indexOf(f) >= 0 || !/^gizmo_next_.*\.js$/.test(f); });
        onDisk = files.every(function (f) { return fs.existsSync(path.join(dir, f)); });
        /* every file a module requires at run time is in the list */
        files.forEach(function (f) { var src = fs.readFileSync(path.join(dir, f), 'utf8'), re = /require\('\.\/(gizmo_next_[a-z0-9_]+\.js)'\)/g, m; while ((m = re.exec(src))) if (files.indexOf(m[1]) < 0 && m[1] !== 'gizmo_next_testkit.js') loads = false; });
      }
      T.check('sync_manifest_list_complete', complete && files.length === need.length + (need.indexOf('gizmo_next_sync.js') < 0 ? 1 : 0) && onDisk && listed && loads);
    });

    /* ---- the rest of the contract ---- */
    S('sync_snapshot_chunks_and_size_bound', function () {
      var W = world(); W.host.setLive(true);
      for (var i = 0; i < 20; i++) W.hm.beats.add && 0;
      var pins = []; for (var k = 0; k < 60; k++) pins.push({ id: 'p' + k, t: k * 0.5, slot: 'f1', kind: 'pose', pose: { x: k / 60, y: 0.1 * (k % 5), z: 0.2 } });
      W.hm.beats.pinsSet(pins); W.hm.friends.sendSnapshot(); var n = W.hm.friends.pending();
      W.step(8);
      T.check('sync_snapshot_chunks_and_size_bound', n >= 1 && n <= 24 && W.gm.beats.pins().length === W.hm.beats.pins().length && W.gm.friends.checksum().beats === W.hm.friends.checksum().beats && W.hm.friends.pending() === 0);
    });
    S('sync_guest_cannot_send_snapshot_and_host_answers_rarely', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var g1 = W.gm.friends.sendSnapshot(), a0 = W.bus.sent.a;
      for (var i = 0; i < 10; i++) W.guest.send('snapreq', { v: 1 }); W.step(0.3);
      var answered = W.bus.sent.a - a0;
      W.guest.send('snapreq', { v: 1, junk: 1, more: 2 }); W.step(0.1);
      T.check('sync_guest_cannot_send_snapshot_and_host_answers_rarely', g1 === false && answered > 0 && answered <= 12);
    });
    S('sync_labels_no_em_dash', function () {
      var W = world(); W.host.setLive(true); W.step(4);
      var seen = W.host._log.concat(W.guest._log).map(function (e) { return e.what; }).concat(W.H.hostCtx._said, W.H.guestCtx._said);
      T.check('sync_labels_no_em_dash', seen.every(function (t) { return String(t).indexOf(DASH) < 0 && String(t).indexOf(EN) < 0; }));
    });
  }

  var api = { stage: 'H9', section: 'sync', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H9 = api;
})();
