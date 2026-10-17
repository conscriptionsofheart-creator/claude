/* gizmo_next_small_selftest.js: the checks for stage H11 (seven small gaps). Pure logic, three.js stub, no headset.
   node gizmo_next_selftest.js --only=small     or the demo page.   "name: 1" is a pass, "name: 0" a fail, other numbers are measurements. */
(function () {
  'use strict';
  var inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  var fs = inNode ? require('fs') : null, path = inNode ? require('path') : null;
  if (inNode) require('./gizmo_next_small.js');

  function run(T, kit) { return kit.isolate(function () { kit.GizmoNext._beatsRegister(); kit.GizmoNext._actionsRegister(); kit.GizmoNext._smallRegister(); return runAll(T, kit); }); }
  function runAll(T, kit) {
    var G = kit.GizmoNext, P = G.smallPure;
    var DASH = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
    var S = function (n, fn) { T.section(n, fn); };
    var near = function (a, b, e) { return Math.abs(a - b) <= (e === undefined ? 1e-6 : e); };
    var cl = function (v) { return JSON.parse(JSON.stringify(v)); };
    var hasDash = function (s) { return String(s).indexOf(DASH) >= 0 || String(s).indexOf(EN) >= 0; };

    function rig(o) {
      o = o || {};
      var clock = kit.makeClock(), calls = [], lights = o.lights || [];
      var g = kit.makeInst({
        clock: clock, guest: !!o.guest, lights: undefined,
        openScene: o.noOpen ? undefined : function (n) { calls.push(['open', n]); },
        sharedScenes: function () { return o.shared || ['Garden']; }, sceneList: function () { return ['Garden', 'Cellar', 'Roof']; },
        camera: o.camera === null ? undefined : { shot: function (n, opts) { calls.push(['shot', n, opts, clock.now()]); }, shots: o.shots === null ? undefined : function () { return o.shots || ['wide', 'close', 'door']; }, fade: function (a) { calls.push(['fade', a]); } },
        sounds: { set: function (id, p) { calls.push(['sound', id, p]); } }
      });
      g._ctx.lights = function () { return lights; };
      var R = { g: g, S: g.modules.small, A: g.modules.actions, B: g.modules.beats, calls: calls, lights: lights, clock: clock, ctx: g._ctx };
      R.step = function (sec) { return kit.stepSeconds(g, sec); };
      R.live = function () { g.setLive(true); return R; };
      return R;
    }

    S('text_cap_1000', function () {
      var R = rig(), t = R.S.text.add({ text: 'x'.repeat(1500) }), t0 = t.text.length, via = R.S.text.setText(t.id, 'y'.repeat(2000)), len = R.S.text.get(t.id).text.length;
      var back = rig(); back.g.load(cl(R.g.state())); var again = back.S.text.list ? 0 : back.g._kinds.text.api.list[0].text.length;
      var nl = R.S.text.setText(t.id, 'one\ntwo\r\nthree' + String.fromCharCode(7)); var ok = R.S.text.get(t.id).text;
            T.check('text_cap_1000', t0 === 1000 && len === 1000 && again === 1000 && R.S.text.cap === 1000 && ok === 'one\ntwo\nthree');
    });
    S('text_autofit_shrinks_to_box', function () {
      var R = rig(), a = P.layout('Hi', 1.2, 0.5, { autoFit: true }), b = P.layout('This is a much longer line of words that has to fit inside the same small box without spilling out', 1.2, 0.5, { autoFit: true });
      var tiny = P.layout('This is a much longer line of words that has to fit', 0.3, 0.1, { autoFit: true }), huge = P.layout('x'.repeat(1000), 1.2, 0.5, { autoFit: true });
      var fits = function (l) { return l.lines.length * l.font * 1.15 <= l.height + 1e-6; };
      var t = R.S.text.add({ text: 'Hi' }); R.step(0.1); var f1 = R.S.text.layoutOf(t.id).font; R.S.text.setText(t.id, 'This is a much longer line of words that has to fit inside the same small box without spilling out'); R.step(0.1); var f2 = R.S.text.layoutOf(t.id).font;
      T.check('text_autofit_shrinks_to_box', b.font < a.font && fits(a) && fits(b) && !b.overflow && tiny.font < b.font && huge.font === 8 && f2 < f1 && P.layout('', 1, 1, {}).lines.length === 1 && P.layout(null, 1, 1, {}).font > 0);
    });
    S('text_fixed_font_does_not_shrink', function () {
      var small = P.layout('A fairly long sentence that will not fit at a big size', 0.5, 0.2, { autoFit: false, fontSize: 96 }), ok = P.layout('Hi', 1.2, 0.5, { autoFit: false, fontSize: 48 });
      var clampLo = P.layout('x', 1, 1, { autoFit: false, fontSize: 1 }), clampHi = P.layout('x', 1, 1, { autoFit: false, fontSize: 9999 });
      T.check('text_fixed_font_does_not_shrink', small.font === 96 && small.overflow === true && ok.font === 48 && ok.overflow === false && clampLo.font === 8 && clampHi.font === 200);
    });
    S('text_visible_toggle', function () {
      var R = rig(), t = R.S.text.add({ text: 'Open' }); R.step(0.1); var shown = R.S.text.plane(t.id).visible;
      R.S.text.kind.set(t.id, { visible: false }); R.step(0.1); var hidden = R.S.text.plane(t.id).visible; R.S.text.kind.set(t.id, { visible: true }); R.step(0.1);
      var rows = R.g._kinds.text.spec.rows(R.S.text.get(t.id), { say: function () {}, redraw: function () {} }), vis = rows.filter(function (r) { return /^Visible/.test(r.label); })[0]; vis.act(); R.step(0.1);
      T.check('text_visible_toggle', shown === true && hidden === false && R.S.text.plane(t.id).visible === false && /^Visible: on/.test(vis.label));
    });
    S('text_stays_when_gizmos_hidden', function () {
      var R = rig(), t = R.S.text.add({ text: 'Stay' }), rec = R.S.text.get(t.id); R.step(0.1);
      R.ctx.gizmos.setAll(true); R.step(0.1); var box = rec._mk.visible, plane = R.S.text.plane(t.id).visible, inMk = R.S.text.plane(t.id).parent === rec._mk;
      R.S.text.kind.remove(t.id); R.step(0.1);
      T.check('text_stays_when_gizmos_hidden', box === false && plane === true && inMk === false && R.S.text.plane(t.id) === null);
    });
    S('text_no_em_dash_in_defaults', function () {
      var R = rig(), t = R.S.text.add({ text: 'Left ' + DASH + ' right ' + EN + ' up' }), rec = R.S.text.get(t.id), said = [];
      var txt = rec.text, labels = R.g._kinds.text.spec.rows(rec, { say: function (x) { said.push(x); }, redraw: function () {} }).map(function (r) { return r.label; }), d = R.g._kinds.text.spec.defaults();
      R.g._kinds.text.spec.rows(rec, { say: function (x) { said.push(x); }, redraw: function () {} }).forEach(function (r) { r.act(); });
      var f = R.g._kinds.text.spec.fields.map(function (x) { return x.label; });
      T.check('text_no_em_dash_in_defaults', !hasDash(d.text) && !hasDash(txt) && /Left, right, up/.test(txt) && labels.concat(said, f, [R.S.text.get(t.id).text]).every(function (l) { return !hasDash(l); }));
    });
    S('door_refuses_unshared_scene_for_guest', function () {
      var H = kit.makeHostGuest({ host: { sharedScenes: function () { return ['Garden']; }, sceneList: function () { return ['Garden', 'Cellar']; }, openScene: function () {} }, guest: { sharedScenes: function () { return ['Garden']; } } });
      var opened = []; H.guestCtx.openScene = function (n) { opened.push(n); }; H.hostCtx.openScene = function (n) { opened.push('host:' + n); };
      var a = H.host.modules.small.door.add({ sceneName: 'Garden', thumbKey: 'Garden' }), b = H.host.modules.small.door.add({ sceneName: 'Cellar' });
      H.host.setLive(true); H.step(0.2);
      var gd = H.guest.modules.small.door, gl = H.guest.modules.small;
      H.guest.load(cl(H.host.state())); H.guest.setLive(true);
      var gids = H.guest._kinds.door.api.list.map(function (r) { return r.id; });
      var shared = gd.go(gids[0]), unshared = gd.go(gids[1]), msg = H.guestCtx._said.slice(-1)[0];
      T.check('door_refuses_unshared_scene_for_guest', gd.visibleFor(gids[0], true) === true && gd.visibleFor(gids[1], true) === false && shared === true && unshared === false && /not shared/.test(msg) && opened.join() === 'Garden' && gd.add({}) === null && gd.setScene(gids[0], 'Cellar') === null);
    });
    S('door_go_disabled_until_live', function () {
      var R = rig(), d = R.S.door.add({ sceneName: 'Garden' });
      var off = R.S.door.go(d.id), m1 = R.ctx._said.slice(-1)[0], can0 = R.S.door.canGo(d.id); R.live(); var on = R.S.door.go(d.id), can1 = R.S.door.canGo(d.id);
      var blank = R.S.door.add({}), nb = R.S.door.go(blank.id);
      var rows = R.g._kinds.door.spec.rows(R.S.door.get(d.id), { say: function () {}, redraw: function () {} });
      T.check('door_go_disabled_until_live', off === false && /Gizmos live/.test(m1) && can0 === false && on === true && can1 === true && nb === false && /^Go to Garden/.test(rows[0].label) && R.calls.filter(function (c) { return c[0] === 'open'; }).length === 1);
    });
    S('door_never_opens_on_its_own', function () {
      var R = rig().live(), d = R.S.door.add({ sceneName: 'Garden' });
      R.step(5); var saved = cl(R.g.state()); var N = rig(); N.g.load(saved); N.live(); N.step(5);
      var none = rig({ noOpen: true }).live(); var d2 = none.S.door.add({ sceneName: 'Garden' }); var r = none.S.door.go(d2.id);
      T.check('door_never_opens_on_its_own', R.calls.length === 0 && N.calls.length === 0 && r === false && /not connected/.test(none.ctx._said.slice(-1)[0]));
    });
    S('mats_patch_values_within_ranges', function () {
      var R = rig(), c = R.S.mats.check(), p = R.S.mats.patch();
      var out = R.S.mats.check({ junk: { name: 'x', b: 5, fr: 100, air: -1, ay: 99 } }), nameless = R.S.mats.check({ k: { b: 0.2, fr: 2, air: 0.1, ay: 0 } });
      var file = null; if (fs) { file = JSON.parse(fs.readFileSync(path.join(__dirname, 'objcfg_mats_patch.json'), 'utf8')); }
      T.check('mats_patch_values_within_ranges', c.ok && Object.keys(p).join() === 'softwood,superice' && p.softwood.b === 0.25 && p.softwood.fr === 6 && p.superice.fr === 0.15 && out.ok === false && out.bad.length >= 4 && nameless.ok === false && (file === null || JSON.stringify(file) === JSON.stringify(p)));
    });
    S('light_21_warns_20_does_not', function () {
      var mk = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: 'l' + i }); return a; };
      var R20 = rig({ lights: mk(20) }), R21 = rig({ lights: mk(21) });
      var a20 = R20.S.light.check(), a21 = R21.S.light.check(), w = R21.ctx._said.concat(R21.g.logList().map(function (e) { return e.what; })).join('|');
      var rows = R21.g.pageRows('small', { say: function () {}, redraw: function () {} }).map(function (r) { return r.label; });
      R21.lights.push({ id: 'x' }); R21.step(2.1); var again = R21.ctx._said.filter(function (t) { return /22 lights/.test(t); }).length;
      T.check('light_21_warns_20_does_not', a20.over === false && a21.over === true && R20.ctx._said.length === 0 && /21 lights/.test(w) && /no more than 20/.test(w) && /^This scene has 21 lights/.test(rows[0]) && again === 1 && P.lightAdvice(0).over === false && P.lightAdvice(NaN).count === 0);
    });
    S('mirror_bigger_radius_costs_more', function () {
      var R = rig(), d = P.mirrorCost({}), big = P.mirrorCost({ radius: 32 }), huge = P.mirrorCost({ radius: 64, nearRes: 1080, farRes: 1080, nearFps: 60, farFps: 60, nearLod: 1, farLod: 60 }), small = P.mirrorCost({ radius: 4 }), hi = P.mirrorCost({ nearRes: 720 }), fps = P.mirrorCost({ nearFps: 60 });
      var f = R.S.mirror.set('m1', { radius: 999, nearRes: 5, farRes: 9999, nearFps: 'x', farLod: 0.1 }), eq = P.equalScale([1, 2, 3]), eq2 = P.equalScale([0.5, 0.5, 0.5]), eq3 = P.equalScale(null);
      var saved = cl(R.g.state()), N = rig(); N.g.load(saved); var back = N.S.mirror.fields('m1'), G = rig({ guest: true }); var gs = G.S.mirror.set('m1', { radius: 2 });
      var rows = R.S.mirror.rows('m1', { say: function () {}, redraw: function () {} }); rows.forEach(function (r) { r.act(); });
      T.value('mirror_cost_default', d);
      T.check('mirror_bigger_radius_costs_more', d > 0 && d < 0.4 && big > d && small < d && huge > big && huge <= 1 && hi > d && fps > d && f.radius === 64 && f.nearRes === 120 && f.farRes <= f.nearRes && f.farLod >= f.nearLod && f.nearFps === 30 && eq.join() === '3,3,3' && eq2.join() === '0.5,0.5,0.5' && eq3.join() === '1,1,1' && back.radius === 64 && gs.radius === 16 && R.S.mirror.advice(2) !== '' && R.S.mirror.advice(1) === '' && /^Mirror cost/.test(rows[0].label));
    });
    S('camera_shot_names_validated', function () {
      var R = rig(), A = R.A, ok = A.add({ kind: 'camera', slot: 'scene', shot: 'wide', t: 1 }), bad = A.add({ kind: 'camera', slot: 'scene', shot: 'nope', t: 3 }), blank = A.add({ kind: 'camera', slot: 'scene', shot: '   ', t: 5 }), long = A.add({ kind: 'camera', slot: 'scene', shot: 'x'.repeat(60), t: 7 });
      var free = rig({ shots: null }), fr = free.A.add({ kind: 'camera', slot: 'scene', shot: 'anything', t: 1 }), none = rig({ camera: null }); 
      T.check('camera_shot_names_validated', !!ok && ok.shot === 'wide' && !bad && !blank && !long && !!fr && R.S.camera.valid('close') && !R.S.camera.valid('nope') && !R.S.camera.valid(5) && !R.S.camera.valid(null) && free.S.camera.valid('anything') && R.S.camera.shots().join() === 'wide,close,door' && none.S.camera.cut('wide') === false);
    });
    S('camera_cut_becomes_0_4s_fade', function () {
      var R = rig().live(), A = R.A, B = R.B;
      B.pinsSet([{ id: 'a', t: 0, slot: 'f1', kind: 'pose', pose: { x: 0 } }, { id: 'b', t: 8, slot: 'f1', kind: 'pose', pose: { x: 1 } }]);
      var p = A.add({ kind: 'camera', slot: 'scene', shot: 'wide', t: 1 }), q = A.add({ kind: 'camera', slot: 'scene', shot: 'close', t: 1.1 }), r = A.add({ kind: 'camera', slot: 'scene', shot: 'door', t: 1.2 });
      var spread = A.clamp([{ id: 'x', kind: 'camera', t: 1, slot: 's', shot: 'wide' }, { id: 'y', kind: 'camera', t: 1.1, slot: 's', shot: 'close' }, { id: 'z', kind: 'camera', t: 1.2, slot: 's', shot: 'door' }]);
      var gaps = spread.beats.map(function (b) { return b.t; }); 
      B.play(0); R.step(2.5); B.stop();
      var shots = R.calls.filter(function (c) { return c[0] === 'shot'; }), fades = R.calls.filter(function (c) { return c[0] === 'fade'; }).map(function (c) { return c[1]; });
      var worst = 0, last = 0, cnt = 0; for (var t = 0; t <= 0.5 + 1e-9; t += 1 / 60) { var a = P.shotFade(t); worst = Math.max(worst, Math.abs(a - last) * 60); last = a; if (a > 0) cnt++; }
      T.value('camera_fade_worst_per_s', Math.round(worst * 1000) / 1000);
      T.check('camera_cut_becomes_0_4s_fade', shots.length === 3 && shots[0][2].fadeSec === 0.4 && A.hold(B.get(p.id)) === 0.4 && worst <= 2.5 + 1e-6 && P.shotFade(0) === 0 && P.shotFade(0.4) === 0 && near(P.shotFade(0.2), 0.5, 1e-9) && P.shotFade(-1) === 0 && P.shotFade(NaN) === 0 && gaps[1] - gaps[0] >= 0.4 - 1e-9 && gaps[2] - gaps[1] >= 0.4 - 1e-9 && fades.length > 10 && Math.max.apply(null, fades) <= 0.5 + 1e-9 && fades[fades.length - 1] === 0 && spread.changed === true);
    });
    S('sound_pitch_min_distance_clamps_and_calls', function () {
      var R = rig(), a = R.S.sound.set('s1', { pitch: 9, minDistance: 0.001, fade: 0.01 }), b = R.S.sound.set('s1', { pitch: 0.1, minDistance: 99, fade: 99 }), c = R.S.sound.set('s1', { pitch: 'x' });
      var calls = R.calls.filter(function (x) { return x[0] === 'sound'; }), hostile = R.S.sound.set('../x', { pitch: 2 });
      var rows = R.S.sound.rows('s1', { say: function () {}, redraw: function () {} }), labels = rows.map(function (r) { return r.label; });
      R.S.sound.set('s1', { pitch: 1 }); rows = R.S.sound.rows('s1', { say: function () {}, redraw: function () {} }); rows.filter(function (r) { return r.label === 'Pitch up'; })[0].act(); var up = R.S.sound.fields('s1').pitch;
      rows = R.S.sound.rows('s1', { say: function () {}, redraw: function () {} }); rows.filter(function (r) { return r.label === 'Pitch down'; })[0].act(); rows = R.S.sound.rows('s1', { say: function () {}, redraw: function () {} }); rows.filter(function (r) { return r.label === 'Pitch down'; })[0].act(); var down = R.S.sound.fields('s1').pitch;
      for (var i = 0; i < 40; i++) { rows = R.S.sound.rows('s1', { say: function () {}, redraw: function () {} }); rows.filter(function (r) { return r.label === 'Pitch up'; })[0].act(); }
      var top = R.S.sound.fields('s1').pitch; var G = rig({ guest: true });
      T.check('sound_pitch_min_distance_clamps_and_calls', a.pitch === 2 && a.minDistance === 0.1 && a.fade === 0.4 && b.pitch === 0.5 && b.minDistance === 20 && b.fade === 10 && c.pitch === 0.5 && calls.length === 3 && calls[0][2].pitch === 2 && calls[0][1] === 's1' && hostile.pitch === 1 && labels.indexOf('Pitch down') > 0 && labels.indexOf('Pitch up') > 0 && /^Min distance/.test(labels[3]) && /0.4 or more/.test(labels[4]) && near(up, 1.0595, 1e-3) && near(down, 0.944, 2e-3) && top === 2 && G.S.sound.set('s1', { pitch: 2 }).pitch === 1);
    });
    S('small_json_roundtrip_and_guest_blocked', function () {
      var R = rig().live(), t = R.S.text.add({ text: 'Keep me', autoFit: false, fontSize: 72 }), d = R.S.door.add({ sceneName: 'Garden' }); R.S.mirror.set('m1', { radius: 8 }); R.S.sound.set('s1', { pitch: 1.5, fade: 2 });
      var saved = cl(R.g.state()), N = rig(); N.g.load(saved); N.step(0.5);
      var tt = N.S.text.get(t.id), dd = N.S.door.get(d.id), again = cl(N.g.state());
      var junk = rig(); junk.g.load({ v: 1, kinds: { text: { items: [{ text: 5, fontSize: 'x', size: 'y' }] }, door: { items: [{ sceneName: {} }] } }, parts: { small: { mirrors: { '../x': { radius: 9 }, ok: { radius: 'z' } }, sounds: 'nope' } } });
      var G = rig({ guest: true });
      T.check('small_json_roundtrip_and_guest_blocked', tt.text === 'Keep me' && tt.autoFit === false && tt.fontSize === 72 && dd.sceneName === 'Garden' && N.S.mirror.fields('m1').radius === 8 && N.S.sound.fields('s1').pitch === 1.5 && N.S.sound.fields('s1').fade === 2 && N.calls.length === 0 && JSON.stringify(again.parts.small) === JSON.stringify(saved.parts.small) && junk.S.mirror.fields('../x').radius === 16 && junk.S.mirror.fields('ok').radius === 16 && G.S.text.add({}) === null && G.S.door.add({}) === null && G.S.text.setText('x', 'y') === null);
    });
    S('small_labels_no_em_dash', function () {
      var R = rig().live(), said = [], H = { say: function (t) { said.push(t); }, redraw: function () {} }, all = [];
      var t = R.S.text.add({}), d = R.S.door.add({ sceneName: 'Garden' });
      [['text', t.id], ['door', d.id]].forEach(function (k) { var kind = R.g._kinds[k[0]]; kind.spec.rows(kind.api.get(k[1]), H).forEach(function (r) { all.push(r.label); r.act(); }); all.push(kind.spec.name, kind.spec.plural); kind.spec.fields.forEach(function (f) { all.push(f.label); }); });
      R.S.mirror.rows('m', H).concat(R.S.sound.rows('s', H)).forEach(function (r) { all.push(r.label); r.act(); });
      all.push(R.S.light.advice ? P.lightAdvice(21).message : '', P.lightAdvice(3).message, R.S.mirror.advice(3)); R.g.pageRows('small', H).forEach(function (r) { all.push(r.label); });
      Object.keys(P.matsPatch).forEach(function (k) { all.push(P.matsPatch[k].name); });
      T.check('small_labels_no_em_dash', all.length > 25 && all.concat(said, R.ctx._said).every(function (l) { return !hasDash(l); }));
    });
  }

  var api = { stage: 'H11', section: 'small', run: run };
  if (inNode) module.exports = api;
  else if (typeof window !== 'undefined') (window.GizmoNextSelftests = window.GizmoNextSelftests || {}).H11 = api;
})();
