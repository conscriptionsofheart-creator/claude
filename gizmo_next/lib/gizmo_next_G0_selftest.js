/* gizmo_next_G0_selftest.js: the checks for stage G0 (the core). Pure logic, three.js stub, no headset.
   node gizmo_next_G0_selftest.js     or the demo page gizmo_next_demo.html.   Each line is "name: 1" (pass), "name: 0" (fail) or a measurement; the last line is RESULT passed/total. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';

  function run(T, kit) { return kit.isolate(function () { return runAll(T, kit); }); }
  function runAll(T, kit) {
    var GN = kit.GizmoNext, DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var mk = function (o, over, id) { var g = kit.makeInst(o); var K = kit.countingKind(id, over); var api = g.defineKind(K.spec); return { g: g, api: api, K: K, ctx: g._ctx }; };
    var unreg = function (n) { var i = GN._registry.findIndex(function (e) { return e.name === n; }); if (i >= 0) GN._registry.splice(i, 1); };
    var entryOf = function (g, id) { return g.entries([]).find(function (e) { return e.id === id; }); };

    /* ---- before anything is installed every global function is a quiet no-op ---- */
    S('core_global_noops_before_install', function () {
      var had = GN.inst; GN.inst = null;
      var ok = GN.has('x') === false && GN.entries([1]).length === 1 && Array.isArray(GN.rows({ kind: 'x', id: 'y' })) && GN.rows({}).length === 0 && GN.dup({}) === null && GN.del({}) === null &&
        GN.restore('x', {}) === null && GN.get('x', 'y') === null && GN.addAt('x', {}) === null && GN.thumb('x') === null && GN.state() === null && GN.load({}) === false && GN.reset() === false &&
        GN.isLive() === false && GN.setLive(true) === false && GN.pages('animate').length === 0 && GN.pageRows('x').length === 0 && GN.sync.parts().length === 0 && GN.sync.validate('x', {}) === false &&
        GN.mountPanel({}) === false;
      var threw = false; try { GN.tick(0.016); } catch (e) { threw = true; }
      GN.inst = had;
      T.check('core_global_noops_before_install', ok && !threw);
    });

    /* ---- kinds ---- */
    S('core_defineKind_add_get_remove', function () {
      var m = mk(), ev = [];
      m.g.on('kind-add', function (p) { ev.push('add:' + p.id); }); m.g.on('kind-remove', function (p) { ev.push('rm:' + p.id); });
      var r = m.api.add({ x: 1, z: 2 });
      var a = !!r && typeof r.id === 'string' && m.api.get(r.id) === r && m.api.list.length === 1 && m.g.has('demo') && m.g.get('demo', r.id) === r && r.x === 1 && r.z === 2 && r.name === 'Demo box';
      var removed = m.api.remove(r.id);
      T.check('core_defineKind_add_get_remove', a && removed && m.api.list.length === 0 && m.api.get(r.id) === null && ev.join() === 'add:' + r.id + ',rm:' + r.id && m.g.defineKind({ id: 'bad id!' }) === null);
    });
    S('core_marker_flags', function () {
      var m = mk(), r = m.api.add({}), mkr = r._mk, flagged = true, n = 0;
      mkr.traverse(function (o) { n++; if (!o.userData || o.userData.isMarker !== true) flagged = false; });
      var c0 = mkr.children[0], sphere = !!c0 && c0.isMesh && c0.geometry.type === 'SphereGeometry';
      mkr.updateMatrixWorld(true);
      var hits = new kit.THREE.Raycaster(new kit.THREE.Vector3(0, 0.25, 5), new kit.THREE.Vector3(0, 0, -1)).intersectObject(mkr, true);
      T.check('core_marker_flags', flagged && n >= 3 && sphere && hits.length === 1 && hits[0].object === c0 && mkr.userData.gizmoDone === 1 && mkr.userData.gizmoKind === 'demo' && m.ctx._scene.children.indexOf(mkr) >= 0);
    });
    S('core_entries_shape', function () {
      var m = mk(), r = m.api.add({}), e = entryOf(m.g, r.id);
      var keys = ['id', 'name', 'object', 'pickObj', 'kind', 'group', 'setGroup', 'setLocked', 'commit'];
      var ok = !!e && keys.every(function (k) { return k in e; }) && e.object === r._mk && e.pickObj === r._mk.children[0] && e.kind === 'demo' && e.id === r.id &&
        typeof e.group === 'function' && typeof e.setGroup === 'function' && typeof e.setLocked === 'function' && typeof e.commit === 'function';
      e.setGroup('g1'); e.setLocked(true);
      ok = ok && e.group() === 'g1' && r.group === 'g1' && r.locked === true && r._mk.userData.locked === true && r._mk.userData.groupId === 'g1';
      e.setGroup(''); ok = ok && r._mk.userData.groupId === undefined;
      T.check('core_entries_shape', ok);
    });
    S('core_commit_reads_marker_back', function () {
      var m = mk(), r = m.api.add({}), e = entryOf(m.g, r.id);
      r._mk.position.set(2, 3.25, -1); r._mk.rotation.set(0, 0.7, 0);
      e.commit();
      T.check('core_commit_reads_marker_back', near(r.x, 2) && near(r.y, 3) && near(r.z, -1) && near(r.yaw, 0.7, 1e-5) && r._mk.rotation.x === 0 && r._mk.rotation.z === 0);
    });
    S('core_resize_size_normalises', function () {
      var m = mk(), r = m.api.add({}), e = entryOf(m.g, r.id), before = m.K.counts.build, same = r._mk;
      r._mk.scale.set(2, 1, 0.5); e.commit();
      var a = near(r.size[0], 2) && near(r.size[1], 1) && near(r.size[2], 0.5) && r._mk.scale.x === 1 && r._mk.scale.y === 1 && r._mk.scale.z === 1 && m.K.counts.build === before + 1;
      e.commit();
      var geom = r._mk.children[1].geometry.parameters;
      T.check('core_resize_size_normalises', a && m.K.counts.build === before + 1 && r._mk === same && near(geom.width, 2) && near(geom.depth, 0.5));
    });
    S('core_resize_scale_saved_as_sc', function () {
      var m = mk(null, { resize: 'scale', defaults: function () { return { enabled: true, armed: false, who: 'anyone', cooldown: 0, tags: [] }; } }), r = m.api.add({}), e = entryOf(m.g, r.id);
      r._mk.scale.set(1.5, 2, 3); e.commit();
      var j = m.api.toJSON().items[0], g2 = kit.makeInst(), a2 = g2.defineKind(kit.countingKind('demo', { resize: 'scale' }).spec);
      a2.fromJSON(m.api.toJSON());
      var r2 = a2.list[0];
      T.check('core_resize_scale_saved_as_sc', r.sc[0] === 1.5 && r.sc[1] === 2 && r.sc[2] === 3 && r._mk.scale.z === 3 && j.sc[2] === 3 && !('size' in r) && r2 && r2._mk.scale.y === 2);
    });
    S('core_max_cap_refuses_and_says', function () {
      var m = mk(null, { max: 3 });
      var a = m.api.add({}), b = m.api.add({}), c = m.api.add({}), d = m.api.add({});
      var said = m.ctx._said[m.ctx._said.length - 1] || '';
      T.check('core_max_cap_refuses_and_says', !!a && !!b && !!c && d === null && m.api.list.length === 3 && said.indexOf('3') >= 0 && said.indexOf('fit') >= 0 && m.g.addAt('demo', { x: 0, y: 1, z: 0 }) === null);
    });
    S('core_dup_new_id_and_group', function () {
      var m = mk(null, { dupReset: ['armed'] }), r = m.api.add({ armed: true, x: 1 }), e = entryOf(m.g, r.id);
      e.setLocked(true);
      var nid = m.g.dup(e, { x: 5, y: 1, z: 5 }, 'g42'), r2 = m.api.get(nid);
      T.check('core_dup_new_id_and_group', !!nid && nid !== r.id && !!r2 && r2.group === 'g42' && r2.locked === false && near(r2.x, 5) && near(r2.y, 0.75) && near(r2.z, 5) && r2.armed === false && r.armed === true && r.locked === true && r2.name === r.name);
    });
    S('core_del_then_restore_same_spec', function () {
      var m = mk(), r = m.api.add({ x: 3, tags: ['a'] }), id = r.id, e = entryOf(m.g, id), snap = JSON.stringify(m.api.toJSON().items[0]);
      var spec = m.g.del(e);
      var gone = m.api.list.length === 0 && !m.api.get(id) && JSON.stringify(spec) === snap;
      var back = m.g.restore('demo', spec);
      T.check('core_del_then_restore_same_spec', gone && back === id && JSON.stringify(m.api.toJSON().items[0]) === snap && !!m.api.get(id)._mk);
    });
    S('core_restore_refuses_when_id_exists', function () {
      var m = mk(), r = m.api.add({}), spec = m.api.toJSON().items[0];
      var back = m.g.restore('demo', spec), said = m.ctx._said[m.ctx._said.length - 1] || '';
      T.check('core_restore_refuses_when_id_exists', back === null && m.api.list.length === 1 && said.indexOf('Undo already brought it back') >= 0 && r.id === spec.id);
    });
    S('core_toJSON_fromJSON_roundtrip', function () {
      var m = mk();
      m.api.add({ x: 1, y: 0.5, z: -2, yaw: 1.2, name: 'One', tags: ['a', 'b'], who: 'guests', cooldown: 7, size: [2, 1, 3] }); m.api.add({ x: -3, locked: true, group: 'g1', armed: true });
      var j1 = JSON.stringify(m.api.toJSON()), st = JSON.stringify(m.g.state());
      var m2 = mk(); m2.api.fromJSON(JSON.parse(j1));
      var m3 = mk(); m3.g.load(JSON.parse(st));
      T.check('core_toJSON_fromJSON_roundtrip', j1 === JSON.stringify(m2.api.toJSON()) && st === JSON.stringify(m3.g.state()) && m2.api.list.length === 2 && !!m2.api.list[0]._mk && JSON.parse(j1).items[0].tags.length === 2);
    });

    S('core_runtime_fields_not_saved', function () {
      var m = mk(), r = m.api.add({ x: 1 });
      r._visitors = ['a', 'b']; r._lastFire = 12345; r._mk.userData.note = 'runtime';
      var j = JSON.stringify(m.g.state()), e = entryOf(m.g, r.id), nid = m.g.dup(e, null, ''), c = m.api.get(nid);
      T.check('core_runtime_fields_not_saved', j.indexOf('_visitors') < 0 && j.indexOf('_lastFire') < 0 && !('_visitors' in c) && !('_lastFire' in c) && m.g.state().kinds.demo.items.length === 2 && Object.keys(c).indexOf('_mk') < 0);
    });
    /* ---- Gizmos live, nothing runs on open ---- */
    S('core_live_default_false', function () {
      var m = mk(), r = m.api.add({ armed: true });
      m.g.tick(0.016); m.g.tick(0.016);
      var okNow = m.g.isLive() === false && m.g.state().live === false && m.K.counts.frame === 0 && kit.track(GN.create({})).isLive() === false;
      T.check('core_live_default_false', okNow && !!r);
    });
    S('core_state_load_runs_nothing', function () {
      var soundCalls = 0, m = mk({ sounds: { playMode: function () { soundCalls++; }, set: function () { soundCalls++; } } });
      var st = { v: 1, live: true, kinds: { demo: { items: [{ armed: true, x: 1 }, { armed: true, x: 2 }] } }, parts: {} };
      m.g.load(st);
      var a = m.K.counts.frame === 0 && m.K.counts.liveOn === 0 && soundCalls === 0 && m.api.list.length === 2 && m.g.isLive() === true;
      m.g.tick(0.016);
      var b = m.K.counts.frame === 2;
      m.g.load({ v: 1, live: false, kinds: { demo: { items: [{ armed: true }] } } });
      m.g.tick(0.016);
      T.check('core_state_load_runs_nothing', a && b && m.g.isLive() === false && m.K.counts.frame === 2 && m.g.load(null) === true && m.api.list.length === 0 && m.g.isLive() === false);
    });
    S('core_onFrame_only_when_live_and_armed', function () {
      var m = mk(), r = m.api.add({}), free = mk(null, { defaults: function () { return { size: [1, 1, 1] }; } });
      free.api.add({}); free.g.setLive(true); free.g.tick(0.016);
      m.g.setLive(true); m.g.tick(0.016);
      var disarmed = m.K.counts.frame === 0;
      m.api.set(r.id, { armed: true }); m.g.setLive(false); m.g.tick(0.016);
      var off = m.K.counts.frame === 0;
      m.g.setLive(true); m.g.tick(0.016);
      T.check('core_onFrame_only_when_live_and_armed', disarmed && off && m.K.counts.frame === 1 && free.K.counts.frame === 1 && m.K.counts.liveOn === 2 && m.K.counts.liveOff === 1);
    });
    S('core_guest_never_live_from_file', function () {
      var st = { v: 1, live: true, kinds: {}, parts: {} };
      var gst = mk({ guest: true }), host = mk();
      gst.g.load(st); host.g.load(st);
      T.check('core_guest_never_live_from_file', gst.g.isLive() === false && host.g.isLive() === true && gst.g.loadFromStorage() === false);
    });
    S('core_hostile_state_ok', function () {
      var m = mk(), threw = false, big = new Array(10001).join('a');
      var evil = { size: [-5, NaN, 1e9], x: NaN, y: 'str', z: Infinity, yaw: 1e12, name: new Array(500001).join('x'), tags: new Array(10001).fill('a'), enabled: 'yes', who: {}, cooldown: -9, locked: 'no', group: 12345, armed: [1], id: '__proto__' };
      var hostile = { v: 1, live: 'true', kinds: { demo: { items: [evil, null, 7, 'x', [], { name: big }].concat(new Array(500).fill({})) }, bogus: { items: 'nope' }, __proto__: { items: [] } }, parts: { evil: { big: new Array(2000001).join('x') } } };
      try { m.g.load(hostile); m.g.load('garbage'); m.g.load([1, 2]); m.g.load(42); m.g.load(hostile); } catch (e) { threw = true; }
      var items = m.api.list, r = items[0];
      var clean = !!r && r.size.every(function (v) { return v >= 0.02 && v <= 100; }) && r.x === 0 && r.y === 0 && r.z === 0 && Math.abs(r.yaw) <= Math.PI + 1e-9 && r.name.length <= 80 && r.tags.length <= 24 && r.enabled === true &&
        r.who === 'anyone' && r.cooldown >= 0 && r.locked === false && typeof r.group === 'string' && r.armed === false;
      var small = JSON.stringify(m.g.state()).length < 20000;
      T.check('core_hostile_state_ok', !threw && clean && items.length > 0 && items.length <= 12 && small && m.g.isLive() === false && m.g.state().parts.evil === undefined && m.g.state().kinds.bogus === undefined);
    });

    /* ---- Gizmos registry: Hide gizmos keeps logic, Photo leaves the box out ---- */
    S('core_registers_with_Gizmos', function () {
      var m = mk(), G = m.ctx.gizmos, k = G.kindOf('demo');
      var fields = !!k && k.id === 'demo' && k.name === 'Demo box' && k.plural === 'Demo boxes' && /^#[0-9a-f]{3,8}$/i.test(k.col) && ['avail', 'items', 'markersOn', 'setMarkers'].every(function (f) { return typeof k[f] === 'function'; });
      m.api.add({});
      var a = fields && k.avail() === true && k.items().length === 1 && k.items()[0]._mk && k.markersOn() === true;
      k.setMarkers(false);
      T.check('core_registers_with_Gizmos', a && k.markersOn() === false && k.items()[0]._mk.visible === false && G.registered.length === 1 && mk({ guest: true }).ctx.gizmos.kindOf('demo').avail() === false);
    });
    S('core_hide_gizmos_keeps_logic', function () {
      var m = mk(), r = m.api.add({ armed: true }), G = m.ctx.gizmos;
      m.g.setLive(true);
      G.setHidden('demo', true);
      var hidden = r._mk.visible === false && m.g.entries([]).length === 0;
      m.g.tick(0.016); m.g.tick(0.016);
      var kept = m.K.counts.frame === 2;
      G.setHidden('demo', false);
      T.check('core_hide_gizmos_keeps_logic', hidden && kept && r._mk.visible === true && m.g.entries([]).length === 1);
    });
    S('core_photo_mode_markers_flag', function () {
      var m = mk(), r = m.api.add({}), G = m.ctx.gizmos, all = true;
      r._mk.traverse(function (o) { if (o.userData.isMarker !== true) all = false; });
      G.photoMode(true);
      var out = r._mk.visible === false;
      G.photoMode(false);
      T.check('core_photo_mode_markers_flag', all && out && r._mk.visible === true);
    });

    /* ---- rows, pages, panel ---- */
    S('core_rows_from_fields', function () {
      var said = [], redraws = 0, opened = [], H = { say: function (t) { said.push(t); }, redraw: function () { redraws++; }, openPage: function (id) { opened.push(id); } };
      var m = mk(null, { rows: function (rec, h) { return [{ label: 'Test it', ic: 'play', act: function () { h.say('Tested'); } }]; } }), r = m.api.add({}), e = entryOf(m.g, r.id);
      var label = function (rows, pre) { return rows.find(function (x) { return x.label.indexOf(pre) === 0; }); };
      var rows = m.g.rows(e, H);
      var first = rows[0].label === 'Test it';
      var before = m.ctx._undos;
      label(rows, 'Enabled').act(); var b = r.enabled === false && m.ctx._undos === before + 1;
      rows = m.g.rows(e, H); var bOn = label(rows, 'Enabled').label === 'Enabled: off';
      label(rows, 'Triggered By').act(); var en = r.who === 'guests'; label(m.g.rows(e, H), 'Triggered By').act(); var en2 = r.who === 'anyone';
      label(m.g.rows(e, H), 'Cooldown (s): 0 (more)').act(); var up = r.cooldown === 1;
      label(m.g.rows(e, H), 'Cooldown (s): 1 (less)').act(); label(m.g.rows(e, H), 'Cooldown (s): 0 (less)').act(); var down = r.cooldown === 0;
      label(m.g.rows(e, H), 'Tags: 0').act();
      m.api.set(r.id, { tags: ['a', 'b'] });
      var pr = m.g.pageRows('list:demo:tags', H), trash = pr.length === 2 && pr[0].ic === 'trash' && pr[0].label === 'a';
      pr[0].act();
      T.check('core_rows_from_fields', first && b && bOn && en && en2 && up && down && opened[0] === 'list:demo:tags' && trash && r.tags.join() === 'b' && redraws > 0 && said.length > 0 && rows.every(function (x) { return typeof x.label === 'string' && x.label.indexOf(DASH) < 0; }));
    });
    S('core_pages_registry', function () {
      var m = mk();
      m.g.registerPage({ id: 'beats', title: 'BEAT STRIP', where: 'animate', rows: function (H) { return [{ label: 'Add beat ' + DASH + ' now', ic: 'plus', act: function () { H.say('added'); } }]; }, thumb: function () { return 'canvas'; } });
      m.g.registerPage({ id: 'tuning', title: 'GIZMO SETTINGS', where: 'settings', rows: function () { return []; } });
      m.g.registerPage({ id: 'odd', title: 'ODD', where: 'nowhere' });
      var an = m.g.pages('animate'), st = m.g.pages('settings'), rows = m.g.pageRows('beats', {});
      T.check('core_pages_registry', an.length === 2 && an[0].id === 'beats' && an[0].title === 'BEAT STRIP' && an[0].label === 'Beat strip' && an[0].thumb() === 'canvas' && st.length === 2 && st[0].id === 'live' && st[1].label === 'Gizmo settings' &&
        rows.length === 1 && rows[0].label.indexOf(DASH) < 0 && m.g.pageRows('missing', {}).length === 0 && m.g.pages('animate').every(function (p) { return p.id.indexOf('list:') !== 0; }));
    });
    S('core_panel_guest_has_no_save_export_download', function () {
      var dom = kit.makeFakeDom(), words = ['save', 'export', 'download'];
      var host = mk(), gst = mk({ guest: true }), he = dom.createElement('div'), ge = dom.createElement('div');
      host.g.mountPanel(he); gst.g.mountPanel(ge);
      var ht = kit.domText(he), gt = kit.domText(ge);
      var clean = words.every(function (w) { return ht.indexOf(w) < 0 && gt.indexOf(w) < 0; });
      var liveBtn = kit.domFind(he, function (n) { return n.className === 'gn-live'; })[0], addBtn = kit.domFind(he, function (n) { return n.className === 'gn-addbtn'; })[0];
      liveBtn.click(); var on = host.g.isLive() === true && liveBtn.textContent === 'Gizmos live: on';
      addBtn.click();
      var guestButtons = kit.domFind(ge, function (n) { return n.tagName === 'BUTTON'; });
      T.check('core_panel_guest_has_no_save_export_download', clean && on && host.api.list.length === 1 && guestButtons.length === 0 && gt.indexOf('gizmos live: off') >= 0 && ht.indexOf('add demo box') >= 0);
    });

    S('core_live_page_rows', function () {
      var m = mk(), gst = mk({ guest: true }), said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} };
      var rows = m.g.pageRows('live', H), off = rows[0].label === 'Gizmos live: off' && rows[1].label === 'What ran: nothing yet';
      rows[0].act();
      var on = m.g.isLive() === true && m.g.pageRows('live', H)[0].label === 'Gizmos live: on' && m.g.pageRows('live', H)[0].on() === true;
      var tiles = m.g.pages('settings');
      var grows = gst.g.pageRows('live', H); grows[0].act();
      m.g.log({ who: 'Doorway', what: 'Someone entered' });
      T.check('core_live_page_rows', off && on && tiles.length === 1 && tiles[0].label === 'Gizmos live' && gst.g.isLive() === false && grows[0].label === 'Gizmos live: off' && said.length === 2 &&
        m.g.pageRows('live', H).some(function (r) { return r.label === 'Doorway: Someone entered'; }) && m.g.pageRows('live', H).every(function (r) { return r.label.indexOf(DASH) < 0; }));
    });
    S('core_probe_part_quiet_until_live', function () {
      if (kit.inNode) require('./gizmo_next_probe.js');
      if (typeof GN._probeRegister !== 'function') { T.check('core_probe_part_quiet_until_live', true); return; }
      GN._probeRegister();
      var g = kit.makeInst(), r = g._kinds.probe.api.add({});
      kit.stepSeconds(g, 0.5); var quiet = (r._frames || 0) === 0;
      g.setLive(true); kit.stepSeconds(g, 0.5);
      var rows = g.rows({ kind: 'probe', id: r.id }, {});
      T.check('core_probe_part_quiet_until_live', quiet && r._frames === 30 && rows[0].label === 'Frames run: 30' && JSON.stringify(g.state()).indexOf('_frames') < 0);
      unreg('probe');
    });
    /* ---- the bus, the log ---- */
    S('core_bus_events', function () {
      var m = mk(), got = [], boom = function () { throw new Error('x'); }, good = function (p) { got.push(p); };
      m.g.on('live', boom); m.g.on('live', good);
      var ticks = 0; m.g.on('tick', function () { ticks++; });
      m.g.setLive(true); m.g.tick(0.016); m.g.setLive(false); m.g.tick(0.016);
      var live = got.length === 2 && got[0] === true && got[1] === false;
      var ev = []; ['scene-load', 'scene-reset', 'kind-add', 'kind-remove', 'enter', 'leave', 'fire', 'beat-play', 'beat-stop', 'seat', 'arrive'].forEach(function (n) { m.g.on(n, function (p) { ev.push(n); }); });
      var r = m.api.add({}); m.api.remove(r.id); m.g.load({ v: 1 }); m.g.reset();
      ['enter', 'leave', 'fire', 'beat-play', 'beat-stop', 'seat', 'arrive'].forEach(function (n) { m.g.emit(n, {}); });
      var off = function () {}; m.g.on('x', off); m.g.off('x', off);
      T.check('core_bus_events', live && ticks === 1 && ev.join() === 'kind-add,kind-remove,scene-load,scene-reset,enter,leave,fire,beat-play,beat-stop,seat,arrive' && m.g.emit('x', 1) === 0);
    });
    S('core_log_ring_200', function () {
      var m = mk();
      for (var i = 0; i < 250; i++) m.g.log({ who: 'w', what: 'e' + i });
      var l = m.g.logList(), s = m.g.log('plain text');
      T.check('core_log_ring_200', l.length === 200 && l[0].what === 'e50' && l[199].what === 'e249' && typeof l[0].t === 'number' && l[0].who === 'w' && m.g.logList().length === 200 && s.what === 'plain text' && m.g.logList()[199].what === 'plain text');
    });
    S('core_timers_die_when_live_off', function () {
      var m = mk(), ran = [];
      m.g.setLive(true); m.g.after(0.5, function () { ran.push('a'); });
      kit.stepSeconds(m.g, 0.3); var early = ran.length === 0; kit.stepSeconds(m.g, 0.4);
      m.g.after(0.5, function () { ran.push('b'); }); m.g.setLive(false); kit.stepSeconds(m.g, 1);
      m.g.setLive(true); m.g.after(0.2, function () { ran.push('c'); }); m.g.load({ v: 1 }); m.g.setLive(true); kit.stepSeconds(m.g, 1);
      var id = m.g.after(0.1, function () { ran.push('d'); }); m.g.cancel(id); kit.stepSeconds(m.g, 0.5);
      T.check('core_timers_die_when_live_off', early && ran.join() === 'a');
    });

    /* ---- friends: sync parts ---- */
    S('core_sync_part_registry_validate_bounds', function () {
      var m = mk(null, { sync: { part: 'demo', send: true } }), g = m.g;
      var names = g.sync.parts(), P = g.sync.encodeAll({});
      var a = names.indexOf('demo') >= 0 && names.indexOf('gizmos') >= 0 && P.gizmos.live === false && P.demo === undefined;
      m.api.add({}); P = g.sync.encodeAll({});
      var b = P.demo && P.demo.items.length === 1;
      var deepBomb = {}; var cur = deepBomb; for (var i = 0; i < 12; i++) { cur.n = {}; cur = cur.n; }
      var bad = [g.sync.validate('nope', {}), g.sync.validate('demo', null), g.sync.validate('demo', { items: 'x' }), g.sync.validate('demo', { items: [{ x: NaN }] }), g.sync.validate('demo', { items: [], big: new Array(20001).join('a') }),
        g.sync.validate('demo', { items: new Array(13).fill({}) }), g.sync.validate('demo', deepBomb), g.sync.validate('gizmos', { live: 'yes' }), g.sync.validate('demo', { items: [], x: new Array(601).fill(1) }),
        g.sync.validate('demo', { items: [], '__proto__x': 1, k: 'a'.repeat(4001) })];
      var good = g.sync.validate('demo', { items: [{ x: 1 }] }) && g.sync.validate('gizmos', { live: true });
      T.check('core_sync_part_registry_validate_bounds', a && b && bad.every(function (x) { return x === false; }) && good === true && g.sync.apply('demo', { items: [{ x: 9 }] }, 'h') === false && m.api.list[0].x === 0);
    });
    S('core_two_instances_bus', function () {
      var hg = kit.makeHostGuest({ latencyMs: 80 }), got = [];
      hg.bus.b.on('probe', function (o) { got.push(o.n); });
      var ok1 = hg.host.send('probe', { n: 1 });
      hg.step(0.05); var early = got.length === 0; hg.step(0.05);
      var arrived = got.length === 1 && got[0] === 1 && ok1 === true;
      var sentOk = 0; for (var i = 0; i < 25; i++) if (hg.host.send('probe', { n: 100 + i })) sentOk++;
      hg.step(0.2);
      var limited = sentOk === 9 && got.length === 10;
      hg.step(1.0); var ok2 = hg.host.send('probe', { n: 999 }); hg.step(0.2);
      hg.hostCtx._private = true; var priv = hg.host.send('probe', { n: 5 }) === false;
      T.check('core_two_instances_bus', early && arrived && limited && ok2 === true && got[got.length - 1] === 999 && priv && hg.host.isHost() && !hg.host.isGuest() && hg.guest.isGuest() && !hg.guest.isHost());
    });
    S('core_sync_live_follows_host', function () {
      var hg = kit.makeHostGuest({ latencyMs: 40 });
      hg.bus.a.send('gizmos', { live: true }); hg.step(0.1);
      var follows = hg.guest.isLive() === true;
      hg.bus.a.send('gizmos', { live: 'yes' }); hg.step(0.1);
      var rejects = hg.guest.isLive() === true;
      hg.bus.b.send('gizmos', { live: true }); hg.step(0.1);
      T.check('core_sync_live_follows_host', follows && rejects && hg.host.isLive() === false && hg.guestCtx.storage.get('jb_gizmonext_atelier_v1') === null);
    });

    /* ---- guests ---- */
    S('core_guest_persists_nothing', function () {
      var gst = mk({ guest: true }), host = mk();
      gst.api.fromJSON({ items: [{ x: 1 }] }); gst.g.setLive(true); gst.g.load({ v: 1, live: true, kinds: { demo: { items: [{}] } } }); gst.g.putFile('clip', 'abc');
      host.api.add({ x: 1 }); var saved = host.ctx.storage.get('jb_gizmonext_atelier_v1');
      T.check('core_guest_persists_nothing', Object.keys(gst.ctx.storage._m).length === 0 && !!saved && JSON.parse(saved).kinds.demo.items.length === 1 && host.g.putFile('clip', 'abc') === true && host.g.getFile('clip') === 'abc');
    });
    S('core_guest_cannot_place_or_delete', function () {
      var gst = mk({ guest: true }), r = gst.api.add({}), e = { kind: 'demo', id: r.id };
      T.check('core_guest_cannot_place_or_delete', gst.g.entries([]).length === 0 && gst.g.addAt('demo', { x: 0, y: 1, z: 0 }) === null && gst.g.dup(e, null, '') === null && gst.g.del(e) === null && gst.g.restore('demo', { id: 'zz' }) === null &&
        gst.api.list.length === 1 && gst.g.addNearHead('demo') === null && gst.api.markersOn() === false && r._mk.visible === false);
    });

    /* ---- parts ---- */
    S('core_parts_order_and_missing_need', function () {
      kit.disposeAll();
      var log = [];
      GN.register('t_b', { needs: ['t_a'] }, function (g) { log.push('make b'); return { init: function () { log.push('init b'); }, state: function () { return { b: 1 }; }, load: function (s) { log.push('load b ' + JSON.stringify(s)); }, reset: function () { log.push('reset b'); }, tick: function () { log.push('tick b'); }, onLive: function (on) { log.push('live b ' + on); } }; });
      GN.register('t_a', {}, function (g) { log.push('make a'); return { init: function () { log.push('init a'); }, alwaysTick: true, tick: function () { log.push('tick a'); } }; });
      GN.register('t_c', { needs: ['zzz'] }, function () { log.push('make c'); return {}; });
      var g = kit.makeInst({ log: null });
      var order = Object.keys(g.modules).join(), made = log.slice(0, 4).join();
      g.tick(0.016); var offTicks = log.filter(function (x) { return x.indexOf('tick') === 0; }).join();
      g.setLive(true); g.tick(0.016);
      var st = g.state(), partsSaved = st.parts.t_b && st.parts.t_b.b === 1 && st.parts.t_a === undefined;
      g.load({ v: 1, parts: { t_b: { k: 2 } } }); var loaded = log.indexOf('load b {"k":2}') >= 0;
      g.load(null); var legacy = log.filter(function (x) { return x === 'reset b'; }).length >= 2;
      var warned = g.warnings.some(function (w) { return w.indexOf('t_c needs zzz') >= 0; }) && !g.modules.t_c;
      ['t_a', 't_b', 't_c'].forEach(unreg);
      T.check('core_parts_order_and_missing_need', order === 't_a,t_b' && made === 'make a,make b,init a,init b' && offTicks === 'tick a' && log.indexOf('live b true') >= 0 && log.filter(function (x) { return x === 'tick b'; }).length === 1 && partsSaved && loaded && legacy && warned);
    });
    S('core_late_part_and_orphan_state_kept', function () {
      kit.disposeAll();
      var g = kit.makeInst(), got = [];
      g.load({ v: 1, live: false, kinds: { late: { items: [{ x: 4, name: 'Later' }] } }, parts: { t_late: { n: 5 } } });
      var kept = g.state().kinds.late.items.length === 1 && g.state().parts.t_late.n === 5;
      GN.register('t_late', {}, function (gg) { gg.defineKind({ id: 'late', name: 'Late box' }); return { load: function (s) { got.push(s); }, state: function () { return { n: 5 }; } }; });
      var rec = g.get('late', 'late1');
      var applied = !!rec && rec.x === 4 && rec.name === 'Later' && got.length === 1 && got[0].n === 5 && g.modules.t_late;
      unreg('t_late');
      T.check('core_late_part_and_orphan_state_kept', kept && applied);
    });
    S('core_install_attaches_modules_and_loads_storage', function () {
      kit.disposeAll();
      var had = GN.inst, seed = kit.makeInst(); seed.defineKind(kit.countingKind('demo').spec); seed.api = seed.get;
      var store = kit.makeStorage(); store.set('jb_gizmonext_atelier_v1', JSON.stringify({ v: 1, live: false, kinds: { demo: { items: [{ x: 7 }] } }, parts: {} }));
      GN.register('t_inst', {}, function (g) { g.defineKind(kit.countingKind('demo').spec); return { hello: function () { return 'hi'; } }; });
      GN.register('sync', {}, function () { return { fake: 1 }; });
      var g = GN.install(kit.makeCtx({ storage: store }));
      var ok = GN.inst === g && GN.t_inst && GN.t_inst.hello() === 'hi' && GN.ready === true && GN.has('demo') && GN.get('demo', 'demo1') && GN.get('demo', 'demo1').x === 7 && g.isLive() === false &&
        GN.sync.parts().indexOf('gizmos') >= 0 && GN.sync.fake === undefined && g.warnings.some(function (w) { return w.indexOf('sync') >= 0; }) && GN.entries([]).length === 1 && GN.isLive() === false && GN.setLive(true) === true && GN.version === '0.' + (1 + GN._registry.length);
      GN.tick(0.016);
      g.dispose(); GN.inst = had; delete GN.t_inst; unreg('t_inst'); unreg('sync');
      T.check('core_install_attaches_modules_and_loads_storage', !!ok);
    });

    /* ---- the rest of the contract ---- */
    S('core_set_moves_marker_and_validates', function () {
      var m = mk(null, { validate: function (r) { return r.name !== 'bad'; } }), ch = [];
      m.g.on('kind-change', function (p) { ch.push(p.id); });
      var r = m.api.add({ name: 'ok' }), bad = m.api.add({ name: 'bad' });
      m.api.set(r.id, { x: 3, yaw: 1, size: [2, 2, 2] });
      var marker = r._mk, moved = near(marker.position.x, 3) && near(marker.rotation.y, 1) && near(r._mk.children[1].geometry.parameters.width, 2);
      var rej = m.api.set(r.id, { name: 'bad' });
      T.check('core_set_moves_marker_and_validates', bad === null && moved && rej === null && r.name === 'ok' && ch.length === 1 && m.api.set('nope', {}) === null);
    });
    S('core_missing_ctx_fields_ok', function () {
      var threw = false, g = null, rec = null;
      try {
        g = kit.track(GN.create({})); kit.track(GN.create()); kit.track(GN.create(null));
        var api = g.defineKind(kit.countingKind('demo').spec);
        rec = api.add({ x: 1 }); api.set(rec.id, { x: 2 }); api.commit(rec.id);
        g.setLive(true); g.tick(0.016); g.tick(); g.entries([]); g.rows({ kind: 'demo', id: rec.id }, {}); g.state(); g.load(g.state()); g.say('hi'); g.thumb('demo'); g.mountPanel(null);
        g.sync.encodeAll({}); g.send('x', {}); g.persist(); g.loadFromStorage(); g.putFile('a', 'b'); g.getFile('a'); g.head(); g.floorAt(1, 2); g.peers(); g.addNearHead('demo');
      } catch (e) { threw = true; }
      T.check('core_missing_ctx_fields_ok', !threw && !!rec && rec._mk === null && g.isLive() === true && g.head() === null && g.floorAt(1, 2) === 0 && g.peers().length === 0 && g.entries([]).length === 0);
    });
    S('core_thumb', function () {
      var m = mk(), has = typeof document !== 'undefined' && !!document.createElement;
      var t = m.g.thumb('demo'), off = m.g.thumb('demo', true);
      T.check('core_thumb', has ? (!!t && t.width === 112 && t !== off && m.g.thumb('demo') === t) : (t === null && m.g.thumb('none') === null));
    });
    S('core_stub_orient_box_math', function () {
      var TH3 = kit.THREE, g = new TH3.Group(); g.position.set(1, 2, 3); g.rotation.y = Math.PI / 2; g.scale.set(2, 1, 1);
      var c = new TH3.Mesh(new TH3.SphereGeometry(0.5, 8, 8)); c.position.set(0, 0, -1); g.add(c); g.updateMatrixWorld(true);
      var w = c.getWorldPosition(new TH3.Vector3());
      var inv = g.matrixWorld.clone().invert(), o = new TH3.Vector3(1, 2, 3).applyMatrix4(inv);
      var p = new TH3.Vector3(), q = new TH3.Quaternion(), s = new TH3.Vector3(); g.matrixWorld.clone().decompose(p, q, s);
      var box = new TH3.Mesh(new TH3.BoxGeometry(2, 2, 2)); box.position.set(0, 0, -5); box.rotation.y = Math.PI / 4; box.updateMatrixWorld(true);
      var h = new TH3.Raycaster(new TH3.Vector3(0, 0, 0), new TH3.Vector3(0, 0, -1)).intersectObject(box, false);
      var e = new TH3.Euler().setFromQuaternion(g.quaternion, 'YXZ');
      T.check('core_stub_orient_box_math', near(w.x, 0, 1e-9) && near(w.y, 2, 1e-9) && near(w.z, 3, 1e-9) && near(o.x, 0, 1e-9) && near(o.y, 0, 1e-9) && near(o.z, 0, 1e-9) && near(s.x, 2, 1e-9) && near(p.x, 1, 1e-9) &&
        h.length === 1 && near(h[0].distance, 5 - Math.SQRT2, 1e-9) && near(e.y, Math.PI / 2, 1e-9));
    });
    S('core_file_storage', function () {
      var m = mk(), big = new Array(1000002).join('x');
      var a = m.g.putFile('clip a', 'data'), b = m.g.putFile('big', big), said = m.ctx._said[m.ctx._said.length - 1] || '';
      T.check('core_file_storage', a === true && m.g.getFile('clip a') === 'data' && b === false && m.g.getFile('big') === null && said.indexOf('Too long') >= 0 && m.g.fileKey('clip a') === 'jb_gizmonext_file_clip_a');
    });

    /* ---- cost and her copy ---- */
    S('core_tick_cost', function () {
      var m = mk(), i;
      for (i = 0; i < 12; i++) m.api.add({ armed: true, x: i });
      m.g.setLive(true);
      for (i = 0; i < 50; i++) m.g.tick(1 / 60);
      var t0 = kit.ms();
      for (i = 0; i < 1000; i++) m.g.tick(1 / 60);
      var per = (kit.ms() - t0) / 1000;
      T.value('core_tick_cost_ms', per.toFixed(5));
      T.check('core_tick_cost', per < 0.05 && m.K.counts.frame === 12 * 1050);
    });
    S('core_no_em_dash_in_strings', function () {
      var m = mk(), r = m.api.add({}), e = entryOf(m.g, r.id), strs = [];
      m.g.registerPage({ id: 'p', title: 'A ' + DASH + ' B', rows: function () { return [{ label: 'x ' + EN + ' y' }]; } });
      m.g.say('one ' + DASH + ' two'); m.g.rows(e, {}).forEach(function (x) { strs.push(x.label); });
      m.g.pages().forEach(function (p) { strs.push(p.title, p.label); }); m.g.pageRows('p', {}).forEach(function (x) { strs.push(x.label); });
      var api2 = m.g.defineKind(kit.countingKind('other', { max: 1 }).spec); api2.add({}); api2.add({});
      m.ctx._said.forEach(function (x) { strs.push(x); }); strs.push(m.api.spec.name, m.api.spec.plural, r.name);
      var dom = kit.makeFakeDom(), el = dom.createElement('div'); m.g.mountPanel(el); strs.push(kit.domText(el));
      var clean = strs.length > 8 && strs.every(function (x) { return String(x).indexOf(DASH) < 0 && String(x).indexOf(EN) < 0; });
      var srcClean = true, scanned = 0;
      if (kit.inNode) {
        var fs = require('fs'), path = require('path'), dir = __dirname;
        fs.readdirSync(dir).filter(function (f) { return /\.(js|html|md|json|txt)$/.test(f); }).forEach(function (f) { scanned++; if (fs.readFileSync(path.join(dir, f), 'utf8').indexOf(DASH) >= 0) { srcClean = false; T.value('core_em_dash_found_in', f); } });
      }
      T.check('core_no_em_dash_in_strings', clean && srcClean && (!kit.inNode || scanned >= 4));
    });
  }

  var mod = { stage: 'G0', section: 'core', run: run };
  if (inNode) {
    module.exports = mod;
    if (require.main === module) { var kit = require('./gizmo_next_testkit.js'); var T = kit.makeT(); run(T, kit); T.finish(); }
  } else { (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).G0 = mod; }
})();
