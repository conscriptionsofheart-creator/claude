/* gizmo_next_script_selftest.js: the checks for stage H10 (the scripting layer). A small model of obj_scripts.js runs the scripts; no page, no headset.
   node gizmo_next_selftest.js --only=script     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (inNode) { require('./gizmo_next_script.js'); require('./gizmo_next_templates.js'); require('./gizmo_next_script_sandbox.js'); }

  function run(T, kit) {
    return kit.isolate(function () {
      var G = kit.GizmoNext; G._beatsRegister(); G._actionsRegister(); G._triggerRegister(); G._spawnRegister(); G._seatRegister(); G._effectsRegister(); G._scriptRegister();
      return runAll(T, kit);
    });
  }
  function runAll(T, kit) {
    var G = kit.GizmoNext, B = G.Blocks;
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };
    function fakeList(prefix) {
      var L = { list: [], nid: 1 };
      L.add = function (spec) { var m = Object.assign({ id: prefix + (L.nid++), name: prefix + ' ' + L.nid, x: 0, y: 0, z: 0, yaw: 0, preset: 'chair', locked: false, group: '' }, spec || {}); L.list.push(m); return m; };
      L.get = function (id) { return L.list.find(function (m) { return m.id === id; }) || null; };
      L.H = 0.25; L.max = 8; L.PRESETS = { chair: { h: 0.46 } };
      return L;
    }
    var peer = function (id, name, x, z) { return kit.makePeer(id, name, [x, 1.6, z], { guest: true }); };

    /* a host page with every adapter a script can reach, and the sandbox model */
    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), calls = [], seats = fakeList('q'), spawns = fakeList('w'), peers = o.peers || [], hidden = {}, ids = 0, props = o.props || [];
      var g = kit.makeInst({
        clock: clock, peers: peers, head: [0, 1.6, 30], props: props, guest: !!o.guest, seat: seats, spawn: spawns,
        sounds: { playMode: function (id, m) { calls.push(['sound', id, m]); } },
        setObjectVisible: function (n, on) { calls.push(['vis', n, on]); hidden[n] = !on; }, objectVisible: function (n) { return !hidden[n]; },
        spawnObject: function (k, p) { var id = 'o' + (++ids); calls.push(['spawn', k, id]); return id; }, despawnObject: function (id) { calls.push(['despawn', id]); },
        raycast: o.raycast, sitRig: function () {}, standRig: function () {}, stature: function () { return 1.7; }, selfId: function () { return 'host'; }, teleport: function () {}, floorFn: function () { return 0; }
      });
      var R = { g: g, m: g.modules, Sc: g.modules.script, B: g.modules.beats, T: g.modules.trigger, calls: calls, peers: peers, seats: seats, spawns: spawns, clock: clock, hidden: hidden, ctx: g._ctx, props: props };
      R.SB = new G.ScriptSandbox(g);
      R.step = function (sec) { var n = Math.round(sec * 60); for (var i = 0; i < n; i++) { kit.stepSeconds(g, 1 / 60); R.SB.tick(1 / 60); } };
      R.live = function () { g.setLive(true); return R; };
      R.beats = function () { R.B.pinsSet([{ id: 'a', t: 0, slot: 'f1', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 6, slot: 'f1', kind: 'pose', pose: { x: 1 } }]); R.B.setRange('Greeting', 0, 3); R.B.setRange('Fall', 0, 3); R.B.setRange('Get up', 3, 6); return R; };
      R.door = function (name, over) { return R.T.add(Object.assign({ name: name || 'Doorway', x: 0, y: 1, z: 0, size: [2, 2, 2], armed: true, who: 'anyone', when: 'both', often: 'every', starts: [] }, over || {})); };
      R.count = function (k) { return calls.filter(function (c) { return c[0] === k; }).length; };
      return R;
    }
    var WHO = function (name, guest) { return { id: name.toLowerCase(), name: name, guest: guest !== false, kind: 'player' }; };
    var enter = function (R, rec, who, type) { R.g.emit(type || 'enter', { trigger: rec, id: rec.id, who: who || WHO('Rosa') }); };

    S('script_fields_become_rows', function () {
      var R = rig(); R.live();
      var code = "fields({ speed: { type: 'number', default: 1, min: 0, max: 5, step: 1 }, who: { type: 'text' }, loud: { type: 'bool' }, mood: { type: 'text', choices: ['calm', 'happy'], default: 'calm' } });\nvar seen = []; on('frame', function () { seen.push(fields.speed); log('speed ' + fields.speed + ' ' + fields.loud + ' ' + fields.mood); });";
      R.SB.start({ s1: code }); R.step(0.1);
      var rows = R.Sc.fieldRows('s1', { say: function () {}, redraw: function () {} }), labels = rows.map(function (r) { return r.label; });
      rows[0].act(); R.step(0.1); var after = R.SB.log.slice(-1)[0].msg;
      rows.filter(function (r) { return /^Loud/.test(r.label); })[0].act(); rows.filter(function (r) { return /^Mood/.test(r.label); })[0].act(); R.step(0.1); var after2 = R.SB.log.slice(-1)[0].msg;
      var set = R.Sc.setField('s1', 'speed', 99), v = R.Sc.fieldsOf('s1').speed.value, bad = R.Sc.setField('s1', 'nope', 1) || R.Sc.setField('s1', 'mood', 'furious');
      var saved = cl(R.g.state()); var R2 = rig(); R2.g.load(saved); R2.SB.start({ s1: code }); R2.step(0.1);
      var G2 = rig({ guest: true }); G2.SB.start({ s1: code });
      T.check('script_fields_become_rows', labels[0] === 'Speed: 1' && labels.indexOf('Speed lower') > 0 && labels.indexOf('Who: none') > 0 && labels.indexOf('Loud: off') > 0 && labels.indexOf('Mood: calm') > 0 && /speed 2 /.test(after) && /speed 2 true happy/.test(after2) &&
        set === true && v === 5 && bad === false && /speed 5 true happy/.test(R2.SB.log.slice(-1)[0].msg) && G2.Sc.fieldRows('s1').length === 0 && G2.Sc.setField('s1', 'speed', 3) === false);
    });
    S('script_emit_on_between_objects', function () {
      var R = rig(); R.live();
      var a = "on('start', function () { emit('doorbell', { n: 7 }); });", b = "var got = []; on('doorbell', function (e) { log('heard ' + e.n); });", loop = "on('ping', function () { log('ping'); emit('ping'); });";
      R.SB.start({ a: a, b: b, loop: loop });
      var heard = R.SB.log.filter(function (l) { return l.msg === 'heard 7'; }).length;
      R.SB.inst.a.h.start = []; R.SB.event('a', 'start'); 
      var n0 = R.SB.log.length; R.m.script.names; var sent = R.g.modules.script.extend({ key: 'x', h: {}, name: 'x' }, {}); sent.values[0]('ping');
      var pings = R.SB.log.filter(function (l) { return l.msg === 'ping'; }).length;
      T.check('script_emit_on_between_objects', heard === 1 && pings >= 1 && pings <= 8 && sent.names.join() === 'emit,fields,visitor,spawnObj,onEnter,onLeave');
    });
    S('script_onEnter_onLeave_via_bus', function () {
      var R = rig(); R.live(); var rec = R.door('Doorway'), other = R.door('Garden', { x: 9 });
      R.SB.start({ s: "onEnter('Doorway', function (e) { log('in ' + e.who.name + ' ' + e.target.kind + ' ' + e.target.name + ' ' + e.who.guest); }); onLeave('Doorway', function (e) { log('out ' + e.who.name); }); onEnter(function (e) { log('any ' + e.target.name); }); onEnter('Chair 1', function (e) { log('sat ' + e.target.name); }); onLeave('Chair 1', function (e) { log('rose ' + e.target.name); });" });
      var p = peer('g1', 'Rosa', 0, 20); R.peers.push(p); R.step(0.1); kit.movePeer(p, 0, 1.6, 0); R.step(0.3); kit.movePeer(p, 0, 1.6, 20); R.step(0.3);
      var s1 = R.seats.add({ x: 3, z: 3, name: 'Chair 1' }); R.m.seat.sit(s1.id); R.step(1); R.m.seat.stand(); R.step(1);
      var m = R.SB.log.map(function (l) { return l.msg; });
      var off = rig(); off.live(); off.door('Doorway'); var q = peer('g1', 'Rosa', 0, 0); off.peers.push(q); off.step(0.3);
      T.check('script_onEnter_onLeave_via_bus', m.indexOf('in Rosa trigger Doorway true') >= 0 && m.indexOf('out Rosa') >= 0 && m.indexOf('any Doorway') >= 0 && m.indexOf('any Garden') < 0 && m.indexOf('sat Chair 1') >= 0 && m.indexOf('rose Chair 1') >= 0 && off.m.script.instances().length === 0);
    });
    S('script_timers_die_when_scripts_off', function () {
      var R = rig(); R.live();
      R.SB.start({ s: "after(2, function () { emit('gizmo', { do: 'say', arg: 'late' }); }); every(0.5, function () { log('tick'); });" });
      R.step(1.1); var ticks = R.SB.log.filter(function (l) { return l.msg === 'tick'; }).length, t1 = R.SB.timers();
      R.SB.off(); var t2 = R.SB.timers(); R.step(3);
      T.check('script_timers_die_when_scripts_off', ticks === 2 && t1 === 2 && t2 === 0 && R.SB.log.filter(function (l) { return l.msg === 'tick'; }).length === 2 && R.ctx._said.indexOf('late') < 0 && R.m.script.instances().length === 0);
    });
    S('script_scripts_off_undoes_changes', function () {
      var R = rig(); R.live();
      R.SB.start({ s: "on('start', function () { emit('gizmo', { do: 'hide', arg: 'Lamp' }); emit('gizmo', { do: 'hide', arg: 'Lamp' }); world.spawn('box'); world.spawn('box'); world.spawn('box'); });" });
      var mid = { hidden: R.hidden.Lamp === true, spawned: R.m.script.spawned() }; R.SB.off();
      var vis = R.calls.filter(function (c) { return c[0] === 'vis'; }), last = vis[vis.length - 1];
      T.check('script_scripts_off_undoes_changes', mid.hidden && mid.spawned === 3 && R.m.script.spawned() === 0 && R.count('despawn') === 3 && R.hidden.Lamp === false && last[2] === true);
    });
    S('script_nothing_runs_on_open', function () {
      var R = rig().beats(); R.live(); R.door('Doorway');
      R.m.script.setBlocks('tpl', { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'Doorway' }, then: [{ do: 'beats', arg: 'Greeting' }] }] }); R.m.script.setVar('v', 1);
      var saved = cl(R.g.state()), txt = JSON.stringify(saved);
      var N = rig().beats(); N.g.load(saved); var rec = N.door('Doorway'); var p = peer('g1', 'Rosa', 0, 0); N.peers.push(p); N.live(); N.step(2);
      T.check('script_nothing_runs_on_open', N.m.script.instances().length === 0 && N.m.script.runLog().length === 0 && N.m.script.getBlocks('tpl') !== null && N.B.time() === 0 && N.calls.length === 0 && txt.indexOf('"blocks"') > 0 && N.m.script.vars().v === 1);
    });
    S('script_error_does_not_stop_other_gizmos', function () {
      var R = rig().beats(); R.live(); var rec = R.door('Doorway', { starts: [{ do: 'beats', arg: 'Greeting', delay: 0 }] });
      R.SB.start({ bad: "onEnter(function () { throw new Error('boom'); });", frame: "on('frame', function () { throw new Error('frame boom'); });", good: "var n = 0; onEnter(function (e) { n++; log('good ' + n); });" });
      var p = peer('g1', 'Rosa', 0, 20); R.peers.push(p); R.step(0.2); kit.movePeer(p, 0, 1.6, 0); R.step(1);
      var errs = R.SB.log.filter(function (l) { return l.err; }).length, good = R.SB.log.filter(function (l) { return /^good 1/.test(l.msg); }).length;
      var dead = R.SB.inst.frame.dead, goodAlive = !R.SB.inst.good.dead && !R.SB.inst.bad.dead;
      var logged = R.g.logList().some(function (e) { return /ERROR enter: boom/.test(e.what); });
      T.check('script_error_does_not_stop_other_gizmos', good === 1 && R.B.time() > 0.5 && dead === true && goodAlive && errs >= 5 && logged && R.m.script.instances().length === 3);
    });
    S('script_blocks_generate_code_that_runs', function () {
      var R = rig().beats(); R.live(); var rec = R.door('Doorway'); var chair = R.seats.add({ x: 3, z: 3, name: 'Chair 1' });
      var res = R.Sc.setBlocks('obj1', { v: 1, rules: [{ when: { who: 'guest', event: 'enters', target: 'Doorway' }, then: [{ do: 'beats', arg: 'Greeting' }, { do: 'wait', sec: 2 }, { do: 'seat', arg: 'Chair 1' }, { do: 'sound', arg: 'bell', mode: 'loop' }, { do: 'set', arg: 'visits', value: 3 }] },
        { when: { who: 'host', event: 'enters', target: 'Doorway' }, then: [{ do: 'say', arg: 'host only' }] }] });
      R.SB.start({ obj1: res.code });
      enter(R, rec, WHO('Rosa', true)); R.step(0.1); var playing = R.B.time() > 0, early = R.m.seat.occupant(chair.id), sound0 = R.calls.filter(function (c) { return c[0] === 'sound'; }).length;
      R.step(2.2); var sound = R.calls.filter(function (c) { return c[0] === 'sound'; }).length; var sat = R.m.seat.occupant(chair.id), vars = R.m.script.vars();
      var said = R.ctx._said.indexOf('host only') >= 0; enter(R, rec, WHO('Boss', false)); var said2 = R.ctx._said.indexOf('host only') >= 0;
      T.check('script_blocks_generate_code_that_runs', res.ok && /onEnter\("Doorway"/.test(res.code) && playing && early === null && sound0 === 0 && sat === 'rosa' && sound === 1 && R.calls.filter(function (c) { return c[0] === 'sound'; })[0][2] === 'loop' && vars.visits === 3 && said === false && said2 === true);
    });
    S('script_code_edit_greys_blocks', function () {
      var R = rig(); var res = R.Sc.setBlocks('k', { v: 1, rules: [{ when: { who: 'anyone', event: 'starts', target: '' }, then: [{ do: 'say', arg: 'hi' }] }] });
      var s0 = R.Sc.blocksState('k'), same = R.Sc.codeEdited('k', res.code), s1 = R.Sc.blocksState('k');
      var ed = R.Sc.codeEdited('k', res.code + '// my change'), s2 = R.Sc.blocksState('k'), msg = R.Sc.testIt('k'), said = R.ctx._said.slice(-1)[0];
      var saved = cl(R.g.state()), N = rig(); N.g.load(saved); var s3 = N.Sc.blocksState('k');
      var back = R.Sc.setBlocks('k', R.Sc.getBlocks('k').blocks), s4 = R.Sc.blocksState('k'), none = R.Sc.blocksState('zz');
      T.check('script_code_edit_greys_blocks', s0.mode === 'blocks' && s0.greyed === false && same === false && s1.greyed === false && ed === true && s2.mode === 'code' && s2.greyed === true && /grey/.test(s2.note) && msg === false && /Turn Scripts on/.test(said) && s3.greyed === true && back.ok && s4.greyed === false && none.mode === 'none');
    });
    S('script_all_five_templates_load_and_run', function () {
      var ids = G.Templates.list().map(function (t) { return t.id; }), okAll = ids.length === 5, notes = [];
      ids.forEach(function (id) {
        var R = rig().beats(); R.live(); var chair = R.seats.add({ x: 3, z: 3, name: 'Chair 1' });
        var inst = R.Sc.installTemplate(id); var rec = R.T.list()[0];
        var good = !!inst && /^\/\/ Made from blocks/.test(inst.code) && inst.gizmos.length === 1 && !!rec && rec.armed === false && R.g.modules.script.getBlocks(inst.key).edited === false;
        R.SB.start({ t: inst ? inst.code : '' }); var ok = good;
        if (id === 'greeting-at-the-door') { enter(R, rec, WHO('Rosa', true)); R.step(0.2); ok = ok && R.B.time() > 0; enter(R, rec, WHO('Boss', false)); }
        if (id === 'doorbell') { enter(R, rec, WHO('Rosa')); ok = ok && R.calls.some(function (c) { return c[0] === 'sound' && c[1] === 'bell' && c[2] === 'once'; }) && R.ctx._said.indexOf('Someone is at the door') >= 0; }
        if (id === 'welcome-chair') { enter(R, rec, WHO('Rosa', true)); R.step(0.3); var early = R.m.seat.occupant(chair.id); R.step(1.2); ok = ok && early === null && R.m.seat.occupant(chair.id) === 'rosa' && R.ctx._said.indexOf('Welcome. Please sit down') >= 0; }
        if (id === 'music-when-someone-enters') { enter(R, rec, WHO('Rosa')); enter(R, rec, WHO('Rosa'), 'leave'); ok = ok && R.calls.filter(function (c) { return c[0] === 'sound'; }).map(function (c) { return c[2]; }).join() === 'loop,stop'; }
        if (id === 'fall-and-get-up') { enter(R, rec, WHO('Rosa')); R.step(0.2); var t1 = R.B.time(); R.step(3); var mid = R.B.time(); R.step(2); ok = ok && t1 > 0 && t1 < 3 && R.B.time() >= 3 && R.B.getRange('Get up').a === 3; }
        if (!ok) notes.push(id); okAll = okAll && ok;
      });
      T.value('script_template_failures', notes.join('|') || 'none');
      T.check('script_all_five_templates_load_and_run', okAll && notes.length === 0);
    });
    S('script_raycast_by_tag', function () {
      var P = function (id, tag, x, z) { return { id: id, name: id, object: { position: { x: x, y: 1, z: z } }, tags: tag ? [tag] : [], radius: 0.4 }; };
      var R = rig({ props: [P('near', null, 0, -2), P('target1', 'target', 0.1, -6), P('target2', 'target', 0, -9), P('side', 'target', 5, 0)] });
      var ws = {}; R.SB.start({ s: "on('start', function () { var h = world.raycast([0, 1, 0], [0, 0, -1], { tag: 'target' }); log(JSON.stringify(h)); var any = world.raycast({ x: 0, y: 1, z: 0 }, [0, 0, -2]); log(JSON.stringify(any)); log(JSON.stringify(world.raycast([0, 1, 0], [0, 0, -1], { tag: 'target', distance: 3 }))); log(JSON.stringify(world.raycast([0, 1, 0], [0, 0, 0]))); log(JSON.stringify(world.raycast([0, 1, 0], [0, 0, 1], { tag: 'target' }))); });" });
      var l = R.SB.log.map(function (x) { return x.msg; }), a = JSON.parse(l[0]), b = JSON.parse(l[1]);
      var R2 = rig({ props: [], raycast: function (o, d, opts) { return { name: 'wall', id: 'w1', distance: 2, point: [0, 1, -2], tag: opts.tag }; } }); R2.SB.start({ s: "on('start', function () { log(JSON.stringify(world.raycast([0, 1, 0], [0, 0, -1], { tag: 't' }))); });" });
      T.check('script_raycast_by_tag', a.id === 'target1' && near(a.distance, 5.6, 0.05) && b.id === 'near' && l[2] === 'null' && l[3] === 'null' && l[4] === 'null' && JSON.parse(R2.SB.log[0].msg).name === 'wall');
    });
    S('script_spawn_budget_20', function () {
      var R = rig(); R.SB.start({ s: "var made = []; on('start', function () { for (var i = 0; i < 25; i++) { var o = spawnObj('box'); if (o) made.push(o); } log('made ' + made.length); var bad = world.spawn('../x') || world.spawn(''); log('bad ' + bad); world.despawn(made[0]); world.despawn(made[0]); var again = world.spawn('box'); log('again ' + (again ? 'yes' : 'no')); });" });
      var l = R.SB.log.map(function (x) { return x.msg; });
      var b = R.Sc.setSpawnBudget(500), c = R.Sc.setSpawnBudget(0), d = R.Sc.setSpawnBudget(3);
      T.check('script_spawn_budget_20', l[0] === 'made 20' && l[1] === 'bad null' && l[2] === 'again yes' && R.Sc.spawned() === 20 && R.count('despawn') === 1 && /Spawn budget reached \(20\)/.test(R.g.logList().concat(R.ctx._said.map(function (t) { return { what: t }; })).map(function (e) { return e.what; }).join('|')) && b === 100 && c === 1 && d === 3);
    });
    S('script_vars_saved_and_loaded', function () {
      var R = rig(); R.SB.start({ s: "on('start', function () { world.vars.score = 5; world.vars.name = 'Rosa'; world.vars.on = true; world.vars.bad = {}; world.vars.huge = 1e9; world.vars.long = 'x'.repeat(500); world.vars.__proto__ = 1; world.vars.fn = function () {}; log(Object.keys(world.vars).join()); });" });
      var keys = R.SB.log[0].msg, v = R.Sc.vars();
      for (var i = 0; i < 80; i++) R.Sc.setVar('k' + i, i);
      var count = Object.keys(R.Sc.vars()).length; var saved = cl(R.g.state()); var N = rig(); N.g.load(saved); N.SB.start({ s: "on('start', function () { log(world.vars.score + ' ' + world.vars.name + ' ' + world.vars.on + ' ' + world.vars.missing); });" });
      var G = rig({ guest: true });
      T.check('script_vars_saved_and_loaded', keys === 'score,name,on' && v.score === 5 && v.name === 'Rosa' && count === 64 && N.SB.log[0].msg === '5 Rosa true undefined' && G.Sc.setVar('a', 1) === false);
    });
    S('script_visitor_count_off_by_default', function () {
      var R = rig().beats(); R.live(); var rec = R.door('Doorway');
      R.SB.start({ s: "onEnter(function (e) { log('count ' + visitor.count(e.who.name)); });" });
      enter(R, rec, WHO('Rosa')); var off1 = R.SB.log.slice(-1)[0].msg, stored0 = R.g.getFile('script_visitors');
      var on = R.Sc.setVisitorCounts(true); enter(R, rec, WHO('Rosa')); enter(R, rec, WHO('Rosa')); enter(R, rec, WHO('Ben')); var l = R.SB.log.map(function (x) { return x.msg; });
      var inScene = JSON.stringify(R.g.state()).indexOf('visitor') >= 0 || JSON.stringify(R.g.state()).indexOf('rosa') >= 0, stored = R.g.getFile('script_visitors');
      var back = R.Sc.setVisitorCounts(false), zero = R.Sc.visitorCount('Rosa'); R.Sc.clearVisitorCounts();
      var G = rig({ guest: true });
      T.check('script_visitor_count_off_by_default', off1 === 'count 0' && stored0 === null && on === true && l.slice(-3).join() === 'count 1,count 2,count 1' && inScene === false && JSON.parse(stored).rosa === 2 && back === false && zero === 0 && R.g.getFile('script_visitors') === null && G.Sc.setVisitorCounts(true) === false);
    });
    S('script_log_has_entries_and_test_it', function () {
      var R = rig().beats(); R.live(); R.door('Doorway');
      var inst = R.Sc.installTemplate('greeting-at-the-door'), before = R.Sc.runLog().length, ok = R.Sc.testIt(inst.key);
      var log = R.Sc.runLog(), last = log[log.length - 1], run = R.Sc.running(), glog = R.g.logList().filter(function (e) { return e.who === 'script'; });
      R.step(2); var gone = R.Sc.running();
      var dom = kit.makeFakeDom(), el = dom.createElement('div'); R.Sc.mountBlocks(el); var words = kit.domText(el);
      var lines = R.Sc.describe(inst.key);
      var multi = R.Sc.installTemplate('fall-and-get-up'), t2 = R.Sc.testIt(multi.key), later = R.Sc.runLog().length; R.step(4.5);
      T.check('script_log_has_entries_and_test_it', ok === true && before === 0 && log.length >= 1 && /play beats Greeting \(test\)/.test(last.text) && last.rule === 0 && last.step === 0 && run && run.rule === 0 && run.key === inst.key && gone === null && glog.length >= 1 && R.B.time() > 0 &&
        /test it with me/.test(words) && /template: doorbell/.test(words) && lines[0] === 'When a guest enters Doorway: play beats Greeting' && t2 === true && R.Sc.runLog().length > later);
    });
    S('script_generated_code_has_no_em_dash', function () {
      var dashy = 'A ' + DASH + ' B ' + EN + ' C', R = rig();
      var res = R.Sc.setBlocks('d', { v: 1, rules: [{ when: { who: { name: 'Ro' + DASH + 'sa' }, event: 'enters', target: 'Door ' + DASH + ' way' }, then: [{ do: 'say', arg: dashy }, { do: 'wait', sec: 1 }, { do: 'set', arg: 'k', value: dashy }] }] });
      var rows = [], dom = kit.makeFakeDom(), el = dom.createElement('div'); R.Sc.mountBlocks(el);
      var all = [res.code, R.Sc.codeFor('d'), R.Sc.describe('d').join(' '), kit.domText(el), JSON.stringify(R.Sc.getBlocks('d').blocks)];
      G.Templates.list().forEach(function (t) { var tt = G.Templates.get(t.id); all.push(t.name, t.note, B.generate(tt.blocks, { key: 'x' }), B.describe(tt.blocks.rules[0])); });
      T.check('script_generated_code_has_no_em_dash', res.ok && all.every(function (s) { return !hasDash(s); }) && /A, B, C/.test(res.code));
    });
    S('script_hostile_blocks_rejected', function () {
      var bad = [null, 5, 'x', [], { v: 2, rules: [] }, { v: 1, rules: 'x' },
        { v: 1, rules: [{ when: { event: 'explodes', target: 'a' }, then: [] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'a' }, then: [{ do: 'eval', arg: 'x' }] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'a' }, then: [{ do: 'wait', sec: -1 }] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'a' }, then: [{ do: 'wait', sec: 1e9 }] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'a' }, then: [{ do: 'set', arg: 'k', value: {} }] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters', target: 'a' }, then: [{ do: 'sound', arg: 'b', mode: 'explode' }] }] },
        { v: 1, rules: [{ when: { who: { name: '' }, event: 'enters', target: 'a' }, then: [{ do: 'say', arg: 'x' }] }] },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'enters' }, then: [{ do: 'say', arg: 'x' }] }] },
        { v: 1, rules: new Array(20).fill({ when: { who: 'anyone', event: 'starts' }, then: [{ do: 'say', arg: 'x' }] }) },
        { v: 1, rules: [{ when: { who: 'anyone', event: 'starts' }, then: new Array(40).fill({ do: 'say', arg: 'x' }) }] }];
      var verdicts = bad.map(function (b) { return B.validate(b).ok; });
      /* strings that try to end the string literal and add a statement are only ever text */
      var nasty = ['"); __danger(); ("', "'); __danger(); ('", '\n}); __danger(); (function(){', '${__danger()}', '`; __danger(); `', '*/ __danger(); /*', '</script><script>__danger()</script>', '\\"); __danger(); (\\"', 'x' + String.fromCharCode(0x2028) + '__danger();', 'a\r\n__danger();//'];
      var hit = 0; var g0 = typeof globalThis !== 'undefined' ? globalThis : window; g0.__danger = function () { hit++; };
      var R = rig(), seenArgs = [];
      var json = { v: 1, rules: nasty.map(function (n, i) { return { when: { who: 'anyone', event: 'enters', target: n }, then: [{ do: 'say', arg: n }, { do: 'wait', sec: 0 }, { do: 'set', arg: 'v' + i, value: n }, { do: 'beats', arg: n }] }; }) };
      json.rules = json.rules.slice(0, 10);
      var res = R.Sc.setBlocks('h', json); var rec = R.door('Doorway');
      R.SB.start({ h: res.code }); nasty.forEach(function (n) { R.g.emit('enter', { trigger: { name: n }, id: 'x', who: WHO('Rosa') }); }); R.step(0.3);
      var lines = res.code.split('\n').length, direct = R.Sc.run({ do: 'eval', arg: '__danger()' }) || R.Sc.run({ do: 'say' }) || R.Sc.run(null) || R.Sc.run({ do: 'beats', arg: '' });
      var src = ''; if (typeof require === 'function') { try { src = require('fs').readFileSync(require('path').join(__dirname, 'gizmo_next_blocks.js'), 'utf8'); } catch (e) { src = ''; } }
      delete g0.__danger;
      T.value('script_hostile_cases', bad.length + nasty.length);
      T.check('script_hostile_blocks_rejected', verdicts.every(function (v) { return v === false; }) && res.ok && hit === 0 && direct === false && !/\beval\s*\(/.test(src) && !/new Function/.test(src) && !/\bFunction\s*\(/.test(src) && lines <= 200 && R.Sc.setBlocks('q', bad[7]).ok === false && R.Sc.getBlocks('q') === null);
    });

    /* ---- the rest of the contract ---- */
    S('script_guest_cannot_run_or_edit', function () {
      var R = rig({ guest: true }); var inst = { key: 'g', h: {}, name: 'g' }, X = R.Sc.extend(inst, {});
      var a = R.Sc.run({ do: 'say', arg: 'x' }), b = R.Sc.setBlocks('k', { v: 1, rules: [] }), c = R.Sc.installTemplate('doorbell'), d = R.Sc.testIt('k'), dom = kit.makeFakeDom(), el = dom.createElement('div'); R.Sc.mountBlocks(el);
      var w = {}; var X2 = R.Sc.extend({ key: 'g2', h: {}, name: 'g2' }, { world: w });
      T.check('script_guest_cannot_run_or_edit', a === false && b.ok === false && c === null && d === false && /only the host edits scripts/.test(kit.domText(el)) && w.spawn('box') === null && R.Sc.setVar('a', 1) === false);
    });
    S('script_extend_is_quiet_and_complete', function () {
      var R = rig(), inst = { key: 'o', h: {}, name: 'o' }, w = {}, X = R.Sc.extend(inst, { world: w });
      T.check('script_extend_is_quiet_and_complete', X.names.length === 6 && X.values.length === 6 && X.names.every(function (n, i) { return typeof X.values[i] === 'function' || typeof X.values[i] === 'object'; }) && typeof w.raycast === 'function' && typeof w.spawn === 'function' && typeof w.despawn === 'function' && !!w.vars && R.Sc.instances().join() === 'o' && R.m.beats.time() === 0 && R.calls.length === 0);
    });
  }

  var api = { stage: 'H10', section: 'script', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H10 = api;
})();
