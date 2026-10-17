/* gizmo_next_h12_scenario.js: stage H12, Ruth's example as one runnable scenario, on a fake clock, in node and on the demo page. Test only: no new features.
   She and a friend are in the room (the friend through the guest door). She poses a figure with one hand up, records "hello friend!", adds three beats (hand up with the recording
   attached, hand right, hand left), puts a trigger box at the doorway (Guests only, someone enters, once per visitor, plays the beats Greeting), turns Gizmos live on, plays and stops,
   and the next time the friend enters the figure greets him, the friend sees the wave and hears the voice in step with the host.
   The friend's voice comes through Share audio (the default), so "hears it in step" is read from the friend's beat clock against the host's voice start. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') { ['beats', 'actions', 'trigger', 'spawn', 'seat', 'effects', 'sync'].forEach(function (n) { require('./gizmo_next_' + n + '.js'); }); }

  var STEPS = ['_beatsRegister', '_actionsRegister', '_triggerRegister', '_spawnRegister', '_seatRegister', '_effectsRegister', '_friendsRegister'];
  var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
  function mkPose(x, y) { return { joints: { wrist: [x, y, 0], elbow: [0, 0.9, 0.1], spine: [0, 0, 0] }, pos: [0, 0, 0], turn: 0 }; }
  function fakeList(prefix) { var L = { list: [], nid: 1 }; L.add = function (s) { var m = Object.assign({ id: prefix + (L.nid++), name: prefix, x: 0, y: 0, z: 0, yaw: 0, preset: 'chair' }, s || {}); L.list.push(m); return m; }; L.get = function (id) { return L.list.find(function (m) { return m.id === id; }) || null; }; return L; }

  /* register every part the scenario needs inside the current kit.isolate (the selftest) or leave the page's own */
  function register() { STEPS.forEach(function (s) { if (typeof GN[s] === 'function') GN[s](); }); }

  function world(kit, o) {
    o = o || {};
    var peers = [], clock = kit.makeClock(), log = { voice: [], guestVoice: [], hostSounds: [] };
    var hostFig = { pose: mkPose(0, 1.4), look: { shader: 'plain', tint: [1, 0.5, 0.25], clothes: ['shirt'], skin: [0.8, 0.6, 0.5] } };
    var guestFig = { pose: mkPose(0, 1.4), look: { shader: 'plain', tint: [1, 0.5, 0.25], clothes: ['shirt'], skin: [0.8, 0.6, 0.5] } };
    var playing = null, now = function () { return clock.now(); };
    var mk = function (fig) {
      return {
        pose: { get: function (s) { return s === 's0' ? cl(fig.pose) : null; }, apply: function (s, p) { if (s === 's0') fig.pose = cl(p); } },
        look: { get: function (s) { return s === 's0' ? cl(fig.look) : null; }, apply: function (s, p) { if (s === 's0') fig.look = Object.assign({}, fig.look, cl(p)); }, allowedClothes: function () { return ['shirt', 'hat']; } },
        figures: [{ slot: 's0', name: 'Her' }], selectedSlots: function () { return ['s0']; }
      };
    };
    var hostBits = mk(hostFig), guestBits = mk(guestFig);
    hostBits.narration = {
      voLines: function () { return [{ rec: 'vo_hello', seconds: 1.5 }]; },
      play: function (s, r) { log.voice.push({ slot: s, rec: r, t: now() }); playing = { until: now() + 1500 }; },
      stop: function (s) { playing = null; },
      mouth: function () { return playing && now() < playing.until ? 0.4 : 0; }
    };
    guestBits.narration = { voLines: function () { return []; }, play: function (s, r) { log.guestVoice.push({ slot: s, rec: r, t: now() }); }, stop: function () {}, mouth: function () { return 0; } };
    var hostCtx = Object.assign({ peers: peers, head: [0, 1.6, 30], seat: fakeList('q'), spawn: fakeList('w'), floorFn: function () { return 0; }, selfId: function () { return 'host'; } }, hostBits);
    var guestCtx = Object.assign({ seat: fakeList('q'), spawn: fakeList('w'), floorFn: function () { return 0; }, selfId: function () { return 'g1'; }, head: [9, 1.6, 9] }, guestBits);
    var H = kit.makeHostGuest({ latencyMs: o.latency === undefined ? 80 : o.latency, clock: clock, host: hostCtx, guest: guestCtx });
    var W = { H: H, host: H.host, guest: H.guest, hm: H.host.modules, gm: H.guest.modules, peers: peers, hostFig: hostFig, guestFig: guestFig, log: log, clock: clock, bus: H.bus };
    W.step = function (sec) { return H.step(sec); };
    W.wrist = function (fig) { return (fig || hostFig).pose.joints.wrist.slice(); };

    /* 1 She selects a figure and poses it with one hand raised */
    W.pose = function (x, y) { hostFig.pose = mkPose(x, y); };
    W.handUp = function () { W.pose(0, 1.9); };
    W.handRight = function () { W.pose(0.5, 1.5); };
    W.handLeft = function () { W.pose(-0.5, 1.5); };
    /* 3 Add beat (the Beat strip button) */
    W.addBeat = function () { return W.hm.beats.addBeatNow(['s0']); };
    /* 2 the recording, and the say beat attached to the first card with its hold at the recording length */
    W.attachVoice = function (t) { return W.hm.actions.addSay('s0', 'vo_hello', t); };
    /* the whole of steps 1 to 4 */
    W.build = function () {
      var B = W.hm.beats;
      W.handUp(); W.addBeat(); W.attachVoice(0);
      W.handRight(); W.addBeat();
      W.handLeft(); W.addBeat();
      B.setClock(0);
      var len = B.length(); B.setRange('Greeting', 0, len);
      W.door = W.hm.trigger.add({ name: 'Doorway', x: 0, y: 1, z: 0, size: [2, 2, 2], by: 'players', who: 'guests', when: 'enter', often: 'visit', armed: true, starts: [{ do: 'beats', arg: 'Greeting', delay: 0 }] });
      return W;
    };
    W.live = function (on) { W.host.setLive(on !== false); return W; };
    /* friends */
    W.friend = function (id, name, far) { var p = kit.makePeer(id, name, [far === false ? 0 : 0, 1.6, far === false ? 0 : 20], { guest: true }); peers.push(p); return p; };
    W.walkIn = function (p) { kit.movePeer(p, 0, 1.6, 0); };
    W.walkOut = function (p) { kit.movePeer(p, 0, 1.6, 20); };
    W.leaveRoom = function (p) { var i = peers.indexOf(p); if (i >= 0) peers.splice(i, 1); };
    W.plays = function () { var n = { host: 0, guest: 0 }; return n; };
    /* count the Beat strip starts on each page */
    W.count = function () { var c = { host: 0, guest: 0, fires: 0 }; W.host.on('beat-play', function () { c.host++; }); W.guest.on('beat-play', function () { c.guest++; }); W.host.on('fire', function () { c.fires++; }); return c; };
    return W;
  }

  /* the example, once, as lines for the demo page: "name: 1" passes, "name: 0" fails, a number is a measurement */
  function runExample(kit) {
    var out = [], ok = function (name, v) { out.push(name + ': ' + (v === true ? 1 : (v === false ? 0 : v))); };
    var W = world(kit).build(), B = W.hm.beats, A = W.hm.actions, pins = B.pins();
    ok('h12_cards', pins.filter(function (p) { return p.kind === 'pose'; }).length === 3 && pins.filter(function (p) { return p.kind === 'say'; }).length === 1);
    W.live(); W.step(3);
    ok('h12_friend_has_the_scene', W.gm.friends.received() === true && W.gm.trigger.list().length === 1);
    B.play(0); W.step(0.3); var wave = W.wrist()[0]; W.step(3.5); B.stop(); W.step(0.2);
    ok('h12_play_and_stop', wave !== 0 && W.log.voice.length === 1);
    var c = W.count(), p = W.friend('g1', 'Rosa'); W.step(0.2); var t0 = W.clock.now(); W.walkIn(p);
    var first = null; for (var i = 0; i < 120 && first === null; i++) { W.step(1 / 60); if (W.gm.beats.time() > 0) first = W.clock.now() - t0; }
    W.step(3);
    ok('h12_friend_enters_one_start', c.host === 1 && c.guest === 1 && c.fires === 1);
    ok('h12_friend_sees_it_after_ms', first === null ? -1 : Math.round(first));
    return out;
  }

  GN.H12 = { register: register, world: world, runExample: runExample, mkPose: mkPose };
  if (typeof module !== 'undefined' && module.exports) module.exports = GN;
})();
